"""Extracts producer/brand names from a LIST page -- an awards-winner list, a trade-show
exhibitor directory, a PDO/IGP producer registry, an industry association's member list.

This is the "roster" half of the 2-stage redesign: the old 1-stage pipeline (main.py's
discovery path) treats every search RESULT as a candidate in its own right, which means a
list page (one search result) can only ever become ONE candidate -- and that candidate is
always wrong, since guess_brand_name/domain_matches_name score the LIST PAGE's own title
against the LIST PAGE's own domain, never the individual producers named inside it. Real,
reproduced case: a Great Taste Awards winners page is correctly "itself" by that check,
but the dozens of real producers listed INSIDE it never get extracted at all -- the
highest-yield channel this project has (small, non-SEO artisan brands a search engine
would never rank directly) was being thrown away at the exact moment it was found.

Only link-based extraction is implemented: a block of 8+ links to distinct external
sites, which hands back a website along with each name (so brand_resolve.py's search
is skipped entirely). Table/list-markup and free-text proper-noun extraction were tried
and removed -- live-tested, they produced false "rosters" (a shop's nav menu, a
certification body's form-download list) and never a confirmed true positive.
"""

import re
from urllib.parse import urlparse

from bs4 import BeautifulSoup
from site_scrape import HEADERS
import requests

_SOCIAL_HOSTS = {
    "facebook.com", "instagram.com", "twitter.com", "x.com", "youtube.com",
    "linkedin.com", "pinterest.com", "tiktok.com", "threads.net", "whatsapp.com",
}

# Nav/utility links a roster page's own template is full of -- never a producer name,
# regardless of language (the "about/contact/privacy/cookie" class of boilerplate that
# name_filter.py's _GENERIC_TITLES/_BOILERPLATE_PARTS already list for the discovery
# path; duplicated narrowly here rather than importing, since this is matched against
# link TEXT, not a page title, and the overlap is small).
_NAV_LINK_TEXT = {
    "home", "about", "about us", "contact", "contact us", "privacy", "privacy policy",
    "cookie policy", "cookies", "terms", "terms of service", "login", "log in", "sign in",
    "register", "subscribe", "newsletter", "sitemap", "faq", "help", "search",
    "accueil", "contact", "mentions légales", "politique de confidentialité",
    "startseite", "kontakt", "datenschutz", "impressum",
    "inicio", "contacto", "política de privacidad",
    "home", "chi siamo", "contatti", "privacy policy",
}

_MIN_LINK_BLOCK_SIZE = 8
_MAX_ANCESTOR_LEVELS = 4
_MIN_ROSTER_NAMES = 8
_NAME_MIN_LEN = 2
_NAME_MAX_LEN = 60


def _host_of(url: str) -> str:
    try:
        return urlparse(url).netloc.lower().removeprefix("www.")
    except Exception:
        return ""


_FORM_CODE_SHAPE = re.compile(r"^[A-Z]{1,5}\d{0,3}$")
_GENERIC_ANCHOR = re.compile(
    r"\b(web\s?site|site\s?web|webseite|sitio\s?web|sito\s?web|homepage|home\s?page|"
    r"read\s+more|learn\s+more|more\s+info\w*|click\s+here|visit|exhibitors?|catalog(ue)?|"
    r"download|en\s+savoir\s+plus|mehr\s+erfahren|leggi\s+tutto|ver\s+m[aá]s|link|here)\b",
    re.I,
)


def _is_plausible_name(text: str) -> bool:
    t = text.strip()
    if not (_NAME_MIN_LEN <= len(t) <= _NAME_MAX_LEN):
        return False
    if t.lower() in _NAV_LINK_TEXT:
        return False
    if t.isdigit():
        return False
    # A certification body's document/form-download list -- real false positive:
    # rina.org's "prodotti tipici DOP" page harvested "MDC3"/"MDC4"/"DC1" as if they
    # were producer names (a DOP consortium's form-download list, not a roster at
    # all). A real company name is essentially never a bare uppercase-letters+digits
    # code like this.
    if _FORM_CODE_SHAPE.match(t):
        return False
    # Generic call-to-action anchors ("Official website", "Exhibitors list (online)",
    # "Read more") -- real false positive: a trade-fair calendar page whose 47 links were
    # all this kind of text pointing at each fair's own site.
    if _GENERIC_ANCHOR.search(t) or t.lower().startswith(("www.", "http")):
        return False
    # Citation / headline link text: quoted ("“Manchego wins ...”") or sentence-length.
    if t[0] in "\"'“”‘’«„" or len(t.split()) > 6:
        return False
    return True


