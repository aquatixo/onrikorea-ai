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
from difflib import SequenceMatcher
from urllib.parse import urlparse

NON_BRAND_DOMAINS = {
    # social platforms
    "facebook.com", "instagram.com", "twitter.com", "x.com", "pinterest.com",
    "youtube.com", "linkedin.com", "reddit.com", "tiktok.com", "threads.net",
    # job boards / OEM-maker directories / regional tourism-editorial sites -- real junk
    # from a Japan + Germany run (none of these is a brand's own site)
    "doda.jp", "careerpark-agent.jp", "shokuhin-oem.jp", "uroko.biz", "shareshima.com",
    "in-berlin-brandenburg.com", "keizai.biz",
    # a site-builder subdomain that duplicated a brand already found on its own .com
    # (torroneproperzi.axeleroweb.it vs torroneproperzi.com)
    "axeleroweb.it",
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
    # tour/activity booking marketplaces -- same class as tripadvisor.com/yelp.com
    # above, just missed on the first pass. Real junk: civitatis.com hosted a
    # "guided tour of the Selaya Sobao Museum" booking page, not a brand's own site.
    "civitatis.com", "getyourguide.com", "viator.com", "klook.com",
    # major recipe/cooking media sites the regional-specialty queries surface
    # constantly (same class as allrecipes.com/thespruceeats.com above) --
    # cucchiaio.it ("Cucchiaio d'Argento") is Italy's biggest recipe site, always a
    # recipe page, never a brand. lebkuchen-rezepte.de is covered generically by
    # is_recipe_page() below instead, since its whole domain is built from the word
    # "Rezepte" (recipes) and that pattern recurs under other domain names too.
    "cucchiaio.it", "giallozafferano.it", "marmiton.org", "chefkoch.de",
    # food/travel "guide to [country]'s snacks" tourism and lifestyle sites -- write
    # about regional specialties for travelers, never the manufacturer. Real junk:
    # deliciousitaly.com's "Abruzzo food" guide, geogastronomica.com's "Sobao
    # Pasiego" explainer, mochimommy.com's "snacks to bring home from Japan" listicle.
    "deliciousitaly.com", "geogastronomica.com", "mochimommy.com", "japan-guide.com",
    # research/feasibility-study and NGO/academic orgs that surface on "traditional
    # recipe development" style queries -- funiber.org is a real junk hit: a food-
    # science feasibility study ABOUT a traditional sobao recipe, not a sobao brand.
    "funiber.org",
    # personal travel/lifestyle blogs -- real junk from the same run: a travel
    # blogger's "petticoat, shortbread and oatcakes" post, a family-travel blog's
    # "El Día del Sobao Pasiego" post. Long-tail and unlikely to recur by this exact
    # domain, but free to block now that they're known.
    "mlisstravels.com", "cantabriaconninos.com",
    # city/neighborhood business-directory and tourism-board sites -- domain_matches_name
    # can't catch these (the directory's own name legitimately matches its own domain),
    # same class as the news-outlet/museum/trade-press junk above. Real junk: a German
    # Printen (Lebkuchen) query surfaced aachen-schoene-altstadt.de and aachen-libersave.de
    # (both local Aachen business-directory/review sites that merely mention real bakeries
    # in their listings, extracted as if the directory itself were the brand) and
    # tourismus.nuernberg.de (the city tourism board's own site, same mention-not-brand shape).
    "aachen-schoene-altstadt.de", "aachen-libersave.de", "tourismus.nuernberg.de",
    # personal/lifestyle recipe & cooking blogs, same class as allrecipes.com etc. above
    # but with a domain name that doesn't contain the word "recipe" as its own token
    # (so is_recipe_page's whole-token check can't catch them either) -- real junk:
    # recipetineats.com (Nagi Coleman's recipe blog) posted a galette bretonne recipe,
    # thespanishapron.com (a personal cooking blog) posted a "Perfect Casadielles"
    # how-to, neither is a biscuit/confectionery brand's own site.
    "recipetineats.com", "thespanishapron.com",
    # software/news/tourism self-referential sites -- domain_matches_name can't catch
    # these either (same "directory matches its own name" blind spot as the city-
    # directory junk above): a real run surfaced support.microsoft.com ("Contact Us"
    # page), thetimes.com and scotsman.com (both "About Us" pages -- the Scotsman one
    # ironically ABOUT an Edinburgh Rock maker closing, not a candidate itself),
    # visit-cambrai.co.uk (a UK tourism site ABOUT the real Bêtises de Cambrai candy),
    # and Japan's national wagashi/confectionery trade associations (wagashi.or.jp,
    # pcg.or.jp -- industry bodies, not a specific shop).
    "support.microsoft.com", "thetimes.com", "scotsman.com", "visit-cambrai.co.uk",
    # NOTE: wagashi.or.jp/pcg.or.jp are trade associations, correctly blocked under the
    # current one-result-one-candidate design (an association's own page is never
    # itself a specific brand). But that condition is design-specific, not permanent --
    # a members/producer LIST page on one of these is exactly the highest-yield harvest
    # source a future 2-stage (list-harvest -> per-name resolve) pipeline would want.
    # Don't just re-add these blindly if that's ever built; reconsider them then.
    "wagashi.or.jp", "pcg.or.jp",
    # a second feedback pass on the same 22-candidate run caught these: frenchquarter.com
    # and provenceweb.fr are city/region tourism portals (same class as visit-cambrai.co.uk
    # above -- frenchquarter.com's own "founded year" was actually a hotel/attraction
    # listing's, not a candy brand's), sottocoperta.net is an Italian lifestyle magazine
    # (its "Mostaccioli abruzzesi" hit was a recipe article), fujingaho.jp and
    # tabisuruwagashi.com are wagashi *curation shops* (retailers aggregating many
    # different makers' products under one storefront, not a single brand), and
    # takashimaya.co.jp is a department store -- all four Japanese ones are the exact
    # class domain_matches_name's non-Latin-script bypass can't catch (see that
    # function's docstring and the generic-noun check added below it).
    "frenchquarter.com", "provenceweb.fr", "sottocoperta.net",
    "fujingaho.jp", "tabisuruwagashi.com", "takashimaya.co.jp",
    # adult content -- a Serper result batch for an otherwise perfectly normal German
    # bakery query ("Dresdner Stollen...") came back one run with several hardcore porn
    # sites mixed in (pornhub.com, xvideos.com, xnxx.com, tubeporn.com, vipwank.com,
    # tubepleasure.com) -- a search engine returning irrelevant/spam results for a
    # legitimate query is itself not something this pipeline can prevent, but nothing
    # in that category should ever reach the review list regardless of what query
    # surfaced it. See is_adult_content() below for the general (not just these 6
    # domains) version of this check.
    "pornhub.com", "xvideos.com", "xnxx.com", "tubeporn.com", "vipwank.com", "tubepleasure.com",
    # Tavily backend, same junk classes as the Serper run above (none of these were
    # caught by any mechanism-level fix this round, since each is a self-consistent
    # domain -- directory/portal/retailer/broadcaster -- domain_matches_name's whole
    # design can't distinguish "is a brand" from "has a domain matching its own name"):
    # dastelefonbuch.de (German phone directory), saporiabruzzo.it (regional food
    # guide portal), asturiasparaisosingluten.es (a gluten-free PRODUCER LISTING page,
    # not any one producer), newjerseyisntboring.com (a local-interest blog), pbs.org
    # (the US broadcaster), scottishsweets.co.uk (a retailer -- the real manufacturer
    # in its own snippet is "Gordon & Durward").
    "dastelefonbuch.de", "saporiabruzzo.it", "asturiasparaisosingluten.es",
    "newjerseyisntboring.com", "pbs.org", "scottishsweets.co.uk",
}

