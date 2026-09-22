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

Usage:
    python main.py [run_id]
(invoked by the Node Server Action in src/app/brands/sourcing/python-actions.ts, which
passes the SourcingRun id it already created so the UI can start polling immediately;
running it bare from a terminal for manual testing still works, and creates its own run.)
"""

import sys
import time
from difflib import SequenceMatcher

# When Node spawns this with piped stdout/stderr (not a real console), Windows defaults
# the stream encoding to the system codepage (e.g. cp949 on Korean Windows) instead of
# UTF-8 -- printing an em-dash or any Korean text (both used throughout this pipeline)
# then crashes with a UnicodeEncodeError. Force UTF-8 so it never depends on the caller's
# console setup.
sys.stdout.reconfigure(encoding="utf-8", errors="replace")
sys.stderr.reconfigure(encoding="utf-8", errors="replace")

from categories import BUCKETS
from tavily_search import search
from name_filter import (
    is_blocked_domain,
    is_retailer_listing_page,
    is_article_page,
    domain_matches_name,
    guess_brand_name,
)
from site_scrape import scrape_candidate_site
from korea_check import check_korea_presence, classify_korea_status
from brand_rules import category_signal, ownership_signal, known_parent_in_name
from known_brands import known_excluded_brand, normalize_brand_name
from country_guess import guess_country_from_domain
from evaluate_client import evaluate_candidate
from db import get_connection, create_sourcing_run, insert_candidate, update_run_progress
from config import MAX_CANDIDATES_PER_BUCKET


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


def discover_bucket(bucket: dict) -> list[dict]:
    raw = []
    for query in bucket["queries"]:
        try:
            results = search(query, count=8)
        except Exception as e:
            print(f"  [warn] search failed for '{query}': {e}", file=sys.stderr)
            continue
        for r in results:
            if is_blocked_domain(r["url"]) or is_retailer_listing_page(r["url"]) or is_article_page(r["url"]):
                continue
            name = guess_brand_name(r["title"], r["url"])
            if not name:
                continue
            # The core quality fix: only accept a result if it's hosted on a domain that
            # IS the brand, not a domain merely writing/selling/listing ABOUT it -- this is
            # what actually separates "Buderim Ginger's own homepage" from "10 Leading
            # Gummy Candy Suppliers" (which lives on some unrelated blog's domain).
            if not domain_matches_name(name, r["url"]):
                continue
            raw.append({"name": name, "website": r["url"], "sourceSnippet": r["description"]})
    return raw


class Progress:
    """Tracks stage percentages + running counts and pushes them to SourcingRun.progress
    on every step, so the /brands/sourcing page can poll and show a live status instead
    of only finding out what happened after the whole script exits."""

    def __init__(self, conn, run_id: str, buckets_total: int):
        self.conn = conn
        self.run_id = run_id
        self.buckets_total = buckets_total
        self.buckets_done = 0
        self.candidates_total = 0
        self.website_done = 0  # candidates that finished this *step* -- for the stage %, real crawl or not
        self.korea_done = 0
        self.website_scraped = 0  # candidates that got an actual site crawl -- for the stat chip
        self.korea_checked = 0  # candidates that got an actual Korea search -- for the stat chip
        self.scoring_done = 0
        self.discovered = 0
        self.rejected = 0
        self.flagged = 0
        self.errors = 0
        self.skipped_crawl = 0  # rejected by the free checks before it would have needed a crawl
        self.stage = "discovery"

    @staticmethod
    def _pct(done: int, total: int) -> int:
        if total <= 0:
            return 0
        return min(100, round(done / total * 100))

    def push(self) -> None:
        discovery_pct = self._pct(self.buckets_done, self.buckets_total)
        payload = {
            "stage": self.stage,
            "stageProgress": {
                "discovery": discovery_pct,
                "dedup": discovery_pct,
                "website": self._pct(self.website_done, self.candidates_total),
                "koreaCheck": self._pct(self.korea_done, self.candidates_total),
                "scoring": self._pct(self.scoring_done, self.candidates_total),
            },
            "counts": {
                "discovered": self.discovered,
                "websitesScraped": self.website_scraped,
                "koreaChecked": self.korea_checked,
                "rejected": self.rejected,
                "flagged": self.flagged,
                "skippedCrawl": self.skipped_crawl,
            },
            "errors": self.errors,
        }
        update_run_progress(self.conn, self.run_id, payload)


def main():
    run_id = sys.argv[1] if len(sys.argv) > 1 else None
    conn = get_connection()
    if run_id is None:
        run_id = create_sourcing_run(conn)
    print(f"Sourcing run {run_id}")

    progress = Progress(conn, run_id, buckets_total=len(BUCKETS))
    progress.push()

    # Phase 1: discover + in-bucket dedupe across every bucket first, so the total
    # candidate count is known up front and website/Korea-check/scoring % are accurate
    # instead of jumping around bucket by bucket.
    pooled_by_bucket = []
    for bucket in BUCKETS:
        print(f"\n=== {bucket['label']} ===")
        raw_candidates = discover_bucket(bucket)
        pooled = dedupe_pooled(raw_candidates)[:MAX_CANDIDATES_PER_BUCKET]
        print(f"  {len(raw_candidates)} raw -> {len(pooled)} after in-bucket dedupe")
        pooled_by_bucket.append((bucket, pooled))
        progress.buckets_done += 1
        progress.discovered += len(pooled)
        progress.push()

    progress.candidates_total = progress.discovered
    progress.stage = "website"
    progress.push()

    total_inserted = 0

    for bucket, pooled in pooled_by_bucket:
        for candidate in pooled:
            # Dedup + category are free (DB lookups / regex only) -- check them *before*
            # spending the expensive steps (site crawl, Korea search). The 8th manual
            # round measured 24% of raw candidates as already-known duplicates, so this
            # ordering alone skips a crawl+search pair for roughly a quarter of candidates.
            try:
                pre_evaluation = evaluate_candidate(
                    {
                        "name": candidate["name"],
                        "website": candidate["website"],
                        "sku": bucket["category"],
                        "methodology": bucket["label"],
                        # Best-effort ccTLD guess -- normalizeCandidateFields only
                        # translates a country it's given, it never derives one, so
                        # without this every candidate's country column stayed blank.
                        "country": guess_country_from_domain(candidate["website"]),
                    }
                )
            except Exception as e:
                print(f"  [warn] evaluate-candidate call failed for '{candidate['name']}': {e}", file=sys.stderr)
                progress.errors += 1
                progress.skipped_crawl += 1
                progress.website_done += 1
                progress.korea_done += 1
                progress.scoring_done += 1
                progress.stage = "scoring"
                progress.push()
                continue

            verdict = pre_evaluation["verdict"]
            reason_parts = []
            if pre_evaluation["categoryExcluded"]["excluded"]:
                reason_parts.append(pre_evaluation["categoryExcluded"]["reason"])
            if pre_evaluation["duplicates"]:
                d = pre_evaluation["duplicates"][0]
                label = "existing brand" if d.get("source") == "brand" else "a previously found sourcing candidate"
                reason_parts.append(f"Possible duplicate of {label}: {d['name']} ({d['reason']})")

            # Cheap category signal from the search snippet alone -- keyword hits here
            # are still just signals (see brand_rules.py), not a claim the page was read.
            snippet_signal = category_signal(f"{candidate['name']} {candidate.get('sourceSnippet') or ''}")
            if snippet_signal:
                code, matched = snippet_signal
                verdict = "reject"
                reason_parts.append(f"Category signal in search snippet ({code}): '{matched}'")

            # 조건 C: 후보 "이름 자체"에 모기업 이름이 들어있으면 하드 제외 -- 이건
            # ButterFinger/Milky Way 같은 사례와 다르다. 그 브랜드들은 자기 이름에
            # "Ferrero"/"Mars"가 전혀 없으니 애초에 여기 안 걸린다 (known_parent_in_name
            # 이 이름 자체를 검사하는 이상, 여기 걸린다는 것 자체가 이미 "이 후보는 모기업의
            # 자체 페이지"라는 뜻 -- 실제 실행에서 정확히 이 패턴으로 Ferrero/Cargill/Orkla
            # 본사 페이지가 그대로 후보로 들어옴). 대기업 소유의 진짜 개별 브랜드는
            # ownership_signal(크롤링 텍스트의 "a brand of X" 문구)에서만 걸러지고, 거긴
            # 여전히 참고 문구로만 남긴다 -- 그쪽이 실제 마스터리스트 근거(ButterFinger 등)가
            # 있는 곳이다.
            name_parent_hit = known_parent_in_name(candidate["name"])
            if name_parent_hit:
                parent, rule_code = name_parent_hit
                verdict = "reject"
                label = "자사 포트폴리오와 동일 모기업 계열" if rule_code == "own_portfolio_parent" else "대형 멀티내셔널 본사/계열 페이지로 추정"
                reason_parts.append(f"소유구조 제외 ({label}): 후보명에 '{parent}' 포함")

            # 병행 Claude 파이프라인이 9라운드에 걸쳐 실제로 확인해둔 "이미 검토 끝난 브랜드"
            # 목록과 이름 대조 -- Tavily 호출 없이 공짜로 되는 체크라 여기서 먼저 한다. 이름이
            # 조금이라도 다르면 안 걸리는 한계는 있지만(정확일치만), 최소한 같은 브랜드를 두
            # 파이프라인이 각자 재검토하는 낭비는 막는다.
            known_hit = known_excluded_brand(candidate["name"])
            if known_hit:
                registry, known_reason = known_hit
                verdict = "reject"
                reason_parts.append(f"기배제 브랜드 등록부 일치 ({registry}): {known_reason}")

            site_info = {"foundedYear": None, "snippet": None}
            korea = {"hitCount": 0, "topHits": []}
            korea_status, korea_reason = "no_evidence_found", None

            if verdict == "reject":
                # Already rejected for free -- skip the crawl and the Korea search
                # entirely. website_done/korea_done still advance (they drive the stage
                # % bars, tracking "candidates done with this step" whether or not it
                # needed real work); skipped_crawl is the honest count of how many
                # candidates this saved a crawl+search on.
                progress.skipped_crawl += 1
                progress.website_done += 1
                progress.stage = "website"
                progress.push()
                progress.korea_done += 1
                progress.stage = "koreaCheck"
                progress.push()
            else:
                site_info = (
                    scrape_candidate_site(candidate["website"])
                    if candidate["website"]
                    else {"foundedYear": None, "snippet": None, "parked": False}
                )
                progress.website_done += 1
                progress.website_scraped += 1
                progress.stage = "website"
                progress.push()

                # 조건 D: 도메인이 매물 페이지로 리다이렉트되면 탈락 (병행 Claude 파이프라인
                # 인수인계 문서 실제 사례: 영국 Piccolo 이유식의 piccolo.co.uk가 GoDaddy
                # 매물 페이지였음). 이건 브랜드 자체가 나쁘다는 뜻이 아니라 지금 우리가 찾은
                # 도메인이 만료/오인일 수 있다는 뜻이라, reject보다는 재검토 여지를 남긴다.
                if site_info.get("parked"):
                    # Already invalid for free (a parked domain proves nothing about
                    # Korea distribution) -- skip the Korea search entirely, same
                    # cost-ordering principle as the pre-crawl reject branch above.
                    verdict = "reject"
                    reason_parts.append(
                        "조건 D 위반 — 도메인이 매물(parked) 페이지로 리다이렉트됨. "
                        "브랜드 자체 결함이 아니라 도메인이 만료/오인일 수 있음 — 다른 도메인으로 재확인 필요"
                    )
                    progress.skipped_crawl += 1
                    progress.korea_done += 1
                    progress.stage = "koreaCheck"
                    progress.push()
                else:
                    korea = check_korea_presence(candidate["name"])
                    korea_status, korea_reason = classify_korea_status(korea["topHits"], candidate["name"])
                    progress.korea_done += 1
                    progress.korea_checked += 1
                    progress.stage = "koreaCheck"
                    progress.push()

                    # Same category check again, now against the actual crawled page
                    # text -- far more likely to mention it than a two-line search
                    # snippet was. But unlike the snippet-level check above (which
                    # describes the whole business, e.g. "family-run distillery"), a
                    # single word on the site could just be one SKU out of many
                    # (Dean's of Huntly, a shortbread brand, has exactly one whisky
                    # fruit cake) -- so this stays a flagged note, never an automatic
                    # reject, until there's real SKU-level parsing.
                    site_text = site_info.get("snippet") or ""
                    site_signal = category_signal(site_text)
                    if site_signal:
                        code, matched = site_signal
                        reason_parts.append(
                            f"주의 — 제외 카테고리 문구 발견 ({code}): '{matched}' "
                            f"(브랜드 전체가 아니라 특정 제품일 수 있음, SKU 단위 확인 필요)"
                        )

                    # 조건 C: 자사 기존 포트폴리오와 같은 모기업이면 하드 제외. 대형
                    # 멀티내셔널 계열이라는 사실 자체는 참고 문구로만 남긴다 (위
                    # name_parent_hit 설명 참고 -- 실제 판정은 조건 A/한국 총판
                    # 여부가 한다).
                    owner_hit = ownership_signal(site_text)
                    if owner_hit:
                        parent, rule_code, matched = owner_hit
                        if rule_code == "own_portfolio_parent":
                            verdict = "reject"
                            reason_parts.append(f"소유구조 제외 (자사 포트폴리오와 동일 모기업 계열): {parent} ('{matched}')")
                        else:
                            reason_parts.append(f"참고 — 대기업 계열 브랜드로 추정: {parent} ('{matched}'), 한국 총판 여부로 별도 판단 필요")

                    # 조건 A: 지금 독점 총판 자리가 비어 있는지가 기준 -- 공식 총판이
                    # 이미 있으면 제외, 병행수입/구매대행만 있으면 오히려 우선
                    # 후보(제외 아님).
                    if korea_status == "official_distributor":
                        verdict = "reject"
                    reason_parts.append(korea_reason)
                    if korea_status == "parallel_import":
                        reason_parts.append("우선 후보: 수요는 검증됐고 총판 자리는 비어있는 것으로 추정됨")

                    if site_info.get("foundedYear"):
                        reason_parts.append(f"Founded year found on site: {site_info['foundedYear']}")
                    if site_info.get("snippet"):
                        reason_parts.append(f"Site snippet: {site_info['snippet'][:200]}")

            # 조건 G: 탈락 사유가 아니라 우선순위 조정용 참고 메모 (병행 Claude 파이프라인
            # 인수인계 문서 기준). 꿀은 검역 난이도가 특히 높다고 명시돼 있어 항상 표시.
            if bucket["category"] == "Honey" and verdict != "reject":
                reason_parts.append(
                    "참고 — 조건 G: 꿀은 검역 난이도 최상급 (축산물 검역, 잔류항생제·C4당 혼입 검사, "
                    "원산지 증명, 수출국 작업장 등록) — 탈락 아님, 우선순위 하향 참고"
                )

            if verdict == "pass":
                # Evidence-only: nothing here judged the remaining ambiguous ownership
                # cases or heritage-story quality, so "no problems found by the
                # mechanical check" is never promoted to "pass".
                verdict = "flag"

            if verdict == "reject":
                progress.rejected += 1
            else:
                progress.flagged += 1

            evidence = [candidate["website"]] if candidate["website"] else []
            evidence += [h["url"] for h in korea["topHits"][:3]]

            insert_candidate(
                conn,
                run_id,
                {
                    "name": candidate["name"],
                    "methodology": bucket["label"],
                    "country": pre_evaluation["normalized"].get("country"),
                    "sku": pre_evaluation["normalized"].get("sku"),
                    "foundedYear": site_info.get("foundedYear") or pre_evaluation["normalized"].get("foundedYear"),
                    "website": candidate["website"],
                    "verdict": verdict,
                    "reason": " | ".join(p for p in reason_parts if p),
                    "evidence": evidence,
                },
            )
            total_inserted += 1
            progress.scoring_done += 1
            progress.stage = "scoring"
            progress.push()
            print(f"  + {candidate['name']} -> {verdict}")
            time.sleep(0.3)  # stay polite to the search API's rate limit

    progress.stage = "done"
    update_run_progress(
        conn,
        run_id,
        {
            "stage": "done",
            "stageProgress": {"discovery": 100, "dedup": 100, "website": 100, "koreaCheck": 100, "scoring": 100},
            "counts": {
                "discovered": progress.discovered,
                "websitesScraped": progress.website_scraped,
                "koreaChecked": progress.korea_checked,
                "rejected": progress.rejected,
                "flagged": progress.flagged,
                "skippedCrawl": progress.skipped_crawl,
            },
            "errors": progress.errors,
        },
        status="done",
    )
    conn.close()
    print(f"\nDone. Inserted {total_inserted} candidates into run {run_id}.")


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
