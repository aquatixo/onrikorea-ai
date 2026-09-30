# Mirrors src/lib/brand-sourcing/discovery-buckets.ts -- kept as a separate list since
# this is a different language/runtime. If you add a category on one side, add it here too.
#
# Rebuilt around a REGION axis instead of a PRODUCT-CATEGORY axis, per a master-list
# country-distribution check (1,616 rows, 2026-09-22 snapshot): US 245 / UK 154 /
# Italy 123 / France 61 / Japan 50 / Germany 46 vs. Turkey 18 / Poland 17 / Sweden 15 /
# Greece 12 / Portugal 8 / Finland 7 / Czechia 6 / Hungary 6 / Iceland 3. The old
# category-shaped buckets (Snacks/Biscuits/Baking/Confectionery/Jellies/Chocolate) were
# mostly generic-English queries that just re-searched the countries already saturated
# in the master list, driving up duplicate-candidate rates. Each bucket below instead
# targets one of the most under-covered regions, in that region's own language --
# these are the small, non-SEO'd family producers that never surface in a generic
# English "heritage snack brand" search to begin with.
#
# Each bucket also layers in higher-yield, more mechanical sourcing channels beyond a
# plain web search, in roughly descending yield order:
#   1. local specialty-item name + local-language "family business" phrasing
#   2. local-language anniversary/founding-year phrasing ("100 Jahre", "desde 18",
#      "vuodesta 19") -- a bare "since 19" is NOT a real date filter (a search engine
#      does not parse "19" as "any year starting with 19"; it just adds two more
#      low-signal keyword tokens), so every founding-year query below spells out a
#      real anniversary phrase or a two-digit-century prefix in the target language.
#   3. PDO/PGI protected-origin producer lists and trade-association member rosters --
#      these are literal lists of qualifying producers, the highest-yield source type
#      available without a specialized directory
#   4. food-award winner/finalist lists (award pages are almost always a clean list)
#   5. trade-fair exhibitor directories -- self-selects for producers that already want
#      export/distribution partners, which is exactly this pipeline's target
#
# Dropped entirely (not just deprioritized):
#   - Nutritional Supplements: outside this pipeline's target category scope --
#     supplements go through an entirely different import-declaration/functional-claim
#     approval track and shouldn't be mixed into a food-brand sourcing run.
#   - Baby Cereal & Porridge: direct category overlap with an existing partner
#     relationship (Organix) -- only ever had 2 master-list rows, which reflects
#     deliberate avoidance, not an unmined gap.
#   - The old Nordic-focused snack/jelly queries specifically: that shelf is already a
#     confirmed oligopoly (KiMs, OK Snacks, Maarud, Sørlandschips), so re-querying it
#     in English was a guaranteed-empty search.
# Japan is left as-is (recently reworked on its own) since the country-distribution
# check doesn't cover it either way.
#
# Each lane's queries were later enriched with concrete local specialty-item vocabulary
# (Polish ptasie mleczko, Hungarian pogácsa, Finnish korvapuusti, Icelandic kleina/
# flatkaka, Greek melomakarona/kourabiedes, Turkish kurabiye, French canelé/pâte de
# fruit, German Zwetschgenmännla/Brause, Nordic vingummi/skumbanan) rather than only
# generic "heritage [category] brand" phrasing -- a fixed query list still only gets
# one good pass per real-world vocabulary item it names, so the more concrete specialty
# terms it covers, the less it depends on the family-owned/anniversary phrasing alone to
# carry a whole lane. This also restores jelly/gummy-candy coverage (dropped along with
# the old English-only Jellies & Gummies bucket) via each lane's own local term for it,
# instead of a generic English "gummy candy" category query that doesn't map to any
# single local vocabulary the way e.g. "biscuit" roughly does.

