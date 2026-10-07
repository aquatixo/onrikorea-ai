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
from urllib.parse import urljoin, urlparse

import requests
from bs4 import BeautifulSoup

from country_guess import guess_country_from_domain, guess_country_from_text
from name_filter import has_latin_letters, looks_like_reseller, pick_brand_name
from relevance import check_food_relevance, has_food_words, name_on_site
from site_scrape import HEADERS, _extract_site_name, _is_parked, extract_founded_year, has_export_signal

MIN_READABLE_CHARS = 400
_MIN_SITE_CHARS = 2000
_PAGE_TEXT_CAP = 6000
_MAX_ABOUT_PAGES = 2
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
    r"会社概要|私たちについて|歴史|沿革|当店について",
    re.I,
)
_TRADE_LINK = re.compile(
    r"wholesale|\btrade\b|b2b|export|stockist|distribut|retailers?\b|"
    r"h[äa]ndler|gro[ßs]handel|gesch[äa]ftskunden|wiederverk|fachhandel|gastronom|horeca|food\s?service|"
    r"grossiste|revendeur|professionnels?|"
    r"ingrosso|rivendit|esportaz|"
    r"mayorista|distribuidor|profesionales|exportaci|"
    r"revenda|grossista|"
    r"卸|業務用|法人|海外",
    re.I,
)

# Supplier-grade signals that stand in for an explicit trade page: food-safety certificates
# that retail chains and importers require (IFS, BRCGS, FSSC 22000, ISO 22000) and
# production plants. Rustichella d'Abruzzo (global pasta exporter) has no "wholesale" page
# at all, but its menu lists "Stabilimenti produttivi" and "Certificazioni".
_SUPPLIER_GRADE = re.compile(
    r"\bIFS\s*(food|certif)|\bBRC(GS)?\b|FSSC\s*22000|ISO\s*22000|"
    r"stabiliment[oi]\s+produttiv|production\s+(plant|facilit)|produktionsst[äa]tte|"
    r"\busines?\s+de\s+production|planta\s+de\s+producci[oó]n|自社工場",
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
    # Japanese directory/listing sites ("掲載お申し込み" = apply to be listed, "メーカーを探す")
    r"掲載|を探す",
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
    r"app|blog)\b|"
    r"観光|ガイド|まとめ|ポータル",
    re.I,
)

# Fresh daily bakery goods can't be imported. Bread/quiche/cream-cake wording vs.
# shelf-stable wording (biscuits, sweets, coffee, pasta...). Measured on a real run: fresh
# bread bakeries 0.46-4.0 (Holtkamp, RepasPAN, Popty Bach Y Wlad) vs. 0.08 for a
# cookie-led bakery that also mentions breads, 0.00 for the confectioners/roasters.
_FRESH_WORDS = re.compile(
    r"\b(brot|brote|brötchen|bread|breads|baguettes?|quiches?|sandwich\w*|pan|panes|panader\w*|"
    r"boulangerie|pains?|pane|focaccia|sourdough|sauerteig|semmel\w*|"
    r"tartas?|torten?|sponges?|cream\s+cakes?|wedding\s+cakes?|hochzeitstorte\w*)\b",
    re.I,
)
_SHELF_WORDS = re.compile(
    r"biscuit|cookie|bonbon|candy|candies|chocolat|schokolade|caramel|karamell|toffee|fudge|praline|"
    r"nougat|turr[oó]n|torrone|lebkuchen|stollen|wafer|waffel|shortbread|kaffee|coffee|espresso|"
    r"\btea\b|\btee\b|honey|honig|pasta|confiserie|calisson|liquirizia|lakritz|crackers?|"
    r"keks|gebäck|biscott|cantucci|taffy|brittle|せんべい|煎餅|菓子|marmelad|confiture|\bjam\b",
    re.I,
)
_MIN_FRESH_HITS = 3
_MAX_FRESH_RATIO = 0.3

