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
# Each query carries its OWN "category" (Korean SKU label, same vocabulary existing
# Brand rows use -- "비스킷/쿠키/케이크", "캔디/컨펙셔너리", etc.) instead of one category
# for the whole bucket. This falls directly out of the "one specialty item per query"
# rule above: since every query already targets exactly one specific product (galette
# bretonne is a cookie, calisson is a candy, torréfacteur is a coffee roaster -- never a
# cookie), the query itself already knows its category precisely. A single bucket-wide
# "category" used to collapse all of that down to a generic "혼합" (mixed) for every
# candidate the bucket found, which is uninformative on the review table. Only genuinely
# cross-category queries (an awards/exhibitor-list query that names several product types
# at once, e.g. "biscuits confectionery producer list") still get "혼합" -- that's an
# honest label there, not a cop-out.
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
        # Fallback country when guess_country_from_domain(website) can't tell from the
        # ccTLD alone (a generic .com/.co/etc gets no guess there, deliberately, rather
        # than risk a wrong one -- see country_guess.py) -- every query in this bucket
        # already targets this one country specifically, so it's a safe, known fallback.
        # Left out entirely on the "Awards" bucket below, which genuinely spans multiple
        # countries -- a fallback there would be an actual guess, not a known fact.
        "country": "Japan",
        "tradeTerm": "卸",
        "queries": [
            {"q": "traditional Japanese wagashi", "category": "스낵/과자"},
            # 2026-10-06: 일반명사 쿼리 5개(heritage/candy snack maker, 菓子店, 和菓子, 食品メーカー 菓子)는 삭제 -- 구인구직·OEM 디렉터리만 반환해 검색 크레딧만 소모함. 아래 품목명 쿼리는 유지.
        # (이전 메모) 추가 -- 위 6개(특히 마지막 3개)가 일반명사 쿼리라 쇼핑몰/매거진만 반환하고 실제
            # 브랜드 수율이 0에 가까웠음 (22건 전수 재현). 다른 레인들처럼 "품목명 단위"
            # 쿼리로 보강 -- 원래 6개는 지우지 않음(이유를 알 수 없는 과거의 의도적 반복
            # 편집이었음), is_query_retired가 2연속 무수확이면 알아서 은퇴시키니 신·구
            # 쿼리를 같이 돌려서 어느 쪽이 실제로 수율을 내는지 숫자로 가려지게 둠.
            {"q": "八ツ橋 製造元", "category": "스낵/과자"},
            {"q": "南部せんべい 製造", "category": "스낵/과자"},
            {"q": "かりんとう 老舗 製造", "category": "스낵/과자"},
        ],
    },
    {
        # 마스터 프랑스 61건이나 파리/대형 브랜드 편중 추정 -- 지방 특산으로 한정
        "label": "France",
        "country": "France",
        "tradeTerm": "revendeurs",
        "queries": [
            {"q": "galette bretonne biscuiterie artisanale -recette", "category": "비스킷/쿠키/케이크"},
            {"q": "kouign-amann fabrique artisanale Bretagne -recette", "category": "베이킹"},
            {"q": "bredele biscuiterie alsacienne familiale -recette", "category": "비스킷/쿠키/케이크"},
            {"q": "calisson d'Aix confiserie artisanale -recette", "category": "캔디/컨펙셔너리"},
            {"q": "bêtises de Cambrai confiserie artisanale -recette", "category": "캔디/컨펙셔너리"},
            {"q": "gâteau basque maison artisanale Pays Basque -recette", "category": "비스킷/쿠키/케이크"},
            {"q": "nougat de Montélimar fabrique artisanale -recette", "category": "캔디/컨펙셔너리"},
            {"q": "canelé bordelais fabrique artisanale -recette", "category": "베이킹"},
            {"q": "pâte de fruit confiserie artisanale française -recette", "category": "젤리/구미"},
            {"q": '"depuis 18" biscuiterie confiserie France', "category": "비스킷/쿠키/케이크"},
            # PDO/PGI/수상 -- 여러 품목을 한꺼번에 나열하는 리스트형 쿼리라 단일 카테고리로 못 좁힘.
            # kind="roster": 생산자 명단 페이지를 겨냥하는 쿼리 -- 기본값("discovery")과 달리
            # 검색결과 자체를 후보로 안 보고, 그 페이지에서 이름을 "수확"한다 (roster_harvest.py).
            {"q": "IGP label rouge confiserie biscuiterie liste des producteurs", "category": "혼합", "kind": "roster"},
            {"q": "Entreprise du Patrimoine Vivant biscuiterie confiserie liste", "category": "혼합", "kind": "roster"},
        ],
    },
    {
        # 이탈리아 전체(123건)는 포화지만, 남부(아브루초·풀리아·칼라브리아·바실리카타·
        # 몰리세)는 파리/밀라노/피렌체 편중과 무관한 별개 특산 어휘권 -- 지방 단위로 좁히면 유효.
        "label": "Italy",
        "country": "Italy",
        "tradeTerm": "rivenditori",
        "queries": [
            {"q": "ferratelle produttore Abruzzo -ricetta", "category": "비스킷/쿠키/케이크"},
            {"q": "pizzelle abruzzesi azienda famiglia -ricetta", "category": "비스킷/쿠키/케이크"},
            {"q": "torrone tenero pasticceria storica L'Aquila -ricetta", "category": "캔디/컨펙셔너리"},
            {"q": "confetti di Sulmona fabbrica artigianale -ricetta", "category": "캔디/컨펙셔너리"},
            {"q": "mostaccioli pasticceria storica famiglia Abruzzo -ricetta", "category": "비스킷/쿠키/케이크"},
            {"q": "bocconotti pasticceria storica Abruzzo -ricetta", "category": "비스킷/쿠키/케이크"},
            # 상호 접미사 트릭 (-ificio = "그걸 만드는 곳")
            {"q": "torronificio Puglia Calabria", "category": "캔디/컨펙셔너리"},
            {"q": "biscottificio storico Puglia", "category": "비스킷/쿠키/케이크"},
            {"q": "taralli forno tradizionale Puglia -ricetta", "category": "스낵/과자"},
            {"q": "liquirizia calabrese fabbrica storica -ricetta", "category": "캔디/컨펙셔너리"},
            # PDO/PGI 생산자 명단
            {"q": "consorzio tutela IGP dolci tipici Sud Italia elenco produttori", "category": "혼합", "kind": "roster"},
        ],
    },
    {
        # 마스터 독일 46건 -- 대도시/대형 브랜드 편중 추정, 지방 특산으로 한정
        "label": "Germany",
        "country": "Germany",
        "tradeTerm": "Großhandel",
        "queries": [
            {"q": "Nürnberger Lebkuchen Manufaktur -Rezept", "category": "비스킷/쿠키/케이크"},
            # Lebküchnerei -- 뉘른베르크 진저브레드 제조사를 부르는 고유 직업명, 회사 이름 자체에
            # 들어가는 접미사형 단어 (-ificio/-erie와 같은 트릭)
            {"q": "Lebküchnerei Nürnberg Familienbetrieb -Rezept", "category": "비스킷/쿠키/케이크"},
            {"q": "Aachener Printen Bäckerei Familienbetrieb -Rezept", "category": "비스킷/쿠키/케이크"},
            {"q": "Dresdner Stollen Bäckerei Familienbetrieb -Rezept", "category": "베이킹"},
            {"q": "Springerle Konditorei Familienbetrieb Schwaben -Rezept", "category": "비스킷/쿠키/케이크"},
            {"q": "Bonbonkocherei Manufaktur handgemacht -Rezept", "category": "캔디/컨펙셔너리"},
            {"q": "Tiroler Lebkuchen Konditorei Familienbetrieb -Rezept", "category": "비스킷/쿠키/케이크"},
            {"q": "Zwetschgenmännla Manufaktur Nürnberg -Rezept", "category": "캔디/컨펙셔너리"},
            {"q": "Brause Manufaktur Süßwaren -Rezept", "category": "캔디/컨펙셔너리"},
            # PDO/PGI/박람회 -- 리스트형 쿼리
            {"q": '"seit 18" Manufaktur Familienbetrieb Süßwaren', "category": "혼합", "kind": "roster"},
            {"q": "geschützte geografische Angabe Gebäck Süßwaren Hersteller Liste", "category": "혼합", "kind": "roster"},
            {"q": "ISM Köln Aussteller Familienunternehmen Gebäck", "category": "혼합", "kind": "roster"},
            {"q": "Slow Food Presidio Deutschland Süßwaren Hersteller", "category": "혼합", "kind": "roster"},
        ],
    },
    {
        # 스페인 전체(44건)는 포화지만, 북부(바스크·나바라·라리오하·아라곤·칸타브리아·
        # 아스투리아스·갈리시아)로 좁히면 여전히 유효. mantecados/polvorones/마자판 등은
        # 실제로는 남부(안달루시아)·중부(톨레도) 특산이라 이 레인(북부)과 안 맞아 빼고,
        # 확실히 북부인 것만 남김.
        "label": "Spain",
        "country": "Spain",
        "tradeTerm": "distribuidores",
        "queries": [
            {"q": "sobao pasiego obrador Cantabria -receta", "category": "베이킹"},
            {"q": "casadielles obrador Asturias -receta", "category": "비스킷/쿠키/케이크"},
            {"q": "confitería artesanal tradicional Galicia -receta", "category": "캔디/컨펙셔너리"},
            {"q": "confitería artesanal tradicional País Vasco -receta", "category": "캔디/컨펙셔너리"},
            {"q": "turrón mazapán obrador familiar Aragón Navarra -receta", "category": "캔디/컨펙셔너리"},
            # 리스트형 쿼리
            {"q": '"desde 18" obrador dulces España', "category": "혼합", "kind": "roster"},
            {"q": "IGP DOP dulces tradicionales norte España lista de productores", "category": "혼합", "kind": "roster"},
        ],
    },
    {
        # 영국(154건)은 전체로는 포화지만, 스코틀랜드·웨일스·북아일랜드는 잉글랜드와
        # 어휘·브랜드가 아예 다른 별개 시장 -- 지방 단위로 좁히면 여전히 유효.
        "label": "UK",
        "country": "UK",
        "tradeTerm": "wholesale",
        "queries": [
            {"q": "oatcake bakery family owned Scotland -recipe", "category": "스낵/과자"},
            {"q": "tablet confectioner family owned Scotland -recipe", "category": "캔디/컨펙셔너리"},
            {"q": "Edinburgh rock maker family owned -recipe", "category": "캔디/컨펙셔너리"},
            {"q": "shortbread bakery family owned Scotland -recipe", "category": "비스킷/쿠키/케이크"},
            {"q": "Welsh cake bakery family owned Wales -recipe", "category": "비스킷/쿠키/케이크"},
            {"q": "bara brith bakery family owned Wales -recipe", "category": "베이킹"},
            {"q": "brown lemonade maker Northern Ireland family owned -recipe", "category": "음료"},
            # 수상 -- 리스트형 쿼리
            {"q": "Great Taste Awards Scottish Welsh Northern Irish confectionery producer list", "category": "혼합", "kind": "roster"},
        ],
    },
    {
        # 미국은 마스터 245건으로 가장 포화됐지만, 유명 전국 브랜드가 아니라 지역 특산
        # 품목(뉴잉글랜드 메이플캔디, 뉴저지 솔트워터타피, 찰스턴 베니웨이퍼, 뉴올리언스
        # 프랄린, 노스캐롤라이나 모라비안 쿠키 등)으로 좁혀서 소형 헤리티지 브랜드를 겨냥.
        "label": "USA",
        "country": "USA",
        "tradeTerm": "wholesale",
        "queries": [
            {"q": "saltwater taffy shop family owned New Jersey -recipe", "category": "캔디/컨펙셔너리"},
            {"q": "maple candy producer Vermont family owned -recipe", "category": "캔디/컨펙셔너리"},
            {"q": "benne wafer bakery Charleston family owned -recipe", "category": "비스킷/쿠키/케이크"},
            {"q": "pecan praline candy company New Orleans family owned -recipe", "category": "캔디/컨펙셔너리"},
            {"q": "peanut brittle candy company family owned Southern -recipe", "category": "캔디/컨펙셔너리"},
            {"q": "Moravian cookies bakery Winston-Salem family owned -recipe", "category": "비스킷/쿠키/케이크"},
            {"q": "horehound candy old fashioned candy company family owned -recipe", "category": "캔디/컨펙셔너리"},
            {"q": "fudge shop Mackinac Island family owned -recipe", "category": "캔디/컨펙셔너리"},
            # 수상/박람회 (미국 특산식품협회 공식 시상식·무역박람회) -- 쿼리 자체가 candy
            # confectionery로 명시돼있어 혼합 아님. 그래도 구조는 명단형이라 kind=roster.
            {"q": "Specialty Food Association sofi Award winners candy confectionery", "category": "캔디/컨펙셔너리", "kind": "roster"},
            {"q": "Fancy Food Show exhibitor directory candy confectionery family company", "category": "캔디/컨펙셔너리", "kind": "roster"},
        ],
    },
    {
        # 지역 무관 -- 리스트 형태라 추출 효율이 가장 높은 채널만 모음 (수상작/박람회 출품사).
        # 쿼리 자체가 여러 품목을 한꺼번에 나열하는 경우가 대부분이라 혼합이 많음 -- 쿼리가
        # 단일 품목(confectionery)만 명시한 경우만 캔디/컨펙셔너리로 좁힘.
        #
        # DISABLED (enabled=False), not deleted -- a수상자/출품사 "명단" 페이지는 구조적으로
        # 이 레인에서 0건을 낼 수밖에 없다. 그 페이지 자체(예: greattasteawards.co.uk)가
        # 검색 결과로 나와도, guess_brand_name은 그 페이지 자신의 제목("Great Taste Awards
        # 2024 Winners")을 "이름"으로 뽑고, domain_matches_name은 그걸 수상 사이트 도메인과
        # 비교하니 항상 불일치 -- 명단 안에 실제로 나열된 개별 생산자 이름은 지금 구조로는
        # 애초에 추출 대상이 아니다 (한 검색 결과 = 한 후보 라는 1단계 설계 자체의 한계).
        # 쿼리 9개는 공들여 고른 채널이라 지우지 않음 -- 2단계(리스트 수확 → 이름별 재검색)
        # 도입 시 이 레인부터 재활성화할 것.
        "label": "Awards",
        # Re-enabled -- process_roster_query (main.py) now exists and every query below
        # is tagged "kind": "roster", so these actually go through the harvest path
        # instead of the discovery path that made this bucket a guaranteed 0-yield
        # dead end before. If this turns out to still yield badly, disable again with a
        # comment saying why found this run -- don't silently flip it back without
        # leaving a trace, same rule as everywhere else in this file.
        # 2026-10-06 다시 비활성화: 명부 경로는 동작했지만 "Slow Food Presidia" 쿼리가 Ark of Taste
        # (멸종위기 식재료 품종) 생태계로 수렴해 씨앗 회사 20곳이 후보로 들어옴 (그 쿼리는 삭제함).
        # 식품 관련성 검사(relevance.py)를 넣었지만 실제 소싱 실행으로 확인하기 전까지는 검색
        # 크레딧을 아끼기 위해 꺼둠. 켤 때는 enabled만 True로 바꾸고 첫 실행의 filterDrops와
        # roster 숫자를 사람이 먼저 확인할 것.
        "enabled": False,
        "queries": [
            {"q": "Great Taste Awards 3 star winners biscuits confectionery producer list", "category": "혼합", "kind": "roster"},
            {"q": "Farm Shop and Deli Awards finalists snacks bakery", "category": "혼합", "kind": "roster"},
            {"q": "World Food Innovation Awards confectionery finalists", "category": "캔디/컨펙셔너리", "kind": "roster"},
            {"q": "Anuga exhibitor list fine food confectionery family company", "category": "캔디/컨펙셔너리", "kind": "roster"},
            {"q": "SIAL Paris exhibitor directory biscuits confectionery", "category": "혼합", "kind": "roster"},
            {"q": "ISM Cologne exhibitor list sweets bakery small producer", "category": "혼합", "kind": "roster"},
            {"q": "Biofach exhibitor list organic snacks biscuits", "category": "혼합", "kind": "roster"},
            {"q": "Speciality and Fine Food Fair exhibitor list producers", "category": "혼합", "kind": "roster"},
        ],
    },
]