# General signal words for adult content -- checked against the search result's own
# title/snippet/URL (not just a fixed domain list above), since tomorrow's spam result
# won't be on today's list of 6 known domains. Deliberately narrow, unambiguous words
# only (no "sex" alone, which hits unrelated real words like "Sussex" or "Essex") to
# avoid rejecting a real brand whose name/description happens to share a substring.
_ADULT_CONTENT_SUBSTRINGS = [
    "porn", "xxx", "hentai", "nsfw", "xvideos", "xnxx", "redtube", "youporn",
]


def is_adult_content(title: str, url: str, description: str) -> bool:
    haystack = f"{title} {url} {description}".lower()
    return any(s in haystack for s in _ADULT_CONTENT_SUBSTRINGS)

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
    # a food company's own "journal" section is its editorial content about a topic,
    # not its homepage -- real junk: sazae.co.jp/journal/wagashi-shurui/, an article
    # explaining wagashi categories in general, extracted as if "季節" (season, a
    # section heading in the article) were itself a brand name. Deliberately NOT
    # adding "story"/"stories" here -- ABOUT_PAGE_PATHS in site_scrape.py already uses
    # "/our-story" as a legitimate About-page path, so blocking it here would reject
    # real brand homepages linked straight to their own story page.
    "journal", "journals",
}

