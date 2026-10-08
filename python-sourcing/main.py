"""
Evidence-only brand sourcing engine -- no LLM anywhere in this file.

What this replaces from the Claude pipeline: the discovery searches and the mechanical
dedup/category checks (via the app's own evaluate-candidate API).

What this does NOT replace, on purpose: judging ownership structure, judging whether a
heritage story is credible, and judging packaging -- none of that is possible without
something that can actually read and reason about prose, which is exactly the part this
script deliberately leaves out. Every candidate this script produces is left as "flag"
(needs human review) unless the deterministic evaluate-candidate check already rejects it
outright (hard category exclusion or an exact/high-confidence duplicate of an existing
brand) -- never "pass", because no automated judgment was made here.

Daily-run design (added after real feedback that a fixed query list run start-to-finish
every day just re-asks a search engine the same questions, which answers near-identically
day after day -- every "new" candidate on day 2+ gets deduped away against day 1's own
finds, so day 2 onward produces ~0 real new candidates): this run resumes from a saved
per-lane cursor instead of always starting at query #1 of every lane, and stops for the
day once DAILY_CANDIDATE_TARGET or DAILY_SEARCH_BUDGET is hit -- see
SourcingQueryLedger/SourcingLaneState/SourcingDailyBudget in prisma/schema.prisma.

Usage:
    python main.py [run_id] [backend]
(backend is "serper" (default) or "tavily" -- Serper and Tavily each have their own
free-tier quota and their own independent lane-cursor/daily-budget progress, see
SourcingLaneState/SourcingQueryLedger/SourcingDailyBudget in prisma/schema.prisma, so
running one never advances or retires the other's state. invoked by the Node Server
Action in src/app/brands/sourcing/python-actions.ts, which passes the SourcingRun id it
already created so the UI can start polling immediately; running it bare from a terminal
for manual testing still works, and creates its own run.)
"""

import sys
import time
from datetime import date
from difflib import SequenceMatcher
from urllib.parse import urlparse

# When Node spawns this with piped stdout/stderr (not a real console), Windows defaults
# the stream encoding to the system codepage (e.g. cp949 on Korean Windows) instead of
# UTF-8 -- printing an em-dash or any Korean text (both used throughout this pipeline)
# then crashes with a UnicodeEncodeError. Force UTF-8 so it never depends on the caller's
# console setup.
sys.stdout.reconfigure(encoding="utf-8", errors="replace")
sys.stderr.reconfigure(encoding="utf-8", errors="replace")

BACKEND = sys.argv[2] if len(sys.argv) > 2 else "serper"
if BACKEND not in ("serper", "tavily"):
    print(f"[fatal] unknown backend '{BACKEND}' -- expected 'serper' or 'tavily'", file=sys.stderr)
    sys.exit(1)

from categories import BUCKETS

if BACKEND == "tavily":
    from tavily_search import search
else:
    from serper_search import search

from name_filter import (
    URL_FILTERS,
    domain_matches_name,
    generic_overlap_only,
    guess_brand_name,
    is_plausible_brand_name,
    strip_shop_words,
)
from site_profile import build_profile, judge, resolved_name
from korea_check import KOREA_QUERY_TEMPLATES, check_korea_presence, classify_korea_status

KOREA_CALLS_PER_CHECK = len(KOREA_QUERY_TEMPLATES)
from brand_rules import category_signal, ownership_signal, known_parent_in_name
from known_brands import known_excluded_brand, normalize_brand_name
from country_guess import guess_country_from_domain
from evaluate_client import evaluate_candidate
from roster_harvest import harvest_names
from brand_resolve import resolve_site
from query_generator import next_query
from db import (
    get_connection,
    create_sourcing_run,
    insert_candidate,
    update_run_progress,
    get_or_create_daily_budget,
    update_daily_budget,
    get_lane_state,
    save_lane_state,
    is_query_retired,
    record_query_result,
    add_search_usage,
    get_lane_ledger,
)
from config import (
    DAILY_CANDIDATE_TARGET_SERPER,
    DAILY_CANDIDATE_TARGET_TAVILY,
    DAILY_SEARCH_BUDGET_SERPER,
    DAILY_SEARCH_BUDGET_TAVILY,
)

DAILY_SEARCH_BUDGET = DAILY_SEARCH_BUDGET_TAVILY if BACKEND == "tavily" else DAILY_SEARCH_BUDGET_SERPER
DAILY_CANDIDATE_TARGET = DAILY_CANDIDATE_TARGET_TAVILY if BACKEND == "tavily" else DAILY_CANDIDATE_TARGET_SERPER


def methodology_label(bucket: dict) -> str:
    """categories.py's bucket "label" is just a short country/region name (e.g.
    "Japan") -- this prefixes the backend that actually found it (e.g. "Serper ·
    Japan") for display in the results table's methodology column, without needing
    categories.py itself to know anything about which backend is running."""
    suffix = " (자동)" if bucket.get("dynamic") else ""
    return f"{BACKEND.capitalize()} · {bucket['label']}{suffix}"


