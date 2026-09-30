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
#
# A country being saturated overall (Spain 44, UK 154, Italy 123) doesn't mean every
# region within it is -- narrowing to a specific under-mined subregion (northern Spain,
# Scotland/Wales/Northern Ireland, southern Italy, French/German regions) stays valid.
# The Netherlands has its own lane too, having had no coverage at all before. This list
# still isn't an automatic "rotate to whichever regions are least-covered this round"
# mechanism -- it's a fixed set that will itself need a fresh look once these lanes dry
# up too.
#
# Query-construction rule (revised after real feedback on the first cut): ONE specialty
# item per query, not several ("ferratelle pizzelle torrone tenero pasticceria storica
# famiglia Abruzzo" reads as 6 concepts a search engine loosely ANDs together -- the only
# pages mentioning all 6 are blog listicles, not an actual ferratelle producer's own
# site, which never talks about torrone on the same page). Each query below instead
# follows: [one specialty item] + [manufacturer noun] + [region], optionally with a
# recipe-site exclusion operator (a bare specialty name alone mostly surfaces recipe
# blogs, not producers) or a quoted exact anniversary phrase. Two extra techniques:
#   - Manufacturer nouns matter more than the specialty name -- "ferratelle" alone
#     surfaces recipes; "ferratelle produttore/pastificio/azienda" surfaces businesses.
#   - Company-name-suffix search: suffixes like -ificio (Italian), -erie (French),
#     -ería (Spanish) are baked into real company names ("Torronificio Marotto"), so
#     suffix + region alone can surface a producer by name pattern -- something no
#     category-shaped query could ever do.
# Manufacturer nouns by language: IT azienda/produttore/pastificio/torronificio/
# biscottificio/forno/laboratorio/fabbrica/pasticceria; ES fábrica/obrador/elaborador/
# productor/confitería/pastelería; FR maison/fabrique/biscuiterie/confiserie/
# torréfacteur/atelier; DE Manufaktur/Bäckerei/Konditorei/Rösterei/Familienbetrieb/
# Hersteller; PT fábrica/fabrico/produtor/pastelaria/torrefação; PL wytwórnia/fabryka/
# piekarnia/cukiernia/producent; SV tillverkare/bruk/bageri/fabrik; FI valmistaja/
# leipomo/tehdas; NL fabriek/bakkerij/makerij/producent; EL βιοτεχνία/εργαστήριο/
# παραγωγός; TR imalathane/üretici/fabrikası/fırını.
#
# Japan is left exactly as edited (English queries trimmed to bare category terms,
# Japanese queries trimmed to bare product nouns with no "老舗"/anniversary/"family
# business" framing) -- NOTE: a second round of outside feedback specifically flagged
# this as likely too far ("老舗" was a real, correct signal to search on; the Japanese
# equivalent of a quoted anniversary phrase would be founding-era terms like "創業明治"/
# "創業大正", and shop-name-suffix words like 総本家/総本舗 parallel to the -ificio/-erie
# trick above). Not silently reverted here since the user explicitly stripped it down
# on purpose, more than once -- flagging it in this comment instead so it's a visible,
# deliberate choice rather than something a future edit quietly undoes.

