"""Heuristic filters to reject search results that are obviously NOT a brand's own site --
listicles ("10 Leading Gummy Candy Suppliers"), social captions ("4.7K views - 177
reactions"), generic nav pages ("Home", "Video"), taglines ("A Family Owned Supplement
Company You Can Trust"), and, most importantly, pages that just mention a brand rather
than being that brand's own website.

None of this is real language understanding -- it's keyword matching and URL structure,
so it will still let some junk through and will reject a few real brands mentioned only in
third-party articles (e.g. "The history of E.Wedel: ..." on a media site gets rejected even
though E.Wedel is real). That's a deliberate precision-over-recall tradeoff: without an
LLM to actually read and judge a page, the strongest free signal available is "does this
page live on a domain that matches the name it's claiming to be" -- a listicle, blog, or
marketplace never does, because it's hosted on the aggregator's domain, not the brand's.
"""

import re
from urllib.parse import urlparse

NON_BRAND_DOMAINS = {
    # social platforms
    "facebook.com", "instagram.com", "twitter.com", "x.com", "pinterest.com",
    "youtube.com", "linkedin.com", "reddit.com", "tiktok.com", "threads.net",
    # marketplaces
    "amazon.com", "amazon.co.uk", "amazon.ca", "ebay.com", "etsy.com",
    "walmart.com", "target.com", "alibaba.com",
    # UGC / publishing platforms (never a specific brand's own domain)
    "medium.com", "wordpress.com", "blogspot.com", "substack.com", "quora.com",
    "wikipedia.org", "wikimedia.org",
    # food/business media -- write ABOUT brands, aren't brands
    "foodnavigator.com", "tastingtable.com", "thespruceeats.com", "seriouseats.com",
    "allrecipes.com", "delish.com", "epicurious.com", "eater.com", "bonappetit.com",
    "foodandwine.com", "businessinsider.com", "forbes.com", "cnn.com", "nytimes.com",
    "today.com", "usatoday.com", "huffpost.com", "buzzfeed.com", "mashed.com",
    "tasteofhome.com", "foodbeast.com", "thekitchn.com", "chowhound.com",
    # non-food orgs that happen to contain food/heritage-adjacent words our queries use
    "heritage.org",
}

_LISTICLE_START = re.compile(r"^\s*\d{1,3}\s")  # "10 Leading...", not "1919 Chocolate" (a real year)
_IMPERATIVE_START = re.compile(r"^(buy|shop|get|find|discover)\b", re.IGNORECASE)

_GENERIC_TITLES = {
    "home", "homepage", "video", "about", "about us", "our story", "our history",
    "our company", "products", "shop", "contact", "contact us", "faq",
}

_JUNK_SUBSTRINGS = [
    "top 10", "best sellers", "leading", "suppliers", "manufacturers",
    "views", "reactions", "brands to", "brands in", "brands you",
    "you can trust", "on instagram", "on facebook", "on twitter", "on tiktok",
    "how to", "buying guide", "gift guide", "the history of", "origins of",
    "food timeline", " vs ", "amazon best",
    "fun to share", "history about", "we carry",
]

_GENERIC_LEAD_WORDS = {"family", "legacy", "company", "trust", "story", "history", "origins", "brands", "products"}


def is_plausible_brand_name(title: str) -> bool:
    t = title.strip()
    if not t:
        return False
    lower = t.lower()

    if lower in _GENERIC_TITLES:
        return False
    if _LISTICLE_START.match(t):
        return False
    if _IMPERATIVE_START.match(t):
        return False
    if any(junk in lower for junk in _JUNK_SUBSTRINGS):
        return False
    if lower.startswith(("a ", "an ", "the ", "our ")) and any(w in lower for w in _GENERIC_LEAD_WORDS):
        return False
    return True


def _normalize_for_domain_match(text: str) -> str:
    return re.sub(r"[^a-z0-9]", "", text.lower())


def is_blocked_domain(url: str) -> bool:
    try:
        host = urlparse(url).netloc.lower().removeprefix("www.")
    except Exception:
        return False
    return any(host == d or host.endswith("." + d) for d in NON_BRAND_DOMAINS)


def domain_matches_name(name: str, url: str) -> bool:
    """The core anti-junk signal: does this page live on a domain that IS the brand,
    rather than a domain that's merely writing/talking/selling ABOUT it? A listicle on
    some-blog.com will never have a domain resembling the specific brand it lists; a
    brand's own homepage almost always does (e.g. "Buderim Ginger" on buderimginger.com)."""
    try:
        host = urlparse(url).netloc.lower().removeprefix("www.")
    except Exception:
        return False
    # The brand-identifying part of a domain is almost always its first label, even for
    # multi-part TLDs like ".com.au" -- so just the piece before the first dot.
    domain_label = host.split(".")[0]
    normalized_name = _normalize_for_domain_match(name)
    normalized_domain = _normalize_for_domain_match(domain_label)
    if not normalized_domain or not normalized_name or len(normalized_domain) < 3:
        return False
    return normalized_domain in normalized_name or normalized_name in normalized_domain
