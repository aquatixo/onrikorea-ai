"""Site-first verification: read a candidate's OWN website and decide from what the site
says about itself whether it is an importable food producer.

Why this exists: the pipeline used to start from a search result's title/snippet and
subtract junk with a growing pile of filters. Every new kind of junk (news articles, seed
shops, job boards, recipe blogs, gift-hamper resellers, sites we could not even read) needed
another patch. Here the burden of proof is reversed -- a candidate is kept only if its own
site positively shows: readable content, food, a producer (not a publisher or reseller),
and a trade/wholesale/export channel. Anything unverifiable is dropped.

Deterministic only (regex + HTML structure), no LLM. Search credits: none -- this only
fetches the candidate's own pages.
"""

import json
import re
import unicodedata
from urllib.parse import urljoin, urlparse

import requests
from bs4 import BeautifulSoup

from country_guess import guess_country_from_domain, guess_country_from_text
from name_filter import (
    brand_domain_label,
    domain_matches_name,
    has_latin_letters,
    is_plausible_brand_name,
    japanese_site_name,
    looks_like_reseller,
    pick_brand_name,
    says_it_makes,
    strip_shop_words,
)
from relevance import _COOKIE_BANNER, check_food_relevance, check_group_relevance, has_food_words, has_group_words, name_on_site
from query_vocab import VOCAB
from shelf_life import MIN_SHELF_LIFE_MONTHS, chilled_hits, format_months, names_cold_product, shelf_life_months
from site_scrape import HEADERS, _extract_site_name, _is_parked, extract_founded_year, has_export_signal, jsonld_founding_year

MIN_READABLE_CHARS = 400
_MIN_SITE_CHARS = 2000
_JP_TITLE = re.compile(r"[぀-ヿ一-鿿]")

# Japan-focus beauty/care lanes: what the company wants vs. what it never handles (user,
# 2026-10-12). Wanted: ReFa-type face/body rollers, gua sha, facial/body beauty devices;
# ReNu-type contact-lens and eye care. Never: hair dryers/irons, combs and brushes
# (incl. makeup brushes -- the first run returned almost only Kumano brush workshops),
# tweezers / eyebrow scissors / razors, simple masks, wound ointment. A site is dropped
# when the never-handled words outnumber the wanted ones.
_GROUP_TARGET_WORDS = {
    "beauty": re.compile(
        # EMS case-sensitive and standalone: with re.I it also matched "items", "systems".
        r"ローラー|かっさ|美顔|美容機器|美容器|(?<![A-Za-z])(?-i:EMS)(?![A-Za-z])|(?<!フォーク)リフト|小顔|フェイスケア|ボディケア|"
        r"マイクロカレント|ラジオ波|"
        r"rollers?|gua\s?sha|beauty\s+device",
        re.I,
    ),
    "care": re.compile(r"コンタクト|レンズ|洗浄液|保存液|洗眼|目薬|点眼|contact\s+lens", re.I),
}
_GROUP_EXCLUDED_WORDS = {
    "beauty": re.compile(
        # Not くし (inside 明るくし/小さくし), not a bare 筆 (筆者/執筆), not "comb" inside
        # "combination skin", and not an LED/EMS face mask -- that is a beauty device.
        r"ドライヤー|ヘアアイロン|ストレートアイロン|カールアイロン|ブラシ|化粧筆|メイク筆|櫛|コーム|毛抜き|ピンセット|"
        r"眉ハサミ|眉はさみ|カミソリ|剃刀|シェーバー|(?<!LED)(?<!EMS)(?<!美顔)マスク|軟膏|絆創膏|"
        r"hair\s?dryers?|straighteners?|curling\s+irons?|brush(?:es)?|\bcombs?\b|tweezers|razors?|"
        r"(?<!led\s)(?<!ems\s)\bmasks?\b",
        re.I,
    ),
    # Not きずな (bond), common in Japanese company copy.
    "care": re.compile(r"軟膏|傷薬|きず(?!な)|絆創膏|マスク|湿布|ointment|bandages?|masks?", re.I),
}
_MIN_EXCLUDED_HITS = 5
# OEM / contract manufacturing: a maker that makes products for other companies' brands is
# not a candidate (user, 2026-10-12). Since 2026-11-04 (user: "OEM 이딴거 나오면 안되지") ONE
# mention drops a food site -- see _oem_reason; beauty/care lanes keep the old count.
# Not \bOEM\b: in "洋菓子のOEM製造" the kana before it is a word character, so no boundary.
#
# Every site
# that mentioned it at all was offering the service -- "Produzioni conto terzi e private
# labels" (Pernigotti), "realizzazione di Private Label" (Brusa), "法人様向けオリジナル商品
# (OEM)" (パイン), "卸売事業、ODMに関して" (法善寺あられ) -- so a maker that also makes for
# other brands is out too, not only a pure OEM factory. Same words in each lane language.
_OEM_WORDS = re.compile(
    r"(?<![A-Za-z])(?:OEM|ODM)(?![A-Za-z])|ＯＥＭ|ＯＤＭ|受託製造|受託加工|製造受託|委託製造|プライベートブランド|"
    r"private[\s-]labels?|white[\s-]labels?|contract\s+manufactur\w*|co-?pack(?:er|ers|ing)\b|"
    r"co-?manufactur\w*|toll\s+manufactur\w*|"
    # Italian "conto terzi" only about production -- "corriere conto terzi" is a courier.
    r"(?:produ|lavora|realizz|fabbric)\w*[^.;]{0,30}?conto\s+terzi|terzisti|"
    r"marcas?\s+blancas?|marcas?\s+de\s+(?:la\s+)?distribuci[oó]n|fabricaci[oó]n\s+para\s+terceros|"
    r"marques?\s+(?:blanches?|de\s+distributeurs?)|\bMDD\b|fa[çc]onnier|sous[\s-]traitance|"
    # Not "Handelsmarke": in German it also just means a registered trademark.
    r"lohnfertigung|lohnherstellung",
    re.I,
)
# "We do not offer private label" / "OEMは行っておりません" is the opposite: a negation at
# most three words before the term, or a Japanese "not done" right after it. Page text is
# joined with spaces (no sentence breaks), so nothing reaches further back than that:
# "No preservatives, no colours -- we also make private label" offers it. Nor "not only":
# "Non solo cioccolato: produzioni conto terzi" offers it too.
_OEM_NOT_ONLY = re.compile(r"\b(?:not|non|no|nicht|pas)\s+(?:only|solo|soltanto|seulement|nur|solamente)\b", re.I)
_OEM_NEGATED_BEFORE = re.compile(
    r"(?:\b(?:no|not|non|never|niente|nessun\w*|kein\w*|nicht|sin|pas\s+de)|n['’]t)\s+(?:[\w'’-]+\s+){0,3}$", re.I
)
# Japanese: ません / お断り within the same phrase (no space): "OEM製造は行っておりません",
# "OEMのご依頼はお断りしております" -- not "(OEM)のご案内 キャンディを…使用しませんか".
_OEM_NEGATED_AFTER = re.compile(r"^[^\s。、.!?]{0,12}?(?:ません|お断り)")
# "We don't do private label OR white label": a term listed right after a negated one.
_OEM_LIST_JOIN = re.compile(r"^[\s,/&・、]*(?:or|and|nor|ou|et|o|e|y|und|oder)?[\s,/&・、]*$", re.I)


def _oem_mention(text: str) -> str | None:
    """The first mention of making products for other companies' brands, with a little
    context for the reason line, or None."""
    text = text or ""
    negated_end = None
    for m in _OEM_WORDS.finditer(text):
        before = _OEM_NOT_ONLY.sub(" ", text[max(0, m.start() - 60) : m.start()])
        listed = negated_end is not None and _OEM_LIST_JOIN.match(text[negated_end : m.start()])
        if listed or _OEM_NEGATED_BEFORE.search(before) or _OEM_NEGATED_AFTER.search(text[m.end() : m.end() + 20]):
            negated_end = m.end()
            continue
        return re.sub(r"\s+", " ", text[max(0, m.start() - 25) : m.end() + 15]).strip()
    return None
# A factory that says outright it works under other companies' names needs no count:
# "社名も出さずお菓子づくりに専念" (浜田食品工業, 2026-11-04 run -- "you've eaten our
# products without knowing it").
_OEM_ONLY = re.compile(r"社名(?:を|も)?(?:表に)?出さ(?:ず|ない)|自社ブランドを持たず|黒子として")
# An OEM / private-label page in the site's own menu ("/oem/", "/private-label").
_OEM_PATH = re.compile(r"/(?:oem|odm|private[-_]?labels?|marque[-_]blanche|marca[-_]blanca|conto[-_]terzi)(?:[/._-]|$)", re.I)
# Beauty/care lanes keep the old count: a ReFa-type brand is often a planner whose devices
# an OEM factory makes, and that's the kind those lanes want.
_MIN_OEM_HITS_BEAUTY = 15


def _oem_reason(profile: dict, food: bool) -> str | None:
    """Why this site is an OEM / private-label maker, or None. See _OEM_WORDS."""
    text = profile.get("fullText") or ""
    tail = " — 다른 회사 브랜드 제품(OEM·ODM·PB)을 만드는 곳이라 제외"
    if _OEM_WORDS.search(profile.get("pageTitle") or ""):
        return "OEM·위탁생산 (사이트 제목)" + tail
    only = _OEM_ONLY.search(text)
    if only:
        return f"OEM·위탁생산 ('{only.group(0)}')" + tail
    if not food:
        n = len(_OEM_WORDS.findall(text))
        return f"OEM·위탁생산 공장 (언급 {n}회)" + tail if n >= _MIN_OEM_HITS_BEAUTY else None
    link = profile.get("oemLink")
    if link:
        return f"OEM·위탁생산 메뉴 ('{link}')" + tail
    mention = _oem_mention(text)
    return f"OEM·위탁생산 언급 ('…{mention}…')" + tail if mention else None

