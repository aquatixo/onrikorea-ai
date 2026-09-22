"""Best-effort scrape of a candidate's official website for a founded-year mention
and a short about-page snippet. Purely mechanical (regex + text extraction) -- no
attempt to judge ownership or heritage credibility, that stays a human call."""

import re
import requests
from urllib.parse import urljoin
from bs4 import BeautifulSoup

FOUNDED_PATTERNS = [
    re.compile(r"founded in (\d{4})", re.I),
    re.compile(r"established in (\d{4})", re.I),
    re.compile(r"since (\d{4})", re.I),
    re.compile(r"est\.?\s*(\d{4})", re.I),
]

HEADERS = {"User-Agent": "Mozilla/5.0 (compatible; OnriBrandSourcing/1.0)"}

# A brand's founding year almost never appears on the homepage itself -- it's on
# an About/History page. Trying these common paths costs zero Tavily credit (plain
# HTTP to a domain we already have, not another search call), so it's worth the
# extra requests to stop losing this evidence for real candidates.
ABOUT_PAGE_PATHS = ["/about", "/about-us", "/our-story", "/history", "/our-history"]

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


def fetch_page_text(url: str, timeout: int = 10) -> tuple[str | None, bool]:
    """Returns (text, is_parked). is_parked is True when the request landed on a
    domain-parking page (via redirect or the page's own content) rather than a real
    site -- callers should treat that the same as "couldn't verify the brand"."""
    try:
        resp = requests.get(url, headers=HEADERS, timeout=timeout)
        resp.raise_for_status()
    except requests.RequestException:
        return None, False
    soup = BeautifulSoup(resp.text, "html.parser")
    for tag in soup(["script", "style", "nav", "footer"]):
        tag.decompose()
    text = soup.get_text(" ", strip=True)[:5000]
    return text, _is_parked(resp.url, text)


def extract_founded_year(text: str) -> int | None:
    for pattern in FOUNDED_PATTERNS:
        match = pattern.search(text)
        if match:
            year = int(match.group(1))
            if 1700 <= year <= 2026:
                return year
    return None


def scrape_candidate_site(url: str) -> dict:
    text, parked = fetch_page_text(url)
    if not text:
        return {"foundedYear": None, "snippet": None, "parked": False}
    if parked:
        return {"foundedYear": None, "snippet": text[:300], "parked": True}

    founded_year = extract_founded_year(text)
    snippet = text[:800]

    if not founded_year:
        for path in ABOUT_PAGE_PATHS:
            about_text, about_parked = fetch_page_text(urljoin(url, path))
            if not about_text or about_parked:
                continue
            founded_year = extract_founded_year(about_text)
            if founded_year:
                # The about page is also more likely to have real heritage-story
                # text than the homepage nav/hero -- worth keeping as the snippet.
                snippet = about_text[:800]
                break

    return {"foundedYear": founded_year, "snippet": snippet, "parked": False}
