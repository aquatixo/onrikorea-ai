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
            # 스코틀랜드 특산 품목명 직접 사용 -- "heritage biscuit"보다 실제 브랜드를
            # 훨씬 잘 찾아낸다 (오트케이크/타블렛/에딘버러락은 일반 쿼리로 잘 안 나옴)
            "Scottish oatcake tablet Edinburgh rock family owned since 19",
            # 현지어(프랑스어)
            "biscuiterie traditionnelle française depuis 19 entreprise familiale",
            "meilleure biscuiterie artisanale France histoire familiale",
            # 현지어(독일어) -- Lebkuchen/Printen은 영어 쿼리로 거의 안 나온다
            "Lebkuchen Printen traditionelle Bäckerei Familienbetrieb seit 18",
            # 현지어(네덜란드어)
            "traditionele Nederlandse stroopwafel speculaas bakkerij familiebedrijf",
            # 현지어(스웨덴어)
            "pepparkakor knäckebröd svenskt familjeföretag sedan 19",
            # 현지어(스페인어) -- 갈레타(비스킷)는 스페인/포르투갈 쪽 산업이 커서 영어로는 거의 안 나옴
            "galletas tradicionales fábrica familiar España desde 19",
        ],
    },
    {
        "label": "Python Sourcing — Baking (Panettone, Viennoiserie)",
        "category": "Baking",
        "queries": [
            "oldest panettone pandoro maker Italy family owned",
            "traditional Italian panettone producer since 19 family business",
            "heritage French biscuiterie viennoiserie brand family owned",
            # 현지어(이탈리아어) -- 이 카테고리 자체가 이탈리아 특산품이라 현지어 쿼리가 핵심
            "miglior panettone artigianale pasticceria storica",
            "pasticceria storica panettone pandoro dal 19",
            "cantucci cantuccini biscotti toscani pasticceria storica famiglia",
            # 현지어(프랑스어)
            "biscuiterie viennoiserie artisanale française depuis 19",
            # 현지어(독일어) -- Stollen도 베이킹 완제품
            "Stollen Christstollen traditionelle Bäckerei Familienbetrieb seit 18",
        ],
    },
    {
        "label": "Python Sourcing — Confectionery & Candy",
        "category": "Confectionery & Candy",
        "queries": [
            "heritage candy confectionery brand family owned since 19",
            "Nordic Baltic heritage confectionery candy brand since 19",
            "Ireland UK heritage sweets confectionery brand family owned",
            # 현지어(이탈리아어) -- torrone/panforte는 영어 쿼리로 거의 안 나온다
            "torrone artigianale storica azienda familiare Italia",
            "panforte confetti storica azienda dolciaria italiana",
            # 현지어(프랑스어) -- dragées/calisson/nougat
            "dragées calisson nougat confiserie artisanale française depuis 18",
            # 현지어(벨기에/프랑스어) -- 프랄린
            "pralines chocolat artisanal belge depuis 19 entreprise familiale",
            # 현지어(독일어) -- 마지팬
            "Marzipan Konditorei traditionell Familienbetrieb seit 18",
            # 터키/그리스 -- 로쿰(터키시딜라이트), 할바
            "Turkish delight lokum helva traditional family maker since 19",
            "traditional Greek loukoumi halva confectionery family business",
            # 중동/이집트 -- 지금까지 이 지역을 타겟하는 쿼리가 전혀 없었음
            "heritage Middle East Egypt confectionery halva dried fruit nuts family owned since 19",
            # 현지어(스페인어) -- 투론(누가)은 스페인 특산품, 영어 쿼리로는 거의 안 나옴
            "turrón artesanal fábrica familiar España desde 19",
            "confitería tradicional española desde 19 empresa familiar",
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
            # 현지어(이탈리아어) -- 잔두이오토
            "gianduiotto cioccolato artigianale storica azienda familiare Italia",
        ],
    },
    {
        # "Wagashi & Traditional Confectionery"라는 라벨/쿼리가 화과자·센베이 한 갈래로만
        # 너무 좁게 느껴진다는 피드백으로 일본 헤리티지 과자·간식 전반으로 범위를 넓힘
        # (사탕/젤리류 포함, 화과자는 그 안의 한 갈래로 유지).
        "label": "Python Sourcing — Japan (Heritage Snacks & Confectionery)",
        "category": "Snacks",
        "queries": [
            "heritage Japanese snack confectionery brand family owned since 19",
            "old Japanese candy snack maker family owned generations",
            "traditional Japanese wagashi senbei confectionery maker since 19",
            # 현지어(일본어) -- 老舗(노포/오래된 가게)가 핵심 검색어. "スナック"는 일본어에서
            # 흔히 술집(스낵바)을 뜻해 오해 소지가 있으므로 피하고 菓子/食品 계열 단어만 사용.
            "老舗 菓子店 創業",
            "老舗 和菓子 せんべい 製造 家族経営",
            "老舗 食品メーカー 菓子 創業 家族経営",
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
