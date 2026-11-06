"""Text signals read off a candidate's own pages: founded year, export/wholesale wording,
parked-domain detection, and the name the site gives itself. Fetching and the keep/drop
decision live in site_profile.py."""

import json
import re
from datetime import date
from bs4 import BeautifulSoup

# Collected ALONGSIDE every FOUNDED_PATTERNS match (not checked first and returned
# early -- that was tried and regressed 3 of 4 real cases, see extract_founded_year's
# docstring) -- bounded to 5-300 years so it can't fire on an unrelated small number
# ("9 Jahre Garantie" = a 9-year warranty) or something nonsensical.
_ANNIVERSARY_PATTERNS = [
    re.compile(r"\b(\d{1,3})\s*years?\b", re.I),  # English
    re.compile(r"\b(\d{1,3})\s*jahre?n?\b", re.I),  # German "Jahre"/"Jahren"
    re.compile(r"\b(\d{1,3})\s*ans\b", re.I),  # French
    re.compile(r"\b(\d{1,3})\s*anni\b", re.I),  # Italian
    re.compile(r"\b(\d{1,3})\s*a[ñn]os\b", re.I),  # Spanish
]
_ANNIVERSARY_MIN_YEARS = 5
_ANNIVERSARY_MAX_YEARS = 300
# An anniversary that is not the company's own age: an age gate ("18 years or older"), a
# regional tradition ("Seit 1950 ... 200 Jahre alte Tradition" gave 1826, "recipes go back
# over 200 years in this region"), or a vague claim ("plus de 300 ans").
# Also a person's age or career on a team page (Sunshine Chocolats, 2026-11-06 run: "à 25
# ans", "Avant ses 18 ans", "Après 20 ans comme technico-commercial", "19 ans plus tard").
_NOT_COMPANY_AGE_BEFORE = re.compile(
    r"(?:over|more\s+than|plus\s+de|[üu]ber|oltre|m[áa]s\s+de|back|"
    r"\b(?:à|a|at|aged?|ses|son|his|her|their|after|après|apr[eè]s|avant|before|dopo|prima\s+di|tras|antes\s+de|nach|vor))\s*$",
    re.I,
)
_NOT_COMPANY_AGE_AFTER = re.compile(
    r"^\s*(?:or\s+older|of\s+age|old\b|ago\b|alte?n?\b|et\s+plus|vieille|d['’]histoire|di\s+storia|de\s+historia|"
    r"tradition|Tradition|plus\s+tard|later\b|più\s+tardi|m[áa]s\s+tarde|sp[äa]ter|comme\b|en\s+tant|as\s+an?\b|"
    r"d['’]expatriation|de\s+carri[èe]re)",
    re.I,
)

# Japanese: 創業1902年 / 1902年創業 / 設立 / 創立, also as an era year (明治35年創業).
# Each era's year 0, so 元年 (year 1) = value + 1. The Edo-period eras too: old wagashi
# houses date themselves that way -- 榮太樓總本鋪 "文政元年の江戸出府から始まる" is 1818,
# and without 文政 the engine stored 1962, the year it became a company (2026-11-06 run).
_JP_ERAS = {
    "慶長": 1595, "元和": 1614, "寛永": 1623, "正保": 1643, "慶安": 1647, "承応": 1651, "明暦": 1654,
    "万治": 1657, "寛文": 1660, "延宝": 1672, "天和": 1680, "貞享": 1683, "元禄": 1687, "宝永": 1703,
    "正徳": 1710, "享保": 1715, "元文": 1735, "寛保": 1740, "延享": 1743, "寛延": 1747, "宝暦": 1750,
    "明和": 1763, "安永": 1771, "天明": 1780, "寛政": 1788, "享和": 1800, "文化": 1803, "文政": 1817,
    "天保": 1829, "弘化": 1843, "嘉永": 1847, "安政": 1853, "万延": 1859, "文久": 1860, "元治": 1863,
    "慶応": 1864, "明治": 1867, "大正": 1911, "昭和": 1925, "平成": 1988, "令和": 2018,
}
_ERA = "(" + "|".join(_JP_ERAS) + ")"
_JP_YEAR = rf"(?:(\d{{4}})|{_ERA}\s*(\d{{1,2}}|元))\s*年"
# Also "創立(設立) 大正10年" (a label in brackets after the word) and "1950年12月 …が個人創業"
# (a month and a few words before it) -- 三立製菓 and ばいこう堂 write it that way.
_JP_FOUNDED = re.compile(
    rf"(?:創業|設立|創立)\s*(?:[（(][^）)]{{0,6}}[）)])?\s*(?:は|：|:)?\s*(?:(\d{{4}})|{_ERA}\s*(\d{{1,2}}|元))\s*年?|"
    # The few words in between never name a facility ("2015年4月 新工場を設立"), and the
    # word isn't 創業者 ("2023年10月 創業者 山田太郎" is about the founder).
    rf"{_JP_YEAR}\s*(?:\d{{1,2}}\s*月)?"
    r"(?:(?!工場|子会社|支店|支社|営業所|店舗|事業所|研究所|センター|社屋|物流)[^。\d]){0,15}?(?:に)?\s*(?:創業|設立|創立)(?!者)|"
    # The story's first line: "文政元年の江戸出府から始まる", "安政4年に暖簾を掲げ", "明治10年開業".
    rf"{_JP_YEAR}[^。\d]{{0,15}}?(?:から始ま|に始ま|開業|開店|創始|暖簾|のれん|創製)"
)
# A dated anniversary in a timeline: "2019年3月 …創業60年記念…" is 1959. Read before
# _JP_FOUNDED's "創業 1963年": in a timeline "…を創業 1963年9月 …" is the NEXT entry's date.
_JP_DATED_ANNIVERSARY = re.compile(r"(\d{4})\s*年\s*(?:\d{1,2}\s*月)?[^。\d]{0,30}?創業\s*(\d{1,3})\s*(?:年|周年)")
# "創業100年" / "創業百年" / "二百年の歴史" -- the company's age, digits or kanji numerals.
_JP_YEARS_SINCE = re.compile(r"創業\s*([\d一二三四五六七八九十百]{1,6})\s*(?:年|周年)|([\d一二三四五六七八九十百]{1,6})\s*(?:年|周年)の(?:歴史|伝統|歩み|あゆみ)")
_KANJI_DIGITS = {"一": 1, "二": 2, "三": 3, "四": 4, "五": 5, "六": 6, "七": 7, "八": 8, "九": 9}
_FULLWIDTH_DIGITS = str.maketrans("０１２３４５６７８９", "0123456789")