# A WordPress-style date path (/2017/11/17/... or the day-less /2017/11/...) is
# essentially always a blog post -- real junk: an Italian lifestyle blog's
# "comprare-miglior-panettone-milano" post lived at the 3-segment form, a Neapolitan
# recipe blog's "ferratelle-morbide-ricetta-tipica-abruzzese.html" post lived at the
# day-less 2-segment form (year/month/slug.html, no day number at all) -- the original
# regex required all three segments and missed that second, very common permalink shape.
_DATE_PATH = re.compile(r"/(19|20)\d{2}/\d{1,2}/")


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


# "recipe" in the local language, as a whole domain label or whole path segment only
# (not a bare substring -- a brand genuinely named e.g. "Secret Recipe" would otherwise
# be rejected). Real junk this catches: lebkuchen-rezepte.de (the whole domain is built
# from "Lebkuchen" + "Rezepte"), cucchiaio.it/ricetta/ferratelle.amp.html (Italy's
# biggest recipe site, path segment "ricetta"). Every regional-specialty query already
# carries a "-receta"/"-Rezept"/"-ricetta" exclusion operator at search time, but that
# only suppresses the WORD "recipe" itself, not every page that happens to be a recipe
# without using that exact word in its title/snippet -- this is the second line of
# defense for whatever slips past the search operator.
_RECIPE_TOKENS = {
    "rezept", "rezepte", "recipe", "recipes", "ricetta", "ricette",
    "receta", "recetas", "recette", "recettes",
}


def is_recipe_page(url: str, title: str = "", description: str = "") -> bool:
    try:
        parsed = urlparse(url)
        host = parsed.netloc.lower().removeprefix("www.")
        path_parts = [p.lower() for p in parsed.path.split("/") if p]
    except Exception:
        return False
    host_labels = set(re.split(r"[.-]", host))
    if host_labels & _RECIPE_TOKENS:
        return True
    if any(part.split(".")[0] in _RECIPE_TOKENS for part in path_parts):
        return True
    # URL-only checks miss a page whose domain/path never says "recipe" but whose own
    # TITLE does, in plain language -- verified empirically: scottishscran.com's result
    # title was literally "Traditional Homemade Scottish Tablet Recipe", on a domain
    # with no recipe-shaped word anywhere in it. Whole-word match (via the same tokenizer
    # as everywhere else in this file), not a bare substring, for the same reason as the
    # URL check -- so a brand genuinely named e.g. "Secret Recipe" isn't rejected for it.
    #
    # Restricted to a ROOT path (no path_parts at all) is NOT safe -- this used to apply
    # to every page regardless of path, and verified empirically broke a real candidate:
    # patisseriebretonne.fr (Kerjeanne, a real manufacturer founded 1963) has the SEO
    # page title "La véritable Recette de Kouign Amann Breton par Kerjeanne" ("recette"
    # as a marketing hook, not a recipe article) on its OWN ROOT homepage -- the title
    # alone can't tell a real manufacturer's SEO-flavored title from an actual recipe
    # blog post, but the PATH can: a real recipe article lives at some specific deep
    # path (/recipes/..., /2023/.../recette-....html), essentially never at the site's
    # own root. So the title/description check only fires when there IS a non-root path
    # to go with it -- a root-path result falls back to trusting the URL-only checks
    # above (and domain_matches_name downstream) instead.
    if not path_parts:
        return False
    text = f"{title} {description}"
    text_tokens = set(re.findall(r"[a-z]+", _strip_diacritics(text).lower()))
    if text_tokens & _RECIPE_TOKENS:
        return True
    # レシピ (Japanese loanword "recipe", katakana) can't be tokenized by the Latin-only
    # regex above -- a plain substring check is low-risk here since it's an unambiguous
    # borrowed word, not a native-Japanese compound a real brand name could contain part of.
    # Same root-path restriction as above applies (already guaranteed by the early
    # return when path_parts is empty).
    return "レシピ" in text


