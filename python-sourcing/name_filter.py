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
import unicodedata
from urllib.parse import urlparse

NON_BRAND_DOMAINS = {
    # social platforms
    "facebook.com", "instagram.com", "twitter.com", "x.com", "pinterest.com",
    "youtube.com", "linkedin.com", "reddit.com", "tiktok.com", "threads.net",
    # marketplaces -- amazon.com/.ca/.co.uk plus the country TLDs the new
    # French/German/Italian/Spanish/Dutch queries actually surface. goldbelly.com and
    # keychain.com are real junk a test run surfaced: Goldbelly is a food-delivery
    # marketplace (it hosted "Settepani Restaurant"'s panettone listing, not a brand's
    # own site), keychain.com is a co-manufacturer/OEM directory platform.
    "amazon.com", "amazon.co.uk", "amazon.ca", "amazon.de", "amazon.fr",
    "amazon.it", "amazon.es", "amazon.nl", "amazon.co.jp", "ebay.com", "etsy.com",
    "walmart.com", "target.com", "alibaba.com", "goldbelly.com", "keychain.com",
    # tradewheel.com is a B2B wholesale sourcing marketplace, same class as alibaba.com
    # (real junk: a "Guangdong Xiaolaoxie Food Co." wholesale gummy-candy listing came
    # back as if it were a brand). indeed.com is a job board -- a job-listing page for
    # "candy makers confectionery industry jobs" is obviously not a candy brand.
    "tradewheel.com", "indeed.com",
    # UGC / publishing platforms (never a specific brand's own domain)
    "medium.com", "wordpress.com", "blogspot.com", "substack.com", "quora.com",
    "wikipedia.org", "wikimedia.org",
    # food/business media -- write ABOUT brands, aren't brands
    "foodnavigator.com", "tastingtable.com", "thespruceeats.com", "seriouseats.com",
    "allrecipes.com", "delish.com", "epicurious.com", "eater.com", "bonappetit.com",
    "foodandwine.com", "businessinsider.com", "forbes.com", "cnn.com", "nytimes.com",
    "today.com", "usatoday.com", "huffpost.com", "buzzfeed.com", "mashed.com",
    "tasteofhome.com", "foodbeast.com", "thekitchn.com", "chowhound.com",
    "tasteatlas.com", "tastecooking.com", "upworthy.com",
    # non-food orgs that happen to contain food/heritage-adjacent words our queries use --
    # heart.org and farmland.org are real junk a test run surfaced (a health-org article
    # on vitamins, a farmland nonprofit's blog post about a honey co-op)
    "heritage.org", "heart.org", "farmland.org",
    # trademark / legal databases -- list a brand's name but are never that brand's site
    "justia.com", "trademarkia.com", "trademarks247.com",
    # general news outlets (not food-specific, but "heritage"/"family owned" queries
    # surface plenty of human-interest news stories about a brand, not the brand itself)
    "abcnews.go.com", "abcnews.com", "cbsnews.com", "nbcnews.com", "bbc.com", "bbc.co.uk",
    "reuters.com", "apnews.com", "npr.org", "washingtonpost.com", "theguardian.com",
    # non-English news outlets -- the French/German/Italian/Spanish/Dutch/Swedish local-
    # language queries surface these constantly, same reason as their English counterparts
    "lefigaro.fr", "lemonde.fr", "liberation.fr", "ouest-france.fr", "lesechos.fr",
    "spiegel.de", "faz.net", "sueddeutsche.de", "welt.de", "zeit.de", "tagesschau.de",
    "corriere.it", "repubblica.it", "gazzetta.it", "ansa.it", "lastampa.it",
    "elpais.com", "elmundo.es", "abc.es", "lavanguardia.com",
    "nu.nl", "nos.nl", "telegraaf.nl", "volkskrant.nl",
    "aftonbladet.se", "dn.se", "svt.se", "expressen.se",
    # business directories / company databases -- list a company, are never that company
    "zoominfo.com", "mapquest.com", "tracxn.com", "leadiq.com", "baseconnect.in",
    "crunchbase.com", "bloomberg.com", "dnb.com", "yellowpages.com", "opencorporates.com",
    "yelp.com", "tripadvisor.com", "manta.com", "owler.com", "pitchbook.com",
    # trade press -- write about food companies, aren't food companies
    "just-food.com", "agro-media.fr", "bakeryandsnacks.com", "confectioneryproduction.com",
    "candyindustry.com", "foodbusinessnews.net", "foodprocessing.com", "foodandbeverage.business",
    # museums / .edu / health-authority sites that come up on "heritage since 19xx" queries
    "chicagohistory.org", "health.harvard.edu", "harvard.edu", "mayoclinic.org",
    "historic-uk.com",
    # generic listicle / lifestyle / trivia sites
    "yardbarker.com", "mentalfloss.com", "allabout-japan.com", "mommyhood101.com",
    "irishpost.com", "wineandcountrylife.com",
    # major Italian food magazines/review sites -- the "miglior panettone" style
    # queries surface these constantly, same reason as the English food-media block
    "lacucinaitaliana.it", "italiangourmet.it", "hardchoco.com",
    # Japanese UGC / review / blog platforms -- domain_matches_name is relaxed for
    # non-Latin-script names (see its docstring), so these need to be blocked by name
    # instead; none of them is ever a specific shop's own site.
    "tabelog.com", "retty.me", "gnavi.co.jp", "ekiten.jp", "ameblo.jp",
    "hatenablog.com", "hatenablog.jp", "note.com", "cookpad.com", "rakuten.co.jp",
    "yahoo.co.jp", "goo.ne.jp",
}

