"""Offline tests for roster_harvest.harvest_from_html (synthetic HTML, no network) and
brand_resolve.resolve_site (stub search function).

Usage: python tests/test_roster_harvest.py
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from brand_resolve import resolve_site
from roster_harvest import harvest_from_html


def _items(n: int, tmpl: str) -> str:
    return "".join(
        tmpl.format(i=i, name=f"Pasticceria Rossi{i}") for i in range(n)
    )


PAGE = "https://consorzio.example.org/associati"

CASES = [
    {
        "label": "ul/li roster (each link has its own <li> parent)",
        "html": "<h1>Elenco produttori</h1><ul>"
        + _items(10, '<li><a href="https://rossi{i}.it/">{name}</a></li>')
        + "</ul>",
        "expect_count": 10,
    },
    {
        "label": "table roster (each link in its own <td>)",
        "html": "<h1>Members list</h1><table>"
        + _items(9, '<tr><td><a href="https://rossi{i}.com">{name}</a></td><td>Italy</td></tr>')
        + "</table>",
        "expect_count": 9,
    },
    {
        "label": "flat sibling links under one <p>",
        "html": "<h2>Winners</h2><p>"
        + _items(8, '<a href="https://rossi{i}.fr">{name}</a> ')
        + "</p>",
        "expect_count": 8,
    },
    {
        "label": "site navigation menu is not a roster (inside <nav>)",
        "html": "<nav><ul>"
        + _items(12, '<li><a href="https://shop{i}.com/">Brand {i}</a></li>')
        + "</ul></nav><p>Great Taste Awards winners list</p>",
        "expect_count": 0,
    },
    {
        "label": "too few links (7) is not a roster",
        "html": "<p>Winners list</p><ul>"
        + _items(7, '<li><a href="https://rossi{i}.it/">{name}</a></li>')
        + "</ul>",
        "expect_count": 0,
    },
    {
        "label": "links all to the same external host are not distinct producers",
        "html": "<p>Members list</p><ul>"
        + _items(10, '<li><a href="https://partner.com/p{i}">{name}</a></li>')
        + "</ul>",
        "expect_count": 0,
    },
    {
        "label": "link list on a page that never reads as a roster (no roster keyword)",
        "html": "<p>Our favourite shops</p><ul>"
        + _items(10, '<li><a href="https://rossi{i}.it/">{name}</a></li>')
        + "</ul>",
        "expect_count": 0,
    },
    {
        "label": "form/document codes are not names",
        "html": "<p>Elenco documenti</p><ul>"
        + _items(10, '<li><a href="https://forms{i}.example.com/f.pdf">DC{i}</a></li>')
        + "</ul>",
        "expect_count": 0,
    },
    {
        "label": "trade-fair calendar: repeated 'Official website' anchors (real false positive)",
        "html": "<p>Exhibitors list</p><ul>"
        + _items(10, '<li><a href="https://fair{i}.com/">Official website</a></li>')
        + "</ul>",
        "expect_count": 0,
    },
    {
        "label": "generic anchors with unique text ('Exhibitors list (online)') are not names",
        "html": "<p>Exhibitors list</p><ul>"
        + _items(10, '<li><a href="https://fair{i}.com/">Exhibitors list (online) {i}</a></li>')
        + "</ul>",
        "expect_count": 0,
    },
    {
        "label": "reference/citation list of quoted news headlines is not a roster (real false positive)",
        "html": "<h2>Winners</h2><ol>"
        + _items(10, '<li><a href="https://news{i}.com/a">"Manchego wins nail-biting World Cheese Awards {i}"</a></li>')
        + "</ol>",
        "expect_count": 0,
    },
    {
        "label": "sentence-length link texts are not names",
        "html": "<p>Winners list</p><ul>"
        + _items(10, '<li><a href="https://news{i}.com/a">US cheese takes top spot at World Cheese Awards {i}</a></li>')
        + "</ul>",
        "expect_count": 0,
    },
    {
        "label": "social links are ignored",
        "html": "<p>Members list</p><ul>"
        + _items(10, '<li><a href="https://facebook.com/rossi{i}">{name}</a></li>')
        + "</ul>",
        "expect_count": 0,
    },
]


def check_resolve() -> list[tuple[str, bool]]:
    results = []

    def search_hit(query, count=5):
        return [{"title": "Pasticceria Rossi", "url": "https://pasticceriarossi.it/", "description": "Dolci"}]

    r = resolve_site("Pasticceria Rossi", "Italy", search_hit)
    results.append(("resolve: official domain found", r["website"] == "https://pasticceriarossi.it/" and r["reason"] == "resolved"))

    def search_wrong(query, count=5):
        return [{"title": "Best bakeries", "url": "https://tripadvisor.com/xyz", "description": ""},
                {"title": "Other", "url": "https://unrelated-shop.com/", "description": ""}]

    r = resolve_site("Pasticceria Rossi", "Italy", search_wrong)
    results.append(("resolve: no matching domain -> None, capped at 2 searches", r["website"] is None and r["searchCalls"] == 2))

    def search_empty(query, count=5):
        return []

    r = resolve_site("Pasticceria Rossi", "Italy", search_empty)
    results.append(("resolve: empty results -> None, reason no_results", r["website"] is None and r["reason"] == "no_results"))

    return results


def main() -> int:
    passed = failed = 0
    for case in CASES:
        got = harvest_from_html(case["html"], PAGE)
        ok = len(got) == case["expect_count"]
        print(f"[{'PASS' if ok else 'FAIL'}] {case['label']}")
        if ok:
            passed += 1
        else:
            failed += 1
            print(f"         expected {case['expect_count']} names, got {len(got)}")
    for label, ok in check_resolve():
        print(f"[{'PASS' if ok else 'FAIL'}] {label}")
        if ok:
            passed += 1
        else:
            failed += 1
    print(f"\n{passed}/{passed + failed} passed, {failed} failed")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