def similarity(a: str, b: str) -> float:
    # Legal-suffix-aware, same normalization the parallel Claude-pipeline's own dedup
    # script uses (see its handoff doc §7) -- without stripping "Ltd"/"S.p.A."/"GmbH"
    # etc, "Wedel" and "Wedel Sp. z o.o." would score below the 0.84 cutoff and both
    # get kept as if they were different companies.
    return SequenceMatcher(None, normalize_brand_name(a), normalize_brand_name(b)).ratio()


def dedupe_pooled(candidates: list[dict]) -> list[dict]:
    kept = []
    for c in candidates:
        if not any(similarity(c["name"], k["name"]) >= 0.84 for k in kept):
            kept.append(c)
    return kept


def dedupe_by_site(candidates: list[dict]) -> list[dict]:
    """One candidate per website host: two results from the same site under different
    titles ("Praline Pecans" product page + the homepage) are the same brand."""
    kept, seen = [], set()
    for c in candidates:
        host = urlparse(c.get("website") or "").netloc.lower().removeprefix("www.")
        if host and host in seen:
            continue
        seen.add(host)
        kept.append(c)
    return kept


class Progress:
    """Tracks today's target/budget progress + running counts and pushes them to
    SourcingRun.progress on every step, so the /brands/sourcing page can poll and show a
    live status instead of only finding out what happened after the whole script exits."""

    def __init__(self, conn, run_id: str, search_used: int, candidates_out: int):
        self.conn = conn
        self.run_id = run_id
        self.search_used = search_used
        self.candidates_out = candidates_out
        self.stopped_by: str | None = None
        self.website_scraped = 0
        self.korea_checked = 0
        self.rejected = 0
        self.flagged = 0
        self.errors = 0
        self.skipped_crawl = 0  # rejected by the free checks before it would have needed a crawl
        self.duplicates_skipped = 0  # already-known (existing brand / earlier candidate) -- not even inserted
        self.duplicate_names: list[str] = []  # which candidates, not just how many -- the count alone isn't reviewable
        # Per-reason count of raw search results dropped before ever becoming a
        # candidate (blocked_domain/retailer_listing/article_page/recipe_page/
        # parked_page/adult_content/portal_page/no_name/domain_mismatch) -- these never
        # left any trace before, making it impossible to tell "filters too strict" from
        # "filters too loose" except by re-reading whatever did survive.
        self.filter_drops: dict[str, int] = {}
        # Funnel counts -- how many raw results survive each successive stage, cumulative
        # across the whole run. filter_drops already has the per-reason breakdown; these
        # are the plain stage totals the 2-stage-redesign baseline doc asks for, so
        # "did stage N or stage N+1 kill most of the candidates" is a single glance
        # instead of summing filter_drops by hand.
        self.raw_results = 0
        self.after_url_filters = 0
        self.after_name = 0
        self.after_domain = 0
        # roster ("kind": "roster" queries, see categories.py) -- the 2-stage harvest
        # path's own funnel, kept separate from the discovery counters above since they
        # measure a completely different pipeline (list page -> names -> resolved sites,
        # not search result -> candidate).
        self.roster_pages_found = 0
        self.roster_pages_harvested = 0  # looks_like_roster passed
        self.names_harvested = 0
        self.names_after_dedup = 0
        self.names_resolved = 0
        self.names_unresolved = 0
        self.stage = "running"

    def push(self) -> None:
        payload = {
            "stage": self.stage,
            "backend": BACKEND,
            "target": {"candidatesOut": self.candidates_out, "target": DAILY_CANDIDATE_TARGET},
            "budget": {"searchUsed": self.search_used, "budget": DAILY_SEARCH_BUDGET},
            "stoppedBy": self.stopped_by,
            "counts": {
                "discovered": self.candidates_out,
                "websitesScraped": self.website_scraped,
                "koreaChecked": self.korea_checked,
                "rejected": self.rejected,
                "flagged": self.flagged,
                "skippedCrawl": self.skipped_crawl,
                "duplicatesSkipped": self.duplicates_skipped,
            },
            "filterDrops": self.filter_drops,
            "duplicateNames": self.duplicate_names,
            "funnel": {
                "rawResults": self.raw_results,
                "afterUrlFilters": self.after_url_filters,
                "afterName": self.after_name,
                "afterDomain": self.after_domain,
            },
            "roster": {
                "pagesFound": self.roster_pages_found,
                "pagesHarvested": self.roster_pages_harvested,
                "namesHarvested": self.names_harvested,
                "namesAfterDedup": self.names_after_dedup,
                "namesResolved": self.names_resolved,
                "namesUnresolved": self.names_unresolved,
            },
            "errors": self.errors,
        }
        update_run_progress(self.conn, self.run_id, payload, status=("done" if self.stage == "done" else None))


