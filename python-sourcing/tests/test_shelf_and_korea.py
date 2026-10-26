"""Offline regression tests for the candidate-judgment rules: shelf-life reading, the Korea
check, reseller/maker wording, site judgment, names, country and founded year. Every case
here is a real misfire found in a run or a review (2026-10-19 .. 10-23), kept so it can't
come back.  python tests/test_shelf_and_korea.py"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from brand_rules import category_signal  # noqa: E402
from country_guess import guess_country_from_text  # noqa: E402
from korea_check import (  # noqa: E402
    _OFFICIAL_PHRASES,
    _is_korea_retail_hit,
    classify_korea_status,
    korea_search_name,
    korea_shop_hits,
)
from jp_reading import korean_reading, with_korean_reading  # noqa: E402
from main import dedupe_pooled  # noqa: E402
from name_filter import (  # noqa: E402
    brand_domain_label,
    guess_brand_name,
    japanese_site_name,
    looks_like_reseller,
    pick_brand_name,
)
from relevance import check_food_relevance, check_group_relevance  # noqa: E402
from shelf_life import chilled_hits, names_cold_product, shelf_life_months  # noqa: E402
from site_profile import (  # noqa: E402
    _DIRECTORY_TITLE,
    _FRESH_WORDS,
    _GIFT_LINK,
    _GROUP_EXCLUDED_WORDS,
    _GROUP_TARGET_WORDS,
    _OFF_TARGET_WORDS,
    _PRODUCER_MARKERS,
    _PUBLISHER_MARKERS,
    _RETAILER_MARKERS,
    _TARGET_WORDS,
    _THIN_DISTRIBUTOR,
    _TRADE_LINK,
    _japanese_middleman,
    judge,
)
from site_scrape import extract_founded_year, has_export_signal  # noqa: E402

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
    ("conservation du patrimoine depuis 3 ans", None),  # not a shelf life at all
    ("durata 3 giorni", None),  # a trade fair
    ("Founded 1890. We bake daily.", None),
    ("shelf life 12 months; fresh truffles 3 weeks shelf life", 12),  # longest one counts
    ("Bei Pralinen reicht die Haltbarkeit von 4 Wochen bis zu einem halben Jahr.", 6),  # Felicitas
    ("Our toffee has a shelf life of a full year", 12),
    ("賞味期限は半年です", 6),
    ("durata di due anni", None),  # "durata" alone is not a shelf-life keyword any more
    ("宝製菓 バタークッキー 139g ; 賞味期限, 300日 ; 商品説明", 10),  # a real Google snippet
    # After opening -- not the product's shelf life.
    ("Nach dem Öffnen 4 Wochen haltbar", None),
    ("Conservabilità dopo l'apertura: 10 giorni", None),
    ("Conservation : après ouverture, 3 jours", None),
    ("賞味期限：開封後3日以内に", None),
    ("Best before 3 days after opening", None),
    ("Shelf life 12 months. Once opened, consume within 4 weeks", 12),
]

CHILLED = [
    ("Keep refrigerated", 1),
    ("Do not refrigerate. Store in a cool dry place", 0),
    ("kühl und trocken lagern", 0),
    ("要冷蔵", 1),
    ("gelato artigianale", 0),  # names a cold product, says nothing about storage (Babbi)
    ("Keep refrigerated. Our gelato", 2),
    ("do not keep refrigerated", 0),
    ("Keep refrigerated after opening. " * 3, 0),  # spreads and caramel sauces
    ("Don't keep them in the fridge", 0),
    ("開封後は要冷蔵", 0),
]

COLD_TITLES = [
    ("Terre adélice | Fabricant de glaces artisanales 100 % Bio", True),
    ("Ingredienti per Gelato e Specialità Dolciarie dal 1952 Babbi", False),  # supplies ice-cream shops
    ("Marrons glacés de Provence", False),  # glazed, not ice cream
    ("Biscuiterie: galettes, sablés et sucre glace", False),  # icing sugar
    ("Glace cherries in syrup", False),
    ("ロイズ 生チョコレート", False),
]

# (pattern, text, should_match)
WORDS = [
    (_OFFICIAL_PHRASES, "휘태커스 Whittaker's 초콜릿 공식수입원", True),
    (_OFFICIAL_PHRASES, "Whittaker's 공식 판매처", True),
    (_OFFICIAL_PHRASES, "Whittaker's 브랜드관", True),
    (_OFFICIAL_PHRASES, "Whittaker's 공식스토어", True),
    (_OFFICIAL_PHRASES, "Whittaker's 독점수입", True),
    (_OFFICIAL_PHRASES, "Whittaker's 정식수입원", True),
    # Parallel importers' own wording, recruitment ads, negations -- not an official distributor.
    (_OFFICIAL_PHRASES, "Whittaker's 정식수입 통관 제품", False),
    (_OFFICIAL_PHRASES, "Whittaker's 정식 수입 정품", False),
    (_OFFICIAL_PHRASES, "Whittaker's 한국 총판 모집", False),
    (_OFFICIAL_PHRASES, "Whittaker's 독점 총판 모집", False),
    (_OFFICIAL_PHRASES, "Whittaker's 공식 대리점 모집", False),
    (_OFFICIAL_PHRASES, "Whittaker's 공식 판매처가 아닙니다", False),
    (_PUBLISHER_MARKERS, "メディア掲載 店舗を探す", False),  # a maker's homepage menu
    (_PUBLISHER_MARKERS, "掲載お申し込みはこちら", True),
    (_RETAILER_MARKERS, "Handmade chocolates, gift boxes and Christmas hampers", False),
    (_RETAILER_MARKERS, "Shop by brand", True),
    (_OFF_TARGET_WORDS, "pasta di mandorle siciliana", False),
    (_OFF_TARGET_WORDS, "pastas de té artesanas", False),
    (_OFF_TARGET_WORDS, "pasta di nocciole", False),
    (_OFF_TARGET_WORDS, "pasta gianduia", False),
    (_OFF_TARGET_WORDS, "pasta fresca all'uovo", True),
    (_OFF_TARGET_WORDS, "honeycomb toffee", False),
    (_OFF_TARGET_WORDS, "Honigkuchen", False),
    (_OFF_TARGET_WORDS, "raw wildflower honey", True),
    (_OFF_TARGET_WORDS, "Traditionsimkerei seit 1904 Propolis Gelée Royale", True),
    (_TARGET_WORDS, "金平糖", True),
    (_TARGET_WORDS, "飴", True),
    (_TARGET_WORDS, "ラムネ", True),
    (_TARGET_WORDS, "galette bretonne", True),
    (_TARGET_WORDS, "polvorones", True),
    (_TARGET_WORDS, "amaretti", True),
    (_TARGET_WORDS, "pain d'épices", True),
    (_TARGET_WORDS, "生菓子", False),  # fresh -- not a shelf-stable line
    (_FRESH_WORDS, "sandwich biscuits", False),
    (_FRESH_WORDS, "pain d'épices de Dijon", False),
    (_FRESH_WORDS, "pain d'épice de Dijon", False),
    (_FRESH_WORDS, "Russisch Brot", False),
    (_FRESH_WORDS, "a pan-European distributor", False),
    (_FRESH_WORDS, "fresh sandwiches daily", True),
    (_FRESH_WORDS, "カステラ", True),
    (_PRODUCER_MARKERS, "当社は1902年創業の老舗です", True),  # mid-sentence Japanese
    (_PRODUCER_MARKERS, "伝統の製法で", True),
    (_GROUP_EXCLUDED_WORDS["beauty"], "肌を明るくします", False),  # くし inside 明るくし
    (_GROUP_EXCLUDED_WORDS["beauty"], "for combination skin", False),
    (_GROUP_EXCLUDED_WORDS["beauty"], "LEDマスク", False),  # a beauty device
    (_GROUP_EXCLUDED_WORDS["beauty"], "フェイスマスク", True),
    (_GROUP_TARGET_WORDS["beauty"], "new items and systems", False),  # "EMS" inside words
    (_GROUP_TARGET_WORDS["beauty"], "EMS美顔器", True),
    (_THIN_DISTRIBUTOR, "Wholesale candy, snacks, and sundries — family-owned since 1924", True),
    (_THIN_DISTRIBUTOR, "Southern Candy Wholesale Manufacturer — Handmade Since 1918", False),  # Dillon Candy
    (_THIN_DISTRIBUTOR, "Handmade toffee. Available through wholesalers and stockists.", False),
    (_DIRECTORY_TITLE, "大阪産（もん）名品の会", True),
    (_DIRECTORY_TITLE, "企業組合 かりんとう工房", False),  # legal form of a small producer
    (_DIRECTORY_TITLE, "農事組合法人 米の里 おかき工房", False),
    (_TRADE_LINK, "Where to buy", True),
    (_TRADE_LINK, "Puntos de venta", True),
    (_TRADE_LINK, "海外発送について", False),
    (_GIFT_LINK, "Noël /professionnels-noel", False),  # a European maker's business page stays
    (_GIFT_LINK, "Weihnachtsgeschenke für Geschäftskunden", False),
    (_GIFT_LINK, "法人・団体様向けギフト", True),
]

RESELLER = [
    ("Distributeur de bonbons et confiseries - Confiserie Mondoux", True),
    ("Acquista Vini e Liquori di Qualità a Torino - Damarco Enoteca", True),
    ("Venar Srl | Dolciumi, Bevande e Forniture per Bar e Ristoranti", True),
    ("沖縄商店｜沖縄のお菓子・食品・雑貨・琉球ガラスをお届け", True),
    ("Fine Scottish Hampers", True),
    ("Bendicks | The Best Intense Mint Dark Chocolate | Luxury Gift Boxes", False),  # a maker's gift boxes
    ("Candies Supplier - Proveedor de Dulces", True),
    ("Jakob Distler Süßwarengroßhandel", True),
    # Makers that say so in the same title.
    ("Chocolaterie Morin - Artisan Chocolatier Torréfacteur", False),
    ("株式会社コジット | 美容・健康雑貨の企画・製造・販売", False),
    ("Biscottificio X – produzione e forniture per bar e hotel", False),
    ("Fornitore della Real Casa - Pasticceria", False),
    ("Supplier to the Royal Household - Toffee makers", False),
    ("Wholesale Candy | Family candy maker since 1920", False),
]

EXPORT = [
    ("全国の百貨店でお求めいただけます", True),  # sold through department stores (榮太樓, 六花亭)
    ("直営販売店舗も少なく", False),
    ("販売店舗も少なく", False),
    ("海外発送は承っておりません", False),
    ("food handler certificate", False),
    ("La gastronomie française", False),
    ("海外輸出のご相談", True),
    ("Händler werden", True),
    ("Wholesale enquiries", True),
    ("取扱店一覧", True),
]

FOUNDED = [
    ("1929年創業の佐々木製菓", 1929),
    ("明治35年創業", 1902),
    ("latest 1800 reviews", None),
    ("Seit 1950 ... 200 Jahre alte Tradition", 1950),
    ("Founded in 1952 … recipes go back over 200 years in this region", 1952),
    ("You must be 18 years or older", None),
    ("Maison fondée en 1878, 100 ans de savoir-faire", 1878),
    ("Depuis 1963 ... 60 ans", 1963),
]

COUNTRY = [
    ("Buffalo, NY 14201. Prices $12. Call 1-800-555-1234", "USA"),
    ("Tel 075-561-1234 価格 $12", None),  # Japanese phone, not US
    ("P.IVA 01234567890 Tel 055 123 4567 € 12", None),  # Italian VAT/phone, not UK/US
    ("variant 44404732264645 Free shipping in Continental U.S. on orders over $45", "USA"),
    ("ORFÈVE Manufacture suisse de cacao & chocolat Genève CHF 12", "Switzerland"),
    ("£4.50 Made in Scotland 01234 567890", "UK"),
    ("Confiserie Certin Belgique +32 477 677 417", "Belgium"),
]

GUESS_NAME = [
    ("Walkers Shortbread Ltd - Scotland's favourite", "https://www.walkersshortbread.com/", "Walkers Shortbread Ltd"),
    ("Pasticceria Fraccaro - Since 1932", "https://www.fraccarospumadoro.it/", "Pasticceria Fraccaro"),
    ("Lebkuchen-Schmidt | Nürnberger Lebkuchen", "https://www.lebkuchen-schmidt.com/", "Lebkuchen-Schmidt"),
]

PICK_NAME = [
    ("Zeno's World's Most Famous Taffy", "Worldsmostfamoustaffy", "https://worldsmostfamoustaffy.com/", "Zeno's World's Most Famous Taffy"),
    ("Dresdner Christstollen", "Dresdner Mühlenbäckerei", "https://www.dresdner-muehlenbaeckerei.de/", "Dresdner Mühlenbäckerei"),
]

JP_NAME = [
    ("名古屋 和菓子 | 両口屋是清", "両口屋是清"),
    ("名古屋の老舗 両口屋是清", "両口屋是清"),
    ("Japanese Sweets Shop | 亀屋良長", "亀屋良長"),
    ("株式会社 菓匠 三全", "菓匠三全"),
    ("九州のお菓子メーカー山田製菓株式会社", "山田製菓"),
    ("株式会社山田製菓のホームページへようこそ", "山田製菓"),
    ("トップページ | 本店", None),
    ("小林製薬株式会社 -あったらいいなをカタチにする-", "小林製薬"),  # not the slogan
    ("flaneru (フラネル) | 粉と砂糖と", "flaneru"),  # Latin brand first, slogan after
]

DOMAIN_LABEL = [
    ("https://shop.bettys.co.uk/", "bettys"),
    ("https://en.lindt.com/", "lindt"),
    ("https://www2.kambly.ch/", "kambly"),
    ("https://ab.co.uk/", "ab"),
    ("https://www.iwateya.co.jp/", "iwateya"),
]

KOREA_NAME = [
    ("カステラ銀装", "https://www.ginso.jp/", "ginso"),
    ("かぎや", "https://www.sweets-kagiya.jp/", "kagiya"),
    ("たんばや", "https://www.y-tanbaya.com/", "tanbaya"),
    ("マルト", "https://marutonet.base.shop/", "マルト"),  # shop-platform subdomain
]

# Korean reading shown after a Japanese-only name (user, 2026-10-23).
READING = [
    ("シード", None, "시도"),
    ("メニコン", None, "메니콘"),  # ん at the end
    ("かぎや", None, "가기야"),  # や
    ("ロッテ", None, "롯테"),  # っ
    ("きょうと", None, "교토"),  # long vowel not written, word-initial 교
    ("三ツ矢製菓", "https://www.mitsuyaseika.co.jp/", "미쓰야세이카"),  # kanji: from the domain
    ("丹生堂本舗", "https://www.tanseido-honpo.co.jp/", "단세이도 혼포"),
    ("小林製薬", "https://www.kobayashi.co.jp/", "고바야시 세이야쿠"),  # suffix the domain leaves out
    ("虎屋", "https://www.toraya-group.co.jp/", "도라야"),  # "group" is not part of the name
    ("Stockley's Sweets", "https://stockleys-sweets.co.uk/", None),  # not Japanese
    ("六花亭", "https://www.example-123.jp/", None),  # domain is not a reading
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
    ("https://music.bugs.co.kr/track/1", False),  # a music page, not a shop
    ("https://smartstore.naver.com/shop/products/1", True),
    ("https://www.coupang.com/vp/products/1", True),
]


def _hits(title: str, n: int) -> list[dict]:
    return [{"title": title, "description": "", "url": f"https://www.coupang.com/vp/products/{i}"} for i in range(n)]


KOREA = [
    # (hits, name, failed searches, own domain label, expected status)
    (_hits("초콜릿 모음 여러 브랜드", 3), "Whittaker's", 0, None, "no_evidence_found"),  # not about this brand
    (_hits("Whittaker's 밀크초콜릿", 3), "Whittaker's", 0, None, "parallel_import"),
    (_hits("Whittaker's 공식수입원 초콜릿", 1), "Whittaker's", 0, None, "official_distributor"),
    (_hits("Whittaker's 정식수입 통관 초콜릿", 3), "Whittaker's", 0, None, "parallel_import"),
    ([], "Whittaker's", 2, None, "check_failed"),
    ([], "Whittaker's", 0, None, "no_evidence_found"),
    ([{"title": "메니콘", "description": "", "url": "https://www.menicon.co.kr/"}], "menicon", 0, "menicon", "official_distributor"),
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
    (_profile(selfTitle="Terre adélice | Fabricant de glaces artisanales"), "chilled_frozen"),
    (_profile(selfTitle="Helados y turrones Artesanos - Jijona"), "ok"),  # also names turrón
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
        check(got == expected, f"chilled {text[:40]!r} -> {got}")
    for text, expected in COLD_TITLES:
        check(names_cold_product(text) == expected, f"cold title {text!r}")
    for pattern, text, expected in WORDS:
        got = bool(pattern.search(text))
        check(got == expected, f"words {text!r} -> {got}")
    for text, expected in RESELLER:
        check(looks_like_reseller(text) == expected, f"reseller {text!r}")
    for text, expected in EXPORT:
        check(has_export_signal(text) == expected, f"export {text!r}")
    for text, expected in FOUNDED:
        got = extract_founded_year(text)
        check(got == expected, f"founded {text!r} -> {got}")
    for text, expected in COUNTRY:
        got = guess_country_from_text(text)
        check(got == expected, f"country {text[:45]!r} -> {got}")
    for title, url, expected in GUESS_NAME:
        got = guess_brand_name(title, url)
        check(got == expected, f"guess name {title!r} -> {got!r}")
    for current, site_name, url, expected in PICK_NAME:
        got = pick_brand_name(current, site_name, url)
        check(got == expected, f"pick name {current!r}/{site_name!r} -> {got!r}")
    for title, expected in JP_NAME:
        got = japanese_site_name(title, None)
        check(got == expected, f"jp name {title!r} -> {got!r}")
    for url, expected in DOMAIN_LABEL:
        check(brand_domain_label(url) == expected, f"domain label {url}")
    for name, site, expected in KOREA_NAME:
        got = korea_search_name(name, site)
        check(got == expected, f"korea name {name} {site} -> {got!r}")
    for name, site, expected in READING:
        got = korean_reading(name, site)
        check(got == expected, f"reading {name} -> {got!r}")
    check(with_korean_reading("三ツ矢製菓", "https://www.mitsuyaseika.co.jp/") == "三ツ矢製菓 (미쓰야세이카)", "name with reading")
    check(with_korean_reading("三ツ矢製菓 (미쓰야세이카)", "https://www.mitsuyaseika.co.jp/") == "三ツ矢製菓 (미쓰야세이카)", "reading not added twice")
    for text, expected in CATEGORY:
        got = category_signal(text)
        check((got[0] if got else None) == expected, f"category {text!r} -> {got}")
    for url, expected in RETAIL_HOSTS:
        check(_is_korea_retail_hit(url) == expected, f"retail host {url}")
    for hits, name, failed_searches, own, expected in KOREA:
        got = classify_korea_status(hits, name, failed_searches, own_domain_label=own)[0]
        check(got == expected, f"korea {hits[0]['title'] if hits else '(no hits)'} failed={failed_searches} -> {got}")
    shop = korea_shop_hits(
        [{"title": "Pelino BBC", "description": "", "url": "https://www.bbc.com/x"}] + _hits("Pelino 사탕", 2), "Pelino"
    )
    check([h["url"] for h in shop] == [f"https://www.coupang.com/vp/products/{i}" for i in range(2)], "evidence = Korean shop hits")
    for profile, expected in JUDGE:
        got = judge(profile, "Maker", "https://maker.example/")[1]
        check(got == expected, f"judge {profile['selfTitle']!r} shelf={profile['shelfLifeMonths']} chilled={profile['chilledHits']} -> {got}")
    # A page with a single "chocolate" is not a food site (one word used to count 3 times).
    tax = "Tax advisory firm. " * 20 + " We once had chocolate at a meeting. " + "Accounting audit payroll. " * 20
    check(check_food_relevance(tax)[0] is False, "tax firm with one 'chocolate' is not food")
    maker = ("Our shortbread is baked by hand with butter, flour, sugar, vegetable oil and sesame seeds. "
             "Biscuits, cookies and toffee. " * 6) + " Careers. Hotel and Horeca partners. Proceed to checkout. " * 4
    check(check_food_relevance(maker)[0] is True, "shortbread maker with ingredients/careers/hotel links is food")
    it = "Facebook でシェア。フォークリフトの販売とITソリューション。combine, brush-up your skills. " * 12
    check(check_group_relevance(it, "beauty")[0] is False, "IT/logistics page is not a beauty site")
    middle = "メディア掲載 " * 10 + "当社のせんべい"
    check(_japanese_middleman(middle) is None, "a maker's press list is not a directory")
    dupes = dedupe_pooled([
        {"name": "Chocolaterie Morin", "website": "https://chocolaterie-morin.com/"},
        {"name": "Chocolaterie Marin", "website": "https://chocolaterie-marin.fr/"},
    ])
    check(len(dupes) == 2, "different makers with similar names on different sites are both kept")

    print(f"\n{total - failed}/{total} passed, {failed} failed")
    sys.exit(1 if failed else 0)