def _jp_number(s: str) -> int | None:
    """"二百" -> 200, "百五十" -> 150, "120" -> 120 (up to 999)."""
    if s.isdigit():
        return int(s)
    total, digit = 0, 0
    for ch in s:
        if ch in _KANJI_DIGITS:
            digit = _KANJI_DIGITS[ch]
        elif ch in ("十", "百"):
            total += (digit or 1) * (10 if ch == "十" else 100)
            digit = 0
        else:
            return None
    return total + digit

FOUNDED_PATTERNS = [
    re.compile(r"founded in (\d{4})", re.I),
    re.compile(r"established in (\d{4})", re.I),
    re.compile(r"since (\d{4})", re.I),
    re.compile(r"\best\.?\s*(\d{4})", re.I),  # not "latest 1800 reviews", "forest 1750"
    # Most candidates in the France/Italy/Germany/Spain buckets have their "since 19xx"
    # heritage-story text in their own language, not English -- these patterns were
    # English-only, so founded year silently stayed blank for almost every non-English/
    # non-Japanese candidate even when the page said so plainly. Same "since"/"founded"
    # vocabulary the search queries themselves already use as exclusion/anniversary
    # operators (see categories.py's "-Rezept"/"-recette"/"-ricetta"/"-receta" and the
    # quoted '"depuis 18"'/'"seit 18"'/'"desde 18"' queries).
    re.compile(r"\bseit (\d{4})", re.I),  # German "since"
    re.compile(r"\bgegründet\s*(?:im jahr\s*)?(\d{4})", re.I),  # German "founded"
    re.compile(r"\bdepuis (\d{4})", re.I),  # French "since"
    re.compile(r"\bfond[ée]e?\s*en (\d{4})", re.I),  # French "founded"
    re.compile(r"\bdal (\d{4})", re.I),  # Italian "since"
    re.compile(r"\bfondat[ao]\s*nel (\d{4})", re.I),  # Italian "founded"
    re.compile(r"\bdesde (\d{4})", re.I),  # Spanish "since"
    re.compile(r"\bfundad[ao]\s*en (\d{4})", re.I),  # Spanish "founded"
    # The same without the preposition, with "the year", or with a creation verb:
    # "Established 1880", "Founded 1926", "créée en 1952", "nata nel 1924", "desde el año
    # 1880", "fundada en el año 1880", "dal lontano 1924", "since the year 1890".
    # Not "opened"/"started": "our new factory opened in 2015", "started exporting in 2010".
    re.compile(
        r"\b(?:founded|established|incorporated)\s*(?:in\s+)?(?:the\s+year\s+)?(\d{4})\b|"
        r"\b(?:since|depuis|desde|dal|seit)\s+(?:the\s+year\s+|l['’]ann[ée]e\s+|el\s+a[ñn]o\s+|lontano\s+|anno\s+|dem\s+jahr\s+)(\d{4})\b|"
        r"\b(?:cr[ée]{2}e?|n[ée]e?|fond[ée]e?)\s+en\s+(?:l['’]ann[ée]e\s+)?(\d{4})\b|"
        r"\b(?:nat[ao]|fondat[ao]|nasce|naque|cread[ao]|nacid[ao]|fundad[ao])\s+(?:nel(?:l['’]anno)?|en(?:\s+el\s+a[ñn]o)?|el\s+a[ñn]o)\s+(\d{4})\b",
        re.I,
    ),
    # "In 1880, Giuseppe founded ..." / "En 1880, ... fundó" / "Nel 1924 ... fondò".
    re.compile(
        r"\b(?:in|en|nel|im\s+jahr)\s+(\d{4}),?\s+(?:[\w'’.-]+\s+){0,5}?"
        r"(?:founded|established|fonde|fonda|cr[ée]a|fond[òo]|fund[óo]|gr[üu]ndete)\b",
        re.I,
    ),
]