# A URL path containing an e-commerce collection/category segment (e.g.
# "/collections/baby-cereals") is almost always a retailer's product-listing page, not
# a specific brand's own site -- even when the domain itself is some small boutique
# retailer that would never make it into NON_BRAND_DOMAINS by name.
_RETAILER_PATH_SEGMENTS = {"collections", "collection", "category", "categories", "shop-by-brand"}

# A real 44-candidate test run exposed the actual failure mode domain_matches_name
# can't catch on its own: a lifestyle blog, gift shop, or trade-press site writes an
# ARTICLE *about* a real brand ("Scottish Shortbread History & Tradition" on a gift
# retailer's own blog, "Valeo Foods Group Acquires... Melegatti 1894" on a trade-press
# site) -- the site's own name legitimately matches its own domain, so the anti-junk
# check passes, but the "brand" it captures is the blog/publication, not the brand the
# article is actually about. The one consistent tell across every junk row from that
# run: the URL path is shaped like an article/blog post, not a homepage or about page.
_ARTICLE_PATH_SEGMENTS = {
    "blog", "blogs", "news", "article", "articles", "press", "magazine",
    # a "buying guide" or photo "gallery" page is always editorial content, never a
    # brand's own homepage -- real junk: hardchoco.com's "buying-guides" section,
    # lacucinaitaliana.it's "gallery" of panettone picks
    "gallery", "buying-guide", "buying-guides",
}

# A WordPress-style date path (/2017/11/17/...) is essentially always a blog post --
# real junk: an Italian lifestyle blog's "comprare-miglior-panettone-milano" post
# lived at exactly this kind of path.
_DATE_PATH = re.compile(r"/(19|20)\d{2}/\d{1,2}/\d{1,2}/")


