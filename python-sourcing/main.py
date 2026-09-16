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
    python main.py
(invoked by the Node Server Action in src/app/brands/sourcing/python-actions.ts)
"""

import sys
import time
from difflib import SequenceMatcher

from categories import BUCKETS
from brave_search import search
from site_scrape import scrape_candidate_site
from korea_check import check_korea_presence
from evaluate_client import evaluate_candidate
from db import get_connection, create_sourcing_run, insert_candidate
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
            name = guess_name_from_result(r)
            if name:
                raw.append({"name": name, "website": r["url"], "sourceSnippet": r["description"]})
    return raw


def main():
    conn = get_connection()
    run_id = create_sourcing_run(conn)
    print(f"Created SourcingRun {run_id}")

    total_inserted = 0

    for bucket in BUCKETS:
        print(f"\n=== {bucket['label']} ===")
        raw_candidates = discover_bucket(bucket)
        pooled = dedupe_pooled(raw_candidates)[:MAX_CANDIDATES_PER_BUCKET]
        print(f"  {len(raw_candidates)} raw -> {len(pooled)} after in-bucket dedupe")

        for candidate in pooled:
            site_info = (
                scrape_candidate_site(candidate["website"])
                if candidate["website"]
                else {"foundedYear": None, "snippet": None}
            )
            korea = check_korea_presence(candidate["name"])

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
                continue

            verdict = evaluation["verdict"]
            if verdict == "pass":
                # Evidence-only: nothing here judged ownership/heritage/Korea-distribution,
                # so "no problems found by the mechanical check" is never promoted to "pass".
                verdict = "flag"

            reason_parts = []
            if evaluation["categoryExcluded"]["excluded"]:
                reason_parts.append(evaluation["categoryExcluded"]["reason"])
            if evaluation["duplicates"]:
                d = evaluation["duplicates"][0]
                reason_parts.append(f"Possible duplicate of existing brand: {d['name']} ({d['reason']})")
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
            print(f"  + {candidate['name']} -> {verdict}")
            time.sleep(0.3)  # stay polite to Brave's rate limit

    conn.close()
    print(f"\nDone. Inserted {total_inserted} candidates into run {run_id}.")


if __name__ == "__main__":
    main()
