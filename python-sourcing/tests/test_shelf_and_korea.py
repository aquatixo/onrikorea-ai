"""Offline tests for the 2026-10-19 review fixes: shelf-life reading, the Korea check, and
the site-judgment words that used to reject real makers.  python tests/test_shelf_and_korea.py"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from brand_rules import category_signal  # noqa: E402
from name_filter import _RESELLER_WORDS  # noqa: E402
from korea_check import _OFFICIAL_PHRASES, _is_korea_retail_hit, classify_korea_status  # noqa: E402
from shelf_life import chilled_hits, shelf_life_months  # noqa: E402
from site_profile import (  # noqa: E402
    _FRESH_WORDS,
    _GROUP_EXCLUDED_WORDS,
    _GROUP_TARGET_WORDS,
    _OFF_TARGET_WORDS,
    _PUBLISHER_MARKERS,
    _RETAILER_MARKERS,
    _THIN_DISTRIBUTOR,
    judge,
)

SHELF = [
    ("Shelf life: 18 months from production", 18),
    ("Our biscuits have a shelf life of 12 and 18 months", 18),
    ("MHD: 12 Monate ab Herstellung", 12),
    ("12 Monate haltbar", 12),
    ("durata: 24 mesi", 24),
    ("24 mesi di conservabilità", 24),
    ("DLUO : 6 mois", 6),
    ("Durée de conservation 1 an", 12),
    ("vida útil de 18 meses", 18),
    ("賞味期限：製造日より180日", 6),
    ("賞味期限 製造日から1年", 12),
    ("賞味期限 6〜12ヶ月", 12),
    ("賞味期限 2027年3月", None),  # a date, not a duration
    ("Fresh cake, best before 5 days", 0),
    ("Conservation du patrimoine depuis 150 ans", None),
    ("Founded 1890. We bake daily.", None),
    ("shelf life 12 months; fresh truffles 3 weeks shelf life", 12),  # longest one counts
    ("Bei Pralinen reicht die Haltbarkeit von 4 Wochen bis zu einem halben Jahr.", 6),  # Felicitas
    ("Our toffee has a shelf life of a full year", 12),
    ("賞味期限は半年です", 6),
    ("durata di due anni", 24),
    ("宝製菓 バタークッキー 139g ; 賞味期限, 300日 ; 商品説明", 10),  # a real Google snippet
]

CHILLED = [
    ("Keep refrigerated", 1),
    ("Do not refrigerate. Store in a cool dry place", 0),
    ("kühl und trocken lagern", 0),
    ("要冷蔵", 1),
    ("gelato artigianale", 0),  # names a cold product, says nothing about storage (Babbi)
    ("Keep refrigerated. Our gelato", 2),
    ("do not keep refrigerated", 0),
]

# (pattern, text, should_match)
WORDS = [
    (_OFFICIAL_PHRASES, "휘태커스 Whittaker's 초콜릿 공식수입원", True),
    (_OFFICIAL_PHRASES, "Whittaker's 정식수입 정품", True),
    (_OFFICIAL_PHRASES, "Whittaker's 공식 판매처", True),
    (_OFFICIAL_PHRASES, "Whittaker's 브랜드관", True),
    (_OFFICIAL_PHRASES, "Whittaker's 공식스토어", True),
    (_OFFICIAL_PHRASES, "Whittaker's 한국 총판 모집", False),  # looking FOR a distributor
    (_PUBLISHER_MARKERS, "メディア掲載 店舗を探す", False),  # a maker's homepage menu
    (_PUBLISHER_MARKERS, "掲載お申し込みはこちら", True),
    (_RETAILER_MARKERS, "Handmade chocolates, gift boxes and Christmas hampers", False),
    (_RETAILER_MARKERS, "Shop by brand", True),
    (_OFF_TARGET_WORDS, "pasta di mandorle siciliana", False),
    (_OFF_TARGET_WORDS, "pastas de té artesanas", False),
    (_OFF_TARGET_WORDS, "pasta fresca all'uovo", True),
    (_FRESH_WORDS, "sandwich biscuits", False),
    (_FRESH_WORDS, "pain d'épices de Dijon", False),
    (_FRESH_WORDS, "a pan-European distributor", False),
    (_FRESH_WORDS, "fresh sandwiches daily", True),
    (_FRESH_WORDS, "カステラ", True),
    (_GROUP_EXCLUDED_WORDS["beauty"], "肌を明るくします", False),  # くし inside 明るくし
    (_GROUP_EXCLUDED_WORDS["beauty"], "for combination skin", False),
    (_GROUP_EXCLUDED_WORDS["beauty"], "LEDマスク", False),  # a beauty device
    (_GROUP_EXCLUDED_WORDS["beauty"], "フェイスマスク", True),
    (_GROUP_TARGET_WORDS["beauty"], "new items and systems", False),  # "EMS" inside words
    (_GROUP_TARGET_WORDS["beauty"], "EMS美顔器", True),
    # 2026-10-19 run: two distributors and a beekeeper that got through.
    (_RESELLER_WORDS, "Distributeur de bonbons et confiseries - Confiserie Mondoux", True),
    (_THIN_DISTRIBUTOR, "Wholesale candy, snacks, and sundries — family-owned since 1924", True),
    (_THIN_DISTRIBUTOR, "Southern Candy Wholesale Manufacturer — Handmade Since 1918", False),  # Dillon Candy, a maker
    (_OFF_TARGET_WORDS, "Traditionsimkerei seit 1904 Propolis Gelée Royale", True),
]

CATEGORY = [
    ("We are an OEM partner", "oem_b2b"),
    ("fresh anchovies", "seafood"),
    ("our distillery", "alcohol"),
    ("contract manufacturing", "oem_b2b"),
    ("dairy-free chocolate", None),
]

RETAIL_HOSTS = [
    ("https://blog.naver.com/x/1", False),
    ("https://cafe.naver.com/a", False),
    ("https://news.chosun.co.kr/a", False),
    ("https://smartstore.naver.com/shop/products/1", True),
    ("https://www.coupang.com/vp/products/1", True),
]


def _hits(title: str, n: int) -> list[dict]:
    return [{"title": title, "description": "", "url": f"https://www.coupang.com/vp/products/{i}"} for i in range(n)]


KOREA = [
    # Unrelated category pages on Coupang are no evidence about THIS brand.
    (_hits("초콜릿 모음 여러 브랜드", 3), "Whittaker's", 0, "no_evidence_found"),
    (_hits("Whittaker's 밀크초콜릿", 3), "Whittaker's", 0, "parallel_import"),
    (_hits("Whittaker's 정식수입 초콜릿", 1), "Whittaker's", 0, "official_distributor"),
    ([], "Whittaker's", 2, "check_failed"),
    ([], "Whittaker's", 0, "no_evidence_found"),
]


def _profile(**over) -> dict:
    base = {
        "readable": True, "parked": False, "selfTitle": "Maker", "pageTitle": "Maker",
        "publisherTypes": [], "publisherHits": 0, "dateStamps": 0, "retailerHits": 0,
        "producerHits": 3, "trade": "거래/도매 링크: 'Wholesale'", "food": (True, "식품"),
        "fullText": "x" * 3000, "freshHits": 0, "shelfHits": 10, "offTargetHits": 0,
        "targetHits": 10, "chilledHits": 0, "shelfLifeMonths": None,
    }
    return {**base, **over}


JUDGE = [
    (_profile(), "ok"),
    (_profile(shelfLifeMonths=6), "shelf_life_short"),
    (_profile(shelfLifeMonths=18), "ok"),
    (_profile(chilledHits=8, shelfHits=10), "chilled_frozen"),
    (_profile(chilledHits=8, shelfHits=10, shelfLifeMonths=12), "ok"),  # stated shelf life wins
    (_profile(chilledHits=2), "ok"),
]


if __name__ == "__main__":
    total = failed = 0

    def check(ok: bool, label: str) -> None:
        global total, failed
        total += 1
        failed += not ok
        print(f"[{'PASS' if ok else 'FAIL'}] {label}")

    for text, expected in SHELF:
        got = shelf_life_months(text)
        check(got == expected, f"shelf {text!r} -> {got} (expected {expected})")
    for text, expected in CHILLED:
        got = chilled_hits(text)
        check(got == expected, f"chilled {text!r} -> {got}")
    for pattern, text, expected in WORDS:
        got = bool(pattern.search(text))
        check(got == expected, f"words {text!r} -> {got}")
    for text, expected in CATEGORY:
        got = category_signal(text)
        check((got[0] if got else None) == expected, f"category {text!r} -> {got}")
    for url, expected in RETAIL_HOSTS:
        check(_is_korea_retail_hit(url) == expected, f"retail host {url}")
    for hits, name, failed_searches, expected in KOREA:
        got = classify_korea_status(hits, name, failed_searches)[0]
        check(got == expected, f"korea {hits[0]['title'] if hits else '(no hits)'} failed={failed_searches} -> {got}")
    for profile, expected in JUDGE:
        got = judge(profile, "Maker", "https://maker.example/")[1]
        check(got == expected, f"judge shelf={profile['shelfLifeMonths']} chilled={profile['chilledHits']} -> {got}")

    print(f"\n{total - failed}/{total} passed, {failed} failed")
    sys.exit(1 if failed else 0)