def is_article_page(url: str) -> bool:
    try:
        path = urlparse(url).path.lower()
    except Exception:
        return False
    if "comment-page" in path:  # WordPress pagination -- unambiguously a blog post
        return True
    if _DATE_PATH.search(path):
        return True
    path_parts = {p for p in path.split("/") if p}
    return bool(path_parts & _ARTICLE_PATH_SEGMENTS)

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
    # "best X" listicle phrasing in other languages -- our own Italian/French queries
    # literally ask for "miglior"/"meilleure" (best), which is exactly the phrasing
    # SEO roundup articles optimize for, so this is a self-inflicted risk, not just
    # an incidental one. Real junk: "La Cucina Italiana"/"Italian Gourmet" ranking
    # "i migliori panettoni" (the best panettones) instead of any single brand.
    "migliori", "miglior ", "meilleur ", "meilleure ", "meilleurs", "meilleures",
    "beste ", "mejor ", "mejores",
    "fun to share", "history about", "we carry",
    # domain_matches_name can't tell a brand's own site from some OTHER organization's
    # own site (a news outlet's "about" page matches its own domain just as well as a
    # brand's does) -- these catch the media/directory/institution class of self-match
    # that isn't in NON_BRAND_DOMAINS by name yet.
    " news", "newsroom", " guide", "restaurants guide", " museum", "database", "directory",
    "company profile", "employee directory", "company overview",
    # a retail chain's own name, not a manufacturer -- "Heritage Grocers Group" (a
    # supermarket chain operator) slipped through a real run's "heritage...family owned"
    # query since that phrasing applies just as well to a retailer's own marketing copy
    "grocers", "grocery chain", "supermarket chain",
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


def _has_latin_letters(text: str) -> bool:
    return bool(re.search(r"[A-Za-z]", text))


# A few Latin letters carry no combining accent to strip -- NFKD leaves them alone,
# so they need an explicit base-letter mapping instead (Turkish dotless "ı" is what a
# real "Hafız Mustafa 1864" candidate exposed: it's a distinct base letter, not "i" with
# an accent, so the plain [^a-z0-9] strip below used to delete it outright).
_NO_DECOMPOSITION_MAP = str.maketrans(
    {"ı": "i", "İ": "i", "ø": "o", "Ø": "o", "đ": "d", "Đ": "d", "ł": "l", "Ł": "l",
     "æ": "ae", "Æ": "ae", "œ": "oe", "Œ": "oe", "ß": "ss"}
)

# German/Swiss/Austrian domains conventionally spell an umlaut out (ä->ae, ö->oe,
# ü->ue) rather than just dropping the dots -- "Läckerli Huus" is a real example
# whose actual domain is "laeckerli-huus.ch", not "lackerli-huus.ch". Plain accent
# stripping alone (ä->a) would still fail to match that domain, so this needs its
# own transliteration checked as a second candidate variant.
_GERMAN_UMLAUT_MAP = str.maketrans({"ä": "ae", "ö": "oe", "ü": "ue", "Ä": "ae", "Ö": "oe", "Ü": "ue"})


def _strip_diacritics(text: str) -> str:
    decomposed = unicodedata.normalize("NFKD", text)
    return "".join(ch for ch in decomposed if not unicodedata.combining(ch))


def _normalize_for_domain_match(text: str) -> str:
    return re.sub(r"[^a-z0-9]", "", text.lower())


def _name_match_variants(name: str) -> set[str]:
    """Real brand names in the newer non-English buckets carry accents a domain
    typically doesn't (or spells differently, per the umlaut case above) -- comparing
    only the raw lowercased string against a domain silently rejected real candidates
    whose only flaw was a diacritic. Returns every plausible ASCII-normalized form so
    the caller can match against any of them instead of just one."""
    base = name.translate(_NO_DECOMPOSITION_MAP)
    variants = {
        _normalize_for_domain_match(base),
        _normalize_for_domain_match(_strip_diacritics(base)),
        _normalize_for_domain_match(base.translate(_GERMAN_UMLAUT_MAP)),
    }
    return {v for v in variants if v}


def _domain_label(url: str) -> str:
    try:
        host = urlparse(url).netloc.lower().removeprefix("www.")
    except Exception:
        return ""
    # The brand-identifying part of a domain is almost always its first label, even for
    # multi-part TLDs like ".com.au" -- so just the piece before the first dot.
    return host.split(".")[0]


def is_blocked_domain(url: str) -> bool:
    try:
        host = urlparse(url).netloc.lower().removeprefix("www.")
    except Exception:
        return False
    return any(host == d or host.endswith("." + d) for d in NON_BRAND_DOMAINS)


def is_retailer_listing_page(url: str) -> bool:
    try:
        path_parts = {p.lower() for p in urlparse(url).path.split("/") if p}
    except Exception:
        return False
    return bool(path_parts & _RETAILER_PATH_SEGMENTS)