# Shop selling OTHER makers' products (marketplace, deli, gift-box assembler).
_RETAILER_MARKERS = re.compile(
    r"\b(shop\s+by\s+brand|our\s+brands|all\s+brands|brands\s+we\s+(stock|carry)|"
    r"marketplace|we\s+stock|hampers?|gift\s+(boxes|baskets)|"
    r"unsere\s+marken|nos\s+marques|i\s+nostri\s+marchi|nuestras\s+marcas)\b",
    re.I,
)

# The site describes itself as MAKING things (not selling or writing about them).
_PRODUCER_MARKERS = re.compile(
    r"\b(hand[\s-]?made|made\s+by\s+hand|we\s+bake|baked\s+(fresh|daily|by\s+hand|in)|"
    r"our\s+(bakery|kitchen|factory|recipes?|confectioners?)|family[\s-](run|owned|business)|"
    r"since\s+1[89]\d\d|since\s+20\d\d|est\.?\s*(19|18|20)\d\d|established\s+in|"
    r"manufactur\w*|confectioners?|chocolatiers?|artisan\w*|"
    r"handgemacht|hergestellt|manufaktur|backstube|konditorei|b[äa]ckerei|familienbetrieb|seit\s+\d{4}|"
    r"fait[\s-]main|fabrication|fabriqu\w*|artisana\w*|biscuiterie|confiserie|chocolaterie|depuis\s+\d{4}|"
    r"fatt[oi]\s+a\s+mano|produzione|artigian\w*|laboratorio|pasticceria|torronificio|biscottificio|dal\s+\d{4}|"
    r"hecho\s+a\s+mano|elaboraci[oó]n|elaboramos|obrador|artesan\w*|confiter[ií]a|pasteler[ií]a|desde\s+\d{4}|"
    r"fabrico|f[aá]brica|"
    r"創業|製造|手作り|自社工場|老舗)",
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
            "foundedYear": extract_founded_year(thin),
            "country": guess_country_from_domain(home.url) or guess_country_from_text(thin),
            "thinFood": has_food_words(thin),
            "thinProducer": bool(_PRODUCER_MARKERS.search(thin)),
            "thinTrade": has_export_signal(thin) or bool(_TRADE_LINK.search(meta)),
            "thinPublisher": bool(_PUBLISHER_MARKERS.search(thin)),
            "selfTitle": _self_title(soup),
        }

    links = _internal_links(soup, home.url)
    about_urls = [h for t, h in links if _ABOUT_LINK.search(t) or _ABOUT_LINK.search(urlparse(h).path)][:_MAX_ABOUT_PAGES]
    trade_links = [(t, h) for t, h in links if _TRADE_LINK.search(t) or _TRADE_LINK.search(urlparse(h).path)]
    texts = [home_text]
    for sub in about_urls + [h for _, h in trade_links[:_MAX_TRADE_PAGES]]:
        resp = _get(sub, timeout=6)
        if resp is not None:
            texts.append(_page_text(BeautifulSoup(resp.text, "html.parser")))
    full_text = " ".join(texts)

    types = _jsonld_types(soup)
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
        "foundedYear": extract_founded_year(full_text),
        "country": guess_country_from_domain(home.url) or guess_country_from_text(full_text),
        "jsonldTypes": sorted(types),
        "publisherTypes": sorted(types & _PUBLISHER_TYPES),
        "publisherHits": len({m.group(0).lower() for m in _PUBLISHER_MARKERS.finditer(home_text)}),
        "dateStamps": len(_DATE_STAMP.findall(home_text)),
        "retailerHits": len({m.group(0).lower() for m in _RETAILER_MARKERS.finditer(full_text)}),
        "producerHits": len({m.group(0).lower() for m in _PRODUCER_MARKERS.finditer(full_text)}),
        "trade": trade_evidence,
        "food": check_food_relevance(full_text),
        "selfTitle": _self_title(soup),
        "freshHits": len(_FRESH_WORDS.findall(full_text)),
        "shelfHits": len(_SHELF_WORDS.findall(full_text)),
    }