# A parked/placeholder domain (never configured past the registrar's or website
# builder's default page) has no brand to find at all -- real junk: loullig.com's
# search snippet was literally "Titre du site Titre du site Bientôt disponible ...
# Créez un site Web", a Wix-style default page in French. Checked against the search
# result's description/snippet text, not the URL, since a parked domain's title/URL
# alone usually look fine (the registrant typed a real-looking name).
_PARKED_PAGE_SUBSTRINGS = [
    "coming soon", "bientôt disponible", "créez un site web", "create your website",
    "build your website", "site en construction", "en construction",
    "under construction", "domain for sale", "this domain is for sale",
    "página en construcción", "questo dominio è in vendita",
    "diese domain steht zum verkauf", "default web site page", "titre du site",
]


def is_parked_page(description: str) -> bool:
    if not description:
        return False
    lower = description.lower()
    return any(s in lower for s in _PARKED_PAGE_SUBSTRINGS)


# Tourism-portal and curation-shop navigation chrome -- a snippet keyword check safer
# than a generic "has a cart/login" rule (a real small brand's own webshop legitimately
# has those too, see e.g. Confitería ARVA/Solla in the same run). These phrases, by
# contrast, are specific to a multi-business directory/portal and essentially never
# appear on a single producer's own site: "Trip Planner"/the full nav bar was literally
# in frenchquarter.com's snippet (a New Orleans tourism portal), "都道府県から探す"/
# "お店から探す" (search by prefecture / search by store) were in tabisuruwagashi.com's
# (a wagashi curation shop aggregating many different makers).
_PORTAL_SUBSTRINGS = [
    "trip planner", "tours & tickets",
    "都道府県から探す", "お店から探す",
]


def is_portal_page(description: str) -> bool:
    if not description:
        return False
    lower = description.lower()
    return any(s in lower for s in _PORTAL_SUBSTRINGS)

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
    if _HEADLINE_SHAPE.search(t):
        return False
    # The "name" is just a domain ("bestofocnj.com") -- guess_brand_name falls back to
    # the page's own host when the title has nothing better, and a host is never a brand.
    if _DOMAIN_SHAPED.match(t):
        return False
    # An industry body / cooperative / association, not a company that sells product
    # (real run: 京都八ツ橋商工業協同組合 -- a trade cooperative's page, not a brand).
    if _TRADE_BODY.search(t):
        return False
    if looks_like_reseller(t):
        return False
    return True


_DOMAIN_SHAPED = re.compile(r"^[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}$", re.I)
_TRADE_BODY = re.compile(
    r"協同組合|組合|協会|連合会|商工会|"
    r"\b(association|federation|chamber of commerce|consorzio|consortium|verband|syndicat)\b",
    re.I,
)


# A page TITLE, not a company name: a question/exclamation mark, or Japanese list/job/
# ranking words. Real run: "お菓子OEMメーカー一覧", "求人一覧", "お菓子メーカーの就職は企業研究から！",
# "製菓メーカーとは？ ..." all came back as "brands" -- non-Latin names skip the
# domain-match check entirely (nothing Latin to compare), so nothing else stopped them.
# A real brand name essentially never contains these.
_HEADLINE_SHAPE = re.compile(
    r"[?？!！「」、。]|一覧|リンク集|求人|採用|転職|就職|ランキング|おすすめ|まとめ|比較|とは$|について"
)


# A reseller / gift-basket assembler, not a producer: it sells other makers' goods in a box
# (real run: "Fine Scottish Hampers" -- whisky, smoked salmon and venison hampers).
_RESELLER_WORDS = re.compile(
    r"\bhampers?\b|gift\s?(basket|box|set)s?\b|geschenk(korb|set|box)|coffret\s+cadeau|"
    r"panier\s+garni|cestas?\s+de\s+regalo|cesti?\s+regalo|"
    # A wholesaler/distributor NAMED as such ("Jakob Distler Süßwarengroßhandel") -- the
    # middleman, not the maker. As a LINK on a maker's site these same words mean the
    # opposite (the maker's own trade channel); site_profile only applies this to names.
    r"gro(ß|ss)handel|\bgrossiste|\bingrosso\b|\bmayorista\b|\bwholesalers?\b|"
    r"\bdistributors?\b|\bdistribuidora\b|\bdistribuzione\b|cash\s*&\s*carry|"
    r"\bimporters?\b|\bimportateur|\bimportatore",
    re.I,
)


