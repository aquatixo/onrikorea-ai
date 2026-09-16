# Mirrors src/lib/brand-sourcing/discovery-buckets.ts -- kept as a separate list since
# this is a different language/runtime. If you add a category on one side, add it here too.
#
# Region-specific queries (Nordic/Baltic, UK/Ireland, Oceania) are here on purpose: a
# generic English query like "heritage chocolate brand family owned" mostly surfaces
# US content-farm listicles ("Top 10 Chocolate Brands"), not small regional producers.
# Naming an actual country/region steers results toward that country's own web presence
# instead, which is much more likely to be the brand's own (smaller, less SEO-optimized)
# site rather than a big US media roundup.

BUCKETS = [
    {
        "label": "Python Sourcing — Snacks",
        "category": "Snacks",
        "queries": [
            "heritage savory snack brand family owned since 19",
            "oldest independent chips crackers brand history",
            "Nordic family owned snack brand since 19",
            "New Zealand Australia heritage snack brand family owned",
        ],
    },
    {
        "label": "Python Sourcing — Biscuits & Shortcakes",
        "category": "Biscuits & Shortcakes",
        "queries": [
            "heritage biscuit shortbread shortcake brand family owned",
            "Scottish Irish heritage biscuit shortbread brand family owned",
            "Nordic Baltic heritage biscuit brand since 19",
        ],
    },
    {
        "label": "Python Sourcing — Confectionery & Candy",
        "category": "Confectionery & Candy",
        "queries": [
            "heritage candy confectionery brand family owned since 19",
            "Nordic Baltic heritage confectionery candy brand since 19",
            "Ireland UK heritage sweets confectionery brand family owned",
        ],
    },
    {
        "label": "Python Sourcing — Jellies & Gummies",
        "category": "Jellies & Gummies",
        "queries": [
            "heritage fruit jelly gummy candy brand family owned",
            "Nordic heritage fruit jelly gummy candy brand since 19",
        ],
    },
    {
        "label": "Python Sourcing — Chocolate",
        "category": "Chocolate",
        "queries": [
            "heritage chocolate brand family owned since 19 bars pralines",
            "Ireland UK heritage chocolate brand family owned",
            "Nordic Baltic heritage chocolate brand since 19",
        ],
    },
    {
        "label": "Python Sourcing — Nutritional Supplements",
        "category": "Nutritional Supplements",
        "queries": [
            "heritage nutritional supplement vitamin brand family owned",
            "New Zealand Australia heritage supplement vitamin brand family owned",
        ],
    },
    {
        "label": "Python Sourcing — Baby Cereal & Porridge",
        "category": "Baby Cereal & Porridge",
        "queries": [
            "heritage baby cereal infant porridge brand family owned",
            "Nordic Baltic heritage baby cereal porridge brand since 19",
        ],
    },
]
