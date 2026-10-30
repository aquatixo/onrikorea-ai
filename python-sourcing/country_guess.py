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


# Markers on a generic-TLD (.com) site's own pages. Phone numbers need their full format
# with digit boundaries: an unanchored UK pattern matched Italian VAT numbers and Shopify
# variant IDs ("44404732264645" filed a US fudge maker under UK), and the US one matched
# Japanese "075-561-1234" and Italian "055 123 4567" -- a US area code never starts with 0/1.
_MARKERS = {
    "USA": [
        re.compile(r"\$\s?\d"),
        re.compile(r"(?<![\d+])(?:\+?1[-.\s])?\(?[2-9]\d{2}\)?[-.\s]\d{3}[-.\s]\d{4}(?!\d)"),
        re.compile(r"\b(?:USA|United States)\b|\bU\.S\.(?:A\.?)?(?![A-Za-z])"),
        re.compile(r",\s*[A-Z]{2}\s+\d{5}\b"),
    ],
    "UK": [
        re.compile(r"£\s?\d"),
        re.compile(r"\b(?:UK|United Kingdom|Great Britain|Scotland|Wales|England)\b"),
        re.compile(r"\+44|(?<!\d)\(?0\d{3,4}\)?\s\d{3}\s?\d{3,4}(?!\d)"),
    ],
    # The French-language lane also finds Swiss, Belgian and Québec makers (ORFÈVE, Geneva,
    # was filed under France).
    "Switzerland": [
        re.compile(r"\+41|\bCHF\b"),
        re.compile(r"\b(?:Suisse|Schweiz|Svizzera|Switzerland|Swiss)\b"),
        re.compile(r"\b(?:Gen[èe]ve|Z[üu]rich|Lausanne|Basel|B[âa]le|Bern|Lugano)\b"),
    ],
    "Belgium": [
        re.compile(r"\+32\b"),
        # Also the adjective: "Fabricant belge de chocolat" (Choc and Co, 2026-10-29 run).
        re.compile(r"\b(?:Belgique|Belgi[eë]|Belgium|Belgien|belges?|Belgian)\b"),
        re.compile(r"\b(?:Bruxelles|Brussel|Brussels|Antwerpen|Anvers|Li[èe]ge|Gent|Gand|Namur)\b"),
    ],
    "Canada": [
        re.compile(r"\bCAD\b|\$\s?\d[\d.,]*\s?CAD\b"),
        re.compile(r"\b(?:Canada|Qu[ée]bec|Ontario|Montr[ée]al|Toronto|Vancouver)\b"),
    ],
}


def guess_country_from_text(text: str | None) -> str | None:
    """Country from the SITE's own text, for generic-TLD sites (.com) where the domain says
    nothing and the bucket's country is only the QUERY's intent. Real run: DiCamillo Bakery
    (Buffalo, NY; prices in $, a 1-800 number) came back from an Italian-bakery query and
    was filed under Italy. Needs two independent markers and more than any other country --
    a wrong country is worse than the bucket default, so it stays conservative."""
    if not text:
        return None
    scores = {c: sum(bool(p.search(text)) for p in pats) for c, pats in _MARKERS.items()}
    best = max(scores, key=scores.get)
    if scores[best] >= 2 and all(scores[best] > v for c, v in scores.items() if c != best):
        return best
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
