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
from name_filter import is_plausible_brand_name, is_blocked_domain, domain_matches_name
from site_scrape import scrape_candidate_site
from korea_check import check_korea_presence
from evaluate_client import evaluate_candidate
from db import get_connection, create_sourcing_run, insert_candidate, update_run_progress
from config import MAX_CANDIDATES_PER_BUCKET


def similarity(a: str, b: str) -> float:
    return SequenceMatcher(None, a.lower(), b.lower()).ratio()


def dedupe_pooled(candidates: list[dict]) -> list[dict]:
    kept = []
    for c in candidates:
        if not any(similarity(c["name"], k["name"]) >= 0.84 for k in kept):
            kept.append(c)
    return kept


def guess_name_from_result(result: dict) -> str:
    """Best-effort brand name from a search result title. Without an LLM to actually
    read and identify 'this is a brand called X', this is a mechanical heuristic and
    will be noisier than the AI-driven discovery -- that's an inherent tradeoff, not a bug."""
    title = result["title"]
    for sep in [" | ", " – ", " — ", " - "]:
        if sep in title:
            title = title.split(sep)[0]
    return title.strip()


def discover_bucket(bucket: dict) -> list[dict]:
    raw = []
    for query in bucket["queries"]:
        try:
            results = search(query, count=8)
        except Exception as e:
            print(f"  [warn] search failed for '{query}': {e}", file=sys.stderr)
            continue
        for r in results:
            if is_blocked_domain(r["url"]):
                continue
            name = guess_name_from_result(r)
            if not name or not is_plausible_brand_name(name):
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
        self.website_done = 0
        self.korea_done = 0
        self.scoring_done = 0
        self.discovered = 0
        self.rejected = 0
        self.flagged = 0
        self.errors = 0
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
                "websitesScraped": self.website_done,
                "koreaChecked": self.korea_done,
                "rejected": self.rejected,
                "flagged": self.flagged,
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
            site_info = (
                scrape_candidate_site(candidate["website"])
                if candidate["website"]
                else {"foundedYear": None, "snippet": None}
            )
            progress.website_done += 1
            progress.stage = "website"
            progress.push()

            korea = check_korea_presence(candidate["name"])
            progress.korea_done += 1
            progress.stage = "koreaCheck"
            progress.push()

            try:
                evaluation = evaluate_candidate(
                    {
                        "name": candidate["name"],
                        "website": candidate["website"],
                        "foundedYear": site_info.get("foundedYear"),
                        "sku": bucket["category"],
                        "methodology": bucket["label"],
                    }
                )
            except Exception as e:
                print(f"  [warn] evaluate-candidate call failed for '{candidate['name']}': {e}", file=sys.stderr)
                progress.errors += 1
                progress.scoring_done += 1
                progress.stage = "scoring"
                progress.push()
                continue

            verdict = evaluation["verdict"]
            if verdict == "pass":
                # Evidence-only: nothing here judged ownership/heritage/Korea-distribution,
                # so "no problems found by the mechanical check" is never promoted to "pass".
                verdict = "flag"

            if verdict == "reject":
                progress.rejected += 1
            else:
                progress.flagged += 1

            reason_parts = []
            if evaluation["categoryExcluded"]["excluded"]:
                reason_parts.append(evaluation["categoryExcluded"]["reason"])
            if evaluation["duplicates"]:
                d = evaluation["duplicates"][0]
                label = "existing brand" if d.get("source") == "brand" else "a previously found sourcing candidate"
                reason_parts.append(f"Possible duplicate of {label}: {d['name']} ({d['reason']})")
            if site_info.get("foundedYear"):
                reason_parts.append(f"Founded year found on site: {site_info['foundedYear']}")
            if site_info.get("snippet"):
                reason_parts.append(f"Site snippet: {site_info['snippet'][:200]}")
            reason_parts.append(
                f"Korea search signal: {korea['hitCount']} raw hits across 총판/쿠팡 queries "
                f"(NOT a verdict — could be a real distributor, a reseller, or an unrelated "
                f"same-named company; check the evidence links)"
            )

            evidence = [candidate["website"]] if candidate["website"] else []
            evidence += [h["url"] for h in korea["topHits"][:3]]

            insert_candidate(
                conn,
                run_id,
                {
                    "name": candidate["name"],
                    "methodology": bucket["label"],
                    "country": evaluation["normalized"].get("country"),
                    "sku": evaluation["normalized"].get("sku"),
                    "foundedYear": evaluation["normalized"].get("foundedYear"),
                    "website": candidate["website"],
                    "verdict": verdict,
                    "reason": " | ".join(reason_parts),
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
                "websitesScraped": progress.website_done,
                "koreaChecked": progress.korea_done,
                "rejected": progress.rejected,
                "flagged": progress.flagged,
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