def process_candidate(conn, run_id: str, bucket: dict, candidate: dict, progress: "Progress") -> tuple[bool, int]:
    """Runs the full evaluate/crawl/Korea-check pipeline for one discovered candidate,
    inserts it, and returns (is_new, search_calls_used) -- is_new means verdict=="flag"
    (a genuine, non-duplicate, non-excluded find worth a human's review); search_calls_used
    is how many Serper calls this candidate itself triggered (0 if pre-rejected/parked,
    2 if it reached the Korea-distribution check)."""
    search_calls = 0

    # A search hit is often one inner page (a blog post, one service page of a
    # company). The candidate is the SITE: normalize to its root so the relevance check
    # reads the whole site instead of judging one page, and so Brands stores the homepage.
    if candidate.get("website"):
        parsed_site = urlparse(candidate["website"])
        if parsed_site.scheme in ("http", "https") and parsed_site.netloc:
            candidate = {**candidate, "website": f"{parsed_site.scheme}://{parsed_site.netloc}/"}

    # Dedup + category are free (DB lookups / regex only) -- check them *before* spending
    # the expensive steps (site crawl, Korea search). The 8th manual round measured 24%
    # of raw candidates as already-known duplicates, so this ordering alone skips a
    # crawl+search pair for roughly a quarter of candidates.
    try:
        pre_evaluation = evaluate_candidate(
            {
                # Shop/online words stripped for the duplicate check only ("Lambertz Online"
                # is the web shop of the existing brand Lambertz).
                "name": strip_shop_words(candidate["name"]),
                "website": candidate["website"],
                "sku": bucket["category"],
                "methodology": methodology_label(bucket),
                # Best-effort ccTLD guess first (e.g. a .de domain -> Germany) -- falls
                # back to the bucket's own country (set on every bucket except "Awards",
                # which genuinely spans several) when the domain is a generic .com/.co/etc
                # that guess_country_from_domain deliberately refuses to guess from.
                # Every query in a country-specific bucket already targets that one
                # country, so this fallback is a known fact, not a guess -- without it,
                # the country column stayed blank for most .com-hosted candidates even
                # though the bucket that found them already knew.
                "country": guess_country_from_domain(candidate["website"]) or bucket.get("country"),
            }
        )
    except Exception as e:
        print(f"  [warn] evaluate-candidate call failed for '{candidate['name']}': {e}", file=sys.stderr)
        progress.errors += 1
        progress.skipped_crawl += 1
        progress.push()
        return False, search_calls

    verdict = pre_evaluation["verdict"]
    duplicates = pre_evaluation["duplicates"]

    # Already-known for CERTAIN -- an exact/high-confidence duplicate match (same
    # precedence evaluate.ts's evaluateCandidate uses), and not already superseded by a
    # category exclusion as the actual reject reason. Nothing new to review here, so
    # don't even insert it -- showing these in the review list (even correctly marked
    # "reject") reads as "why did this come back?" confusion to anyone other than
    # whoever already knows the history (e.g. Sakuraco resurfacing every run after it
    # was already added to Brands). A LOW-confidence duplicate hint (duplicates
    # non-empty but not exact/high) is deliberately NOT skipped here -- that's
    # evaluate.ts saying "possibly the same, a human should glance at it", and dropping
    # it silently would lose a real review signal, not just noise.
    has_certain_duplicate = any(d.get("matchType") == "exact" or d.get("confidence") == "high" for d in duplicates)
    if has_certain_duplicate and not pre_evaluation["categoryExcluded"]["excluded"]:
        d = duplicates[0]
        label = "existing brand" if d.get("source") == "brand" else "a previously found sourcing candidate"
        print(f"  - {candidate['name']} -> skipped (duplicate of {label}: {d['name']})")
        progress.duplicates_skipped += 1
        progress.duplicate_names.append(f"{candidate['name']} (dup of {label}: {d['name']})")
        progress.push()
        return False, search_calls

    reason_parts = []
    if pre_evaluation["categoryExcluded"]["excluded"]:
        reason_parts.append(pre_evaluation["categoryExcluded"]["reason"])
    if duplicates:
        d = duplicates[0]
        label = "existing brand" if d.get("source") == "brand" else "a previously found sourcing candidate"
        reason_parts.append(f"Possible duplicate of {label}: {d['name']} ({d['reason']})")

    # Cheap category signal from the search snippet alone -- keyword hits here are still
    # just signals (see brand_rules.py), not a claim the page was read. This used to
    # hard-reject the whole candidate (verdict="reject"), inconsistent with the identical
    # check run again after crawling the real site below, which only ever adds a note
    # ("주의 — ... SKU 단위 확인 필요"), never rejects. A two-line snippet mentioning one
    # excluded-category word doesn't prove the category is the candidate's main line any
    # more than the full site text does -- real case: "Peanuts Pralines" got hard-rejected
    # here purely because its snippet mentioned "rum" (one flavor variant), even though
    # 조건 B treats alcohol as a per-SKU exclusion, not a whole-brand one. Keep it as a
    # note and let the real site crawl (and the same check against real page text) make
    # the actual call, same as every other signal in this function.
    snippet_signal = category_signal(f"{candidate['name']} {candidate.get('sourceSnippet') or ''}")
    if snippet_signal:
        code, matched = snippet_signal
        reason_parts.append(
            f"주의 — 검색 스니펫에서 제외 카테고리 문구 발견 ({code}): '{matched}' "
            f"(브랜드 전체가 아니라 특정 제품일 수 있음, SKU 단위 확인 필요)"
        )

    # 조건 C: 후보 "이름 자체"에 모기업 이름이 들어있으면 하드 제외 -- 이건 ButterFinger/Milky
    # Way 같은 사례와 다르다. 그 브랜드들은 자기 이름에 "Ferrero"/"Mars"가 전혀 없으니 애초에
    # 여기 안 걸린다 (known_parent_in_name이 이름 자체를 검사하는 이상, 여기 걸린다는 것
    # 자체가 이미 "이 후보는 모기업의 자체 페이지"라는 뜻 -- 실제 실행에서 정확히 이 패턴으로
    # Ferrero/Cargill/Orkla 본사 페이지가 그대로 후보로 들어옴). 대기업 소유의 진짜 개별
    # 브랜드는 ownership_signal(크롤링 텍스트의 "a brand of X" 문구)에서만 걸러지고, 거긴
    # 여전히 참고 문구로만 남긴다 -- 그쪽이 실제 마스터리스트 근거(ButterFinger 등)가 있는
    # 곳이다.
    name_parent_hit = known_parent_in_name(candidate["name"])
    if name_parent_hit:
        parent, rule_code = name_parent_hit
        verdict = "reject"
        label = "자사 포트폴리오와 동일 모기업 계열" if rule_code == "own_portfolio_parent" else "대형 멀티내셔널 본사/계열 페이지로 추정"
        reason_parts.append(f"소유구조 제외 ({label}): 후보명에 '{parent}' 포함")

    # 병행 Claude 파이프라인이 9라운드에 걸쳐 실제로 확인해둔 "이미 검토 끝난 브랜드" 목록과
    # 이름 대조 -- 검색 API 호출 없이 공짜로 되는 체크라 여기서 먼저 한다. 이름이 조금이라도
    # 다르면 안 걸리는 한계는 있지만(정확일치만), 최소한 같은 브랜드를 두 파이프라인이 각자
    # 재검토하는 낭비는 막는다.
    known_hit = known_excluded_brand(candidate["name"])
    if known_hit:
        registry, known_reason = known_hit
        verdict = "reject"
        reason_parts.append(f"기배제 브랜드 등록부 일치 ({registry}): {known_reason}")

    site_info: dict = {}
    korea = {"hitCount": 0, "hits": [], "topHits": []}
    korea_status, korea_reason = "no_evidence_found", None

    if verdict == "reject":
        # Already rejected for free -- skip the crawl and the Korea search entirely.
        # skipped_crawl is the honest count of how many candidates this saved a
        # crawl+search on.
        progress.skipped_crawl += 1
    else:
        # Site-first verification (site_profile.py): the candidate's OWN site must show it
        # is a readable food producer with a trade channel -- otherwise it is dropped here,
        # before the 2-search Korea lookup. This replaced a chain of separate subtractive
        # filters that each needed patching for every new kind of junk.
        try:
            profile = build_profile(candidate["website"]) if candidate["website"] else {"readable": False, "why": "웹사이트 없음"}
        except Exception as e:
            # Arbitrary third-party HTML: one unexpected page must cost one candidate, not the run.
            print(f"  [warn] site profile failed for '{candidate['website']}': {e}", file=sys.stderr)
            profile = {"readable": False, "why": f"사이트 분석 오류 ({type(e).__name__})"}
        progress.website_scraped += 1
        keep, drop_code, why = judge(profile, candidate["name"], candidate["website"] or "")
        if not keep:
            print(f"  - {candidate['name']} -> dropped ({drop_code}: {why})")
            progress.filter_drops[drop_code] = progress.filter_drops.get(drop_code, 0) + 1
            progress.skipped_crawl += 1
            progress.push()
            return False, search_calls
        site_info = profile
        reason_parts.append(f"사이트 검증 통과 — {why}")

        # Store the address that actually loaded (after redirects), as a site root. Some
        # sites only work on one host variant -- brieuc.bzh resets HTTPS on the bare domain
        # and only serves www.brieuc.bzh -- so the stored link must be the one verified.
        final = urlparse(profile.get("finalUrl") or "")
        if final.scheme in ("http", "https") and final.netloc:
            candidate = {**candidate, "website": f"{final.scheme}://{final.netloc}/"}

        better_name = resolved_name(profile, candidate["name"], candidate["website"])
        renamed = better_name != candidate["name"]
        if renamed:
            reason_parts.append(f"이름을 사이트 자체 표기로 보정: '{candidate['name']}' -> '{better_name}'")
            candidate = {**candidate, "name": better_name}

        # A .com site gets the QUERY's country by default, which is only an intent -- the
        # site's own text overrules it when it clearly says otherwise.
        site_country = profile.get("country")
        country_changed = bool(
            site_country and not guess_country_from_domain(candidate["website"]) and site_country != bucket.get("country")
        )
        if renamed or country_changed:
            # The duplicate check ran on the search-result name; a corrected name can match
            # a brand that one missed (real case: "Chocolaterie Monbana" -> "monbana", an
            # existing brand, only got a low-confidence hint and reached the review list).
            try:
                re_eval = evaluate_candidate(
                    {
                        "name": strip_shop_words(candidate["name"]),
                        "website": candidate["website"],
                        "sku": bucket["category"],
                        "methodology": methodology_label(bucket),
                        "country": site_country if country_changed else (guess_country_from_domain(candidate["website"]) or bucket.get("country")),
                    }
                )
            except Exception:
                re_eval = None
            if re_eval:
                if country_changed:
                    pre_evaluation = {**pre_evaluation, "normalized": re_eval["normalized"]}
                certain = [d for d in re_eval["duplicates"] if d.get("matchType") == "exact" or d.get("confidence") == "high"]
                if renamed and certain:
                    d = certain[0]
                    label = "existing brand" if d.get("source") == "brand" else "a previously found sourcing candidate"
                    print(f"  - {candidate['name']} -> skipped after rename (duplicate of {label}: {d['name']})")
                    progress.duplicates_skipped += 1
                    progress.duplicate_names.append(f"{candidate['name']} (dup of {label}: {d['name']})")
                    progress.push()
                    return False, search_calls

        korea = check_korea_presence(candidate["name"])
        search_calls += KOREA_CALLS_PER_CHECK
        # Classify against ALL hits, not just the capped topHits display list -- a brand's
        # own (non-Korean) site usually ranks first and could push the one real Korean
        # marketplace hit out of the display cap. See check_korea_presence.
        korea_status, korea_reason = classify_korea_status(korea["hits"], candidate["name"])
        progress.korea_checked += 1
        progress.push()

        site_text = profile.get("fullText") or ""
        snippet = site_text[:800]
        # Excluded-category words on the site stay a NOTE, never a reject: one word can be
        # one SKU out of many (Dean's of Huntly, a shortbread brand, has one whisky cake).
        site_signal = category_signal(snippet)
        if site_signal:
            code, matched = site_signal
            reason_parts.append(
                f"주의 — 제외 카테고리 문구 발견 ({code}): '{matched}' "
                f"(브랜드 전체가 아니라 특정 제품일 수 있음, SKU 단위 확인 필요)"
            )

        # 조건 C: 자사 기존 포트폴리오와 같은 모기업이면 하드 제외. 대형 멀티내셔널 계열이라는
        # 사실 자체는 참고 문구로만 남긴다 (실제 판정은 조건 A/한국 총판 여부가 한다).
        owner_hit = ownership_signal(site_text)
        if owner_hit:
            parent, rule_code, matched = owner_hit
            if rule_code == "own_portfolio_parent":
                verdict = "reject"
                reason_parts.append(f"소유구조 제외 (자사 포트폴리오와 동일 모기업 계열): {parent} ('{matched}')")
            else:
                reason_parts.append(f"참고 — 대기업 계열 브랜드로 추정: {parent} ('{matched}'), 한국 총판 여부로 별도 판단 필요")

        # 조건 A: 지금 독점 총판 자리가 비어 있는지가 기준 -- 공식 총판이 이미 있으면 제외,
        # 병행수입/구매대행만 있으면 오히려 우선 후보(제외 아님).
        if korea_status == "official_distributor":
            verdict = "reject"
        reason_parts.append(korea_reason)
        if korea_status == "parallel_import":
            reason_parts.append("우선 후보: 수요는 검증됐고 총판 자리는 비어있는 것으로 추정됨")

        if profile.get("foundedYear"):
            reason_parts.append(f"Founded year found on site: {profile['foundedYear']}")
        if snippet:
            reason_parts.append(f"Site snippet: {snippet[:200]}")

    if verdict == "pass":
        # Evidence-only: nothing here judged the remaining ambiguous ownership cases or
        # heritage-story quality, so "no problems found by the mechanical check" is
        # never promoted to "pass".
        verdict = "flag"

    if verdict == "reject":
        # A rejected candidate (multinational parent, known-excluded brand, official Korean
        # distributor already in place, ...) is not something to review -- it used to be
        # listed anyway, so "Mars México" and "Grupo Ferrero" showed up as candidates.
        progress.rejected += 1
        progress.filter_drops["rejected_rule"] = progress.filter_drops.get("rejected_rule", 0) + 1
        print(f"  - {candidate['name']} -> dropped (rejected: {' | '.join(p for p in reason_parts if p)[:120]})")
        progress.push()
        return False, search_calls
    progress.flagged += 1

    evidence = [candidate["website"]] if candidate["website"] else []
    evidence += [h["url"] for h in korea["topHits"][:3]]

    insert_candidate(
        conn,
        run_id,
        {
            "name": candidate["name"],
            "methodology": methodology_label(bucket),
            "country": pre_evaluation["normalized"].get("country"),
            "sku": pre_evaluation["normalized"].get("sku"),
            "foundedYear": site_info.get("foundedYear") or pre_evaluation["normalized"].get("foundedYear"),
            "website": candidate["website"],
            "verdict": verdict,
            "reason": " | ".join(p for p in reason_parts if p),
            "evidence": evidence,
        },
    )
    print(f"  + {candidate['name']} -> {verdict}")
    time.sleep(0.3)  # stay polite to the search API's rate limit
    return verdict == "flag", search_calls


