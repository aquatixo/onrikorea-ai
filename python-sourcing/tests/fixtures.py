"""Real search-result shapes from actual sourcing runs this session, each labeled with
the expected outcome -- a regression set, not a correctness proof. When a filter change
makes one of these flip, that's the signal to look closer, not necessarily that the
change is wrong (a fixture's expected label can be wrong too; update it deliberately,
don't just make the test pass).

"keep" means: should survive every URL/description-level filter in main.py's raw-result
loop AND domain_matches_name, i.e. would become a candidate for evaluate_candidate to
judge. "drop" means: should be rejected before ever becoming a candidate, by whichever
filter is named in "expect_reason" (purely documentation here -- the runner doesn't
enforce which specific filter catches it, only whether something does).
"""

FIXTURES = [
    # --- should be DROPPED (real junk from the 22-candidate incident) ---
    {
        "label": "Aachen directory site (not Printenbäckerei Klein itself)",
        "title": "Printenbäckerei Klein - Aachen schöne Altstadt",
        "url": "https://www.aachen-schoene-altstadt.de/printenbaeckerei-klein",
        "description": "Printenbäckerei Klein (Krämerstraße) - Aachen schöne Altstadt",
        "expect": "drop",
        "expect_reason": "blocked_domain (city business directory)",
    },
    {
        "label": "Tourismus Nürnberg (city tourism board)",
        "title": "Fraunholz Lebkuchen - Tourismus Nürnberg",
        "url": "https://tourismus.nuernberg.de/fraunholz-lebkuchen",
        "description": "Fraunholz Lebkuchen - Tourismus Nürnberg Hotline: +49 911",
        "expect": "drop",
        "expect_reason": "blocked_domain (city tourism board)",
    },
    {
        # is_recipe_page used to only check the URL -- this domain has no recipe-shaped
        # word in it at all, only the search result's own TITLE says what it is.
        "label": "scottishscran.com (recipe page, domain itself has no recipe-word)",
        "title": "Traditional Homemade Scottish Tablet Recipe - Scottish Scran",
        "url": "https://scottishscran.com/traditional-homemade-scottish-tablet-recipe/",
        "description": "Traditional Homemade Scottish Tablet Recipe - Scottish Scran Skip to content",
        "expect": "drop",
        "expect_reason": "recipe_page (title-based)",
    },
    {
        "label": "recipetineats.com (recipe blog, not a brand)",
        "title": "Galettes Bretonnes (Brittany Butter Biscuits) - RecipeTin Eats",
        "url": "https://www.recipetineats.com/galettes-bretonnes/",
        "description": "Fast Prep, Big Flavours - RecipeTin Eats",
        "expect": "drop",
        "expect_reason": "blocked_domain (recipe blog)",
    },
    {
        "label": "frenchquarter.com (New Orleans tourism portal)",
        "title": "Basin St. Station",
        "url": "https://www.frenchquarter.com/nola/evans-creole-candy-company/2533/",
        "description": "HOTELS EVENTS DINING NIGHTLIFE ATTRACTIONS SHOP TOURS & TICKETS EXPLORE Maps Trip Planner",
        "expect": "drop",
        "expect_reason": "blocked_domain + portal_page (tourism portal)",
    },
    {
        "label": "sottocoperta.net (Italian lifestyle magazine)",
        "title": "Mostaccioli abruzzesi - Sottocoperta.Net",
        "url": "https://www.sottocoperta.net/food/ricette-italia/abruzzo/mostaccioli-abruzzesi/",
        "description": "Iscriviti alla Newsletter Search for: Topics Newsletter Disneyland Paris: offerte e Hotel",
        "expect": "drop",
        "expect_reason": "blocked_domain (lifestyle magazine)",
    },
    {
        "label": "takashimaya.co.jp (department store, not a brand)",
        "title": "洋菓子",
        "url": "https://www.takashimaya.co.jp/shopping/food/0400000001/",
        "description": "高島屋のオンラインショッピング",
        "expect": "drop",
        "expect_reason": "blocked_domain (department store)",
    },
    {
        "label": "shop.fujingaho.jp (magazine's curated shop, not a brand)",
        "title": "和菓子",
        "url": "https://shop.fujingaho.jp/shop/r/ri10/",
        "description": "和菓子・和スイーツ | スイーツ・グルメ・ギフトの通販は【婦人画報のお取り寄せ】",
        "expect": "drop",
        "expect_reason": "blocked_domain (magazine curation shop)",
    },
    {
        "label": "tabisuruwagashi.com (wagashi curation shop, not a brand)",
        "title": "旅するように和菓子と出逢う",
        "url": "https://www.tabisuruwagashi.com/",
        "description": "和菓子を探す カテゴリーから探す 都道府県から探す お店から探す しぼりこみ検索",
        "expect": "drop",
        "expect_reason": "blocked_domain + portal_page (curation shop)",
    },
    {
        "label": "sazae.co.jp/journal (editorial article, not a brand homepage)",
        "title": "季節",
        "url": "https://www.sazae.co.jp/journal/wagashi-shurui/",
        "description": "【和菓子の種類を徹底解説！】分類・季節・人気ランキングまで詳しく紹介 | サザエの食卓ジャーナル",
        "expect": "drop",
        "expect_reason": "article_page (journal path segment)",
    },
    {
        "label": "generic category noun as a 'brand name' (和菓子 itself)",
        "title": "和菓子の種類",
        "url": "https://wagashi.or.jp/monogatari/shiru/syurui/",
        "description": "和菓子の種類 | 全国和菓子協会",
        "expect": "drop",
        "expect_reason": "blocked_domain (trade association) + generic_category_word",
    },
    {
        "label": "pornhub.com (adult content, surfaced once for an unrelated bakery query)",
        "title": "Pornhub.com",
        "url": "https://www.pornhub.com/video/search?search=free+tube+pleasure",
        "description": "Pornhub is the world's leading free porn site",
        "expect": "drop",
        "expect_reason": "adult_content",
    },

    # --- should be KEPT (real candidates, to guard against over-blocking) ---
    {
        "label": "Confiteria ARVA (real small Spanish confectionery, has its own domain)",
        "title": "Confiteria ARVA",
        "url": "https://confiteriaarva.com/",
        "description": "Bienvenidos a Confitería Arva Pastelería, confitería y bombonería tradicional en Ourense desde 1932",
        "expect": "keep",
    },
    {
        "label": "Bäckerhaus Veit (real German bakery, award-winning)",
        "title": "Willkommen - Bäckerhaus Veit",
        "url": "https://www.baeckerhaus-veit.de/",
        "description": "Bäckerhaus Veit - traditionelles Bäckerei-Handwerk mit regionalen Produkten",
        "expect": "keep",
    },
    {
        "label": "small Japanese shop on myshopify.com (must NOT be blocked just for the platform)",
        "title": "ちひろ菓子店",
        "url": "https://chihirosweets.myshopify.com/",
        "description": "ちひろ菓子店｜厳選素材の焼き菓子専門店",
        "expect": "keep",
    },
    {
        # Locks in a real regression: is_recipe_page's title/description check used to
        # apply regardless of path, and dropped this real manufacturer (Kerjeanne,
        # founded 1963) purely because its OWN root-page SEO title says "Recette"
        # ("La véritable Recette de ... par Kerjeanne" -- a marketing hook, not an
        # article). The fix restricts the title/snippet check to non-root paths only.
        "label": "patisseriebretonne.fr root page with an SEO title containing 'Recette' (must NOT be treated as a recipe article)",
        "title": "La véritable Recette de Kouign Amann Breton par Kerjeanne",
        "url": "https://patisseriebretonne.fr/",
        "description": "CONTACTEZ-NOUS : 02 97 55 38 97 | NOTRE SAVOIR-FAIRE | NOTRE MAGASIN | Atelier de Pâtisserie Bretonne | Fabricant artisanal depuis 1963",
        "expect": "keep",
    },
    {
        "label": "Comptoir des Flandres (real French confiserie)",
        "title": "Comptoir des Flandres",
        "url": "https://www.comptoirdesflandres.com/produit/betises-de-cambrai-coquelicot-125g/",
        "description": "Bêtises de Cambrai - boutique en ligne de confiserie artisanale",
        "expect": "keep",
    },
    # --- previously FALSE NEGATIVES, fixed by domain_matches_name's token-overlap
    # fallback -- word-order/partial-name mismatches a whole-string containment check
    # alone can't catch. Locked in here so a future change to that fallback can't
    # silently re-break these without this suite catching it.
    {
        "label": "Confiserie Afchain (shares a token with its domain, not a whole-string match)",
        "title": "Confiserie Afchain",
        "url": "https://betises-afchain.com/",
        "description": "Confiserie Afchain, fabricant des véritables Bêtises de Cambrai depuis 1830",
        "expect": "keep",
    },
    {
        "label": "Printenbäckerei Klein (brand name word order reversed vs. its domain)",
        "title": "Printenbäckerei Klein",
        "url": "http://www.klein-printen.de/",
        "description": "Printenbäckerei Klein - Aachener Printen seit 1858",
        "expect": "keep",
    },
    {
        # Flipped from "keep" to "drop": the only shared token with its domain is
        # "biscuiterie" itself, which _GENERIC_MATCH_TOKENS now correctly excludes (it's
        # an industry noun, not evidence of which specific biscuiterie this is -- a
        # trade magazine's domain would share the exact same word). String-matching
        # can't tell these apart; that's a real, currently-unfixed gap for 2-stage
        # harvest or an LLM site-type classifier to close later, same class as the two
        # cases noted below.
        "label": "Biscuiterie de Saint-Guénolé (only shares the generic 'biscuiterie' token -- can't be told apart from a trade magazine by string alone)",
        "title": "Biscuiterie de Saint-Guénolé",
        "url": "https://biscuiterie-sg.fr/",
        "description": "Biscuiterie de Saint-Guénolé, biscuits bretons artisanaux",
        "expect": "drop",
    },
    # --- adversarial junk constructed specifically to probe the token-overlap fallback
    # above -- real regression found and fixed: a bare length>=4 guard let 9/9 of these
    # through, since a magazine/directory/blog domain routinely shares an industry or
    # product noun with a real brand's name. These must all stay "drop".
    {
        "label": "chocolate-blog.de (shares only the generic 'chocolate')",
        "title": "Chocolate Museum Cologne",
        "url": "https://chocolate-blog.de/",
        "description": "",
        "expect": "drop",
    },
    {
        "label": "artisan-directory.com (shares only the generic 'artisan')",
        "title": "Artisan Bakery Guide",
        "url": "https://artisan-directory.com/",
        "description": "",
        "expect": "drop",
    },
    {
        "label": "biscuiterie-magazine.fr (shares only the generic 'biscuiterie')",
        "title": "Biscuiterie du Moulin",
        "url": "https://biscuiterie-magazine.fr/",
        "description": "",
        "expect": "drop",
    },
    {
        "label": "lebkuchen-portal.de (shares only the generic 'lebkuchen')",
        "title": "Lebkuchen Welt",
        "url": "https://lebkuchen-portal.de/",
        "description": "",
        "expect": "drop",
    },
    {
        "label": "shortbread-reviews.co.uk (shares only the generic 'shortbread')",
        "title": "Best Shortbread Brands",
        "url": "https://shortbread-reviews.co.uk/",
        "description": "",
        "expect": "drop",
    },
    {
        "label": "turron-guia.es (shares only the generic 'turron'/'guia' -- Spanish guide site)",
        "title": "Turron Artesano Guia",
        "url": "https://turron-guia.es/",
        "description": "",
        "expect": "drop",
    },

    # --- real brand recovered by the concatenated-domain substring fallback (a domain
    # with no hyphen/separator at all never tokenizes the way "klein-printen" does, so
    # the plain token-SET intersection used for the other recoveries above can't fire
    # even though the real word is sitting right there in the domain) ---
    {
        "label": "Pasticceria Fraccaro on a concatenated domain (fraccaro+spumadoro, no separator)",
        "title": "Pasticceria Fraccaro",
        "url": "https://www.fraccarospumadoro.it/",
        "description": "Pasticceria Fraccaro Spumadoro, dal 1932",
        "expect": "keep",
    },

    # NOTE: three cases are deliberately NOT fixtures here -- all real, currently-
    # unfixed gaps (would need a brand-name/maker knowledge base or an LLM call), not
    # something to encode as an expected outcome this suite would just fail on forever:
    # - "Bêtises de Cambrai" / afchain.com (the maker's surname vs. the product name,
    #   zero shared tokens)
    # - "Le Roy René" / calisson.com (maker's name vs. a generic product-category word
    #   used as the domain)
    # - "Wagashi Collection" / wagashi-collection.jp -- a junk curation site whose own
    #   title literally IS its domain name, so it passes the very first whole-string
    #   containment check (same shape as frenchquarter.com) before the token-overlap
    #   fallback is ever reached. This one isn't a token-matching problem at all --
    #   it's the same "domain legitimately matches its own name, but its own name isn't
    #   a brand" blind spot domain_matches_name's docstring already describes for news/
    #   directory sites, just for a site whose name happens to look product-related.
]
