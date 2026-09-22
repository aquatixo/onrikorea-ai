"""Best-effort country guess from a candidate's website domain, purely from the
ccTLD -- cheap and free (no Tavily call), and the discovery queries already skew
results toward a specific country/region per bucket, so the domain usually agrees.

Deliberately conservative: a generic TLD (.com, .org, .shop, ...) returns None
rather than guessing wrong, since a wrong country is worse than a blank one for a
human reviewer -- they can still fill it in themselves.
"""

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