def process_discovery_query(conn, run_id: str, bucket: dict, query_text: str, progress: "Progress") -> tuple[int, int, int]:
    """Runs one discovery query, evaluates every candidate it surfaces, inserts them.
    Returns (search_calls_used, new_candidates_count, results_count)."""
    search_calls = 1  # the discovery call itself
    new_candidates = 0

    # Bias results toward makers WITH a trade channel, which is what site verification
    # keeps. Measured A/B on 7 real queries: 5 verified candidates with the bucket's trade
    # word appended vs 2 without (the plain "family-owned artisan" queries mostly return
    # walk-in shops that are then dropped for having no wholesale/export channel).
    search_text = f"{query_text} {bucket['tradeTerm']}" if bucket.get("tradeTerm") else query_text
    page = bucket.get("page", 1)
    try:
        results = search(search_text, count=8, page=page) if page > 1 else search(search_text, count=8)
    except Exception as e:
        print(f"  [warn] search failed for '{query_text}': {e}", file=sys.stderr)
        progress.errors += 1
        progress.push()
        return search_calls, 0, 0

    raw = []
    for r in results:
        progress.raw_results += 1
        dropped = False
        for reason, check in URL_FILTERS:
            if check(r):
                progress.filter_drops[reason] = progress.filter_drops.get(reason, 0) + 1
                dropped = True
                break
        if dropped:
            continue
        progress.after_url_filters += 1
        name = guess_brand_name(r["title"], r["url"])
        if not name:
            progress.filter_drops["no_name"] = progress.filter_drops.get("no_name", 0) + 1
            continue
        progress.after_name += 1
        # The core quality fix: only accept a result if it's hosted on a domain that IS
        # the brand, not a domain merely writing/selling/listing ABOUT it -- this is what
        # actually separates "Buderim Ginger's own homepage" from "10 Leading Gummy Candy
        # Suppliers" (which lives on some unrelated blog's domain).
        if not domain_matches_name(name, r["url"]):
            # Split out from plain "domain_mismatch" -- this specific sub-reason (shares
            # only an industry/product noun with its domain, e.g. a trade magazine) is a
            # known, currently-unfixed-without-an-LLM gap (see domain_matches_name's
            # docstring). Tracking it separately turns "how often does this actually
            # happen" from a guess into a number.
            reason = "generic_token_only" if generic_overlap_only(name, r["url"]) else "domain_mismatch"
            progress.filter_drops[reason] = progress.filter_drops.get(reason, 0) + 1
            continue
        progress.after_domain += 1
        raw.append({"name": name, "website": r["url"], "sourceSnippet": r["description"]})

    # Dedupes near-duplicate raw hits WITHIN this one query's own results (e.g. two search
    # hits for slightly different URLs of the same company). Cross-query/cross-lane
    # duplicates are now caught downstream by evaluate_candidate's live DB check instead,
    # since every candidate is inserted immediately and visible to the next query's
    # duplicate check -- broader coverage than the old in-memory per-bucket pool ever had.
    pooled = dedupe_by_site(dedupe_pooled(raw))

    for candidate in pooled:
        is_new, calls = process_candidate(conn, run_id, bucket, candidate, progress)
        search_calls += calls
        if is_new:
            new_candidates += 1

    return search_calls, new_candidates, len(pooled)