def harvest_from_links(soup: BeautifulSoup, page_host: str) -> list[dict]:
    """Finds the block of sibling links most likely to be a roster -- same parent
    element with 8+ links pointing to DISTINCT external domains (not the page's own
    site, not social media, not a repeated nav menu). A real roster almost always
    links each name straight to that producer's own site; when it does, this is the
    single cheapest and most complete harvest strategy there is -- name AND website in
    one pass, no resolve step needed at all afterward."""
    # Links are registered on each of their first few ancestors, not just the direct
    # parent: the common roster markup is <ul><li><a>..</a></li>...</ul>, where every
    # link has a DIFFERENT parent (its own <li>), so grouping by direct parent alone
    # could never reach 8 links for it. The tightest qualifying container wins, so a
    # roster list isn't merged with unrelated links further up the page.
    by_node: dict[int, tuple[int, list]] = {}
    for a in soup.find_all("a", href=True):
        href = a["href"]
        if not href.startswith(("http://", "https://")):
            continue
        host = _host_of(href)
        if not host or host == page_host or host in _SOCIAL_HOSTS:
            continue
        text = a.get_text(" ", strip=True)
        if not _is_plausible_name(text):
            continue
        node = a.parent
        for level in range(_MAX_ANCESTOR_LEVELS):
            if node is None or node.name in ("body", "html", "[document]"):
                break
            by_node.setdefault(id(node), (level, []))[1].append((text, href, host))
            node = node.parent

    best: list[dict] = []
    best_level = _MAX_ANCESTOR_LEVELS
    for level, links in by_node.values():
        distinct_hosts = {host for _, _, host in links}
        if len(links) < _MIN_LINK_BLOCK_SIZE or len(distinct_hosts) < _MIN_LINK_BLOCK_SIZE:
            continue
        if level < best_level or (level == best_level and len(links) > len(best)):
            best_level = level
            best = [{"name": name, "website": href, "context": "", "confidence": 0.8} for name, href, _ in links]
    return best


_ROSTER_KEYWORDS = re.compile(
    r"\b(list|liste|lista|elenco|directory|members?|winners?|exhibitors?|"
    r"producteurs|produttori|productores|hersteller|出展社|会員)\b",
    re.I,
)


def looks_like_roster(text: str, extracted: list[dict]) -> bool:
    distinct_names = {e["name"].strip().lower() for e in extracted if e.get("name")}
    if len(distinct_names) < _MIN_ROSTER_NAMES:
        return False
    avg_len = sum(len(n) for n in distinct_names) / len(distinct_names)
    if not (3 <= avg_len <= 50):
        return False
    # A real roster is mostly unique names; one label repeated across the block
    # ("Official website" x N) means the links are boilerplate, not producers.
    names = [e["name"].strip().lower() for e in extracted if e.get("name")]
    if max(names.count(n) for n in distinct_names) / len(names) > 0.3:
        return False
    return bool(_ROSTER_KEYWORDS.search(text))



def harvest_from_html(html: str, page_url: str) -> list[dict]:
    soup = BeautifulSoup(html, "html.parser")
    # Strip nav/header/footer BEFORE extraction -- verified empirically this was
    # missing and caused a real false positive: a shop's blog post about Great Taste
    # Awards harvested 104 "names" that were entirely its own site navigation menu.
    # 
    for tag in soup(["script", "style", "nav", "header", "footer"]):
        tag.decompose()
    text_for_keywords = soup.get_text(" ", strip=True)[:8000]
    link_results = harvest_from_links(soup, _host_of(page_url))
    if looks_like_roster(text_for_keywords, link_results):
        return link_results
    return []


def harvest_names(url: str) -> list[dict]:
    """Returns [{"name", "website", "context", "confidence"}, ...] -- empty list if the
    page couldn't be fetched or doesn't actually look like a roster."""
    try:
        resp = requests.get(url, headers=HEADERS, timeout=10)
        resp.raise_for_status()
    except requests.RequestException:
        return []
    return harvest_from_html(resp.text, resp.url)
