"""Best-effort scrape of a candidate's official website for a founded-year mention
and a short about-page snippet. Purely mechanical (regex + text extraction) -- no
attempt to judge ownership or heritage credibility, that stays a human call."""

import re
import requests
from bs4 import BeautifulSoup

FOUNDED_PATTERNS = [
    re.compile(r"founded in (\d{4})", re.I),
    re.compile(r"established in (\d{4})", re.I),
    re.compile(r"since (\d{4})", re.I),
    re.compile(r"est\.?\s*(\d{4})", re.I),
]

HEADERS = {"User-Agent": "Mozilla/5.0 (compatible; OnriBrandSourcing/1.0)"}


def fetch_page_text(url: str, timeout: int = 10) -> str | None:
    try:
        resp = requests.get(url, headers=HEADERS, timeout=timeout)
        resp.raise_for_status()
    except requests.RequestException:
        return None
    soup = BeautifulSoup(resp.text, "html.parser")
    for tag in soup(["script", "style", "nav", "footer"]):
        tag.decompose()
    return soup.get_text(" ", strip=True)[:5000]


def extract_founded_year(text: str) -> int | None:
    for pattern in FOUNDED_PATTERNS:
        match = pattern.search(text)
        if match:
            year = int(match.group(1))
            if 1700 <= year <= 2026:
                return year
    return None


def scrape_candidate_site(url: str) -> dict:
    text = fetch_page_text(url)
    if not text:
        return {"foundedYear": None, "snippet": None}
    return {"foundedYear": extract_founded_year(text), "snippet": text[:300]}