# A single roster page can easily harvest 30-40 names -- without a cap, one query's
# resolve step could spend dozens of search calls before the outer loop in main() ever
# gets to check the daily budget again (that check only runs BETWEEN queries). This is
# the in-run safety valve; the full redesign's SourcingPendingName carryover (unresolved
# names picked up again next run) is deliberately not built yet -- out of scope for this
# pass, a name that doesn't fit the cap is just not resolved this run.
_MAX_RESOLVE_PER_QUERY = 8
# Every entry processed is a site-profile crawl (up to 5 pages) even when it is then
# dropped, so this bounds crawl TIME per roster query, not just search credits -- a
# 200-name member list would otherwise mean ~150 crawls (20+ minutes) for one query.
_MAX_ROSTER_ENTRIES_PER_QUERY = 20


def process_roster_query(conn, run_id: str, bucket: dict, query_text: str, progress: "Progress") -> tuple[int, int, int]:
    """Runs one roster query (see categories.py's "kind": "roster"): finds candidate
    list/roster pages via search, harvests producer names from each (roster_harvest.py),
    dedupes against known brands/candidates BEFORE spending any resolve-search budget,
    then resolves only the survivors to their own official site (brand_resolve.py).
    Returns (search_calls_used, new_candidates_count, results_count) -- same shape as
    process_discovery_query so main()'s caller doesn't need to know which path ran.

    domain_matches_name is deliberately NOT called anywhere in this function on the
    roster page's own URL -- a list/roster page is never itself a brand's site by
    definition, so that check has nothing to do here. It's used correctly inside
    resolve_site instead, checking a candidate NAME against a candidate SITE once both
    are in hand."""
    search_calls = 1  # the discovery call itself (finding the roster page)
    new_candidates = 0

    try:
        results = search(query_text, count=8)
    except Exception as e:
        print(f"  [warn] search failed for '{query_text}': {e}", file=sys.stderr)
        progress.errors += 1
        progress.push()
        return search_calls, 0, 0

    harvested: dict[str, dict] = {}  # keyed by normalized name, first hit wins
    for r in results:
        progress.roster_pages_found += 1
        entries = harvest_names(r["url"])
        if not entries:
            continue
        progress.roster_pages_harvested += 1
        for e in entries:
            key = normalize_brand_name(e["name"])
            if key and key not in harvested:
                harvested[key] = e
    progress.names_harvested += len(harvested)
    progress.push()

    # Entries that arrived WITHOUT a website would each cost up to 2 resolve searches, so
    # dedup those by name first (the redesign's main economic lever). Entries that
    # already carry a website skip this: process_candidate runs the same duplicate check
    # as its first step, so a separate pre-check would just be a second identical call.
    survivors: list[dict] = []
    for entry in harvested.values():
        name = entry["name"]
        if known_excluded_brand(name):
            continue
        # A real roster links each producer's name to that producer's own site, so the
        # name must look like a name AND match the linked domain. A reference/citation list
        # fails this -- real run: link text "Manchego wins nail-biting World Cheese Awards
        # 2012" pointing at a news site came back as a "brand".
        if not is_plausible_brand_name(name) or (entry.get("website") and not domain_matches_name(name, entry["website"])):
            progress.filter_drops["roster_name_mismatch"] = progress.filter_drops.get("roster_name_mismatch", 0) + 1
            continue
        if entry.get("website"):
            survivors.append(entry)
            continue
        try:
            pre_evaluation = evaluate_candidate(
                {
                    "name": name,
                    "website": None,
                    "sku": bucket["category"],
                    "methodology": methodology_label(bucket),
                    "country": bucket.get("country"),
                }
            )
        except Exception as e:
            print(f"  [warn] evaluate-candidate call failed for harvested name '{name}': {e}", file=sys.stderr)
            progress.errors += 1
            continue
        has_certain_duplicate = any(
            d.get("matchType") == "exact" or d.get("confidence") == "high" for d in pre_evaluation["duplicates"]
        )
        if has_certain_duplicate:
            d = pre_evaluation["duplicates"][0]
            label = "existing brand" if d.get("source") == "brand" else "a previously found sourcing candidate"
            progress.duplicates_skipped += 1
            progress.duplicate_names.append(f"{name} (roster, dup of {label}: {d['name']})")
            continue
        survivors.append(entry)
    progress.names_after_dedup += len(survivors)
    progress.push()

    # _MAX_RESOLVE_PER_QUERY bounds the EXPENSIVE work (resolve search / crawl / Korea
    # check). Duplicates and pre-rejects cost nothing beyond the evaluate call, so they
    # don't use up the budget -- otherwise a big roster of already-known names would crowd
    # out the new ones at its tail.
    expensive = 0
    for entry in survivors[:_MAX_ROSTER_ENTRIES_PER_QUERY]:
        if expensive >= _MAX_RESOLVE_PER_QUERY:
            break
        name = entry["name"]
        website = entry.get("website")

        if not website:
            resolved = resolve_site(name, bucket.get("country"), search)
            search_calls += resolved["searchCalls"]
            expensive += 1
            website = resolved["website"]
            if not website:
                progress.names_unresolved += 1
                continue
        progress.names_resolved += 1

        candidate = {"name": name, "website": website, "sourceSnippet": entry.get("context") or ""}
        is_new, calls = process_candidate(conn, run_id, bucket, candidate, progress)
        search_calls += calls
        if calls > 0 and entry.get("website"):
            expensive += 1
        if is_new:
            new_candidates += 1

    return search_calls, new_candidates, len(survivors)


