"""Regression runner for the mechanical junk filters in name_filter.py -- re-applies
the same filter chain main.py's process_one_query uses against each labeled fixture in
fixtures.py and reports PASS/FAIL. No network calls, no DB, runs in well under a second.

Usage: python tests/test_filters.py   (run from python-sourcing/, or anywhere -- this
file adds the parent directory to sys.path itself)

This is a regression net, not a correctness proof -- a FAIL means "this filter change
flipped a previously-agreed outcome", which is worth looking at, not necessarily wrong.
If the fixture's own expected label turns out to be the mistake, fix fixtures.py
deliberately and say why in the commit, don't just delete the fixture to make this pass.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from fixtures import FIXTURES
from name_filter import URL_FILTERS, domain_matches_name, generic_overlap_only, guess_brand_name


def classify(fixture: dict) -> tuple[str, str]:
    """Returns (outcome, reason) -- outcome is "keep" or "drop". Mirrors main.py's
    process_one_query step for step (including the generic_token_only split) -- this
    drifted once already (classify() called domain_matches_name directly without the
    same follow-up distinction main.py makes), which hid the exact thing this suite
    exists to show: how often that specific known gap is actually happening."""
    for reason, check in URL_FILTERS:
        if check(fixture):
            return "drop", reason
    name = guess_brand_name(fixture["title"], fixture["url"])
    if not name:
        return "drop", "no_name"
    if not domain_matches_name(name, fixture["url"]):
        reason = "generic_token_only" if generic_overlap_only(name, fixture["url"]) else "domain_mismatch"
        return "drop", reason
    return "keep", "-"


def main() -> int:
    passed = 0
    failed = 0
    drop_reasons: dict[str, int] = {}
    for fx in FIXTURES:
        outcome, reason = classify(fx)
        ok = outcome == fx["expect"]
        status = "PASS" if ok else "FAIL"
        if ok:
            passed += 1
        else:
            failed += 1
        if outcome == "drop":
            drop_reasons[reason] = drop_reasons.get(reason, 0) + 1
        print(f"[{status}] {fx['label']}")
        if not ok:
            print(f"         expected={fx['expect']!r} got={outcome!r} (via {reason})")

    print(f"\n{passed}/{len(FIXTURES)} passed, {failed} failed")
    if drop_reasons:
        print("drop reasons:", ", ".join(f"{k}={v}" for k, v in sorted(drop_reasons.items())))
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
