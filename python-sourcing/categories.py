# Mirrors src/lib/brand-sourcing/discovery-buckets.ts -- kept as a separate list since
# this is a different language/runtime. If you add a category on one side, add it here too.
#
# Narrowed to countries whose branding/language a Korean consumer finds recognizable
# and reassuring at the point of purchase -- the "big 5" mainstream European languages
# (English/French/Italian/German/Spanish) plus Japan and the US. This REPLACES the
# earlier under-covered-region strategy (Portugal, Poland/Czechia/Hungary, Nordic,
# Greece/Turkey, Netherlands), which was built purely around master-list country-
# saturation data and explicitly produced candidates from countries whose language/
# script a Korean consumer won't recognize on a shelf. Business call, not a data-driven
# one -- consumer trust at the point of sale outweighs discovery efficiency here, and
# the saturated-country tradeoff (most of these already have the most master-list
# coverage, so expect a higher duplicate rate / lower per-query yield than the dropped
# regions had) is accepted knowingly.
#
# Query-construction rule (unchanged from the earlier region-axis work, still applies):
# ONE specialty item per query, not several -- a query naming several specialty items at
# once reads as multiple concepts a search engine loosely ANDs together, and the only
# pages mentioning all of them tend to be blog listicles, not an actual producer's own
# site. Each query instead follows: [one specialty item] + [manufacturer noun] +
# [region], optionally with a recipe-site exclusion operator (a bare specialty name alone
# mostly surfaces recipe blogs, not producers) or a quoted exact anniversary phrase.
# Company-name-suffix search (-ificio in Italian, -erie in French, etc.) is also used
# where a real such suffix exists, since it can surface a producer by name pattern alone.
#
# Japan is left exactly as previously edited (English queries trimmed to bare category
# terms, Japanese queries trimmed to bare product nouns, no "老舗"/anniversary/"family
# business" framing) -- that was the user's own deliberate repeated edit, not touched here.
#
# Each bucket's "label" is deliberately just a short country/region name now (was
# "Python Sourcing — Japan (Heritage Snacks & Confectionery)" etc.) -- the old long form
# didn't fit in the results table's methodology column at all. main.py prefixes it with
# the backend name at runtime (e.g. "Serper · Japan", "Tavily · France") when building
# the methodology string actually stored on each candidate, so the short label here is
# still only half of what ends up displayed.

BUCKETS = [
    {
        "label": "Japan",
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
        # 마스터 프랑스 61건이나 파리/대형 브랜드 편중 추정 -- 지방 특산으로 한정
        "label": "France",
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
        # 이탈리아 전체(123건)는 포화지만, 남부(아브루초·풀리아·칼라브리아·바실리카타·
        # 몰리세)는 파리/밀라노/피렌체 편중과 무관한 별개 특산 어휘권 -- 지방 단위로 좁히면 유효.
        "label": "Italy",
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
        # 마스터 독일 46건 -- 대도시/대형 브랜드 편중 추정, 지방 특산으로 한정
        "label": "Germany",
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
        # 아스투리아스·갈리시아)로 좁히면 여전히 유효. mantecados/polvorones/마자판 등은
        # 실제로는 남부(안달루시아)·중부(톨레도) 특산이라 이 레인(북부)과 안 맞아 빼고,
        # 확실히 북부인 것만 남김.
        "label": "Spain",
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
        "label": "UK",
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
        # 미국은 마스터 245건으로 가장 포화됐지만, 유명 전국 브랜드가 아니라 지역 특산
        # 품목(뉴잉글랜드 메이플캔디, 뉴저지 솔트워터타피, 찰스턴 베니웨이퍼, 뉴올리언스
        # 프랄린, 노스캐롤라이나 모라비안 쿠키 등)으로 좁혀서 소형 헤리티지 브랜드를 겨냥.
        "label": "USA",
        "category": "혼합",
        "queries": [
            "saltwater taffy shop family owned New Jersey -recipe",
            "maple candy producer Vermont family owned -recipe",
            "benne wafer bakery Charleston family owned -recipe",
            "pecan praline candy company New Orleans family owned -recipe",
            "peanut brittle candy company family owned Southern -recipe",
            "Moravian cookies bakery Winston-Salem family owned -recipe",
            "horehound candy old fashioned candy company family owned -recipe",
            "fudge shop Mackinac Island family owned -recipe",
            # 수상/박람회 (미국 특산식품협회 공식 시상식·무역박람회)
            "Specialty Food Association sofi Award winners candy confectionery",
            "Fancy Food Show exhibitor directory candy confectionery family company",
        ],
    },
    {
        # 지역 무관 -- 리스트 형태라 추출 효율이 가장 높은 채널만 모음 (수상작/박람회 출품사)
        "label": "Awards",
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