def process_one_query(
    conn, run_id: str, bucket: dict, query_text: str, kind: str, progress: "Progress"
) -> tuple[int, int, int]:
    """Dispatches to the discovery or roster pipeline based on this query's "kind" (see
    categories.py) -- the two are different enough (one candidate per search result vs.
    many names harvested from one page) that branching here is clearer than merging
    them into one function."""
    if kind == "roster":
        return process_roster_query(conn, run_id, bucket, query_text, progress)
    return process_discovery_query(conn, run_id, bucket, query_text, progress)


def main():
    run_id = sys.argv[1] if len(sys.argv) > 1 else None
    conn = get_connection()
    if run_id is None:
        run_id = create_sourcing_run(conn, BACKEND)
    print(f"Sourcing run {run_id} (backend: {BACKEND})")

    today = date.today()
    budget_state = get_or_create_daily_budget(conn, BACKEND, today)
    search_used = budget_state["searchUsed"]
    candidates_out = budget_state["candidatesOut"]

    progress = Progress(conn, run_id, search_used, candidates_out)
    progress.push()

    # A bucket with "enabled": False (e.g. Awards -- see categories.py) is skipped
    # entirely rather than removed, so its hand-picked queries/lane-state survive to be
    # reactivated later without re-authoring them.
    lanes_by_label = {b["label"]: b for b in BUCKETS if b.get("enabled", True)}
    lane_states = {label: get_lane_state(conn, BACKEND, label) for label in lanes_by_label}
    # Every enabled lane takes part: one whose hand-written queries ran out continues with
    # generated ones, and is only dropped from this run once the generator is out too.
    active = list(lane_states)

    stopped_by = None

    while active:
        if candidates_out >= DAILY_CANDIDATE_TARGET:
            stopped_by = "target"
            break
        if search_used >= DAILY_SEARCH_BUDGET:
            stopped_by = "budget"
            break

        progressed_this_round = False
        for label in list(active):
            if candidates_out >= DAILY_CANDIDATE_TARGET or search_used >= DAILY_SEARCH_BUDGET:
                break

            bucket = lanes_by_label[label]
            state = lane_states[label]
            queries = bucket["queries"]  # each item: {"q": <text>, "category": <Korean SKU label>}

            # Skip past any query already proven dry (2 consecutive zero-yield runs).
            # Keyed on the query TEXT only (not the category), same as before -- an
            # existing SourcingQueryLedger row's key is just the string, unaffected by
            # this file moving "category" from the bucket level down to the query level.
            while state["cursor"] < len(queries) and is_query_retired(conn, BACKEND, label, queries[state["cursor"]]["q"]):
                state["cursor"] += 1

            if state["cursor"] < len(queries):
                query_item = queries[state["cursor"]]
                dynamic = False
                ledger_text = query_item["q"]
            else:
                # Hand-written queries used up -> generated combinations (query_generator.py).
                # Paging needs Serper; Tavily has no result-page parameter.
                dyn = next_query(label, get_lane_ledger(conn, BACKEND, label), allow_paging=(BACKEND == "serper"))
                if dyn is None:
                    state["exhausted"] = True
                    save_lane_state(conn, BACKEND, label, state["cursor"], True, state["totalNewBrands"])
                    active.remove(label)
                    continue
                query_item = {"q": dyn["text"], "category": dyn["category"], "page": dyn["page"]}
                dynamic = True
                ledger_text = dyn["key"]

            query_text = query_item["q"]
            page = query_item.get("page", 1)
            print(f"\n=== {label} :: {query_text}" + (f" (page {page})" if page > 1 else "") + (" [auto]" if dynamic else "") + " ===")
            # bucket["category"] is read by process_candidate -- override it per-query
            # instead of threading a new parameter through process_one_query/
            # process_candidate's signatures just for this.
            query_bucket = {**bucket, "category": query_item["category"], "page": page, "dynamic": dynamic}
            kind = query_item.get("kind", "discovery")
            korea_before = progress.korea_checked
            calls, new_count, results_count = process_one_query(conn, run_id, query_bucket, query_text, kind, progress)
            if BACKEND != "serper":
                # Korea checks always use Serper (it finds Naver/Coupang listings far better),
                # so record them on Serper's daily usage too -- otherwise a Tavily run spends
                # Serper credits that never show up on the Serper side.
                add_search_usage(conn, "serper", today, (progress.korea_checked - korea_before) * KOREA_CALLS_PER_CHECK)

            search_used += calls
            candidates_out += new_count
            record_query_result(conn, BACKEND, label, ledger_text, results_count, new_count)

            if not dynamic:
                state["cursor"] += 1
            state["totalNewBrands"] += new_count
            save_lane_state(conn, BACKEND, label, state["cursor"], False, state["totalNewBrands"])
            update_daily_budget(conn, BACKEND, today, search_used, candidates_out)

            progress.search_used = search_used
            progress.candidates_out = candidates_out
            progress.push()

            progressed_this_round = True

        if not progressed_this_round:
            break  # every remaining active lane got exhausted this round

    if stopped_by is None:
        stopped_by = "exhausted" if not active else "target"

    update_daily_budget(conn, BACKEND, today, search_used, candidates_out, stopped_by=stopped_by)
    progress.stage = "done"
    progress.stopped_by = stopped_by
    progress.push()
    conn.close()
    print(f"\nDone. {candidates_out} candidates today so far ({search_used} search calls). Stopped by: {stopped_by}")


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        import traceback

        detail = traceback.format_exc()
        print(f"[fatal] {detail}", file=sys.stderr)
        try:
            fallback_run_id = sys.argv[1] if len(sys.argv) > 1 else None
            if fallback_run_id:
                fallback_conn = get_connection()
                update_run_progress(
                    fallback_conn,
                    fallback_run_id,
                    {"stage": "error", "message": f"{type(e).__name__}: {e}"},
                    status="error",
                )
                fallback_conn.close()
        except Exception:
            pass
        sys.exit(1)