# A beauty/care product company says it develops or makes its products in different words
# than a food maker ("開発", "メーカー", "製造販売元", "日本製").
_DEVICE_MAKER_MARKERS = re.compile(r"開発|研究|メーカー|製品|製造販売|自社ブランド|特許|日本製|made\s+in\s+japan|our\s+products", re.I)
_PAGE_TEXT_CAP = 6000
_MAX_ABOUT_PAGES = 3
_MAX_TRADE_PAGES = 2

# Internal links worth following, found in the homepage's own menus/footer instead of
# guessing URL paths (the old approach tried ~20 guessed paths per site, mostly 404s).
_ABOUT_LINK = re.compile(
    r"about|our[\s-]story|heritage|history|"
    r"über[\s-]?uns|ueber[\s-]uns|unternehmen|geschichte|tradition|"
    r"qui[\s-]sommes|notre[\s-]histoire|histoire|la[\s-]maison|"
    r"chi[\s-]siamo|storia|azienda|"
    r"qui[eé]nes[\s-]somos|nuestra[\s-]historia|historia|empresa|"
    r"sobre[\s-]n[oó]s|hist[oó]ria|"
    r"notre[\s-](?:aventure|[ée]quipe|savoir|chocolaterie|biscuiterie|confiserie)|"
    r"会社概要|会社情報|会社案内|企業情報|企業概要|私たちについて|歴史|沿革|当店について",
    re.I,
)
# The history of a PRODUCT, not of the company: "Historia del chocolate" (Chocolates Artesanos
# Isabel, 2026-11-06 run) dated the company 1819 from "En 1819, Cailler fundó la primera
# fábrica de chocolate".
_TOPIC_HISTORY = re.compile(
    r"(?:histor\w*|storia|geschichte)[\s_-]+(?:(?:del|de|du|des|of|della|dello|der|the|la|le|el)[\s_-]+)*"
    r"(?:chocolate|chocolat|cioccolato|schokolade|cacao|cocoa|turr[oó]n|torrone|nougat|caramel|candy|biscuit|liquori|regaliz)",
    re.I,
)
# Company pages before stories: 昔飴本舗 links two product "our-story" pages ahead of its
# 会社情報, and only those were read -- the founding year sits on the company page.
_COMPANY_PAGE = re.compile(
    r"about|company|unternehmen|geschichte|histoire|qui[\s-]sommes|chi[\s-]siamo|storia|azienda|"
    r"qui[eé]nes[\s-]somos|empresa|history|historia|会社概要|会社情報|会社案内|企業情報|企業概要|沿革|歴史",
    re.I,
)
_TRADE_LINK = re.compile(
    r"wholesale|(?<!fair\s)\btrade\b|b2b|export|stockist|distribut|retailers?\b|"
    # Where-to-buy pages -- what several lanes search with as their tradeTerm, so a maker
    # found that way must not fail for "no trade channel".
    r"where\s+to\s+buy|points?\s+de\s+vente|puntos?\s+de\s+venta|punti\s+vendita|verkaufsstellen|"
    # With ä/ae only (not English "handler"). A "Gastronomia/Gastronomie" LINK stays: on a
    # maker's own site it is the foodservice line (Amarelli's liquorice for chefs). Running
    # text is different -- site_scrape only counts German foodservice wording there.
    r"h(?:ä|ae)ndler|gro[ßs]handel|gesch[äa]ftskunden|wiederverk|fachhandel|gastronom|horeca|food\s?service|"
    r"grossiste|revendeur|professionnels?|"
    r"ingrosso|rivendit|esportaz|"
    r"mayorista|distribuidor|profesionales|exportaci|"
    r"revenda|grossista|"
    # Japanese makers rarely say 卸 outright: "お取引" (trade enquiries), "取扱店/販売店"
    # (stockist list), "代理店" (agents), "輸出" (export) all mean a B2B channel. Not
    # 特定商取引法 (the legal notice every Japanese web shop must have), not 海外発送 (a
    # shop's overseas shipping), and not OEM -- that's a reject reason, not a trade channel.
    # Not 商取引法 / 特定取引法 either ("商取引法に基づく表記" is on every web shop).
    r"卸|業務用|法人|海外(?!発送)|(?<!商)(?<!特定)取引(?!法)|取扱店|取り?扱い?店|販売店(?!舗)|代理店|輸出|問屋",
    re.I,
)
# A Japanese shop's corporate-gift page ("法人・団体様向けギフト", カステラ銀装) is a
# company buying gift boxes, not a trade channel. European corporate/Christmas pages stay:
# for a Lebkuchen or chocolate maker the business-customer page IS its B2B channel.
_GIFT_LINK = re.compile(r"ギフト|贈答|手土産")

# Supplier-grade signals that stand in for an explicit trade page: food-safety certificates
# that retail chains and importers require (IFS, BRCGS, FSSC 22000, ISO 22000) and
# production plants. Rustichella d'Abruzzo (global pasta exporter) has no "wholesale" page
# at all, but its menu lists "Stabilimenti produttivi" and "Certificazioni".
_SUPPLIER_GRADE = re.compile(
    r"\bIFS\s*(food|certif)|\bBRC(GS)?\b|FSSC\s*22000|ISO\s*22000|"
    r"stabiliment[oi]\s+produttiv|production\s+(plant|facilit)|produktionsst[äa]tte|"
    # Not HACCP: required by law of every Japanese food business since 2021.
    r"\busines?\s+de\s+production|planta\s+de\s+producci[oó]n|自社工場|工場見学",
    re.I,
)

# A news site / magazine / blog, not a company. JSON-LD types are near-certain; the text
# markers are publishing vocabulary that brand homepages rarely use together.
_PUBLISHER_TYPES = {"NewsMediaOrganization", "NewsArticle", "Blog", "BlogPosting", "Article", "Periodical"}
_PUBLISHER_MARKERS = re.compile(
    r"\b(advertise\s+with\s+us|advertising|editorial|editor[\s-]in[\s-]chief|journalists?|"
    r"latest\s+news|breaking\s+news|news\s*&\s*analysis|op-?ed|columnists?|"
    r"recipes?\s+(index|by|archive)|travel\s+guide|itinerar(y|ies)|"
    r"redaktion|chefredaktion|rédaction|redazione|redacci[oó]n)\b|"
    # Japanese listing sites only by what a maker never says: "掲載お申し込み" (apply to be
    # listed), "掲載企業" (listed companies). Bare 掲載/を探す were here and rejected real
    # makers -- メディア掲載 (press coverage) + 店舗を探す (store finder) is on most JP maker
    # homepages. Directories are also caught by _japanese_middleman (掲載 >= 10).
    r"掲載(?:お申し?込み|申込|企業|社数|料)",
    re.I,
)
_DATE_STAMP = re.compile(
    r"\b\d{1,2}\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+20\d\d\b|"
    r"\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+\d{1,2},\s+20\d\d\b|"
    r"\b20\d\d[-/.]\d{1,2}[-/.]\d{1,2}\b",
    re.I,
)

# What the site calls ITSELF in its <title>/site name. A portal, city magazine or tourism
# guide says so right there ("El portal con todos los proveedores de alimentación",
# "Tourisme, Vacances ... Guide du Pays Basque", "Stuttgart Inside App Onlinemagazin"),
# while a maker's title names its products. Checked against the title only, so a brand's
# own "Magazin"/"News" menu entry doesn't trigger it.
_DIRECTORY_TITLE = re.compile(
    r"\b(portal|portale|directory|directorio|annuaire|verzeichnis|branchenbuch|"
    r"guide|guía|guida|reiseführer|tourisme|tourism|turismo|tourismus|vacances|"
    r"(online|stadt|city)[\s-]?magazin\w*|magazine|news|noticias|actualités|nachrichten|"
    # Trade journals ("Revista de Distribución y Consumo | Sweetpress", 2026-10-29 run).
    r"revista|rivista|revue|zeitschrift|fachzeitschrift|"
    r"app|blog)\b|"
    r"観光|ガイド|まとめ|ポータル|"
    # Associations and member directories ("大阪産（もん）名品の会", 2026-10-23 run).
    # Not 企業組合 / 農事組合法人 -- the legal forms of real small producers ("企業組合
    # かりんとう工房", "農事組合法人 米の里 おかき工房").
    r"名品の会|協会|協議会|(?<!企業)(?<!農事)組合(?!法人)|連合会",
    re.I,
)

