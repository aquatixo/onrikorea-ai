"""Offline tests for query_generator (pure functions over a fake ledger, no DB/network).

Usage: python tests/test_query_generator.py
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from query_generator import MAX_PAGE, combinations, ledger_key, next_query, split_key, word_scores  # noqa: E402
from query_vocab import VOCAB  # noqa: E402


def row(key: str, hits: int, runs: int = 1) -> dict:
    return {"queryText": key, "timesRun": runs, "newCandidates": hits, "retired": False}


combos = combinations("Germany")
first, second = combos[0], combos[1]
v = VOCAB["Germany"]

# Paging case: one generated query that found 2 candidates on page 1.
hit_text = first["text"]
paging_ledger = [row(hit_text, 2)]
# Same query already paged to the last page -> no further paging.
maxed_ledger = [row(hit_text, 2)] + [row(ledger_key(hit_text, p), 1) for p in range(2, MAX_PAGE + 1)]
# Scoring case: "Marzipan" queries found candidates, "Lakritz" queries never did.
scored_ledger = [row("Marzipan Hersteller Bayern -Rezept", 3), row("Lakritz Hersteller -Rezept", 0), row("Lakritz Manufaktur -Rezept", 0)]
every_combo_done = [row(c["text"], 0) for c in combos]

CASES = [
    ("combination count = products x makers x (regions + no region)",
     len(combos), len(v["products"]) * len(v["makers"]) * (len(v["regions"]) + 1)),
    ("consecutive combinations change the product first", first["words"][0] != second["words"][0], True),
    ("generated text ends with the lane's exclude suffix", first["text"].endswith("-Rezept"), True),
    ("ledger key round-trips for page 1", split_key(ledger_key("x y", 1)), ("x y", 1)),
    ("ledger key round-trips for page 3", split_key(ledger_key("x y", 3)), ("x y", 3)),
    ("empty ledger -> first combination, page 1", next_query("Germany", [])["key"], first["text"]),
    ("a run combination is not repeated", next_query("Germany", [row(first["text"], 0)])["key"] != first["text"], True),
    ("a productive query continues to its next page first", next_query("Germany", paging_ledger)["key"], ledger_key(hit_text, 2)),
    ("paging stops at MAX_PAGE", next_query("Germany", maxed_ledger)["page"], 1),
    ("no paging when the backend can't page (Tavily)", next_query("Germany", paging_ledger, allow_paging=False)["page"], 1),
    ("a word whose queries found candidates scores above an untried word",
     word_scores("Germany", scored_ledger)["Marzipan"] > word_scores("Germany", scored_ledger)["Printen"], True),
    ("a word that keeps finding nothing scores below an untried word",
     word_scores("Germany", scored_ledger)["Lakritz"] < word_scores("Germany", scored_ledger)["Printen"], True),
    ("the next query prefers the productive product", "Marzipan" in next_query("Germany", scored_ledger, allow_paging=False)["text"], True),
    ("every combination run -> None (lane exhausted)", next_query("Germany", every_combo_done), None),
    ("a lane without vocabulary -> None", next_query("Awards", []), None),
    ("category comes from the product", next_query("Germany", [])["category"], first["category"]),
]


def main() -> int:
    failed = 0
    for label, got, expected in CASES:
        ok = got == expected
        print(f"[{'PASS' if ok else 'FAIL'}] {label}")
        if not ok:
            failed += 1
            print(f"         expected={expected!r} got={got!r}")
    print(f"\n{len(CASES) - failed}/{len(CASES)} passed, {failed} failed")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