def domain_matches_name(name: str, url: str) -> bool:
    """The core anti-junk signal: does this page live on a domain that IS the brand,
    rather than a domain that's merely writing/talking/selling ABOUT it? A listicle on
    some-blog.com will never have a domain resembling the specific brand it lists; a
    brand's own homepage almost always does (e.g. "Buderim Ginger" on buderimginger.com).

    A brand name written entirely in a non-Latin script (Kanji/Hiragana/Katakana,
    Cyrillic, ...) can never satisfy this -- _normalize_for_domain_match strips
    everything but a-z0-9, so a pure-Kanji name normalizes to an empty string and
    this would always return False. That's fatal for the Japan bucket specifically:
    a real 老舗 (long-established) shop's own name is almost always written in
    Japanese script even though its domain is romanized (e.g. "虎屋" on toraya-group.co.jp),
    so the strict check would silently reject every genuine candidate it could ever
    find and only let romanized names (like "WATATO") through. For a non-Latin name,
    fall back to trusting the earlier is_blocked_domain/is_retailer_listing_page
    checks instead, since there's no script-agnostic way to compare the two."""
    normalized_domain = _normalize_for_domain_match(_domain_label(url))
    if not normalized_domain or len(normalized_domain) < 3:
        return False

    if not _has_latin_letters(name):
        return True

    return any(
        normalized_domain in variant or variant in normalized_domain
        for variant in _name_match_variants(name)
    )


# Includes the full-width equivalents ("｜", "－", "：", "・") Japanese page titles
# commonly use instead of the ASCII versions -- without these, a Japanese wagashi
# shop's title never splits at all and the whole title (tagline included) gets
# scored as a single "brand name" candidate.
_TITLE_SEPARATORS = re.compile(r"\s*[|\-–—:·｜－：・]\s*")

_BOILERPLATE_PARTS = _GENERIC_TITLES | {
    "official site", "official website", "online store", "welcome to", "buy", "product",
}

# A leading "About "/"Welcome to " on an otherwise-fine part (e.g. "About WATATO") is
# common enough on real "about us" pages that it's worth stripping instead of scoring
# the whole phrase -- the brand name is the part that actually matters here.
_LEADING_BOILERPLATE = re.compile(r"^(about|welcome to|discover|introducing)\s+", re.IGNORECASE)


def _domain_token_overlap(domain_label: str, part: str) -> int:
    # Strip diacritics first -- otherwise "Läckerli" tokenizes as ["l", "ckerli"]
    # (the regex simply skips "ä"), which can never overlap a domain's "laeckerli".
    dom_tokens = set(re.findall(r"[a-z]+", _strip_diacritics(domain_label).lower()))
    part_tokens = set(re.findall(r"[a-z]+", _strip_diacritics(part).lower()))
    return len(dom_tokens & part_tokens)


def guess_brand_name(title: str, url: str) -> str | None:
    """Splits a noisy search-result title on common separators and keeps the part most
    likely to be the actual brand name -- the one whose words overlap the site's own
    domain the most, tie-broken by shorter length.

    Replaces a naive "take everything before the first ' | ' or ' - '" approach, which
    let compound titles using other separators (' :: ', ' at ') straight through
    untouched -- e.g. "Heritage Candy Company, Inc. Trademarks Page 1 :: Justia
    Trademarks" kept its "Justia Trademarks" tail, which then coincidentally shared
    letters with the trademarks.justia.com domain and passed domain_matches_name for
    the wrong reason entirely.
    """
    domain_label = _domain_label(url)
    parts = [p.strip() for p in _TITLE_SEPARATORS.split(title) if p.strip()]
    parts = [p for p in parts if p.lower() not in _BOILERPLATE_PARTS]
    parts = [_LEADING_BOILERPLATE.sub("", p).strip() for p in parts]
    parts = [p for p in parts if p]
    if not parts:
        return None

    scored = sorted(parts, key=lambda p: (-_domain_token_overlap(domain_label, p), len(p)))
    candidate = scored[0]
    if not (2 <= len(candidate) <= 60):
        return None
    if not is_plausible_brand_name(candidate):
        return None
    return candidate