# Fresh daily bakery goods can't be imported. Bread/quiche/cream-cake wording vs.
# shelf-stable wording (_SHELF_WORDS: biscuits, sweets, chocolate...). Measured on a real run: fresh
# bread bakeries 0.46-4.0 (Holtkamp, RepasPAN, Popty Bach Y Wlad) vs. 0.08 for a
# cookie-led bakery that also mentions breads, 0.00 for the confectioners/roasters.
_FRESH_WORDS = re.compile(
    # Not "sandwich biscuits" (shelf-stable), not "pain d'épices" (gingerbread), and no bare
    # English "pan"/"pains" ("pan-European", "Peter Pan", "great pains" all counted as bread).
    r"\b((?<!russisch\s)brot|brote|brötchen|bread|breads|baguettes?|quiches?|sandwich(?!\s+(?:biscuits?|cookies?|wafers?))\w*|"
    r"panes|pan\s+(?:de|artesano|casero)|panader\w*|"
    r"boulangerie|pains?(?!\s+d['’]\s?[ée]pices?)|pane|focaccia|sourdough|sauerteig|semmel\w*|"
    r"tartas?|torten?|sponges?(?!\s+(?:candy|toffee))|cream\s+cakes?|wedding\s+cakes?|hochzeitstorte\w*|"
    r"macarons?|tiramis[uù]|cheesecakes?)\b|"
    # Japanese fresh sweets (no \b: CJK has no word boundary inside a sentence).
    # 要冷蔵 is counted by shelf_life.chilled_hits, not here.
    r"生菓子|生クリーム|大福|団子|だんご|食パン|当日中|カステラ|生八ッ橋|生八つ橋",
    re.I,
)
# Kept cold / frozen (see shelf_life.chilled_hits) outweighing shelf-stable wording.
_MIN_CHILLED_HITS = 3
_MAX_CHILLED_RATIO = 0.3
_MIN_FRESH_HITS = 3
_MAX_FRESH_RATIO = 0.3

# Product lines the company does not handle (coffee, tea, honey, pasta -- as of 2026-10).
# Dropped only when they OUTWEIGH the target lines: honey is a nougat/praline ingredient
# and "café" shows up on many pâtisserie sites, so a mere mention must not drop a maker.
_OFF_TARGET_WORDS = re.compile(
    r"coffee|kaffee|espresso|r[öo]sterei|roaster|roastery|torr[ée]fact|torrefaz|tostador|"
    # French "thé" only WITH the accent -- th[ée] also matched English "the" (99 hits on
    # one cookie bakery's homepage, which then read as a tea site).
    r"\bcaf[ée]s?\b|\btea\b|\btee\b|\bthés?\b|matcha|"
    # Honey -- but not honeycomb toffee, Honigkuchen/Honiglebkuchen (gingerbread). "miel"
    # alone stays: a pain d'épices maker is kept because pain d'épices is a target word.
    r"honey(?!comb|dew)|honig(?!kuchen|lebkuchen)|\bmiel\b|miele|pastificio|"
    # Not almond/hazelnut/pistachio paste, shortcrust or gianduja paste ("pasta di
    # mandorle", "pasta reale", "pasta frolla", "pasta di nocciole") or Spanish tea
    # biscuits ("pastas de té") -- confectioners were dropped as pasta makers.
    r"\bpasta\b(?!\s+(?:di\s+(?:mandorl|pistacchi|nocciol|cacao|zucchero)|reale|frolla|gianduia|de\s+almendra))|"
    # Beekeepers: honey, propolis and royal jelly with a few honey sweets on the side
    # (Imkergut, 2026-10-19 run) -- a honey business, not a confectioner.
    r"imkerei|\bimker\b|propolis|gel[ée]e\s+royale|royal\s+jelly|beekeep\w*|apicoltur\w*|apicultur\w*|"
    # Japanese. Not 抹茶: it's a flavour all over wagashi, not a tea business on its own.
    r"コーヒー|珈琲|紅茶|緑茶|日本茶|煎茶|蜂蜜|はちみつ|パスタ|"
    # Drinks: ハタ鉱泉's ラムネ is bottled soda, not the tablet sweet (2026-11-04 run). Not
    # 炭酸せんべい (a cracker) or baking soda.
    r"清涼飲料|飲料|炭酸(?!せんべい|煎餅)|サイダー|シャンメリー|ドリンク|ジュース|ひやしあめ|"
    r"\bbeverages?\b|\bsoft\s+drinks?\b|\blemonades?\b|(?<!baking\s)\bsodas?\b(?!\s+bread)",
    re.I,
)


def _vocab_product_words() -> list[str]:
    """Every food product the query lanes search for (query_vocab.VOCAB), so a maker found
    by a query is never short of target words for its own product -- the hand-kept list
    missed 金平糖, galette, polvorones, amaretti... and their makers lost to off-target."""
    words = set()
    for lane, v in VOCAB.items():
        if lane in ("Japan Beauty", "Japan Care"):
            continue
        for product, _category in v["products"]:
            words.add(product.lower())
    return sorted(words, key=len, reverse=True)


# The product lines the company handles, all shelf-stable -- used both as "target" (vs
# off-target lines) and as "shelf-stable" (vs fresh-bakery words). These used to be two
# hand-kept lists that drifted apart. Short-lived lines (カステラ, 八ッ橋, Stollen) are not
# in here. Not 菓子 inside 生菓子 (fresh).
_TARGET_WORDS = re.compile(
    "|".join(re.escape(w) for w in _vocab_product_words()) + "|"
    r"biscuit|cookie|bonbon|candy|candies|sweets|chocolat|schokolade|caramel|karamell|toffee|fudge|praline|"
    r"nougat|turr[oó]n|torrone|lebkuchen|wafer|waffel|shortbread|confiserie|calisson|"
    r"liquirizia|lakritz|licorice|liquorice|crackers?|keks|gebäck|biscott|cantucci|taffy|brittle|"
    r"marzipan|mazap[aá]n|marshmallow|dragée|dragee|confett|galettes?|sabl[ée]s?|berlingots?|"
    r"pain\s+d['’]\s?[ée]pices?|p[âa]te\s+de\s+fruits?|galletas|polvorones|mantecados|amaretti|croccante|"
    r"せんべい|煎餅|(?<!生)菓子|キャンディ|グミ|ビスケット|おかき|あられ|かりんとう|羊羹|クッキー|チョコ|焼菓子|米菓|"
    r"金平糖|ラムネ|ドロップ|落雁|飴",
    re.I,
)
_SHELF_WORDS = _TARGET_WORDS

# Every OTHER product category the company doesn't buy (user, 2026-11-04: "관련 없는
# 카테고리 나오면 안되지"): drinks and alcohol, dairy, meat, fish, oils/vinegar/sauces,
# cosmetics and soap, maple syrup, supplements, baby and pet food, ice cream. Together with
# _OFF_TARGET_WORDS (coffee, tea, honey, pasta, drinks) they must stay well below the
# sweets/biscuit/snack words -- measured on every reviewed site: Mount Mansfield Maple
# (28 other vs 17 sweets), Pasticceria Bonci (25 wine/soap vs 38), a Basque cheese and
# charcuterie house (52 vs 4) are out; a candy shop that also scoops ice cream (Granite
# State: 25 vs 206) or a taralli maker listing "vino" pairings (8 vs 87) stays.
_OTHER_CATEGORY_WORDS = re.compile(
    # Not "wine gums", "Swedish Fish", "for the sake of", or a cheese-flavoured cracker.
    r"\bwines?\b(?!\s+gums?)|\bvino\b|\bvini\b|\bvins?\b|\bbeers?\b|\bbirra\b|\bcerveza\b|\bspirits\b|日本酒|焼酎|ワイン|ビール|"
    # Spirits by name ("Cioccolato, distillati e altre passioni", ADELIA DI FANT, 2026-11-09
    # run: 16 of them vs 21 chocolate words). Not "liquirizia" (liquorice).
    r"distillat\w*|\bgrappa\b|\bliquori\b|\bliqueurs?\b|\bwhiske?y\b|\bvodka\b|\bdistiller\w*|"
    r"\bcheeses?\b(?!\s+(?:crackers?|straws?|biscuits?|puffs?|balls?))|fromages?|formagg\w*|\bquesos?\b|"
    r"チーズ(?!おかき|せんべい|煎餅|あられ|クッキー|ケーキ)|乳製品|"
    r"\bsalumi\b|charcuterie|sausages?|\bham\b|jam[oó]n|ハム|ソーセージ|"
    r"(?<!swedish\s)\bfish\b|poissons?|\bpesce\b|水産|鮮魚|"
    r"olive\s+oil|huile\s+d['’]olive|olio\s+(?:extra|d['’]oliva)|aceite\s+de\s+oliva|vinegar|vinaigre|aceto|"
    r"醤油|味噌|調味料|ドレッシング|"
    r"cosmetics?|\bsoaps?\b|savons?|\bsapon[ei]\b|jab[oó]n|化粧品|石鹸|スキンケア|"
    r"maple\s+syrup|sirop\s+d['’][ée]rable|メープルシロップ|"
    r"supplements?|サプリ|健康食品|baby\s+food|離乳食|pet\s+food|ペットフード|"
    r"ice\s+cream|gelato|gelateria|helado|アイスクリーム",
    re.I,
)
_MIN_OTHER_CATEGORY_HITS = 8


def _other_category_hits(text: str) -> int:
    return len(_OTHER_CATEGORY_WORDS.findall(text or ""))
_MIN_OFF_TARGET_HITS = 5
# ラムネ is both a tablet sweet and a bottled soda. On a drinks maker's site (ハタ鉱泉:
# ラムネ 73, サイダー/シャンメリー/飲料 25, 2026-11-04 run) it isn't a sweets word.
_DRINK_WORDS = re.compile(r"清涼飲料|飲料|飲み物|サイダー|シャンメリー|ビー玉|\bbeverages?\b|\bsoft\s+drinks?\b", re.I)