BUCKETS = [
    {
        "label": "Python Sourcing — Japan (Heritage Snacks & Confectionery)",
        "category": "Snacks",
        "queries": [
            "heritage Japanese snack confectionery brand",
            "Japanese candy snack maker",
            "traditional Japanese wagashi",
            "菓子店",
            "和菓子",
            "食品メーカー 菓子",
        ],
    },
    {
        # 마스터 8건 -- 가장 얇은 지역 중 하나
        "label": "Python Sourcing — Portugal",
        "category": "혼합",
        "queries": [
            "bolachas tradicionais fábrica Portugal -receita",
            "pastéis conventuais doçaria artesanal Portugal -receita",
            "torrão de ovos fábrica artesanal Portugal -receita",
            "broas castelares fabrico artesanal Portugal -receita",
            "torrefação de café histórica Portugal -receita",
            "queijadas Sintra fábrica tradicional -receita",
            "gomas de fruta fábrica artesanal Portugal -receita",
            '"desde 18" fábrica doces Portugal',
            # PDO/PGI 생산자 명단 · 박람회
            "IGP DOP doçaria portuguesa lista de produtores",
            "SISAB Portugal expositores doces bolachas",
        ],
    },
    {
        # 마스터 폴란드 17 · 체코 6 · 헝가리 6
        "label": "Python Sourcing — Poland, Czechia & Hungary",
        "category": "혼합",
        "queries": [
            # 폴란드어
            "pierniki toruńskie wytwórnia rodzinna -przepis",
            "krówki cukiernia tradycyjna Polska -przepis",
            "ptasie mleczko fabryka Polska -przepis",
            "opłatki wafle producent Polska -przepis",
            '"od 18" cukiernia tradycja Polska',
            # 체코어
            "lázeňské oplatky výrobce Karlovy Vary -recept",
            "perník výroba Pardubice rodinná -recept",
            "čokoládovna tradiční Česká republika -recept",
            # 헝가리어
            "kürtőskalács gyártó családi Magyarország -recept",
            "szaloncukor manufaktúra Magyarország -recept",
            "pogácsa pékség családi Magyarország -recept",
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
            "polkagris tillverkare Sverige -recept",
            "pepparkakor bageri familjeägt Sverige -recept",
            "knäckebröd bruk familjeägt Sverige -recept",
            "lakritsfabrik svensk familjeföretag -recept",
            "chokladfabrik svensk familjeägd -recept",
            "vingummi godisfabrik Sverige -recept",
            "skumbanan godisfabrik Sverige -recept",
            # 핀란드어
            "salmiakki valmistaja perheyritys Suomi -resepti",
            "piparkakku leipomo perheyritys Suomi -resepti",
            "näkkileipä tehdas perheyritys Suomi -resepti",
            "korvapuusti leipomo perheyritys Suomi -resepti",
            # 아이슬란드어
            "lakkrís sælgætisgerð íslensk -uppskrift",
            "kleina bakarí íslenskt fjölskyldufyrirtæki -uppskrift",
            "flatkaka bakstur íslenskt fjölskyldufyrirtæki -uppskrift",
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
            "κουλουράκια βιοτεχνία οικογενειακή -συνταγή",
            "μαστίχα Χίου παραγωγός -συνταγή",
            "παστέλι εργαστήριο παραδοσιακό -συνταγή",
            "λουκούμι εργαστήριο παραδοσιακό -συνταγή",
            "ελληνικός καφές καβουρδιστήριο οικογενειακό -συνταγή",
            "μελομακάρονα εργαστήριο οικογενειακό -συνταγή",
            "κουραμπιέδες εργαστήριο οικογενειακό -συνταγή",
            # 터키어
            "lokum imalathanesi aile şirketi -tarif",
            "pişmaniye üretimi aile firması -tarif",
            "leblebi üretici aile Türkiye -tarif",
            "Türk kahvesi kavurma fabrikası aile -tarif",
            "kurabiye fırını aile Türkiye -tarif",
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
            "galette bretonne biscuiterie artisanale -recette",
            "kouign-amann fabrique artisanale Bretagne -recette",
            "bredele biscuiterie alsacienne familiale -recette",
            "calisson d'Aix confiserie artisanale -recette",
            "bêtises de Cambrai confiserie artisanale -recette",
            "gâteau basque maison artisanale Pays Basque -recette",
            "nougat de Montélimar fabrique artisanale -recette",
            "canelé bordelais fabrique artisanale -recette",
            "pâte de fruit confiserie artisanale française -recette",
            "torréfacteur artisanal maison familiale française -recette",
            '"depuis 18" biscuiterie confiserie France',
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
            "Nürnberger Lebkuchen Manufaktur -Rezept",
            # Lebküchnerei -- 뉘른베르크 진저브레드 제조사를 부르는 고유 직업명, 회사 이름 자체에
            # 들어가는 접미사형 단어 (-ificio/-erie와 같은 트릭)
            "Lebküchnerei Nürnberg Familienbetrieb -Rezept",
            "Aachener Printen Bäckerei Familienbetrieb -Rezept",
            "Dresdner Stollen Bäckerei Familienbetrieb -Rezept",
            "Springerle Konditorei Familienbetrieb Schwaben -Rezept",
            "Bonbonkocherei Manufaktur handgemacht -Rezept",
            "Kaffeerösterei Familienbetrieb Deutschland -Rezept",
            "Tiroler Lebkuchen Konditorei Familienbetrieb -Rezept",
            "Zwetschgenmännla Manufaktur Nürnberg -Rezept",
            "Brause Manufaktur Süßwaren -Rezept",
            '"seit 18" Manufaktur Familienbetrieb Süßwaren',
            # PDO/PGI/박람회
            "geschützte geografische Angabe Gebäck Süßwaren Hersteller Liste",
            "ISM Köln Aussteller Familienunternehmen Gebäck",
            "Slow Food Presidio Deutschland Süßwaren Hersteller",
        ],
    },
    {
        # 스페인 전체(44건)는 포화지만, 북부(바스크·나바라·라리오하·아라곤·칸타브리아·
        # 아스투리아스·갈리시아)로 좁히면 여전히 유효 -- 프랑스/독일과 같은 논리. mantecados/
        # polvorones/mazapán 등 이전 버전에 있던 품목은 실제로는 남부(안달루시아)·중부(톨레도)
        # 특산이라 이 레인(북부)과 안 맞아 빼고, 확실히 북부인 것만 남김.
        "label": "Python Sourcing — Spain (Northern Regional)",
        "category": "혼합",
        "queries": [
            "sobao pasiego obrador Cantabria -receta",
            "casadielles obrador Asturias -receta",
            "confitería artesanal tradicional Galicia -receta",
            "confitería artesanal tradicional País Vasco -receta",
            "turrón mazapán obrador familiar Aragón Navarra -receta",
            '"desde 18" obrador dulces España',
            # PDO/PGI 생산자 명단
            "IGP DOP dulces tradicionales norte España lista de productores",
        ],
    },
    {
        # 영국(154건)은 전체로는 포화지만, 스코틀랜드·웨일스·북아일랜드는 잉글랜드와
        # 어휘·브랜드가 아예 다른 별개 시장 -- 지방 단위로 좁히면 여전히 유효.
        "label": "Python Sourcing — UK (Scotland, Wales & Northern Ireland)",
        "category": "혼합",
        "queries": [
            "oatcake bakery family owned Scotland -recipe",
            "tablet confectioner family owned Scotland -recipe",
            "Edinburgh rock maker family owned -recipe",
            "shortbread bakery family owned Scotland -recipe",
            "Welsh cake bakery family owned Wales -recipe",
            "bara brith bakery family owned Wales -recipe",
            "brown lemonade maker Northern Ireland family owned -recipe",
            # 수상
            "Great Taste Awards Scottish Welsh Northern Irish confectionery producer list",
        ],
    },
    {
        # 네덜란드 -- 지금까지 어느 레인에도 없던 완전 공백 지역
        "label": "Python Sourcing — Netherlands",
        "category": "혼합",
        "queries": [
            "stroopwafel bakkerij familiebedrijf -recept",
            "drop fabriek Nederlands familiebedrijf -recept",
            "speculaas bakkerij familiebedrijf Nederland -recept",
            '"sinds 18" bakkerij familiebedrijf Nederland',
        ],
    },
    {
        # 이탈리아 전체(123건)는 포화지만, 남부(아브루초·풀리아·칼라브리아·바실리카타·
        # 몰리세)는 파리/밀라노/피렌체 편중과 무관한 별개 특산 어휘권 -- 지방 단위로 좁히면 유효.
        "label": "Python Sourcing — Italy (Southern Regional)",
        "category": "혼합",
        "queries": [
            "ferratelle produttore Abruzzo -ricetta",
            "pizzelle abruzzesi azienda famiglia -ricetta",
            "torrone tenero pasticceria storica L'Aquila -ricetta",
            "confetti di Sulmona fabbrica artigianale -ricetta",
            "mostaccioli pasticceria storica famiglia Abruzzo -ricetta",
            "bocconotti pasticceria storica Abruzzo -ricetta",
            # 상호 접미사 트릭 (-ificio = "그걸 만드는 곳")
            "torronificio Puglia Calabria",
            "biscottificio storico Puglia",
            "taralli forno tradizionale Puglia -ricetta",
            "liquirizia calabrese fabbrica storica -ricetta",
            # PDO/PGI 생산자 명단
            "consorzio tutela IGP dolci tipici Sud Italia elenco produttori",
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
