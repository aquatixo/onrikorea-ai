"""
Evidence-only brand sourcing engine -- no LLM anywhere in this file.

What this replaces from the Claude pipeline: the discovery searches and the mechanical
dedup/category checks (via the app's own evaluate-candidate API).

What this does NOT replace, on purpose: judging whether a heritage story is credible, and
judging packaging -- none of that is possible without something that can actually read
and reason about prose. Every candidate this script inserts is "flag" (needs human
review), never "pass". Anything a deterministic rule rejects -- a certain duplicate, an
excluded category, OEM, a multinational parent, an official Korean distributor, short
shelf life, a country we don't source from -- is dropped and never inserted.

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

import os
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

def _fail_before_start(message: str) -> None:
    """Exits on a bad argument/setting found before main() runs. The app already created
    this run's SourcingRun row (argv[1]); it is marked failed here, or the sourcing page
    keeps showing it as running."""
    print(f"[fatal] {message}", file=sys.stderr)
    if len(sys.argv) > 1 and sys.argv[1]:
        try:
            from db import get_connection, update_run_progress

            conn = get_connection()
            update_run_progress(conn, sys.argv[1], {"stage": "error", "message": message}, status="error")
            conn.close()
        except Exception:
            pass
    sys.exit(1)


BACKEND = sys.argv[2] if len(sys.argv) > 2 else "serper"
if BACKEND not in ("serper", "tavily"):
    _fail_before_start(f"unknown backend '{BACKEND}' -- expected 'serper' or 'tavily'")

from categories import BUCKETS, FOCUS_LANES
from search_errors import SearchAuthError

# Optional 3rd arg: a focus run ("japan") spends the backend's SAME daily budget on only
# that focus's lanes (categories.FOCUS_LANES) instead of every country. Focus-only lanes
# (e.g. Japan Beauty / Japan Care) never run in a normal run.
FOCUS = sys.argv[3] if len(sys.argv) > 3 and sys.argv[3] else None
if FOCUS is not None and FOCUS not in FOCUS_LANES:
    _fail_before_start(f"unknown focus '{FOCUS}' -- expected one of {sorted(FOCUS_LANES)}")

if BACKEND == "tavily":
    from tavily_search import search
else:
    from serper_search import search

from name_filter import (
    URL_FILTERS,
    brand_domain_label,
    domain_matches_name,
    generic_overlap_only,
    guess_brand_name,
    is_plausible_brand_name,
    strip_shop_words,
)
from site_profile import build_profile, judge, resolved_name
from korea_check import KOREA_QUERY_TEMPLATES, check_korea_presence, classify_korea_status, korea_search_name, korea_shop_hits
from shelf_life import MIN_SHELF_LIFE_MONTHS, format_months, search_shelf_life
from jp_reading import with_korean_reading

KOREA_CALLS_PER_CHECK = len(KOREA_QUERY_TEMPLATES)
from brand_rules import category_signal, ownership_signal, known_parent_in_name
from known_brands import known_excluded_brand, normalize_brand_name
from country_guess import guess_country_from_domain, is_target_country
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
# One-off extra searches for a single manual run (e.g. re-testing after a fix on a day the
# budget is already used up): SOURCING_EXTRA_SEARCH_BUDGET=40 python main.py ... Never set
# by the app's run buttons, so the normal daily cap is unchanged.
try:
    DAILY_SEARCH_BUDGET += int(os.environ.get("SOURCING_EXTRA_SEARCH_BUDGET", "0") or 0)
except ValueError:
    _fail_before_start("SOURCING_EXTRA_SEARCH_BUDGET must be a whole number")
DAILY_CANDIDATE_TARGET = DAILY_CANDIDATE_TARGET_TAVILY if BACKEND == "tavily" else DAILY_CANDIDATE_TARGET_SERPER


def methodology_label(bucket: dict) -> str:
    """categories.py's bucket "label" is just a short country/region name (e.g.
    "Japan") -- this prefixes the backend that actually found it (e.g. "Serper ·
    Japan") for display in the results table's methodology column, without needing
    categories.py itself to know anything about which backend is running."""
    suffix = " (자동)" if bucket.get("dynamic") else ""
    focus = " · 집중" if FOCUS else ""
    return f"{BACKEND.capitalize()}{focus} · {bucket['label']}{suffix}"


def similarity(a: str, b: str) -> float:
    # Legal-suffix-aware, same normalization the parallel Claude-pipeline's own dedup
    # script uses (see its handoff doc §7) -- without stripping "Ltd"/"S.p.A."/"GmbH"
    # etc, "Wedel" and "Wedel Sp. z o.o." would score below the 0.84 cutoff and both
    # get kept as if they were different companies.
    return SequenceMatcher(None, normalize_brand_name(a), normalize_brand_name(b)).ratio()


def _site_host(c: dict) -> str:
    return urlparse(c.get("website") or "").netloc.lower().removeprefix("www.")


def dedupe_pooled(candidates: list[dict]) -> list[dict]:
    """Near-identical names on the SAME site are one brand. Names alone are not enough:
    "Chocolaterie Morin" / "Chocolaterie Marin" score 0.94 on the shared generic word and
    one of two different makers silently disappeared."""
    kept = []
    for c in candidates:
        if not any(similarity(c["name"], k["name"]) >= 0.84 and _site_host(c) == _site_host(k) for k in kept):
            kept.append(c)
    return kept


def dedupe_by_site(candidates: list[dict]) -> list[dict]:
    """One candidate per website host: two results from the same site under different
    titles ("Praline Pecans" product page + the homepage) are the same brand."""
    kept, seen = [], set()
    for c in candidates:
        host = _site_host(c)
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
        # Searches that always go to Serper whatever the run's backend (Korea check,
        # shelf-life lookup) -- a Tavily run adds these to Serper's daily usage too.
        self.serper_calls = 0
        self.rejected = 0
        self.flagged = 0
        self.errors = 0
        self.skipped_crawl = 0  # dropped before its site was crawled
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
            "focus": FOCUS,
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

    def count_drop(self, code: str) -> None:
        self.filter_drops[code] = self.filter_drops.get(code, 0) + 1

    def drop(self, name: str, code: str, why: str, crawled: bool) -> None:
        """One candidate dropped by a rule: logged, counted under its reason, pushed."""
        print(f"  - {name} -> dropped ({code}: {why})")
        self.count_drop(code)
        if not crawled:
            self.skipped_crawl += 1
        self.push()

    def skip_duplicate(self, name: str, match: dict, when: str = "") -> None:
        """A certain duplicate of an existing brand or earlier candidate: not inserted."""
        label = "existing brand" if match.get("source") == "brand" else "a previously found sourcing candidate"
        print(f"  - {name} -> skipped{when} (duplicate of {label}: {match['name']})")
        self.duplicates_skipped += 1
        self.duplicate_names.append(f"{name} (dup of {label}: {match['name']})")
        self.push()


def _certain_duplicates(duplicates: list[dict]) -> list[dict]:
    """Exact or high-confidence matches -- the same precedence evaluate.ts uses."""
    return [d for d in duplicates if d.get("matchType") == "exact" or d.get("confidence") == "high"]


def _evaluate(bucket: dict, name: str, website: str | None, country: str | None) -> dict:
    """The app's duplicate/category check (evaluate_client.py) for one candidate."""
    return evaluate_candidate(
        {"name": name, "website": website, "sku": bucket["category"], "methodology": methodology_label(bucket), "country": country}
    )


def _parent_in_name(name: str) -> str | None:
    """Reject reason when the candidate's own name is a multinational's or our own
    portfolio's parent ("Grupo Ferrero", "Mars México") -- that's the parent's own page."""
    hit = known_parent_in_name(name)
    if not hit:
        return None
    parent, rule_code = hit
    label = "자사 포트폴리오와 동일 모기업 계열" if rule_code == "own_portfolio_parent" else "대형 멀티내셔널 본사/계열 페이지로 추정"
    return f"소유구조 제외 ({label}): 후보명에 '{parent}' 포함"


def process_candidate(conn, run_id: str, bucket: dict, candidate: dict, progress: "Progress") -> tuple[bool, int]:
    """Runs the full evaluate/crawl/Korea-check pipeline for one discovered candidate,
    inserts it if it survives, and returns (is_new, search_calls_used). is_new: inserted
    for review. search_calls_used: the Serper calls this candidate itself made -- 0 when
    it was dropped before the Korea check, up to 3 after it (Korea check + shelf life)."""
    search_calls = 0

    # A search hit is often one inner page (a blog post, one service page of a
    # company). The candidate is the SITE: normalize to its root so the relevance check
    # reads the whole site instead of judging one page, and so Brands stores the homepage.
    if candidate.get("website"):
        parsed_site = urlparse(candidate["website"])
        if parsed_site.scheme in ("http", "https") and parsed_site.netloc:
            candidate = {**candidate, "website": f"{parsed_site.scheme}://{parsed_site.netloc}/"}

    # A site in a country we don't source from (sun-foods.co.za from a UK query) is out
    # before anything else is spent on it. A .com one is caught after the crawl, from the
    # site's own text.
    domain_country = guess_country_from_domain(candidate.get("website") or "")
    if not is_target_country(domain_country):
        progress.drop(candidate["name"], "foreign_country", f"사이트 도메인 국가 {domain_country} — 소싱 대상 국가 아님", crawled=False)
        return False, search_calls

    # Dedup + category are free (DB lookups / regex only) -- check them *before* spending
    # the expensive steps (site crawl, Korea search). The 8th manual round measured 24%
    # of raw candidates as already-known duplicates, so this ordering alone skips a
    # crawl+search pair for roughly a quarter of candidates.
    try:
        pre_evaluation = _evaluate(
            bucket,
            # Shop/online words stripped for the duplicate check only ("Lambertz Online"
            # is the web shop of the existing brand Lambertz).
            strip_shop_words(candidate["name"]),
            candidate["website"],
            # The ccTLD when it names a country, else the lane's country: every query in a
            # lane targets that one country, so it's a known fact, not a guess.
            guess_country_from_domain(candidate["website"]) or bucket.get("country"),
        )
    except Exception as e:
        print(f"  [warn] evaluate-candidate call failed for '{candidate['name']}': {e}", file=sys.stderr)
        progress.errors += 1
        progress.skipped_crawl += 1
        progress.push()
        return False, search_calls

    verdict = pre_evaluation["verdict"]
    duplicates = pre_evaluation["duplicates"]

    # Already-known for CERTAIN (exact/high-confidence match) and not already rejected for
    # its category: nothing new to review, so it isn't inserted (Sakuraco resurfaced every
    # run after it was added to Brands). A LOW-confidence hint is kept as a note below --
    # that's evaluate.ts saying "possibly the same, a human should glance at it".
    certain = _certain_duplicates(duplicates)
    if certain and not pre_evaluation["categoryExcluded"]["excluded"]:
        progress.skip_duplicate(candidate["name"], certain[0])
        return False, search_calls

    reason_parts = []
    if pre_evaluation["categoryExcluded"]["excluded"]:
        reason_parts.append(pre_evaluation["categoryExcluded"]["reason"])
    if duplicates:
        d = duplicates[0]
        label = "기존 브랜드" if d.get("source") == "brand" else "이전 발굴 후보"
        reason_parts.append(f"중복 가능성 ({label}): {d['name']} ({d['reason']})")

    # Category words in the search snippet stay a NOTE: a two-line snippet mentioning one
    # excluded word doesn't prove it's the brand's main line ("Peanuts Pralines" mentioned
    # rum, one flavour). OEM is the exception -- the company never takes an OEM/private-
    # label maker at all (user, 2026-11-04), and site_profile drops it on one mention too.
    snippet_signal = category_signal(f"{candidate['name']} {candidate.get('sourceSnippet') or ''}")
    if snippet_signal:
        code, matched = snippet_signal
        if code == "oem_b2b":
            verdict = "reject"
            reason_parts.append(f"OEM·위탁생산 (검색 스니펫: '{matched}') — 다른 회사 브랜드 제품을 만드는 곳이라 제외")
        else:
            reason_parts.append(
                f"주의 — 검색 스니펫에서 제외 카테고리 문구 발견 ({code}): '{matched}' "
                f"(브랜드 전체가 아니라 특정 제품일 수 있음, SKU 단위 확인 필요)"
            )

    # 조건 C: 후보 이름 자체가 모기업 이름이면 하드 제외 (Ferrero/Cargill/Orkla 본사 페이지가
    # 그대로 후보로 들어온 적이 있다). 이름에 모기업이 안 드러나는 계열 브랜드는 크롤링 후
    # ownership_signal("a brand of X" 문구)이 잡는다 -- 그것도 하드 제외다.
    parent_reason = _parent_in_name(candidate["name"])
    if parent_reason:
        verdict = "reject"
        reason_parts.append(parent_reason)

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
    shelf_evidence = None
    korea = {"hitCount": 0, "hits": [], "topHits": []}
    korea_name = candidate["name"]

    if verdict == "reject":
        # Already rejected for free -- skip the crawl and the Korea search entirely.
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
        keep, drop_code, why = judge(profile, candidate["name"], candidate["website"] or "", bucket.get("group", "food"))
        if not keep:
            progress.drop(candidate["name"], drop_code, why, crawled=True)
            return False, search_calls
        site_info = profile
        reason_parts.append(f"사이트 검증 통과 — {why}")

        # Store the address that actually loaded (after redirects), as a site root. Some
        # sites only work on one host variant -- brieuc.bzh resets HTTPS on the bare domain
        # and only serves www.brieuc.bzh -- so the stored link must be the one verified.
        original_website = candidate["website"]
        final = urlparse(profile.get("finalUrl") or "")
        if final.scheme in ("http", "https") and final.netloc:
            candidate = {**candidate, "website": f"{final.scheme}://{final.netloc}/"}
        moved = _site_host({"website": original_website}) != _site_host(candidate)

        better_name = resolved_name(profile, candidate["name"], candidate["website"])
        renamed = better_name != candidate["name"]
        if renamed:
            reason_parts.append(f"이름을 사이트 자체 표기로 보정: '{candidate['name']}' -> '{better_name}'")
            candidate = {**candidate, "name": better_name}

        # A .com site gets the QUERY's country by default, which is only an intent -- the
        # site's own text overrules it when it clearly says otherwise.
        # Compared with the country the first evaluation used (the search result's own domain,
        # else the lane's) -- not with the redirected site's domain: a .com that redirects to
        # a .ch site used to keep the lane's country because the new domain "had" one.
        site_country = profile.get("country")
        if not is_target_country(site_country):
            progress.drop(candidate["name"], "foreign_country", f"사이트 국가 {site_country} — 소싱 대상 국가 아님", crawled=True)
            return False, search_calls
        first_country = guess_country_from_domain(original_website) or bucket.get("country")
        country_changed = bool(site_country and site_country != first_country)
        if renamed or moved or country_changed:
            # The first check saw the search-result name and address. A corrected name or the
            # site it redirected to can be a brand that check missed (real case: "Chocolaterie
            # Monbana" -> "monbana", an existing brand, reached the review list as a hint).
            try:
                re_eval = _evaluate(
                    bucket,
                    strip_shop_words(candidate["name"]),
                    candidate["website"],
                    site_country if country_changed else (guess_country_from_domain(candidate["website"]) or bucket.get("country")),
                )
            except Exception as e:
                print(f"  [warn] re-evaluation failed for '{candidate['name']}': {e}", file=sys.stderr)
                progress.errors += 1
                re_eval = None
            if re_eval:
                if country_changed:
                    pre_evaluation = {**pre_evaluation, "normalized": re_eval["normalized"]}
                certain = _certain_duplicates(re_eval["duplicates"])
                if (renamed or moved) and certain:
                    progress.skip_duplicate(candidate["name"], certain[0], " after rename/redirect")
                    return False, search_calls
                if re_eval["categoryExcluded"]["excluded"]:
                    verdict = "reject"
                    reason_parts.append(re_eval["categoryExcluded"]["reason"])

        # The free checks that need the crawled site or the corrected name -- all before the
        # paid Korea search, so a rejected candidate doesn't spend it.
        korea_name = korea_search_name(candidate["name"], candidate["website"])
        if renamed:
            parent_reason = _parent_in_name(candidate["name"])
            if parent_reason:
                verdict = "reject"
                reason_parts.append(parent_reason)
        # The registry check before the crawl only saw the search-result name
        # ("ヤーマン公式通販サイト"); the corrected name or the domain name can match it
        # (ヤーマン / "ya man"). The domain-derived name only when it's long enough to mean
        # something: a 4-5 letter domain word ("solo", "novi", "lance") matched an unrelated
        # registry entry.
        known_after = known_excluded_brand(candidate["name"]) or (
            known_excluded_brand(korea_name) if len(korea_name.replace(" ", "")) >= 6 else None
        )
        if known_after:
            registry, known_reason = known_after
            progress.drop(candidate["name"], "known_excluded", f"{registry} — {known_reason}", crawled=True)
            return False, search_calls

        site_text = profile.get("fullText") or ""
        snippet = site_text[:800]
        # 조건 C: 자사 기존 포트폴리오와 같은 모기업, 또는 대형 멀티내셔널 계열이면 하드 제외.
        # 멀티내셔널 계열은 참고 문구로만 남기던 때 Thorntons ("part of the Ferrero Group")가
        # 후보로 들어왔다 (2026-11-02 run) -- 그런 브랜드의 한국 판권은 그룹 한국 법인 몫이다.
        owner_hit = ownership_signal(site_text)
        if owner_hit:
            parent, rule_code, matched = owner_hit
            verdict = "reject"
            label = "자사 포트폴리오와 동일 모기업 계열" if rule_code == "own_portfolio_parent" else "대형 멀티내셔널 계열"
            reason_parts.append(f"소유구조 제외 ({label}): {parent} ('{matched}')")
        # Other excluded-category words on the site stay a NOTE: one word can be one SKU out
        # of many (Dean's of Huntly, a shortbread brand, has one whisky cake). OEM on the site
        # was already dropped by judge().
        site_signal = category_signal(snippet)
        if site_signal:
            code, matched = site_signal
            reason_parts.append(
                f"주의 — 제외 카테고리 문구 발견 ({code}): '{matched}' "
                f"(브랜드 전체가 아니라 특정 제품일 수 있음, SKU 단위 확인 필요)"
            )

        if verdict != "reject":
            korea = check_korea_presence(korea_name)
            search_calls += KOREA_CALLS_PER_CHECK
            progress.serper_calls += KOREA_CALLS_PER_CHECK
            # Classify against ALL hits, not just the capped topHits display list -- a brand's
            # own (non-Korean) site usually ranks first and could push the one real Korean
            # marketplace hit out of the display cap. See check_korea_presence.
            korea_status, korea_reason = classify_korea_status(
                korea["hits"], korea_name, korea.get("failed", 0), own_domain_label=brand_domain_label(candidate["website"] or "")
            )
            progress.korea_checked += 1
            progress.push()
            # 조건 A: 지금 독점 총판 자리가 비어 있는지가 기준 -- 공식 총판이 이미 있으면 제외,
            # 병행수입/구매대행만 있으면 오히려 우선 후보(제외 아님).
            if korea_status == "official_distributor":
                verdict = "reject"
            reason_parts.append(korea_reason)
            if korea_status == "parallel_import":
                reason_parts.append("우선 후보: 수요는 검증됐고 총판 자리는 비어있는 것으로 추정됨")

        # Shelf life >= 12 months (user, 2026-10-15). The site's own statement was already
        # judged in site_profile.judge; when it states none, ask Google once (1 search, only
        # for candidates still standing). Not found is a note, never a reject.
        if verdict != "reject" and bucket.get("group", "food") == "food" and profile.get("shelfLifeMonths") is None:
            # The lane's country (English, "Italy"): the stored one is a Korean label.
            shelf = search_shelf_life(candidate["name"], bucket.get("country"), candidate["website"])
            search_calls += 1
            progress.serper_calls += 1
            if shelf["months"] is not None and shelf["months"] < MIN_SHELF_LIFE_MONTHS:
                verdict = "reject"
                reason_parts.append(
                    f"구글 검색 결과 유통기한 최대 {format_months(shelf['months'])} — {MIN_SHELF_LIFE_MONTHS}개월 미만 ({shelf['url']})"
                )
            elif shelf["months"] is not None:
                # The LONGEST one found -- can be an atypical product (Pernigotti's 60 months
                # was a gelato-base paste, 三立製菓's 5 years emergency hardtack), so the
                # source goes in the text for the reviewer.
                reason_parts.append(f"유통기한 최대 {shelf['months']}개월 (구글 검색 결과, 제품별 확인 필요: {shelf['url']})")
                shelf_evidence = shelf["url"]
            else:
                reason_parts.append(
                    "유통기한 미확인 — 사이트·검색 결과에 표기 없음"
                    + (" (검색 실패)" if shelf.get("failed") else "")
                    + ", 콜드메일 시 확인 필요"
                )

        if profile.get("foundedYear"):
            reason_parts.append(f"설립연도 (사이트 기준): {profile['foundedYear']}")
        if snippet:
            reason_parts.append(f"사이트 발췌: {snippet[:200]}")

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
        progress.count_drop("rejected_rule")
        print(f"  - {candidate['name']} -> dropped (rejected: {' | '.join(p for p in reason_parts if p)[:120]})")
        progress.push()
        return False, search_calls
    progress.flagged += 1

    evidence = [candidate["website"]] if candidate["website"] else []
    # The Korean shop results the Korea status was decided on -- not the first raw results,
    # which were usually the brand's own site, social posts and unrelated pages.
    evidence += [h["url"] for h in korea_shop_hits(korea["hits"], korea_name)[:3]] if korea["hits"] else []
    if shelf_evidence:
        evidence.append(shelf_evidence)

    insert_candidate(
        conn,
        run_id,
        {
            # A Japanese-only name gets its Korean reading: "三ツ矢製菓 (미쓰야세이카)". Only
            # here, at insert -- every check above (duplicates, registry, Korea search) used
            # the plain name.
            "name": with_korean_reading(candidate["name"], candidate["website"]),
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


def process_discovery_query(conn, run_id: str, bucket: dict, query_text: str, progress: "Progress") -> tuple[int, int, int, bool]:
    """Runs one discovery query, evaluates every candidate it surfaces, inserts them.
    Returns (search_calls_used, new_candidates_count, results_count, search_failed)."""
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
    except SearchAuthError:
        raise  # no key / no credits: the run stops here (see search_errors.py)
    except Exception as e:
        print(f"  [warn] search failed for '{query_text}': {e}", file=sys.stderr)
        progress.errors += 1
        progress.push()
        return search_calls, 0, 0, True

    raw = []
    for r in results:
        progress.raw_results += 1
        dropped = False
        for reason, check in URL_FILTERS:
            if check(r):
                progress.count_drop(reason)
                dropped = True
                break
        if dropped:
            continue
        progress.after_url_filters += 1
        name = guess_brand_name(r["title"], r["url"])
        if not name:
            progress.count_drop("no_name")
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
            progress.count_drop("generic_token_only" if generic_overlap_only(name, r["url"]) else "domain_mismatch")
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

    return search_calls, new_candidates, len(pooled), False


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


def process_roster_query(conn, run_id: str, bucket: dict, query_text: str, progress: "Progress") -> tuple[int, int, int, bool]:
    """Runs one roster query (see categories.py's "kind": "roster"): finds candidate
    list/roster pages via search, harvests producer names from each (roster_harvest.py),
    dedupes against known brands/candidates BEFORE spending any resolve-search budget,
    then resolves only the survivors to their own official site (brand_resolve.py).
    Returns (search_calls_used, new_candidates_count, results_count, search_failed) -- same shape as
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
    except SearchAuthError:
        raise  # no key / no credits: the run stops here (see search_errors.py)
    except Exception as e:
        print(f"  [warn] search failed for '{query_text}': {e}", file=sys.stderr)
        progress.errors += 1
        progress.push()
        return search_calls, 0, 0, True

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
            progress.count_drop("known_excluded")
            continue
        # A real roster links each producer's name to that producer's own site, so the
        # name must look like a name AND match the linked domain. A reference/citation list
        # fails this -- real run: link text "Manchego wins nail-biting World Cheese Awards
        # 2012" pointing at a news site came back as a "brand".
        if not is_plausible_brand_name(name) or (entry.get("website") and not domain_matches_name(name, entry["website"])):
            progress.count_drop("roster_name_mismatch")
            continue
        if entry.get("website"):
            survivors.append(entry)
            continue
        try:
            pre_evaluation = _evaluate(bucket, name, None, bucket.get("country"))
        except Exception as e:
            print(f"  [warn] evaluate-candidate call failed for harvested name '{name}': {e}", file=sys.stderr)
            progress.errors += 1
            continue
        certain = _certain_duplicates(pre_evaluation["duplicates"])
        if certain:
            progress.skip_duplicate(name, certain[0], " (roster)")
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

    return search_calls, new_candidates, len(survivors), False


def process_one_query(
    conn, run_id: str, bucket: dict, query_text: str, kind: str, progress: "Progress"
) -> tuple[int, int, int, bool]:
    """Dispatches to the discovery or roster pipeline based on this query's "kind" (see
    categories.py) -- the two are different enough (one candidate per search result vs.
    many names harvested from one page) that branching here is clearer than merging
    them into one function."""
    if kind == "roster":
        return process_roster_query(conn, run_id, bucket, query_text, progress)
    return process_discovery_query(conn, run_id, bucket, query_text, progress)


# The SourcingRun row a manual run (no run id argument) created, for the crash handler.
_created_run_id: str | None = None


def main():
    global _created_run_id
    run_id = sys.argv[1] if len(sys.argv) > 1 else None

    # Fail before touching the budget/ledger/lane state when a key this run needs is
    # missing (the run buttons already refuse to start then -- this covers a manual run).
    # The Korea check always uses Serper, so a Tavily run needs both keys. These checks come
    # before a manual run creates its SourcingRun row: the run button shows the newest
    # "running" run as in progress, so a row left behind by a failed start looked stuck.
    from config import SERPER_API_KEY, TAVILY_API_KEY

    missing = [k for k, v in (("SERPER_API_KEY", SERPER_API_KEY), ("TAVILY_API_KEY", TAVILY_API_KEY)) if not v]
    if BACKEND == "serper":
        missing = [k for k in missing if k == "SERPER_API_KEY"]
    if missing:
        raise SearchAuthError(f"{', '.join(missing)}가 .env에 없습니다")

    # The duplicate check is the app's own API (evaluate_client.py). Unreachable (dev
    # server not running) or refusing the internal secret, it fails every candidate --
    # after its searches were paid for, with each query recorded as finding nothing (two
    # of those retire it). One read-only call before any search instead -- tried twice, as
    # `next dev` compiles the route on its first request and that can outlast the timeout.
    for attempt in (1, 2):
        try:
            evaluate_candidate({"name": "preflight", "website": None, "sku": "과자", "methodology": "preflight", "country": None})
            break
        except Exception as e:
            if attempt == 2:
                raise RuntimeError(f"앱 API에 연결할 수 없습니다 (개발 서버/INTERNAL_API_SECRET 확인): {e}") from e

    conn = get_connection()
    if run_id is None:
        run_id = _created_run_id = create_sourcing_run(conn, BACKEND)
    print(f"Sourcing run {run_id} (backend: {BACKEND}" + (f", focus: {FOCUS}" if FOCUS else "") + ")")

    today = date.today()
    budget_state = get_or_create_daily_budget(conn, BACKEND, today)
    search_used = budget_state["searchUsed"]
    candidates_out = budget_state["candidatesOut"]

    progress = Progress(conn, run_id, search_used, candidates_out)
    progress.push()

    # A bucket with "enabled": False (e.g. Awards -- see categories.py) is skipped
    # entirely rather than removed, so its hand-picked queries/lane-state survive to be
    # reactivated later without re-authoring them.
    if FOCUS:
        focus_labels = FOCUS_LANES[FOCUS]
        lanes_by_label = {b["label"]: b for b in BUCKETS if b.get("enabled", True) and b["label"] in focus_labels}
    else:
        lanes_by_label = {b["label"]: b for b in BUCKETS if b.get("enabled", True) and not b.get("focusOnly")}
    lane_states = {label: get_lane_state(conn, BACKEND, label) for label in lanes_by_label}
    # Every enabled lane takes part: one whose hand-written queries ran out continues with
    # generated ones, and is only dropped from this run once the generator is out too.
    active = list(lane_states)

    stopped_by = None
    search_failed = False

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

            # Skip a query the ledger retired (2 consecutive zero-yield runs). The cursor
            # normally points at a query that hasn't run yet, so this only matters after
            # categories.py's list was edited. Keyed on the query TEXT only.
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
            serper_before = progress.serper_calls
            calls, new_count, results_count, failed = process_one_query(conn, run_id, query_bucket, query_text, kind, progress)
            own_calls = calls
            if BACKEND != "serper":
                # Korea checks and shelf-life lookups always use Serper (it finds Naver/
                # Coupang listings far better): they go on Serper's daily usage, not on this
                # backend's budget, which counts its own credits (config.py).
                serper_spent = progress.serper_calls - serper_before
                add_search_usage(conn, "serper", today, serper_spent)
                own_calls -= serper_spent

            search_used += own_calls
            candidates_out += new_count
            update_daily_budget(conn, BACKEND, today, own_calls, new_count)
            if failed:
                # The search itself failed (network, 429, 5xx): nothing was learned about this
                # query, so it isn't recorded or skipped past -- the lane sits out the rest of
                # this run and the same query runs next time.
                active.remove(label)
                search_failed = True
            else:
                record_query_result(conn, BACKEND, label, ledger_text, results_count, new_count)
                if not dynamic:
                    state["cursor"] += 1
                state["totalNewBrands"] += new_count
                save_lane_state(conn, BACKEND, label, state["cursor"], False, state["totalNewBrands"])

            progress.search_used = search_used
            progress.candidates_out = candidates_out
            progress.push()

            progressed_this_round = True

        if not progressed_this_round:
            break  # every remaining active lane got exhausted this round

    if stopped_by is None:
        stopped_by = ("search_error" if search_failed else "exhausted") if not active else "target"

    update_daily_budget(conn, BACKEND, today, 0, 0, stopped_by=stopped_by)
    progress.stage = "done"
    progress.stopped_by = stopped_by
    progress.push()
    conn.close()
    print(f"\nDone. {candidates_out} candidates today so far ({search_used} search calls). Stopped by: {stopped_by}")


if __name__ == "__main__":
    try:
        main()
    except (Exception, KeyboardInterrupt) as e:
        # KeyboardInterrupt too: a run stopped with Ctrl+C must not stay "running" forever.
        import traceback

        detail = traceback.format_exc()
        print(f"[fatal] {detail}", file=sys.stderr)
        try:
            fallback_run_id = sys.argv[1] if len(sys.argv) > 1 else _created_run_id
            if fallback_run_id:
                fallback_conn = get_connection()
                update_run_progress(
                    fallback_conn,
                    fallback_run_id,
                    # A key/credit problem is shown as-is (it's the whole story); anything
                    # else keeps its exception type for debugging.
                    {"stage": "error", "message": str(e) if isinstance(e, SearchAuthError) else f"{type(e).__name__}: {e}"},
                    status="error",
                )
                fallback_conn.close()
        except Exception:
            pass
        sys.exit(1)