# Shop selling OTHER makers' products (marketplace, deli, gift-box assembler). Strong
# markers count on any site; the weak ones only when the site never says it makes
# anything -- a chocolatier sells "gift boxes and Christmas hampers" of its own chocolate,
# and a maker with several product lines has "our brands".
_RETAILER_MARKERS = re.compile(
    r"\b(shop\s+by\s+brand|all\s+brands|brands\s+we\s+(stock|carry)|marketplace)\b",
    re.I,
)
# A sweet SHOP rather than a maker (2026-11-06 run): a range counted in the title ("400+
# Types of Liquorice Sweets", Liquorice Heaven) and pick & mix counters (SugarSin, a Covent
# Garden sweet shop: 8 mentions). Of every reviewed maker, one mentioned pick & mix once.
_SHOP_RANGE_TITLE = re.compile(r"\b\d{2,}\+?\s+(?:types|varieties|brands|kinds|flavou?rs)\s+of\b", re.I)
_PICK_AND_MIX = re.compile(r"pick\s*(?:&|'n'|’n’|n|and|\+)\s*mix", re.I)
_MIN_PICK_AND_MIX = 3
# Shopify/WooCommerce product listings: never a trade page.
_PRODUCT_LISTING_PATH = re.compile(r"/(?:collections|products|product-category|categorie|categoria)/", re.I)
# A distributor describing itself (judged on a JS site's title + meta description only):
# "Wholesale candy, snacks, and sundries" (General Candy Company). Not "wholesalers" /
# "distributors of" -- a maker's own description says "available through wholesalers and
# stockists" -- and not when the same text says it makes the products.
_THIN_DISTRIBUTOR = re.compile(
    r"\bsundries\b|\bwholesale\s+(?:candy|candies|snacks?|confectionery|groceries|foods?)\b|\bdistributeurs?\s+de\b",
    re.I,
)
_WEAK_RETAILER_MARKERS = re.compile(
    r"\b(our\s+brands|we\s+stock|hampers?|gift\s+(boxes|baskets)|"
    r"unsere\s+marken|nos\s+marques|i\s+nostri\s+marchi|nuestras\s+marcas)\b",
    re.I,
)

# The site describes itself as MAKING things (not selling or writing about them).
_PRODUCER_MARKERS = re.compile(
    r"\b(?:hand[\s-]?made|made\s+by\s+hand|we\s+bake|baked\s+(fresh|daily|by\s+hand|in)|"
    r"our\s+(bakery|kitchen|factory|recipes?|confectioners?)|family[\s-](run|owned|business)|"
    r"since\s+1[89]\d\d|since\s+20\d\d|est\.?\s*(19|18|20)\d\d|established\s+in|"
    r"manufactur\w*|confectioners?|chocolatiers?|artisan\w*|"
    r"handgemacht|hergestellt|manufaktur|backstube|konditorei|b[äa]ckerei|familienbetrieb|seit\s+\d{4}|"
    r"fait[\s-]main|fabrication|fabriqu\w*|artisana\w*|biscuiterie|confiserie|chocolaterie|depuis\s+\d{4}|"
    r"fatt[oi]\s+a\s+mano|produzione|artigian\w*|laboratorio|pasticceria|torronificio|biscottificio|dal\s+\d{4}|"
    r"hecho\s+a\s+mano|elaboraci[oó]n|elaboramos|obrador|artesan\w*|confiter[ií]a|pasteler[ií]a|desde\s+\d{4}|"
    r"fabrico|f[aá]brica)|"
    # Japanese OUTSIDE the \b(...)\b group: kanji and kana are word characters, so inside
    # it "1902年創業", "伝統の製法", "製菓メーカー" never matched in running text -- a
    # senbei maker's site read as "not a producer".
    r"創業|製造|手作り|自社工場|老舗|製菓|本舗|本舖|総本家|総本店|菓子司|菓子處|菓子処|職人|製法|自社製|工場",
    re.I,
)


def _host(url: str) -> str:
    try:
        return urlparse(url).netloc.lower().removeprefix("www.")
    except ValueError:
        return ""


def _get(url: str, timeout: int = 8) -> requests.Response | None:
    try:
        try:
            resp = requests.get(url, headers=HEADERS, timeout=timeout)
        except (requests.Timeout, requests.ConnectionError):
            resp = requests.get(url, headers=HEADERS, timeout=15)
        resp.raise_for_status()
        # A text/html response with no charset in its Content-Type makes requests fall
        # back to ISO-8859-1, which turned every UTF-8 Japanese page (fukusaya, kanro,
        # toraya...) into mojibake -- zero food words, so real makers read as "not a food
        # site". Detect the encoding from the bytes instead in that case.
        if "charset" not in resp.headers.get("Content-Type", "").lower():
            resp.encoding = resp.apparent_encoding or resp.encoding
        return resp
    except requests.RequestException:
        return None


def _page_text(soup: BeautifulSoup) -> str:
    clone = BeautifulSoup(str(soup), "html.parser")
    for tag in clone(["script", "style", "nav", "footer", "noscript", "svg"]):
        tag.decompose()
    return clone.get_text(" ", strip=True)[:_PAGE_TEXT_CAP]


def _meta_text(soup: BeautifulSoup) -> str:
    parts = []
    if soup.title and soup.title.string:
        parts.append(soup.title.string.strip())
    for attrs in ({"name": "description"}, {"property": "og:description"}, {"property": "og:title"}):
        tag = soup.find("meta", attrs=attrs)
        if tag and tag.get("content", "").strip():
            parts.append(tag["content"].strip())
    return " ".join(dict.fromkeys(parts))


def _self_title(soup: BeautifulSoup) -> str:
    title = soup.title.string.strip() if soup.title and soup.title.string else ""
    return f"{title} {_extract_site_name(soup) or ''}".strip()


def _jsonld_types(soup: BeautifulSoup) -> set[str]:
    types: set[str] = set()
    for script in soup.find_all("script", type="application/ld+json"):
        try:
            data = json.loads(script.string or "")
        except (ValueError, TypeError):
            continue
        stack = [data]
        while stack:
            item = stack.pop()
            if isinstance(item, list):
                stack.extend(item)
            elif isinstance(item, dict):
                t = item.get("@type")
                for k in t if isinstance(t, list) else [t]:
                    if isinstance(k, str):
                        types.add(k)
                if "@graph" in item:
                    stack.append(item["@graph"])
    return types


def _internal_links(soup: BeautifulSoup, base_url: str) -> list[tuple[str, str]]:
    host = _host(base_url)
    seen: set[str] = set()
    out: list[tuple[str, str]] = []
    for a in soup.find_all("a", href=True):
        try:
            href = urljoin(base_url, a["href"]).split("#")[0]
        except ValueError:
            # A malformed href ("http://[broken") makes urljoin raise; one bad link on a
            # candidate's page must not abort the whole sourcing run.
            continue
        if not href.startswith(("http://", "https://")) or _host(href) != host or href in seen:
            continue
        seen.add(href)
        out.append((a.get_text(" ", strip=True)[:80], href))
    return out


def _earliest(*years: int | None) -> int | None:
    found = [y for y in years if y]
    return min(found) if found else None


def _product_counts(text: str) -> dict:
    """How often the site names each kind of product -- counted without the cookie banner,
    whose "cookies"/"クッキー" read as biscuits ("This website uses cookies" = 3 hits)."""
    text = _COOKIE_BANNER.sub(" ", text)
    target = len(_TARGET_WORDS.findall(text))
    return {
        "freshHits": len(_FRESH_WORDS.findall(text)),
        "offTargetHits": len(_OFF_TARGET_WORDS.findall(text)),
        "targetHits": target,
        "shelfHits": target,
        "chilledHits": chilled_hits(text),
        "otherCategoryHits": _other_category_hits(text),
    }