HEADERS = {"User-Agent": "Mozilla/5.0 (compatible; OnriBrandSourcing/1.0)"}

# 조건 D 위반 -- 도메인이 매물 페이지로 리다이렉트되면 탈락 (parallel Claude-pipeline handoff
# doc's own detection keywords, real case: UK Piccolo's piccolo.co.uk redirected to a
# GoDaddy parking page). None of this needs a Tavily call -- it's just the same HTTP
# fetch we're already doing, checked against the resolved URL and page text.
_PARKING_SIGNS = re.compile(
    r"forsale|godaddy\.com/(?:domainfor)?forsale|sedoparking|afternic|domain is for sale|buy this domain|"
    r"this domain (?:is|may be) for sale|parked (?:free|domain)",
    re.I,
)


def _is_parked(resolved_url: str, text: str) -> bool:
    return bool(_PARKING_SIGNS.search(resolved_url) or _PARKING_SIGNS.search(text))


def _extract_site_name(soup: BeautifulSoup) -> str | None:
    """The name the site gives ITSELF: og:site_name, application-name, or a JSON-LD
    Organization/LocalBusiness `name`. Far more reliable than a search-result title, which
    is often a product or page title ("Pure Vermont Organic Maple Sugar Candy" for the
    company Hi Vue Maples)."""
    for attrs in ({"property": "og:site_name"}, {"name": "application-name"}):
        tag = soup.find("meta", attrs=attrs)
        if tag and tag.get("content", "").strip():
            return tag["content"].strip()
    for script in soup.find_all("script", type="application/ld+json"):
        try:
            data = json.loads(script.string or "")
        except (ValueError, TypeError):
            continue
        items = data if isinstance(data, list) else data.get("@graph", [data]) if isinstance(data, dict) else []
        for item in items:
            if not isinstance(item, dict):
                continue
            kind = item.get("@type")
            kinds = kind if isinstance(kind, list) else [kind]
            if any(isinstance(k, str) and k in _ORG_TYPES for k in kinds):
                name = item.get("name")
                if isinstance(name, str) and name.strip():
                    return name.strip()
    return None


_ORG_TYPES = {"Organization", "LocalBusiness", "Bakery", "Store", "FoodEstablishment", "Corporation", "CafeOrCoffeeShop"}


def jsonld_founding_year(soup: BeautifulSoup) -> int | None:
    """The year in a JSON-LD Organization's "foundingDate" ("1924", "1924-03-01") -- many
    shop platforms and SEO plugins fill it in, where the page text never says it."""
    for script in soup.find_all("script", type="application/ld+json"):
        try:
            data = json.loads(script.string or "")
        except (ValueError, TypeError):
            continue
        items = data if isinstance(data, list) else data.get("@graph", [data]) if isinstance(data, dict) else []
        for item in items:
            if isinstance(item, dict):
                m = re.match(r"\s*(\d{4})", str(item.get("foundingDate") or ""))
                if m and 1590 <= int(m.group(1)) <= date.today().year:
                    return int(m.group(1))
    return None