def looks_like_reseller(text: str) -> bool:
    return bool(_RESELLER_WORDS.search(text or ""))


_SHOP_WORDS = re.compile(
    r"\b(online[\s-]?shop|online[\s-]?store|web[\s-]?shop|onlineshop|shop|store|online|official(\s+site)?)\b",
    re.I,
)


def strip_shop_words(name: str) -> str:
    """For DUPLICATE checking only: "Lambertz Online" is the web shop of the existing brand
    Lambertz, and the low-confidence match the app returned for it was easy to overlook."""
    stripped = re.sub(r"\s{2,}", " ", _SHOP_WORDS.sub(" ", name)).strip(" -|:·")
    return stripped if len(stripped) >= 2 else name


def pick_brand_name(current: str, site_name: str | None, url: str) -> str:
    """Choose between the search-result-derived name and the name the site gives itself
    (og:site_name / JSON-LD), whichever is closer to the domain. Domain-closeness decides
    because the domain is the one thing both names can be checked against: it kept
    "La Maison Guella" (the site's own SEO title had a "Biscuiterie ... - Cancale Saint-Malo
    Dinard Dinan" tail that made it worse) and replaced "Dresdner Christstollen" (a product)
    with "Dresdner Mühlenbäckerei" (the company)."""
    if not site_name or not site_name.strip():
        return current
    dom = _normalize_for_domain_match(_domain_label(url))

    def closeness(n: str) -> float:
        return SequenceMatcher(None, _normalize_for_domain_match(n), dom).ratio()

    # Split only on separators with whitespace around them ("A - B", "A | B", "A » B"):
    # guess_brand_name's splitter also cuts a hyphenated name like "Saint-Malo" in half.
    pieces = [site_name.strip()] + [
        p.strip() for p in re.split(r"\s+[|\-–—:·»]\s+|\s*[｜»]\s*", site_name) if p.strip()
    ]
    usable = [
        p for p in pieces
        if len(p) >= 3 and has_latin_letters(p) and is_plausible_brand_name(p) and domain_matches_name(p, url)
    ]
    if not usable:
        return current
    best = max(usable, key=closeness)
    return best if closeness(best) > closeness(current) + 0.05 else current


def has_latin_letters(text: str) -> bool:
    return bool(re.search(r"[A-Za-z]", text))


# A non-Latin "name" that's actually a generic category word, not a specific brand --
# domain_matches_name below can't tell "和菓子" (wagashi, the whole category) from "虎屋"
# (Toraya, one specific shop) since neither has Latin letters to compare against a
# domain. A real run's Japan bucket surfaced exactly these as "candidates": 和菓子,
# 洋菓子 (western-style confectionery), 季節 (season -- not even food-specific),
# スイーツ (sweets). Checked as an EXACT match (not substring) -- a real shop name that
# happens to contain "和菓子" as part of a longer name (e.g. "ちひろ和菓子店") is a real
# candidate, just a plain category word on its own never is.
_GENERIC_CATEGORY_WORDS_NON_LATIN = {
    "和菓子", "洋菓子", "菓子", "スイーツ", "季節", "お菓子", "スナック",
}