def build_profile(url: str) -> dict:
    """Never raises. Always returns a dict with at least "readable"."""
    home = _get(url)
    if home is None:
        return {"readable": False, "why": "사이트 접속 실패/차단"}
    soup = BeautifulSoup(home.text, "html.parser")
    home_text = _page_text(soup)
    if _is_parked(home.url, home_text):
        return {"readable": True, "parked": True, "why": "매물(parked) 도메인"}
    if len(home_text) < MIN_READABLE_CHARS:
        # A JavaScript-rendered site leaves almost no body text, but its <title> and meta
        # description are server-rendered and usually say exactly what the business is
        # (dilloncandy.com: 82 chars of body, title "Southern Candy Wholesale Manufacturer
        # — Handmade Since 1918"). Judge from those -- strictly, see judge().
        meta = _meta_text(soup)
        if len(meta) < 30:
            return {"readable": False, "why": f"홈페이지 본문이 거의 없음 ({len(home_text)}자)"}
        thin = f"{meta} {home_text}"
        return {
            "readable": True,
            "parked": False,
            "thin": True,
            "finalUrl": home.url,
            "siteName": _extract_site_name(soup),
            "fullText": thin,
            "foundedYear": _earliest(extract_founded_year(thin), jsonld_founding_year(soup)),
            "country": guess_country_from_domain(home.url) or guess_country_from_text(thin),
            "thinFood": has_food_words(thin),
            "thinProducer": bool(_PRODUCER_MARKERS.search(thin)),
            "thinTrade": has_export_signal(thin) or bool(_TRADE_LINK.search(meta)),
            "thinPublisher": bool(_PUBLISHER_MARKERS.search(thin)),
            "shelfLifeMonths": shelf_life_months(thin),
            **_product_counts(thin),
            "selfTitle": _self_title(soup),
            "pageTitle": soup.title.string.strip() if soup.title and soup.title.string else "",
        }

    links = _internal_links(soup, home.url)
    oem_link = next(
        (t or urlparse(h).path for t, h in links if _OEM_WORDS.search(t) or _OEM_PATH.search(urlparse(h).path)),
        None,
    )
    about = [
        (t, h)
        for t, h in links
        if (_ABOUT_LINK.search(t) or _ABOUT_LINK.search(urlparse(h).path))
        and not _TOPIC_HISTORY.search(f"{t} {urlparse(h).path}")
    ]
    about.sort(key=lambda th: not (_COMPANY_PAGE.search(th[0]) or _COMPANY_PAGE.search(urlparse(th[1]).path)))
    about_urls = [h for _, h in about][:_MAX_ABOUT_PAGES]
    # A web shop's product collection is never its trade page, whatever its slug says:
    # "/collections/finnish-liquorice-lakritsi-uk-stockist" is a liquorice retailer's
    # shelf of Finnish brands (Liquorice Heaven, 2026-11-06 run).
    trade_links = [
        (t, h)
        for t, h in links
        if (_TRADE_LINK.search(t) or (_TRADE_LINK.search(urlparse(h).path) and not _PRODUCT_LISTING_PATH.match(urlparse(h).path)))
        and not _GIFT_LINK.search(f"{t} {urlparse(h).path}")
    ]
    texts = [home_text]
    for sub in about_urls + [h for _, h in trade_links[:_MAX_TRADE_PAGES]]:
        resp = _get(sub, timeout=6)
        if resp is not None:
            texts.append(_page_text(BeautifulSoup(resp.text, "html.parser")))
    full_text = " ".join(texts)

    types = _jsonld_types(soup)
    producer_hits = len({m.group(0).lower() for m in _PRODUCER_MARKERS.finditer(full_text)})
    retailer_hits = len({m.group(0).lower() for m in _RETAILER_MARKERS.finditer(full_text)})
    if not producer_hits:
        retailer_hits += len({m.group(0).lower() for m in _WEAK_RETAILER_MARKERS.finditer(full_text)})
    trade_evidence = None
    if trade_links:
        t, h = trade_links[0]
        trade_evidence = f"거래/도매 링크: '{t or urlparse(h).path}'"
    elif has_export_signal(full_text):
        trade_evidence = "본문에 도매/수출 문구"
    else:
        link_texts = " ".join(t for t, _ in links)
        supplier = _SUPPLIER_GRADE.search(f"{link_texts} {full_text}")
        if supplier:
            trade_evidence = f"납품업체급 신호 (생산공장/식품안전 인증): '{supplier.group(0)}'"

    return {
        "readable": True,
        "parked": False,
        "finalUrl": home.url,
        "siteName": _extract_site_name(soup),
        "homeText": home_text,
        "fullText": full_text,
        "foundedYear": _earliest(extract_founded_year(full_text), jsonld_founding_year(soup)),
        "country": guess_country_from_domain(home.url) or guess_country_from_text(full_text),
        "jsonldTypes": sorted(types),
        "publisherTypes": sorted(types & _PUBLISHER_TYPES),
        "publisherHits": len({m.group(0).lower() for m in _PUBLISHER_MARKERS.finditer(home_text)}),
        "dateStamps": len(_DATE_STAMP.findall(home_text)),
        "retailerHits": retailer_hits,
        "producerHits": producer_hits,
        "trade": trade_evidence,
        "food": check_food_relevance(full_text),
        "selfTitle": _self_title(soup),
        "pageTitle": soup.title.string.strip() if soup.title and soup.title.string else "",
        "shelfLifeMonths": shelf_life_months(full_text),
        "oemLink": oem_link,
        **_product_counts(full_text),
    }


# A food-MACHINERY maker names its machines in its own title: "Customized Biscuit
# Production Line, Dough Mixer Manufacturing Company, Tunnel Oven Manufacturers" (WENVA,
# 2026-10-29 run) -- full of biscuit words and "manufacturing", so every food check passed.
# Two different machine words in the title; a confectioner's title never has even one.
_MACHINERY_TITLE = re.compile(
    r"\b(production\s+lines?|machinery|machines?|equipment|tunnel\s+ovens?|mixers?|"
    r"packaging\s+systems?|maquinaria|m[áa]quinas?|macchin[ae]|macchinari|maschinen|anlagenbau)\b|"
    r"製造ライン|製菓機械|食品機械|機械",
    re.I,
)
# A Japanese wholesaler / product planner calling itself that in its title ("北陸のおみやげは
# あいの風 | 卸売り・商品企画開発", 2026-10-29 run) -- it plans souvenirs that others make.
# Not when the title also says it makes them ("製造・卸売").
_JP_WHOLESALE_TITLE = re.compile(r"卸売|卸販売|菓子卸|商品企画")
# A maker suffix counts too: "山田製菓株式会社 | せんべい卸売・直売" makes its senbei.
_JP_MAKES_TITLE = re.compile(r"製造|工場|自社製|製菓|本舗|本舖|総本家|総本店|菓子司|製作所")
# A Japanese cake shop (ケーキバイキング, birthday cakes) -- fresh, not importable. Its own
# word because 生菓子-type fresh words are rare on these sites: Lis Blanc (Toyama, 2026-10-29
# run) had ケーキ x57 against 77 shelf-stable words; the most cake-heavy real maker in
# tests/eval_japan_sites.py had 12 against 29. Not パウンドケーキ / カップケーキ /
# ドライケーキ (baked, shelf-stable) or ライスケーキ.
_JP_CAKE = re.compile(r"(?<!パウンド)(?<!カップ)(?<!ドライ)(?<!ライス)ケーキ")
_MIN_CAKE_HITS = 15
_MAX_CAKE_RATIO = 0.5
# A shop for wedding/christening favours (dragées, bomboniere, confetti), not a brand to
# import: it sells by occasion. Measured: the deleted favour shops (Limas, Càversa, Crispo
# Confetti) name 5-7 different occasions; no team brand or eval maker names more than 2.
_OCCASIONS = re.compile(
    r"\b(mariages?|bapt[êe]mes?|communions?|matrimoni[oa]?|battesim[oi]|comunion[ei]|cresim[ae]|laurea|"
    r"bodas?|bautizos?|comuniones|wedding\s+favou?rs?|baby\s+showers?)\b",
    re.I,
)
_MIN_OCCASION_KINDS = 4
# A Japanese pâtisserie/bakery chain (EDELWEISS: ブーランジェ, パティスリー, "約80店舗を展開",
# 2026-10-30 run) -- fresh cakes and bread from its own shops. Real makers: at most 1.
_JP_BAKERY_CHAIN = re.compile(r"ブーランジェ|ベーカリー|パティスリー|生ケーキ|店舗を展開|店舗展開")
_MIN_JP_BAKERY_CHAIN_HITS = 3


# A cocoa PROCESSOR (cocoa mass, butter, powder, "cocoa preparations" for the food
# industry), not a chocolate brand: 大東カカオ (2026-10-29 run) had 21 of those words and
# 調製品 x10; every real maker in tests/eval_japan_sites.py has 0. English sites need the
# industry wording too -- a chocolatier lists cocoa butter in every ingredient line.
_COCOA_INGREDIENTS = re.compile(
    r"カカオマス|ココアバター|ココアパウダー|cocoa\s+(?:mass|liquor|butter|powder)|cacao\s+(?:mass|butter)", re.I
)
_FOR_INDUSTRY = re.compile(r"調製品|原料|業務用|\bfood\s+(?:industry|manufacturers)\b|\bindustrial\b", re.I)


# One candidate = one brand (user, 2026-10-29). Not a group or holding company over several
# brands ("Le groupe Sucralliance", "株式会社ロワールホールディングス"), not a distributor of
# other makers' brands ("Fabricant et distributeur de marques reconnues"), and not a
# business-to-business supplier that names itself so -- a B2B catalogue ("Catalogue B2B
# Choc and Co") or a hotel/restaurant supplier ("galletas ... para Hostelería"). The B2B
# rule reads only the site's own title and domain: almost every real brand also has a trade
# page, and that page is the trade-channel signal, not a reason to drop it.
# A group name alone isn't enough: "APOLLO Food Holdings" and "OHO GROUP" are each one
# brand (the team works with both); a group also lists its brands ("Nos Marques").
# Private-label wording isn't part of THIS rule -- it is its own reject (_oem_reason) since
# 2026-11-04, which also drops makers with their own brand that do it on the side (Mathez,
# chocolate truffles, mentions it 13 times).
_GROUP_NAME = re.compile(r"\b(?:groupe?|gruppo|grupo|gruppe|holdings?)\b|ホールディングス|グループ", re.I)
_BRAND_LIST = re.compile(
    r"\b(?:nos\s+marques|our\s+brands|nuestras\s+marcas|i\s+nostri\s+marchi|unsere\s+marken|"
    r"brand\s+portfolio|portfolio\s+of\s+brands|our\s+family\s+of\s+brands)\b|ブランド一覧|ブランド紹介",
    re.I,
)
_BRAND_DISTRIBUTOR = re.compile(
    r"distributeur\s+de\s+marques|distributor\s+of\s+(?:\w+\s+){0,2}brands|distribuidor\s+de\s+marcas|"
    r"distributore\s+di\s+marchi|vertrieb\s+(?:von\s+)?(?:\w+\s+){0,2}marken",
    re.I,
)
# A maker recruiting distributors for its own brand: "Become a distributor of our brands",
# "Vertrieb unserer Marken", "Diventa distributore di marchi".
_OWN_BRAND_RECRUIT = re.compile(r"\b(?:our|nos|nostri|nuestras|unserer)\b", re.I)
_BECOME = re.compile(r"become|devenez|diventa|diventare|hazte|convi[ée]rtete|werden", re.I)
_B2B_TITLE = re.compile(
    r"\bb2b\b|\bhoreca\b|\bfoodservice\b|\bfood\s+service\b|\bhosteler[ií]a\b|\bristorazione\b|"
    r"pour\s+(?:les\s+)?professionnels|f[üu]r\s+(?:die\s+)?gastronomie|業務用",
    re.I,
)