def judge(profile: dict, name: str, url: str) -> tuple[bool, str, str]:
    """(keep, reason_code, human_reason). reason_code doubles as the progress filter-drop key."""
    if not profile.get("readable"):
        return False, "unverifiable_site", profile.get("why", "")
    if profile.get("parked"):
        return False, "parked_domain", profile.get("why", "")
    directory = _DIRECTORY_TITLE.search(profile.get("selfTitle") or "")
    if directory:
        return False, "publisher_site", f"사이트 제목이 포털/가이드/매거진형 ('{directory.group(0)}')"
    if profile.get("thin"):
        # Only the title/meta description to go on, so all three must be stated outright.
        if profile["thinPublisher"]:
            return False, "publisher_site", "본문이 거의 없고 제목/설명이 언론형"
        if looks_like_reseller(profile.get("siteName") or "") or looks_like_reseller(name):
            return False, "reseller_site", "이름이 도매상/유통업자/선물세트형"
        if not (profile["thinFood"] and profile["thinProducer"] and profile["thinTrade"]):
            return False, "unverifiable_site", "본문이 거의 없고 제목/설명에 식품·제조·도매 근거가 다 있지 않음"
        if not has_latin_letters(name) and name_on_site(name, profile["fullText"]) is False:
            return False, "name_not_on_site", "사이트 제목/설명에 후보 이름이 없음"
        return True, "ok", "JS 사이트라 본문 대신 제목/설명으로 판정: 식품·제조·도매 모두 명시"
    if profile["publisherTypes"] and not profile["producerHits"]:
        return False, "publisher_site", f"언론/블로그 사이트 (JSON-LD {profile['publisherTypes']})"
    if profile["publisherHits"] >= 2 or profile["dateStamps"] >= 6:
        return False, "publisher_site", f"언론/블로그형 사이트 (출판 용어 {profile['publisherHits']}, 날짜 {profile['dateStamps']})"
    if looks_like_reseller(profile.get("siteName") or "") or looks_like_reseller(name) or profile["retailerHits"] >= 2:
        return False, "reseller_site", f"재판매/편집숍형 사이트 (신호 {profile['retailerHits']})"
    food_ok, food_why = profile["food"]
    if food_ok is not True:
        return False, "not_food_site", food_why
    if not has_latin_letters(name) and name_on_site(name, profile["fullText"]) is False:
        return False, "name_not_on_site", "사이트 본문에 후보 이름이 없음"
    fresh, shelf = profile["freshHits"], profile["shelfHits"]
    if fresh >= _MIN_FRESH_HITS and fresh / max(shelf, 1) >= _MAX_FRESH_RATIO:
        return False, "fresh_bakery", f"신선 빵·케이크 위주 (빵 단어 {fresh} vs 보존식품 단어 {shelf}) — 수입 불가 품목"
    # A one-page website is a micro business (home kitchen, single shop), not an importable
    # supplier. Measured across every site kept in tests/eval_live_sites.py: the one
    # one-pager (a farmhouse cake maker, 1,257 chars total) vs. 3,225+ for all others.
    if len(profile["fullText"]) < _MIN_SITE_CHARS:
        return False, "micro_site", f"사이트가 한 페이지 수준으로 작음 ({len(profile['fullText'])}자) — 초소형 업체 추정"
    if profile["producerHits"] == 0:
        return False, "not_a_producer", "직접 만든다는 표현(수제, 제조, since 등)이 사이트에 없음"
    if not profile["trade"]:
        return False, "no_export_signal", "도매/수출/거래처 링크나 문구가 없음 (동네 가게 추정)"
    return True, "ok", f"{profile['trade']}; 생산자 신호 {profile['producerHits']}종; {food_why}"


def resolved_name(profile: dict, name: str, url: str) -> str:
    return pick_brand_name(name, profile.get("siteName"), url)
