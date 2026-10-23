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
_NOT_COMPANY_AGE_BEFORE = re.compile(r"(?:over|more\s+than|plus\s+de|[üu]ber|oltre|m[áa]s\s+de|back)\s*$", re.I)
_NOT_COMPANY_AGE_AFTER = re.compile(
    r"^\s*(?:or\s+older|of\s+age|old\b|ago\b|alte?n?\b|et\s+plus|vieille|d['’]histoire|di\s+storia|de\s+historia|"
    r"tradition|Tradition)",
    re.I,
)

# Japanese: 創業1902年 / 1902年創業 / 設立 / 創立, also as an era year (明治35年創業).
_JP_ERAS = {"明治": 1867, "大正": 1911, "昭和": 1925, "平成": 1988, "令和": 2018}
_JP_FOUNDED = re.compile(
    r"(?:創業|設立|創立)\s*(?:は|：|:)?\s*(?:(\d{4})|(明治|大正|昭和|平成|令和)\s*(\d{1,2}|元))\s*年?|"
    r"(?:(\d{4})|(明治|大正|昭和|平成|令和)\s*(\d{1,2}|元))\s*年\s*(?:に)?\s*(?:創業|設立|創立)"
)
_JP_YEARS_SINCE = re.compile(r"創業\s*(\d{1,3})\s*(?:年|周年)")
_FULLWIDTH_DIGITS = str.maketrans("０１２３４５６７８９", "0123456789")

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
        year_s, era, era_n, year_s2, era2, era_n2 = m.groups()
        if year_s or year_s2:
            year = int(year_s or year_s2)
        else:
            n = era_n or era_n2
            year = _JP_ERAS[era or era2] + (1 if n == "元" else int(n))
        if 1600 <= year <= this_year:
            years.append(year)
    for m in _JP_YEARS_SINCE.finditer(text):
        n = int(m.group(1))
        if _ANNIVERSARY_MIN_YEARS <= n <= 500:
            years.append(this_year - n)

    for pattern in FOUNDED_PATTERNS:
        for match in pattern.finditer(text):
            year = int(match.group(1))
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
    # "海外発送は承っておりません" (no overseas shipping), "海外進出".
    r"卸売|卸販売|業務用|海外(?!発送)|輸出|お取引|取扱店|取扱い店|販売店(?!舗)|代理店|百貨店",
    re.I,
)


def has_export_signal(text: str) -> bool:
    return bool(_EXPORT_KEYWORDS.search(text))