def _not_one_brand(profile: dict, name: str, url: str) -> tuple[str, str] | None:
    title = profile.get("selfTitle") or ""
    group = _GROUP_NAME.search(title) or _GROUP_NAME.search(name)
    if group and _BRAND_LIST.search(profile.get("fullText") or ""):
        return "multi_brand", f"그룹·지주회사 ('{group.group(0)}') — 여러 브랜드를 가진 회사라 브랜드 하나가 아님"
    distributor = next(
        (
            m for m in _BRAND_DISTRIBUTOR.finditer(profile.get("fullText") or "")
            if not _OWN_BRAND_RECRUIT.search(m.group(0))
            and not _BECOME.search((profile.get("fullText") or "")[max(0, m.start() - 25) : m.start()])
        ),
        None,
    )
    if distributor:
        return "multi_brand", f"여러 브랜드를 유통하는 회사 ('{distributor.group(0)}') — 브랜드 하나가 아님"
    b2b = _B2B_TITLE.search(title)
    if b2b:
        return "b2b_supplier", f"B2B 납품업체 (사이트 제목: '{b2b.group(0)}') — 소비자 브랜드가 아님"
    if "b2b" in brand_domain_label(url):  # b2bchocandco.com: no word boundary in a domain
        return "b2b_supplier", "B2B 납품업체 (사이트 주소에 'b2b') — 소비자 브랜드가 아님"
    return None


def _ingredient_supplier(text: str) -> str | None:
    cocoa = len(_COCOA_INGREDIENTS.findall(text))
    industry = len(_FOR_INDUSTRY.findall(text))
    if cocoa >= 10 and industry >= 5:
        return f"초콜릿 원료(카카오매스·코코아버터·파우더) 제조사 (원료 단어 {cocoa}회, 업무용/원료 {industry}회) — 완제품 브랜드가 아님"
    return None


def _machinery_title(title: str) -> str | None:
    # Singular and plural are one word ("Machine" / "Machines"); a lone "oven" is a
    # bakery's ("Oven Baked Biscuits"), only "tunnel oven" is a machine.
    words = {re.sub(r"s$", "", re.sub(r"\s+", " ", m.group(0).lower())) for m in _MACHINERY_TITLE.finditer(title)}
    return ", ".join(sorted(words)) if len(words) >= 2 else None


def _japanese_middleman(text: str) -> tuple[str, str] | None:
    """A Japanese site that sells, lists or supplies OTHER makers' products (or makes the
    machines), not its own. Each rule is the wording one kind of middleman can't avoid,
    measured on a real Japan-focus run (2026-10-12) against the makers it kept:
      goooods.com (B2B marketplace): 仕入れ x29 with 掲載/バイヤー -- a maker like 名月製菓
        also says 仕入れ x18 (it sells to shops) but never 掲載/バイヤー.
      food-oem.com (OEM directory): 掲載 x95 -- makers 0-3.
      miyata-net (trading co.): 総合商社. wave-b2b: 卸通販 (wholesale web shop).
      masaki-ya (wholesaler, "800 makers, 30,000 items"): メーカー様 + 小売店 x8 + バイヤー x19.
      contactlife (lens web shop): 処方箋 x7. masdac (food machinery): 食品機械 x11."""
    n = text.count
    # 掲載 as in "listed here" -- not a maker's own press coverage (メディア掲載, "…に掲載
    # されました"), which a popular maker's homepage lists many times.
    listed = n("掲載") - n("メディア掲載") - n("掲載されました") - n("掲載いただ") - n("掲載情報")
    if n("卸通販"):
        return "reseller_site", "도매 통판 사이트 (卸通販) — 다른 업체 상품을 파는 곳"
    if n("総合商社"):
        return "reseller_site", "식품 종합상사 (総合商社) — 제조사가 아님"
    if listed >= 10:
        return "publisher_site", f"업체 목록·디렉토리 사이트 (掲載 {listed}회)"
    if n("仕入れ") >= 10 and (listed >= 5 or n("バイヤー") >= 5 or n("登録無料")):
        return "reseller_site", f"B2B 도매 마켓플레이스 (仕入れ {n('仕入れ')}회)"
    if n("メーカー様") and n("小売店") >= 5 and n("バイヤー") >= 5:
        return "reseller_site", "여러 제조사 상품을 모아 파는 도매상 (メーカー様/小売店/バイヤー)"
    if n("処方箋") >= 3:
        return "reseller_site", "콘택트렌즈 통판(소매) 사이트 (処方箋)"
    # j-maeda.co.jp (2nd run): "国内外の幅広い製菓原材料や機械を取り扱う企業" -- an ingredient
    # and machinery trader, not a confectioner.
    if n("製菓原材料") and n("機械") and n("取り扱"):
        return "reseller_site", "제과 원료·기계 취급 상사 (製菓原材料/機械) — 제조사가 아님"
    if n("食品機械") >= 3:
        return "not_a_producer", "식품 기계 제조사 (食品機械) — 식품 제조사가 아님"
    return None