BUCKETS = [
    {
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
        # 마스터 8건 -- 가장 얇은 지역 중 하나
        "label": "Python Sourcing — Portugal",
        "category": "혼합",
        "queries": [
            "fábrica de bolachas tradicionais portuguesas desde 18",
            "pastéis secos conventuais fábrica artesanal Portugal",
            "torrão de ovos amêndoa doçaria conventual produtor",
            "broas castelares bolos secos fabrico artesanal",
            "torrefação de café histórica Portugal empresa familiar",
            "queijadas fábrica tradicional Sintra Évora",
            "mais antiga fábrica de bolachas de Portugal",
            "doçaria conventual portuguesa 100 anos empresa familiar",
            # PDO/PGI 생산자 명단
            "IGP DOP doçaria portuguesa lista de produtores",
            # 박람회 출품사
            "SISAB Portugal expositores doces bolachas",
            # 젤리/구미류 -- 포르투갈어 특산 어휘
            "gomas de fruta fábrica artesanal Portugal",
        ],
    },
    {
        # 마스터 폴란드 17 · 체코 6 · 헝가리 6
        "label": "Python Sourcing — Poland, Czechia & Hungary",
        "category": "혼합",
        "queries": [
            # 폴란드어
            "pierniki toruńskie tradycyjna piekarnia rodzinna",
            "krówki cukierki tradycyjne producent od 19",
            "fabryka cukierków rodzinna tradycja Polska",
            "opłatki wafle tradycyjne producent Polska",
            # "새 발 우유"라는 뜻의 폴란드 국민 사탕 -- 크루프키(krówki)와 별개 품목
            "ptasie mleczko cukiernia tradycyjna rodzinna Polska",
            # 체코어
            "lázeňské oplatky Karlovy Vary výrobce rodinná firma",
            "perník tradiční výroba Pardubice rodinná",
            "čokoládovna tradiční česká rodinná firma od roku",
            # 헝가리어
            "kürtőskalács szaloncukor hagyományos gyártó családi",
            "cukrászda manufaktúra magyar családi alapítva",
            # 헝가리 전통 짭짤한 패스트리 (스콘형) -- 단맛류 쪽만 있던 헝가리 쿼리 보완
            "pogácsa hagyományos pékség családi vállalkozás Magyarország",
            # 협회/박람회
            "tradycyjna żywność lista producentów regionalnych Polska",
            "Polagra Food wystawcy słodycze producenci",
        ],
    },
    {
        # 마스터 스웨덴 15 · 핀란드 7 · 아이슬란드 3
        # 덴마크/노르웨이 스낵·베이킹은 KiMs/OK Snacks/Maarud/Sørlandschips 완전 과점
        # 확인됨 -- 독립 헤리티지 브랜드가 없어 이 레인에서 의도적으로 제외.
        "label": "Python Sourcing — Sweden, Finland & Iceland",
        "category": "혼합",
        "queries": [
            # 스웨덴어
            "polkagris tillverkning familjeföretag sedan 18",
            "pepparkakor knäckebröd familjeägt bageri sedan",
            "lakritsfabrik kola karamell svensk familjeföretag",
            "chokladfabrik svensk familjeägd sedan 19",
            # 젤리/구미류 (스웨덴어) -- vingummi(와인검)·skumbanan(폼바나나) 등 북유럽 젤리 품목명
            "vingummi skumbanan godisfabrik familjeföretag Sverige",
            # 핀란드어
            "salmiakki lakritsi valmistaja perheyritys vuodesta",
            "piparkakku näkkileipä leipomo perheyritys Suomi",
            "suomalainen makeistehdas perheyritys vuodesta 19",
            # 핀란드 헤리티지 시나몬빵 -- 단맛류 위주였던 핀란드 쿼리에 베이킹 품목 보완
            "korvapuusti perinteinen leipomo perheyritys Suomi",
            # 아이슬란드어
            "lakkrís sælgætisgerð íslensk fjölskyldufyrirtæki",
            "íslenskt kex bakarí frá 19",
            # 아이슬란드 전통 페이스트리 (꽈배기형 도넛/플랫브레드)
            "kleina flatkaka bakstur íslensk fjölskyldufyrirtæki",
            # 박람회
            "Matmässan Nordic Organic Food Fair utställare godis kex",
        ],
    },
    {
        # 마스터 그리스 12 · 튀르키예 18
        "label": "Python Sourcing — Greece & Turkey",
        "category": "혼합",
        "queries": [
            # 그리스어
            "παραδοσιακά κουλουράκια μπισκότα οικογενειακή βιοτεχνία",
            "μαστίχα Χίου προϊόντα παραγωγός ένωση",
            "παστέλι λουκούμι παραδοσιακό εργαστήριο από το 19",
            "ελληνικός καφές παραδοσιακό καβουρδιστήρι οικογενειακή",
            # 그리스 명절 전통과자 (꿀쿠키/버터쿠키) -- 지금까지 없었던 품목
            "μελομακάρονα κουραμπιέδες παραδοσιακό οικογενειακό εργαστήριο",
            # 터키어
            "geleneksel lokum imalathanesi aile şirketi kuruluş 18",
            "pişmaniye helva üretimi aile firması geleneksel",
            "leblebi kuruyemiş geleneksel üretici aile",
            "Türk kahvesi kavurma fabrikası aile şirketi 19",
            # 터키 전통 쿠키 -- 로쿰/헬바 위주였던 쿼리에 제과 품목 보완
            "kurabiye geleneksel tarif aile fırını Türkiye",
            # PDO/PGI 생산자 명단
            "Χίος Μαστίχα ΠΟΠ παραγωγοί κατάλογος",
            "coğrafi işaretli Türk gıda üreticileri listesi lokum",
        ],
    },
    {
        # 마스터 프랑스 61건이나 파리/대형 브랜드 편중 추정 -- 지방 특산으로 한정
        "label": "Python Sourcing — France (Regional)",
        "category": "혼합",
        "queries": [
            "biscuiterie bretonne artisanale galette palet entreprise familiale",
            "kouign-amann fabrication artisanale Bretagne maison depuis",
            "bredele bretzel sucré biscuiterie alsacienne familiale",
            "calisson d'Aix confiserie artisanale maison depuis 18",
            "berlingot bêtises de Cambrai confiserie artisanale famille",
            "gâteau basque conserverie artisanale Pays Basque maison",
            "nougat de Montélimar fabrique artisanale famille depuis",
            "torréfacteur artisanal français maison familiale depuis 18",
            # 보르도 지방 특산 (카늘레) -- 지금까지 아키텐 지방이 빠져있었음
            "canelé bordelais fabrication artisanale maison depuis",
            # 젤리/구미류 (프랑스어 특산 어휘, "gummy"에 대응하는 현지 개념이 따로 없음)
            "pâte de fruit confiserie artisanale française maison depuis",
            # PDO/PGI/수상
            "IGP label rouge confiserie biscuiterie liste des producteurs",
            "Entreprise du Patrimoine Vivant biscuiterie confiserie liste",
        ],
    },
    {
        # 마스터 독일 46건 -- 대도시/대형 브랜드 편중 추정, 지방 특산으로 한정
        "label": "Python Sourcing — Germany & Austria (Regional)",
        "category": "혼합",
        "queries": [
            "Nürnberger Lebkuchen Familienbetrieb seit 18 Manufaktur",
            "Aachener Printen Traditionsbäckerei Familienbetrieb",
            "Dresdner Stollen Bäckerei Familienbetrieb seit",
            "Springerle Schwäbisch Gebäck Manufaktur Familienbetrieb",
            "Bonbonkocherei Manufaktur handgemacht Familienbetrieb seit 18",
            "Kaffeerösterei Traditionsunternehmen Familienbetrieb seit 18",
            "Tiroler Lebkuchen Konditorei Familienbetrieb seit",
            # 바이에른 지방 특산 -- 뉘른베르크 전통 자두인형 과자, 발포성 캔디가루(Brause)
            "Zwetschgenmännla Nürnberger Manufaktur Familienbetrieb",
            "Brause Manufaktur Familienbetrieb Süßwaren seit 18",
            # PDO/PGI/박람회
            "geschützte geografische Angabe Gebäck Süßwaren Hersteller Liste",
            "ISM Köln Aussteller Familienunternehmen Gebäck",
            "Slow Food Presidio Deutschland Süßwaren Hersteller",
        ],
    },
    {
        # 지역 무관 -- 리스트 형태라 추출 효율이 가장 높은 채널만 모음 (수상작/박람회 출품사)
        "label": "Python Sourcing — Awards & Trade Fair Exhibitors",
        "category": "혼합",
        "queries": [
            "Great Taste Awards 3 star winners biscuits confectionery producer list",
            "Farm Shop and Deli Awards finalists snacks bakery",
            "World Food Innovation Awards confectionery finalists",
            "Slow Food Presidia list biscuits confectionery producers",
            "Anuga exhibitor list fine food confectionery family company",
            "SIAL Paris exhibitor directory biscuits confectionery",
            "ISM Cologne exhibitor list sweets bakery small producer",
            "Biofach exhibitor list organic snacks biscuits",
            "Speciality and Fine Food Fair exhibitor list producers",
        ],
    },
]
