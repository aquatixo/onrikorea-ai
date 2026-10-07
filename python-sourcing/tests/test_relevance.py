"""Offline tests for relevance.check_food_relevance and the headline-shaped name filter.
Texts are condensed from the real pages of a real run (heirloom-seed shops that came back
as "brand candidates", Welsh/German bakeries that are real). Usage: python tests/test_relevance.py
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from name_filter import is_plausible_brand_name
from relevance import check_food_relevance, name_on_site


def pad(s: str) -> str:
    return (s + " ") * (450 // max(len(s), 1) + 1)


SEED_SITE = pad(
    "Open pollinated heirloom vegetable seeds and garden supplies. Shop seeds by planting "
    "zone, germination tips, perennial flowers. Chocolate cosmos and sweet corn varieties."
)
BAKERY_SITE = pad(
    "Handmade Welshcakes and traditional bakes made in Wales. Shop our cakes, biscuits and "
    "shortbread. Family bakery baking since 1995."
)
GERMAN_CANDY = pad(
    "Bonbonkocherei Herzlich willkommen. Handgemachte Bonbons und Lakritz, Karamell und "
    "Schokolade aus unserer Manufaktur. Bonbons zum Probieren."
)
LIFESTYLE_BLOG = (
    "Life in Abruzzo: travel diaries, hiking itineraries, village festivals and local "
    "history of the region. " * 120
) + " One day we tasted cookies, a cake and some chocolate. "

COOKIE_BANNER_GARDEN = pad(
    "This website uses cookies to improve your experience. Accept all cookies. Cookie policy. "
    "Garden seeds, vegetable seeds, planting guide, nursery plants."
)

from bs4 import BeautifulSoup
from site_profile import _internal_links

_BAD_LINKS_HTML = '<a href="http://[broken">x</a><a href="/about-us">About</a><a href="https://other.com/">ext</a>'

from country_guess import guess_country_from_text
from name_filter import domain_matches_name, looks_like_reseller, pick_brand_name, strip_shop_words

CASES = [
    ("a malformed href is skipped, not raised (would abort the run)", [h for _, h in _internal_links(BeautifulSoup(_BAD_LINKS_HTML, "html.parser"), "https://maker.example/")], ["https://maker.example/about-us"]),
    # name correction -- every case below is a real (current name, site's own name, url) from a run
    ("keeps 'La Maison Guella' over the site's long SEO title", pick_brand_name("La Maison Guella", "Biscuiterie La Maison Guella - Cancale Saint-Malo Dinard Dinan", "https://www.lamaisonguella.com/"), "La Maison Guella"),
    ("replaces a product title with the company name", pick_brand_name("Dresdner Christstollen", "Dresdner Mühlenbäckerei", "https://dresdner-muehlenbaeckerei.de/"), "Dresdner Mühlenbäckerei"),
    ("replaces a title with a tagline tail by the clean site name", pick_brand_name("Confiteria Ancla » Rosquillas tradicionales gallegas", "Confiteria Ancla", "https://confiteriaancla.com/"), "Confiteria Ancla"),
    ("replaces a lone fragment ('Malo') with the full brand", pick_brand_name("Malo", "Kouign Amann de Saint-Malo", "https://kouignamanndesaintmalo.com/"), "Kouign Amann de Saint-Malo"),
    ("keeps the name when the site name is a bare symbol", pick_brand_name("Pure Vermont Organic Maple Sugar Candy", "|", "https://hivuemaples.com/"), "Pure Vermont Organic Maple Sugar Candy"),
    ("no site name -> unchanged", pick_brand_name("Shriver's", None, "https://shrivers.com/"), "Shriver's"),
    # reseller / hamper sites and shop-word stripping for duplicate checks
    ("gift-hamper reseller is detected", looks_like_reseller("Fine Scottish Hampers"), True),
    ("whisky & venison hamper tagline is detected", looks_like_reseller("Whisky, Smoked Salmon & Venison Hampers"), True),
    ("a normal bakery is not a reseller", looks_like_reseller("Welsh Cottage Cakes"), False),
    ("a confectionery wholesaler named as such is a reseller", looks_like_reseller("Jakob Distler Süßwarengroßhandel in Nürnberg"), True),
    ("an Italian 'ingrosso' is a reseller", looks_like_reseller("Dolciaria Rossi Ingrosso"), True),
    ("a maker describing its own wholesale channel is NOT a reseller", looks_like_reseller("Southern Candy Wholesale Manufacturer"), False),
    ("a hamper name is not a plausible brand name", is_plausible_brand_name("Fine Scottish Hampers"), False),
    ("'Lambertz Online' is checked for duplicates as 'Lambertz'", strip_shop_words("Lambertz Online"), "Lambertz"),
    ("'Shop' is stripped too", strip_shop_words("Bonbon Shop"), "Bonbon"),
    ("a name that is only shop words is left alone", strip_shop_words("Online Shop"), "Online Shop"),
    ("product page on a shop: long title sharing only a place name is not the domain's brand", domain_matches_name("Olde Colony Bakery Original Charleston Benne Wafers", "https://essentiallycharleston.com/products/olde-colony-benne-wafers"), False),
    ("same long title on a site's own homepage keeps the lenient match", domain_matches_name("La véritable Recette de Kouign Amann Breton par Kerjeanne", "https://patisseriebretonne.fr/"), True),
    ("short real name still matches its domain", domain_matches_name("Printenbäckerei Klein", "https://klein-printen.de/"), True),
    ("two-word real name on its own domain", domain_matches_name("Sorelle Nurzia", "https://sorellenurzia.com/"), True),
    ("US bakery on a .com (prices in $, 1-800 number) -> USA", guess_country_from_text("Your Italian Bakery Fresh Panettone FREE SHIPPING OVER $199 1-800-634-4363 Buffalo"), "USA"),
    ("UK shop (pound prices + Wales) -> UK", guess_country_from_text("Handmade Welshcakes £4.50 made in Wales, delivered across the UK"), "UK"),
    ("a single weak marker is not enough", guess_country_from_text("Panettone da 5 $ al kg"), None),
    ("no markers -> None", guess_country_from_text("Torrone tenero al cioccolato dell'Aquila"), None),
    ("seed shop is not a food site", check_food_relevance(SEED_SITE, "Harris Seeds")[0], False),
    ("Welsh bakery is a food site", check_food_relevance(BAKERY_SITE, "Popty Bach Y Wlad")[0], True),
    ("German candy maker is a food site", check_food_relevance(GERMAN_CANDY, "Bonbonkocherei")[0], True),
    ("lifestyle/travel blog that mentions cookies a few times is not a food brand site", check_food_relevance(LIFESTYLE_BLOG, "Life in Abruzzo")[0], False),
    ("cookie-consent banner does not count as food", check_food_relevance(COOKIE_BANNER_GARDEN, "X Seeds")[0], False),
    ("short page text, neutral name -> cannot tell (None)", check_food_relevance("Welcome", "Bonbonmacherei Berlin")[0], None),
    ("short page text, clearly non-food name -> drop", check_food_relevance("Welcome", "High Desert Seed + Gardens")[0], False),
    ("short page text, food name with a non-food word -> not dropped", check_food_relevance("", "Garden Cakes Bakery")[0], None),
    ("Japanese list page title is not a brand name", is_plausible_brand_name("お菓子OEMメーカー一覧"), False),
    ("Japanese job page title is not a brand name", is_plausible_brand_name("求人一覧"), False),
    ("headline with question mark is not a brand name", is_plausible_brand_name("製菓メーカーとは？ 製菓会社の特徴"), False),
    ("headline with exclamation is not a brand name", is_plausible_brand_name("お菓子メーカーの就職は企業研究から！"), False),
    ("news headline with brackets/commas is not a brand name", is_plausible_brand_name("盛岡に「小松製菓」の新工場開設へ 人が集い、南部せんべい"), False),
    ("JP name found on its own site -> True", name_on_site("南部せんべい乃 巖手屋（いわてや）", "南部せんべい乃 巖手屋（いわてや） ナビゲーション お知らせ " * 10), True),
    ("JP company name missing from a directory site -> False", name_on_site("株式会社佐々木製菓", "トップページ いわてFOOD＆CRAFT バイヤーズ商談ナビ 人気検索ワード ギフト 鍋 簡単 美味しい 限定 受賞 お得 新着トピックス 一覧 カテゴリー別商品一覧 検索タグ " * 3), False),
    ("JP name, page text too short -> cannot tell", name_on_site("株式会社佐々木製菓", "短い"), None),
    ("a bare domain is not a brand name (bestofocnj.com)", is_plausible_brand_name("bestofocnj.com"), False),
    ("a Japanese trade cooperative is not a brand", is_plausible_brand_name("京都八ツ橋商工業協同組合"), False),
    ("an association is not a brand", is_plausible_brand_name("Scottish Bakers Association"), False),
    ("a consorzio is not a brand", is_plausible_brand_name("Consorzio Tutela Amaretti"), False),
    ("real Japanese shop name stays", is_plausible_brand_name("虎屋"), True),
    ("brand with an apostrophe stays", is_plausible_brand_name("Shriver's"), True),
    ("brand with a dot and a space stays", is_plausible_brand_name("J. Hornig"), True),
    ("real Latin brand name stays", is_plausible_brand_name("Bonbonkocherei"), True),
]


def main() -> int:
    failed = 0
    for label, got, expected in CASES:
        ok = got is expected or got == expected
        print(f"[{'PASS' if ok else 'FAIL'}] {label}")
        if not ok:
            failed += 1
            print(f"         expected={expected!r} got={got!r}")
    print(f"\n{len(CASES) - failed}/{len(CASES)} passed, {failed} failed")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