def judge(profile: dict, name: str, url: str, group: str = "food") -> tuple[bool, str, str]:
    """(keep, reason_code, human_reason). reason_code doubles as the progress filter-drop key.

    group: "food" (every normal lane) or "beauty"/"care" (Japan-focus lanes) -- picks which
    product words the site must be about; the publisher/reseller/producer/trade checks
    are the same for every group."""
    food = group == "food"
    # Says it makes its products: the producer words, or for beauty/care the maker words.
    makes = profile.get("producerHits", 0) > 0 or (
        not food and bool(_DEVICE_MAKER_MARKERS.search(profile.get("fullText", "")))
    )
    if not profile.get("readable"):
        return False, "unverifiable_site", profile.get("why", "")
    if profile.get("parked"):
        return False, "parked_domain", profile.get("why", "")
    directory = _DIRECTORY_TITLE.search(profile.get("selfTitle") or "")
    if directory:
        return False, "publisher_site", f"사이트 제목이 포털/가이드/매거진형 ('{directory.group(0)}')"
    # Food lanes only: a ReFa-style beauty brand is often a planner (企画・開発) whose
    # devices are made elsewhere, and that's the kind the beauty lane wants.
    title = profile.get("selfTitle") or ""
    machinery = _machinery_title(title) if food else None
    if machinery:
        return False, "not_a_producer", f"사이트 제목이 기계·설비 제조사 ('{machinery}') — 식품 제조사가 아님"
    if food and _JP_WHOLESALE_TITLE.search(title) and not _JP_MAKES_TITLE.search(title):
        return False, "reseller_site", f"사이트 제목이 도매·상품기획 회사 ('{_JP_WHOLESALE_TITLE.search(title).group(0)}') — 제조사가 아님"
    not_one_brand = _not_one_brand(profile, name, url)
    if not_one_brand:
        return False, not_one_brand[0], not_one_brand[1]
    if profile.get("thin"):
        # Only the title/meta description to go on, so all three must be stated outright.
        if profile["thinPublisher"]:
            return False, "publisher_site", "본문이 거의 없고 제목/설명이 언론형"
        if looks_like_reseller(profile.get("selfTitle") or "") or looks_like_reseller(name):
            return False, "reseller_site", "이름이 도매상/유통업자/선물세트형"
        # The description is this site's whole self-introduction here, so a distributor's
        # wording in it counts like a title ("Wholesale candy, snacks, and sundries").
        distributor = _THIN_DISTRIBUTOR.search(profile["fullText"])
        if distributor and not says_it_makes(profile["fullText"]):
            return False, "reseller_site", f"제목/설명이 도매·유통업체형 ('{distributor.group(0)}')"
        thin_off = len(_OFF_TARGET_WORDS.findall(profile["fullText"])) + _other_category_hits(profile["fullText"])
        thin_target = len(_TARGET_WORDS.findall(profile["fullText"]))
        # One "miel" next to one "nougat" is a honey-nougat maker ("Nougat au miel de
        # Provence"), not a honey business -- a tie only counts from two hits up.
        if food and (thin_off > thin_target or (thin_off >= 2 and thin_off >= thin_target)):
            return False, "off_target_category", "과자·비스킷·스낵·초콜릿이 아닌 품목 위주 (제목/설명 기준)"
        on_topic = profile["thinFood"] if food else has_group_words(profile["fullText"], group)
        if not (on_topic and (profile["thinProducer"] or makes) and profile["thinTrade"]):
            return False, "unverifiable_site", "본문이 거의 없고 제목/설명에 제품·제조·도매 근거가 다 있지 않음"
        if not has_latin_letters(name) and name_on_site(name, profile["fullText"]) is False:
            return False, "name_not_on_site", "사이트 제목/설명에 후보 이름이 없음"
        # The checks that only need the title/description, same as the full path below.
        oem = _oem_reason(profile, food)
        if oem:
            return False, "oem_maker", oem
        middleman = _japanese_middleman(profile["fullText"])
        if middleman:
            return False, middleman[0], middleman[1]
        ingredient = _ingredient_supplier(profile["fullText"]) if food else None
        if ingredient:
            return False, "not_a_producer", ingredient
        product = _product_reason(profile, group)
        if product:
            return False, product[0], product[1]
        return True, "ok", "JS 사이트라 본문 대신 제목/설명으로 판정: 식품·제조·도매 모두 명시" + _shelf_note(profile)
    # Strict producer words only: a review listicle (my-best) is full of "メーカー".
    if profile["publisherTypes"] and not profile["producerHits"]:
        return False, "publisher_site", f"언론/블로그 사이트 (JSON-LD {profile['publisherTypes']})"
    # Dated lists alone only mean "publisher" when nothing says the site makes anything:
    # every Japanese company homepage carries a dated お知らせ (news) list -- 井筒八ッ橋本舗
    # had 173 dates and was read as a blog.
    if profile["publisherHits"] >= 2 or (profile["dateStamps"] >= 6 and not makes):
        return False, "publisher_site", f"언론/블로그형 사이트 (출판 용어 {profile['publisherHits']}, 날짜 {profile['dateStamps']})"
    if looks_like_reseller(profile.get("selfTitle") or "") or looks_like_reseller(name) or profile["retailerHits"] >= 2:
        return False, "reseller_site", f"재판매/편집숍형 사이트 (신호 {profile['retailerHits']})"
    shop_range = _SHOP_RANGE_TITLE.search(profile.get("selfTitle") or "")
    if shop_range:
        return False, "reseller_site", f"여러 브랜드를 파는 판매점 (사이트 제목: '{shop_range.group(0)}')"
    pick_mix = len(_PICK_AND_MIX.findall(profile["fullText"]))
    if pick_mix >= _MIN_PICK_AND_MIX:
        return False, "reseller_site", f"pick & mix 사탕 가게 (언급 {pick_mix}회) — 여러 브랜드를 파는 판매점"
    middleman = _japanese_middleman(profile["fullText"])
    if middleman:
        return False, middleman[0], middleman[1]
    ingredient = _ingredient_supplier(profile["fullText"]) if food else None
    if ingredient:
        return False, "not_a_producer", ingredient
    oem = _oem_reason(profile, food)
    if oem:
        return False, "oem_maker", oem
    food_ok, food_why = profile["food"] if food else check_group_relevance(profile["fullText"], group)
    if food_ok is not True:
        return False, "not_food_site" if food else "off_topic_site", food_why
    if not has_latin_letters(name) and name_on_site(name, profile["fullText"]) is False:
        return False, "name_not_on_site", "사이트 본문에 후보 이름이 없음"
    product = _product_reason(profile, group)
    if product:
        return False, product[0], product[1]
    # A one-page website is a micro business (home kitchen, single shop), not an importable
    # supplier. Measured across every site kept in tests/eval_live_sites.py: the one
    # one-pager (a farmhouse cake maker, 1,257 chars total) vs. 3,225+ for all others.
    if len(profile["fullText"]) < _MIN_SITE_CHARS:
        return False, "micro_site", f"사이트가 한 페이지 수준으로 작음 ({len(profile['fullText'])}자) — 초소형 업체 추정"
    if not makes:
        return False, "not_a_producer", "직접 만든다는 표현(수제, 제조, since 등)이 사이트에 없음"
    if not profile["trade"]:
        return False, "no_export_signal", "도매/수출/거래처 링크나 문구가 없음 (동네 가게 추정)"
    return True, "ok", f"{profile['trade']}; 생산자 신호 {profile['producerHits']}종; {food_why}" + _shelf_note(profile)


def _product_reason(profile: dict, group: str) -> tuple[str, str] | None:
    """(code, reason) when the site's products are ones the company doesn't buy -- other
    categories, fresh bakery goods, favour boxes, short shelf life, chilled/frozen goods, or
    for beauty/care the excluded items. Shared by the full and the JS-site (thin) path."""
    text = profile["fullText"]
    if group != "food":
        excluded = _GROUP_EXCLUDED_WORDS[group].findall(text)
        wanted = len(_GROUP_TARGET_WORDS[group].findall(text))
        # 2:1 so a device brand that also sells a few combs or sheet masks (ヤーマン, アクシージア)
        # stays, while a hair-appliance / brush / comb house (SALONIA, 熊野筆, uka) goes.
        if len(excluded) >= _MIN_EXCLUDED_HITS and len(excluded) > 2 * wanted:
            top = max(set(excluded), key=excluded.count)
            return "excluded_item", (
                f"취급하지 않는 품목 위주 ('{top}' 등 {len(excluded)}회 vs 취급 품목 {wanted}회) — "
                "빗·브러시·화장붓·족집게·면도칼·마스크·연고·드라이어류 제외"
            )
        return None
    if "targetHits" not in profile:  # a profile built by hand (tests) rather than by build_profile
        profile = {**profile, **_product_counts(text)}
    off, target = profile["offTargetHits"], profile["targetHits"]
    if len(_DRINK_WORDS.findall(text)) >= _MIN_OFF_TARGET_HITS:
        target -= text.count("ラムネ")
    if off >= _MIN_OFF_TARGET_HITS and off >= target:
        return "off_target_category", f"취급하지 않는 품목(커피·차·꿀·파스타·음료) 위주 ({off} vs 과자류 {target})"
    other = off + profile.get("otherCategoryHits", 0)
    if other >= _MIN_OTHER_CATEGORY_HITS and other * 2 >= target:
        words = sorted({m.group(0).lower() for m in _OTHER_CATEGORY_WORDS.finditer(text)})[:5]
        return "off_target_category", (
            f"과자·비스킷·스낵·초콜릿이 아닌 품목 비중이 큼 (기타 품목 {other} vs 과자류 {target}: {', '.join(words)})"
        )
    fresh, shelf = profile["freshHits"], profile["shelfHits"]
    if fresh >= _MIN_FRESH_HITS and fresh / max(shelf, 1) >= _MAX_FRESH_RATIO:
        return "fresh_bakery", f"신선 빵·케이크 위주 (빵 단어 {fresh} vs 보존식품 단어 {shelf}) — 수입 불가 품목"
    cake = len(_JP_CAKE.findall(text))
    if cake >= _MIN_CAKE_HITS and cake >= _MAX_CAKE_RATIO * shelf:
        return "fresh_bakery", f"케이크 가게 (ケーキ {cake}회 vs 보존식품 단어 {shelf}) — 생케이크는 수입 불가"
    bakery_chain = len(_JP_BAKERY_CHAIN.findall(text))
    if bakery_chain >= _MIN_JP_BAKERY_CHAIN_HITS:
        return "fresh_bakery", f"제과점·베이커리 체인 (ブーランジェ/パティスリー/店舗展開 {bakery_chain}회) — 생과자·빵 위주"
    # One kind per occasion, not per spelling: "mariage"/"mariages", "matrimonio"/"matrimoni"
    # counted twice and a dragée maker became a favour shop.
    occasions = {_fold(m.group(1))[:6] for m in _OCCASIONS.finditer(text)}
    if len(occasions) >= _MIN_OCCASION_KINDS:
        return "favor_shop", f"결혼식·세례식 답례품 가게 (행사 {len(occasions)}종: {', '.join(sorted(occasions)[:4])}) — 수입 브랜드가 아님"
    short = _short_shelf_life(profile)
    if short:
        return "shelf_life_short", short
    cold = _cold_product_title(profile)
    if cold:
        return "chilled_frozen", cold
    chilled = profile.get("chilledHits", 0)
    if profile.get("shelfLifeMonths") is None and chilled >= _MIN_CHILLED_HITS and chilled / max(shelf, 1) >= _MAX_CHILLED_RATIO:
        return "chilled_frozen", f"냉장·냉동 제품 위주 (냉장/냉동 표현 {chilled} vs 보존식품 단어 {shelf}) — 유통기한 12개월 미달 추정"
    return None


def _fold(text: str) -> str:
    """Lowercase without accents ("baptêmes" -> "baptemes")."""
    return "".join(c for c in unicodedata.normalize("NFD", text.lower()) if not unicodedata.combining(c))


def _short_shelf_life(profile: dict) -> str | None:
    """The site itself states a shelf life, and even its longest one is under 12 months."""
    months = profile.get("shelfLifeMonths")
    if months is not None and months < MIN_SHELF_LIFE_MONTHS:
        return f"사이트에 표기된 유통기한이 최대 {format_months(months)} — {MIN_SHELF_LIFE_MONTHS}개월 미만이라 수입 불가"
    return None


def _cold_product_title(profile: dict) -> str | None:
    """The site's title says it is an ice-cream/gelato maker -- unless the title also names a
    shelf-stable line ("Helados y turrones", "Torrone e gelato"): then the site's own
    shelf-life and chilled wording decide, like for any other mixed maker."""
    title = profile.get("selfTitle") or ""
    if names_cold_product(title) and not _TARGET_WORDS.search(title):
        return "사이트 제목이 아이스크림·젤라또 업체 — 냉동 제품이라 유통기한 12개월 미달"
    return None