def extract_founded_year(text: str) -> int | None:
    """Collects every plausible year this text could be claiming (every FOUNDED_PATTERNS
    match anywhere in the text, plus every anniversary phrase converted via
    this_year - N) and returns the EARLIEST one, not the first one found.

    An earlier version checked anniversary phrases first and returned immediately on a
    match -- that broke as often as it fixed things, verified empirically against 4 real
    cases: "Maison fondée en 1878, 100 ans de savoir-faire" returned 1926 (the rounded
    marketing anniversary) instead of the explicitly stated 1878; "dal 1890 ... Seit 2015
    Onlineshop" returned 2015 instead of 1890 (a DIFFERENT, pre-existing bug: looping
    FOUNDED_PATTERNS in a fixed list order and returning on the first PATTERN to match
    anywhere picks whichever pattern happens to be earlier in the list, not whichever
    match is earlier in the text -- "seit" is listed before "dal", so it wins even when
    "dal 1890" is the only one that's actually about the founding); "Depuis 1963 ... 60
    ans" returned 1966 instead of 1963. A company's true founding year is, by
    definition, the EARLIEST plausible year mentioned anywhere -- an anniversary badge,
    an "online since", a relocation, or a rebrand are never earlier than the real
    founding, only later or equal. Taking min() over every candidate resolves all of
    the above (including the original Woitinek case this was built for: "125 Jahre"
    alongside "Seit 2004" -- min(2004, this_year-125) is still the correct ~1901)
    without needing to special-case which pattern or phrase "wins"."""
    this_year = date.today().year
    years: list[int] = []
    text = text.translate(_FULLWIDTH_DIGITS)

    for m in _JP_FOUNDED.finditer(text):
        groups = m.groups()
        # Three (4-digit year, era, era year) triples, one per alternative -- one is set.
        for year_s, era, era_n in zip(groups[0::3], groups[1::3], groups[2::3]):
            if year_s or era:
                year = int(year_s) if year_s else _JP_ERAS[era] + (1 if era_n == "元" else int(era_n))
                if 1590 <= year <= this_year:
                    years.append(year)
                break
    for m in _JP_DATED_ANNIVERSARY.finditer(text):
        year = int(m.group(1)) - int(m.group(2))
        if 1590 <= year <= this_year:
            years.append(year)
    for m in _JP_YEARS_SINCE.finditer(text):
        n = _jp_number(m.group(1) or m.group(2))
        if n and _ANNIVERSARY_MIN_YEARS <= n <= 500:
            years.append(this_year - n)

    for pattern in FOUNDED_PATTERNS:
        for match in pattern.finditer(text):
            year = int(next(g for g in match.groups() if g))
            if 1700 <= year <= this_year:
                years.append(year)

    for pattern in _ANNIVERSARY_PATTERNS:
        for match in pattern.finditer(text):
            n = int(match.group(1))
            if not (_ANNIVERSARY_MIN_YEARS <= n <= _ANNIVERSARY_MAX_YEARS):
                continue
            if _NOT_COMPANY_AGE_BEFORE.search(text[max(0, match.start() - 15) : match.start()]):
                continue
            if _NOT_COMPANY_AGE_AFTER.match(text[match.end() : match.end() + 20]):
                continue
            years.append(this_year - n)

    return min(years) if years else None


# A real run surfaced 5 single-location shops (2 physical stores, perishable fresh
# confections) that passed every other check -- real brands, just not plausible export
# candidates. Checked against text pages already fetched for this candidate (no extra
# HTTP requests beyond what scrape_candidate_site already does) -- a site mentioning
# wholesale/export/reseller inquiries anywhere is a real signal the business already
# thinks beyond its own storefront, which a single local shop's site essentially never
# does. Absence isn't proof the brand can't export, just a priority signal for the human
# reviewer (same "note, not a reject" treatment as everything else mechanical here).
_EXPORT_KEYWORDS = re.compile(
    r"\bwholesale\b|\bb2b\b|\bexport(?:s|ing)?\b|distributor inquir|"
    r"h(?:ä|ae)ndler|großhandel|"  # German -- with ä/ae, never English "food handler"
    r"grossiste|revendeur|exportation|"  # French
    r"rivenditor|ingrosso|esportazione|"  # Italian
    r"mayorista|distribuidor|exportaci[oó]n|"  # Spanish
    r"\bstockists?\b|trade\s+(account|enquir|inquir|customer|sales)|\bfor\s+retailers\b|"  # English trade
    # "Gastronomie" only as German foodservice ("für Gastronomie", "Gastronomie & Handel") --
    # in French "la gastronomie" is just cuisine, on every food site.
    r"gesch[äa]ftskunden|wiederverk[äa]ufer|fachhandel|horeca|foodservice|"  # German / food service
    r"f[üu]r\s+(?:die\s+)?gastronomie|gastronomie\s*(?:&|und)\s*handel|gastronomiekunden|"
    r"grossista|revendedor|exporta[cç][aã]o|"  # Portuguese
    # Japanese, as phrases: the bare words were matching shop-location and retail text --
    # "阪神百貨店 B1F" (the maker's own counter), "販売店舗も少なく" ("few shops"),
    # "海外発送は承っておりません" (no overseas shipping). "海外進出 5か国" (overseas
    # expansion) does count.
    # Department stores nationwide are a channel; one store's counter is not.
    r"卸売|卸販売|業務用|海外(?!発送)|輸出|お取引|取扱店|取扱い店|販売店(?!舗)|代理店|(?:全国|各地|主要)の?百貨店",
    re.I,
)


def has_export_signal(text: str) -> bool:
    return bool(_EXPORT_KEYWORDS.search(text))
