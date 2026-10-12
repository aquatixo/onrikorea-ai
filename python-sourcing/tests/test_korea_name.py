"""Offline tests for korea_check.korea_search_name.  python tests/test_korea_name.py"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from korea_check import korea_search_name  # noqa: E402

CASES = [
    ("南部せんべい乃 巖手屋", "https://www.iwateya.co.jp/", "iwateya"),
    ("株式会社レダ", "https://www.leda.co.jp/", "leda"),
    ("S HEART S", "https://www.s-heart-s.com/", "S HEART S"),  # Latin name kept as is
    ("桂新堂", "https://www.keishindo.co.jp/", "keishindo"),
    ("虎屋", "https://www.toraya-group.co.jp/", "toraya group"),
    ("白鳳堂", "https://www.hakuho-do.co.jp/", "hakuho do"),
    ("六花亭", "https://www.rokkatei.co.jp/", "rokkatei"),
    ("某社", "https://www.k2.co.jp/", "某社"),  # domain too short / has a digit -> keep name
    ("某社", None, "某社"),
]

if __name__ == "__main__":
    failed = 0
    for name, site, expected in CASES:
        got = korea_search_name(name, site)
        ok = got == expected
        failed += not ok
        print(f"[{'PASS' if ok else 'FAIL'}] {name} {site} -> {got!r}" + ("" if ok else f" (expected {expected!r})"))
    print(f"\n{len(CASES) - failed}/{len(CASES)} passed, {failed} failed")
    sys.exit(1 if failed else 0)
