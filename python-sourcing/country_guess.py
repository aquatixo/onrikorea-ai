"""Best-effort country guess from a candidate's website domain, purely from the
ccTLD -- cheap and free (no Tavily call), and the discovery queries already skew
results toward a specific country/region per bucket, so the domain usually agrees.

Deliberately conservative: a generic TLD (.com, .org, .shop, ...) returns None
rather than guessing wrong, since a wrong country is worse than a blank one for a
human reviewer -- they can still fill it in themselves.
"""

import re
from urllib.parse import urlparse

# Longest suffix wins, so multi-label ccTLDs (.co.uk) are listed before their
# shorter cousins would ever be checked -- see _COUNTRY_BY_SUFFIX ordering below.
_COUNTRY_BY_SUFFIX = {
    "co.uk": "United Kingdom", "org.uk": "United Kingdom", "uk": "United Kingdom",
    "scot": "United Kingdom",
    "com.au": "Australia", "net.au": "Australia", "au": "Australia",
    "co.nz": "New Zealand", "nz": "New Zealand",
    "co.jp": "Japan", "jp": "Japan",
    "ie": "Ireland",
    "it": "Italy",
    "fr": "France",
    "de": "Germany",
    "es": "Spain",
    "nl": "Netherlands",
    "se": "Sweden",
    "dk": "Denmark",
    "no": "Norway",
    "fi": "Finland",
    "pt": "Portugal",
    "be": "Belgium",
    "ch": "Switzerland",
    "at": "Austria",
    "ca": "Canada",
    "gr": "Greece",
    "tr": "Turkey",
    "lt": "Lithuania",
    "lv": "Latvia",
    "ee": "Estonia",
    "pl": "Poland",
    "cz": "Czechia",
    "hu": "Hungary",
}

# Checked longest-first so "co.uk" matches before the bare "uk" would.
_SUFFIXES_LONGEST_FIRST = sorted(_COUNTRY_BY_SUFFIX, key=len, reverse=True)


_US_PRICE = re.compile(r"\$\s?\d")
_US_PHONE = re.compile(r"(?<!\d)(?:1[-.\s])?\(?\d{3}\)?[-.\s]\d{3}[-.\s]\d{4}(?!\d)")
_US_WORD = re.compile(r"\b(USA|U\.S\.A?\.?|United States)\b")
_US_ADDRESS = re.compile(r",\s*[A-Z]{2}\s+\d{5}\b")
_UK_PRICE = re.compile(r"£\s?\d")
_UK_WORD = re.compile(r"\b(UK|United Kingdom|Great Britain|Scotland|Wales|England)\b")
_UK_PHONE = re.compile(r"\+44|\(?0\d{3,4}\)?\s?\d{3}\s?\d{3,4}")


def guess_country_from_text(text: str | None) -> str | None:
    """Country from the SITE's own text, for generic-TLD sites (.com) where the domain says
    nothing and the bucket's country is only the QUERY's intent. Real run: DiCamillo Bakery
    (Buffalo, NY; prices in $, a 1-800 number) came back from an Italian-bakery query and
    was filed under Italy. Needs two independent markers, USA or UK only -- a wrong country
    is worse than the bucket default, so it stays conservative."""
    if not text:
        return None
    us = sum(bool(p.search(text)) for p in (_US_PRICE, _US_PHONE, _US_WORD, _US_ADDRESS))
    uk = sum(bool(p.search(text)) for p in (_UK_PRICE, _UK_WORD, _UK_PHONE))
    if us >= 2 and us > uk:
        return "USA"
    if uk >= 2 and uk > us:
        return "UK"
    return None


def guess_country_from_domain(url: str) -> str | None:
    if not url:
        return None
    try:
        host = urlparse(url).netloc.lower().removeprefix("www.")
    except Exception:
        return None
    for suffix in _SUFFIXES_LONGEST_FIRST:
        if host == suffix or host.endswith("." + suffix):
            return _COUNTRY_BY_SUFFIX[suffix]
    return None