def _shelf_note(profile: dict) -> str:
    months = profile.get("shelfLifeMonths")
    return f"; 유통기한 {months}개월 표기 (사이트)" if months is not None else ""


def resolved_name(profile: dict, name: str, url: str) -> str:
    # A Japanese site names itself in its <title> (株式会社晃祐堂, 【名月製菓】...) --
    # pick_brand_name only reads Latin-letter names, see japanese_site_name.
    title = profile.get("pageTitle") or ""
    jp = japanese_site_name(title, profile.get("siteName"))
    if jp:
        return jp
    # Last resort for a Japanese title with no name-shaped piece: a non-Latin name that the
    # title doesn't even contain is a search-title fragment ("大口注文" for お菓子屋ニャンライズ),
    # and a Japanese title starts with the shop's own name.
    if _JP_TITLE.search(title) and not has_latin_letters(name) and name not in title:
        # Not the page's own name: "トップページ-いわてFOOD＆CRAFT" starts with "top page".
        rest = re.sub(r"^(?:トップページ|トップ|ホーム|TOP|HOME)\s*[-－|｜:：]?\s*", "", title.strip(), flags=re.I)
        first = re.split(r"[\s　｜|【】]", rest)[0]
        if 2 <= len(first) <= 20:
            return first
    # Not the page <title> as a stand-in for a missing og:site_name: on a product page it names
    # the PARENT company ("Munchy's Topmix" -> "URC Malaysia", "Charleston Chew" -> "Tootsie").
    picked = _strip_page_words(pick_brand_name(name, profile.get("siteName"), url))
    if _unusable_name(picked) or _category_in_place(picked):
        better = _name_from_title(f"{title} | {profile.get('siteName') or ''}", picked, url)
        if better:
            return better
        if _unusable_name(picked):
            label = brand_domain_label(url)
            return label.replace("-", " ").title() if len(label) >= 3 else picked
    return picked


# --- names that are not names --------------------------------------------------------------
# What reached the review list as a "brand" (2026-10-29 run): a search title cut off by
# Google ("富山のスイーツ専門店リブラン-Lis Blanc-話題のケーキや ..."), an article headline
# ("Turrón, un dulce que trasciende la Navidad") and a product-in-a-place phrase ("Turrones
# en Alicante" -- the maker is "Hijas de Alberto Monerris Sirvent", the title's next piece).
# Function words a headline has and a company name doesn't (no de/la/di/du/van: "Maison De
# La Praline", "Hijas de Alberto ...").
_HEADLINE_WORDS = {
    "un", "una", "uno", "que", "che", "qui", "est", "es", "is", "are", "the", "for", "with", "con",
    "para", "per", "pour", "avec", "und", "mit", "für", "your", "how", "why", "what", "come", "como",
}
_PLACE_PREPOSITIONS = {"en", "de", "in", "di", "da", "from", "aus", "du", "of"}
_LOCATIVE_WORDS = {"en", "in", "from", "aus"}
_CONNECTORS = {"y", "e", "et", "and", "&", "la", "le", "el", "del", "della", "los", "las", "les"}
# A title piece that doesn't match the domain only replaces the name when it says it is a
# company ("Hijas de Alberto Monerris Sirvent"): any Title Case piece let "Free Shipping
# Worldwide" or "Privacy Policy" replace "Nougat de Montélimar".
_COMPANY_SHAPE = re.compile(
    r"\b(hij[oa]s|fils|figli|filhos|sons|söhne|brothers|fr[èe]res|fratelli|hermanos|maison|casa|famil\w+|"
    r"s\.?r\.?l|s\.?p\.?a|s\.?l|s\.?a|ltd|limited|gmbh|ag|inc|llc|co|company|cie)\b",
    re.I,
)
# Title Case pieces that are page furniture or slogans, not a company ("Made In Italy").
_NOT_COMPANY_WORDS = {
    "home", "homepage", "page", "welcome", "official", "site", "website", "shop", "store", "online",
    "accueil", "inicio", "startseite", "contact", "about", "products", "made", "since", "italy",
    "france", "spain", "españa", "italia", "england", "scotland", "uk", "usa", "japan", "gifts", "gift",
}
# Splits a title into pieces, also on a dash glued to Japanese text ("リブラン-Lis Blanc-話題の").
_TITLE_PIECES = re.compile(r"\s*[|｜–—:·»【】「」]\s*|\s+-\s+|(?<=[぀-ヿ一-鿿])-|-(?=[぀-ヿ一-鿿])")


# Page words around a name (2026-10-29 run): a menu item glued on by the search snippet
# ("Cotswold Fudge CoStockists") and a page-type prefix ("B2B Choc and Co", the trade
# catalogue of Choc and Co). Only navigation words no brand name ends with.
_GLUED_MENU_WORD = re.compile(r"(?<=[a-z])(?:Stockists|Contact|Login|Basket|Cart|Menu|Home)$")
# Also the name of the page the search hit was on: "PRESENTATION BISCUITERIE LE DREAN"
# (the "Présentation" page of Biscuiterie Le Drean, 2026-11-09 run).
_PAGE_PREFIX = re.compile(
    r"^(?:catalogue|catalogo|catálogo|katalog|b2b|espace\s+pro|pr[ée]sentation|accueil|home|about(?:\s+us)?|"
    r"l['’]entreprise|qui\s+sommes[\s-]nous|chi\s+siamo|qui[ée]nes\s+somos|notre\s+histoire|la\s+storia|historique)\s+",
    re.I,
)
# ... and a site-type suffix from the page title ("McVITIES Official", "EDELWEISS エーデル
# ワイス オフィシャルサイト").
_SITE_SUFFIX = re.compile(
    r"\s*(?:official(?:\s+(?:site|website|store|shop))?|online\s+(?:shop|store)|"
    r"オフィシャルサイト|オフィシャルショップ|公式サイト|公式オンラインショップ|公式通販サイト|公式通販|オンラインショップ)$",
    re.I,
)
# A Latin name followed by its katakana reading: "EDELWEISS エーデルワイス" -> EDELWEISS.
_LATIN_THEN_KANA = re.compile(r"^([A-Za-z][A-Za-z0-9&'.\- ]*?)\s+[ァ-ヶー・]+$")


def _strip_page_words(name: str) -> str:
    stripped = _SITE_SUFFIX.sub("", _PAGE_PREFIX.sub("", _GLUED_MENU_WORD.sub("", name))).strip()
    latin = _LATIN_THEN_KANA.match(stripped)
    stripped = latin.group(1).strip() if latin else stripped
    return stripped if len(stripped) >= 2 else name


def _unusable_name(name: str) -> bool:
    words = re.findall(r"[^\W\d_]+", name.lower())
    # Two DIFFERENT function words: "The Fudge Shop of the Lakes" has "the" twice and is a name.
    headline = len(words) >= 5 and len(set(words) & _HEADLINE_WORDS) >= 2
    # 60: "Premiata Fabbrica di Cioccolato Zeno 1926 Srl" is a real 45-character name.
    return name.rstrip().endswith(("...", "…")) or len(name) > 60 or headline


def _category_in_place(name: str) -> bool:
    """ "Turrones en Alicante", "Biscuits from Devon": a product (plural or not) + a place.
    Only "in/from" words: with de/di/of it's how real brands are named ("Chocolat de
    Neuville", "Amaretti di Saronno", "Galletas de la Abuela")."""
    words = name.split()
    if not 3 <= len(words) <= 4 or words[1].lower() not in _LOCATIVE_WORDS:
        return False
    first = words[0].lower()
    product = any(_TARGET_WORDS.fullmatch(first[: len(first) - cut]) for cut in (0, 1, 2) if len(first) - cut >= 3)
    return product and all(w[:1].isupper() for w in words[2:])


def _name_from_title(text: str, current: str, url: str) -> str | None:
    """Another piece of the site's own title that reads as a company name: a Title Case
    piece of 1-6 words that matches the domain ("Lis Blanc"), else one with no product or
    page/slogan word in it ("Hijas de Alberto Monerris Sirvent"). Lower-case words mean a
    description ("Elaboración artesanal de turrones y dulces de Jijona")."""
    pieces = []
    # Also what comes before a comma: "La Dragée de Valence, dragées et pralines pour mariage"
    # is the company, then what it sells (2026-11-09 run: the domain "Drageepraline" won).
    candidates = []
    for p in _TITLE_PIECES.split(text):
        candidates += [p, p.split(",")[0]] if "," in p else [p]
    for p in candidates:
        p = re.sub(r"\s+", " ", p).strip(" -")
        content = [w for w in p.split() if w.lower() not in _PLACE_PREPOSITIONS and w.lower() not in _CONNECTORS]
        if (
            2 <= len(p) <= 60
            and 1 <= len(p.split()) <= 6
            and has_latin_letters(p)
            and content
            and all(w[:1].isupper() for w in content)
            and p.lower() != current.lower()
            and not _unusable_name(p)
            and not _category_in_place(p)
            and is_plausible_brand_name(p)
        ):
            pieces.append((p, content))
    for p, _content in pieces:
        if domain_matches_name(p, url):
            return strip_shop_words(p)  # "McVITIES Official" -> McVITIES
    for p, content in pieces:
        if (
            len(p.split()) >= 2
            and _COMPANY_SHAPE.search(p)
            and not any(w.lower().strip(".,") in _NOT_COMPANY_WORDS for w in content)
            and not _TARGET_WORDS.search(p)
        ):
            return p
    return None