def is_generic_category_word(name: str) -> bool:
    return name.strip() in _GENERIC_CATEGORY_WORDS_NON_LATIN


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
    checks instead, since there's no script-agnostic way to compare the two -- EXCEPT
    when the name is itself just a generic category word (see is_generic_category_word
    above), which is never a brand regardless of what domain it's on.

    Whole-string containment alone (checked first, below) silently drops real brands on
    their own domain when the words appear in a different ORDER -- verified empirically:
    "Printenbäckerei Klein" on domain "klein-printen.de" fails (normalized strings
    "printenbaeckereiklein" vs "kleinprinten" don't contain each other even though both
    words are the same), and likewise "Confiserie Afchain" on "betises-afchain.com"
    (shares "afchain" but not as a whole-string match either way). A shared word token
    of real length (>=4 chars, to exclude connector words like "de"/"la"/"im"/"am") is
    still a strong signal, just not full-string containment -- reusing the same
    tokenizer guess_brand_name already uses to score domain overlap.

    A length guard alone is NOT enough, though -- verified empirically with 9
    constructed junk cases, all 9 false-positived on a length-only guard: a magazine/
    directory/blog domain routinely shares an INDUSTRY or PRODUCT noun with a real
    brand's name (both "Biscuiterie du Moulin" the brand and "biscuiterie-magazine.fr"
    the trade magazine contain "biscuiterie" -- that word is evidence of the industry,
    not of which specific site this is), e.g. "Lebkuchen Welt" on lebkuchen-portal.de,
    "Maison du Chocolat Blog" on maison-presse.fr. _GENERIC_MATCH_TOKENS excludes
    exactly these category/modifier words from counting -- only a token NOT in that
    set, at least 4 chars, counts as real evidence (a surname, a place name, a coined
    brand word: "afchain", "klein", "fossier").

    This does NOT catch every case (a brand name that shares no word at all with its
    own domain, e.g. a product name like "calisson.com" selling "Le Roy René" -- there's
    no string signal left to find there at all; same for "biscuiterie-sg.fr" selling
    "Biscuiterie de Saint-Guénolé", whose only shared token IS the generic one) -- that
    class needs either a brand-name knowledge base or an LLM call to resolve, not a
    regex. What this recovers is narrower: a real, non-generic token just reordered or
    standing alone."""
    normalized_domain = _normalize_for_domain_match(_domain_label(url))
    if not normalized_domain or len(normalized_domain) < 3:
        return False

    if not has_latin_letters(name):
        return not is_generic_category_word(name)

    if any(
        normalized_domain in variant or variant in normalized_domain
        for variant in _name_match_variants(name)
    ):
        return True

    # The strict "long name, tiny overlap" guard only applies to an INNER page: a product
    # page on someone else's shop is exactly where a long title meets a domain on one
    # shared word. A site's own homepage (root path) with a long SEO title still gets the
    # lenient match -- real case patisseriebretonne.fr, title "La véritable Recette de
    # Kouign Amann Breton par Kerjeanne".
    try:
        inner_page = urlparse(url).path.strip("/") != ""
    except ValueError:
        inner_page = False
    return _token_overlap_match(_domain_label(url), name, strict=inner_page)


# Industry/product-category nouns and generic modifiers -- NOT brand-identifying on
# their own, so sharing one of these with a domain is not evidence the domain IS that
# brand (a trade magazine's own domain uses the exact same vocabulary as the real
# brands it writes about). Deliberately scoped to this project's own food/confectionery
# domain + the exact words categories.py's queries themselves target (lebkuchen,
# calisson, turron, wagashi, ...), not a general-purpose stopword list.
_GENERIC_MATCH_TOKENS = {
    # manufacturer-type nouns
    "biscuiterie", "confiserie", "chocolaterie", "patisserie", "pasticceria",
    "biscottificio", "torrefazione", "baeckerei", "backerei", "konditorei",
    "confiteria", "pasteleria", "bakery", "confectionery", "chocolate", "candy",
    "sweets", "snack", "cookies", "biscuits",
    # generic modifiers -- "artesano" (Spanish "artisan") was missing even though its
    # French/English counterparts were already here, same gap-by-omission as the
    # founded-year/about-path language coverage elsewhere in this file.
    "maison", "casa", "artisan", "artisanal", "artesano", "traditionnel", "tradicional",
    "famille", "familie", "manufaktur", "fabrik", "fabrica", "store", "shop", "online",
    # specialty-item nouns (same vocabulary categories.py's queries target)
    "lebkuchen", "shortbread", "stollen", "calisson", "nougat", "turron", "torrone",
    "wagashi", "galette", "speculaas", "stroopwafel", "panettone",
    # publishing/listicle/directory words -- a magazine, wiki, forum, or "best of" list
    # shares these with whatever it's writing about just as readily as an industry
    # noun does (turron-guia.es, "Turron Artesano Guia" -- "guia"/Spanish "guide").
    "guia", "guide", "collection", "magazin", "magazine", "wiki", "forum",
    "welt", "mondo", "best", "top", "list", "ranking",
}


def _shared_tokens(domain_label: str, name: str) -> set[str]:
    dom_tokens = set(re.findall(r"[a-z]+", _strip_diacritics(domain_label).lower()))
    name_tokens = set(re.findall(r"[a-z]+", _strip_diacritics(name).lower()))
    return dom_tokens & name_tokens


def _non_generic_shared_tokens(domain_label: str, name: str) -> set[str]:
    return {t for t in _shared_tokens(domain_label, name) if len(t) >= 4 and t not in _GENERIC_MATCH_TOKENS}


def _non_generic_name_tokens(name: str) -> set[str]:
    name_tokens = set(re.findall(r"[a-z]+", _strip_diacritics(name).lower()))
    return {t for t in name_tokens if len(t) >= 4 and t not in _GENERIC_MATCH_TOKENS}


def _token_overlap_match(domain_label: str, name: str, strict: bool = False) -> bool:
    """True if a non-generic name token either (a) is its own separate token in the
    domain label (hyphen/underscore-separated, e.g. "klein-printen"), or (b) appears as
    a plain substring once separators are stripped -- (b) is for a CONCATENATED domain
    with no separator at all, verified empirically: "fraccarospumadoro.it" for
    "Pasticceria Fraccaro" never tokenizes into ["fraccaro", "spumadoro"] (it's one
    solid blob to the regex in (a)), so an exact token-SET intersection can never fire
    even though "fraccaro" is sitting right there in it."""
    candidate_tokens = _non_generic_name_tokens(name)
    if not candidate_tokens:
        return False
    dom_tokens = set(re.findall(r"[a-z]+", _strip_diacritics(domain_label).lower()))
    domain_plain = _strip_diacritics(domain_label).lower().replace("-", "").replace("_", "")
    matched = {t for t in candidate_tokens if t in dom_tokens or t in domain_plain}
    if not matched:
        return False
    # A LONG name that shares only one word with the domain is a product/page title, not
    # the domain's brand: real run -- "Olde Colony Bakery Original Charleston Benne
    # Wafers" matched essentiallycharleston.com (a gift shop) on the place name alone.
    # Real brand names have 1-3 distinctive words; 4+ distinctive words with under 40%
    # of them on the domain is a headline.
    if strict and len(candidate_tokens) >= 4 and len(matched) / len(candidate_tokens) < 0.4:
        return False
    return True


def generic_overlap_only(name: str, url: str) -> bool:
    """True when name and url's domain share a token, but ONLY a generic one -- i.e.
    domain_matches_name correctly returns False here, but for a specifically
    diagnosable reason (distinct from sharing nothing at all). Used by main.py to log
    a separate "generic_token_only" filter_drops reason instead of lumping it into
    plain "domain_mismatch" -- that count is exactly the measure of how often this
    known, unfixed-without-an-LLM gap (see domain_matches_name's docstring) actually
    comes up in practice."""
    shared = _shared_tokens(_domain_label(url), name)
    return bool(shared) and not _non_generic_shared_tokens(_domain_label(url), name)


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


# Single source of truth for "which URL/description-level filter rejects this raw
# search result, and why" -- used by both main.py's process_one_query (the real
# pipeline) and tests/test_filters.py (the regression runner). These used to be two
# separately-maintained copies of the same list; the moment they drifted, the test
# suite would keep passing while testing a pipeline that no longer matched the real
# one, silently defeating the whole point of having it. Each entry takes a result dict
# with "title"/"url"/"description" keys, same shape both callers already use.
URL_FILTERS = [
    ("blocked_domain", lambda r: is_blocked_domain(r["url"])),
    ("retailer_listing", lambda r: is_retailer_listing_page(r["url"])),
    ("article_page", lambda r: is_article_page(r["url"])),
    ("recipe_page", lambda r: is_recipe_page(r["url"], r.get("title", ""), r.get("description", ""))),
    ("parked_page", lambda r: is_parked_page(r.get("description", ""))),
    ("adult_content", lambda r: is_adult_content(r["title"], r["url"], r.get("description", ""))),
    ("portal_page", lambda r: is_portal_page(r.get("description", ""))),
]
