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
# 2026-10-19: shelf life >= 12 months is now required (user, 2026-10-15), so queries for
# short-lived items (kouign-amann, canelé, Stollen, Welsh cakes, bara brith, pecan
# pralines, fudge shops...) and for fresh-pastry businesses (pasticceria, Bäckerei,
# Konditorei, "shop") were swapped for long-life lines. Swapped IN PLACE, never deleted or
# inserted: a lane remembers how far it got by list position (SourcingLaneState.cursor),
# so removing an entry would make it skip or repeat others.
#
# Japan uses bare product nouns + a maker word (the user's own earlier edit); its first
# two entries were also swapped in place on 2026-10-19 (wagashi/八ッ橋 -> 干菓子/金平糖).
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
        # Was "卸" (wholesale) -- appended to every Japan query, it pulled wholesalers, B2B
        # marketplaces and OEM factories (first Japan-focus run, 2026-10-12: 11 of 22
        # candidates). "公式" (official) pulls each maker's own brand site instead; the
        # trade channel is still required by site_profile.judge.
        "tradeTerm": "公式",
        "queries": [
            # 2026-10-06: 일반명사 쿼리 5개(heritage/candy snack maker, 菓子店, 和菓子,
            # 食品メーカー 菓子)는 삭제 -- 구인구직·OEM 디렉터리만 반환해 검색 크레딧만 소모함.
            # 품목명 단위 쿼리만 남김.
            {"q": "干菓子 製造元", "category": "캔디/컨펙셔너리"},
            {"q": "金平糖 製造元", "category": "캔디/컨펙셔너리"},
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
            {"q": "caramel au beurre salé confiserie Bretagne -recette", "category": "캔디/컨펙셔너리"},
            {"q": "bredele biscuiterie alsacienne familiale -recette", "category": "비스킷/쿠키/케이크"},
            {"q": "calisson d'Aix confiserie artisanale -recette", "category": "캔디/컨펙셔너리"},
            {"q": "bêtises de Cambrai confiserie artisanale -recette", "category": "캔디/컨펙셔너리"},
            {"q": "touron basque confiserie artisanale -recette", "category": "캔디/컨펙셔너리"},
            {"q": "nougat de Montélimar fabrique artisanale -recette", "category": "캔디/컨펙셔너리"},
            {"q": "berlingots confiserie artisanale -recette", "category": "캔디/컨펙셔너리"},
            {"q": "pâte de fruit confiserie artisanale française -recette", "category": "젤리/구미"},
            {"q": '"depuis cinq générations" biscuiterie confiserie', "category": "비스킷/쿠키/케이크"},
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
            {"q": "torrone tenero produttore L'Aquila -ricetta", "category": "캔디/컨펙셔너리"},
            {"q": "confetti di Sulmona fabbrica artigianale -ricetta", "category": "캔디/컨펙셔너리"},
            {"q": "mostaccioli azienda dolciaria Abruzzo -ricetta", "category": "비스킷/쿠키/케이크"},
            {"q": "croccante di mandorle produttore Abruzzo -ricetta", "category": "캔디/컨펙셔너리"},
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
        # DISABLED 2026-10-19 (user): German brand names read as unfamiliar to Korean
        # shoppers, so German brands are not wanted for now. Kept, not deleted, so it can be
        # switched back on -- its query history and lane state stay in the DB.
        "enabled": False,
        # Was "Großhandel" (wholesaler) -- like 卸 for Japan, it pulled wholesalers rather than
        # makers, and the word in a result's title also tripped name_filter.looks_like_reseller.
        # "Händler werden" (become a dealer) is how a maker titles its own dealer page. Not
        # "Wiederverkäufer": also a reseller word there (tried 2026-10-19, dropped Kossatz).
        "tradeTerm": "Händler werden",
        "queries": [
            {"q": "Nürnberger Lebkuchen Manufaktur -Rezept", "category": "비스킷/쿠키/케이크"},
            # Lebküchnerei -- 뉘른베르크 진저브레드 제조사를 부르는 고유 직업명, 회사 이름 자체에
            # 들어가는 접미사형 단어 (-ificio/-erie와 같은 트릭)
            {"q": "Lebküchnerei Nürnberg Familienbetrieb -Rezept", "category": "비스킷/쿠키/케이크"},
            {"q": "Aachener Printen Hersteller Familienbetrieb -Rezept", "category": "비스킷/쿠키/케이크"},
            {"q": "Lakritz Manufaktur Familienbetrieb -Rezept", "category": "캔디/컨펙셔너리"},
            {"q": "Springerle Manufaktur Schwaben -Rezept", "category": "비스킷/쿠키/케이크"},
            {"q": "Bonbonkocherei Manufaktur handgemacht -Rezept", "category": "캔디/컨펙셔너리"},
            {"q": "Kräuterbonbons Hersteller Bayern -Rezept", "category": "캔디/컨펙셔너리"},
            {"q": "Fruchtgummi Manufaktur Familienbetrieb -Rezept", "category": "젤리/구미"},
            {"q": "Brause Manufaktur Süßwaren -Rezept", "category": "캔디/컨펙셔너리"},
            {"q": '"in fünfter Generation" Süßwaren Manufaktur', "category": "혼합"},
            # PDO/PGI/박람회 -- 리스트형 쿼리
            {"q": "geschützte geografische Angabe Gebäck Süßwaren Hersteller Liste", "category": "혼합", "kind": "roster"},
            {"q": "ISM Köln Aussteller Familienunternehmen Gebäck", "category": "혼합", "kind": "roster"},
            {"q": "Russisch Brot Hersteller -Rezept", "category": "비스킷/쿠키/케이크"},
        ],
    },
    {
        # 스페인 전체(44건)는 포화지만, 북부(바스크·나바라·라리오하·아라곤·칸타브리아·
        # 아스투리아스·갈리시아)로 좁히면 여전히 유효. mantecados/polvorones/마자판 등은
        # 실제로는 남부(안달루시아)·중부(톨레도) 특산이라 이 레인(북부)과 안 맞아 빼고,
        # 확실히 북부인 것만 남김.
        "label": "Spain",
        "country": "Spain",
        # Was "distribuidores" -- pulled distributors. "puntos de venta" is a maker's own
        # where-to-buy page.
        "tradeTerm": "puntos de venta",
        "queries": [
            # sobao pasiego / casadielles (fresh pastry, days to weeks) swapped in place for
            # long-life lines, 2026-10-23 -- shelf life >= 12 months.
            {"q": "caramelos artesanos obrador Cantabria -receta", "category": "캔디/컨펙셔너리"},
            {"q": "galletas artesanas fábrica Asturias -receta", "category": "비스킷/쿠키/케이크"},
            {"q": "confitería artesanal tradicional Galicia -receta", "category": "캔디/컨펙셔너리"},
            {"q": "confitería artesanal tradicional País Vasco -receta", "category": "캔디/컨펙셔너리"},
            {"q": "turrón mazapán obrador familiar Aragón Navarra -receta", "category": "캔디/컨펙셔너리"},
            {"q": '"quinta generación" obrador dulces', "category": "혼합"},
            # 리스트형 쿼리
            {"q": "IGP DOP dulces tradicionales norte España lista de productores", "category": "혼합", "kind": "roster"},
        ],
    },
    {
        # 영국(154건)은 전체로는 포화지만, 스코틀랜드·웨일스·북아일랜드는 잉글랜드와
        # 어휘·브랜드가 아예 다른 별개 시장 -- 지방 단위로 좁히면 여전히 유효.
        "label": "UK",
        "country": "UK",
        # Was "wholesale" -- names wholesalers. "stockists" is a maker's where-to-buy page.
        "tradeTerm": "stockists",
        "queries": [
            {"q": "oatcake bakery family owned Scotland -recipe", "category": "스낵/과자"},
            {"q": "Scottish tablet confectioner family owned -recipe", "category": "캔디/컨펙셔너리"},
            {"q": "Edinburgh rock maker family owned -recipe", "category": "캔디/컨펙셔너리"},
            {"q": "shortbread bakery family owned Scotland -recipe", "category": "비스킷/쿠키/케이크"},
            {"q": "fudge maker family owned Wales -recipe", "category": "캔디/컨펙셔너리"},
            {"q": "boiled sweets maker family owned Wales -recipe", "category": "캔디/컨펙셔너리"},
            {"q": "yellowman honeycomb toffee maker Northern Ireland -recipe", "category": "캔디/컨펙셔너리"},
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
        # Was "wholesale" -- names wholesalers; "where to buy" is a maker's own stockist page.
        "tradeTerm": "where to buy",
        "queries": [
            {"q": "saltwater taffy company family owned New Jersey -recipe", "category": "캔디/컨펙셔너리"},
            {"q": "maple candy producer Vermont family owned -recipe", "category": "캔디/컨펙셔너리"},
            {"q": "benne wafer bakery Charleston family owned -recipe", "category": "비스킷/쿠키/케이크"},
            {"q": "hard candy company family owned Pennsylvania -recipe", "category": "캔디/컨펙셔너리"},
            {"q": "peanut brittle candy company family owned Southern -recipe", "category": "캔디/컨펙셔너리"},
            {"q": "Moravian cookies company Winston-Salem family owned -recipe", "category": "비스킷/쿠키/케이크"},
            {"q": "horehound candy old fashioned candy company family owned -recipe", "category": "캔디/컨펙셔너리"},
            {"q": "caramel candy company family owned -recipe", "category": "캔디/컨펙셔너리"},
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
    # --- Japan-focus-only lanes (focusOnly) -------------------------------------------
    # Requested 2026-10-12: alongside Japanese confectionery, look for ReFa-style beauty
    # tools (rollers, gua sha, beauty devices -- NOT brushes/combs, hair dryers/irons) and
    # ReNu-style personal care (contact-lens care, eye care). They run only in a Japan
    # focus run ("일본 집중" buttons), never in a normal run, and use the same daily
    # budget. "group" makes site_profile.judge check beauty/care words instead of food,
    # and drop hair-appliance sites. Korean SKU labels: 뷰티 도구/기기, 생활/헬스케어.
    # Regulatory note for review: lens-care solutions are 의료기기/의약외품 in Korea.
    {
        "label": "Japan Beauty",
        "country": "Japan",
        "group": "beauty",
        "focusOnly": True,
        "queries": [
            # "ブランド 公式", not "メーカー": maker/manufacturer queries returned OEM
            # factories and brush workshops (first run: 6 of 6 beauty results were Kumano
            # makeup-brush makers). Brushes/combs are out of scope (user, 2026-10-12).
            {"q": "美顔ローラー ブランド 公式", "category": "뷰티 도구/기기"},
            {"q": "美顔器 ブランド 公式 日本", "category": "뷰티 도구/기기"},
            {"q": "EMS 美顔器 ブランド 公式", "category": "뷰티 도구/기기"},
            {"q": "マイクロカレント 美顔器 ブランド", "category": "뷰티 도구/기기"},
            {"q": "かっさ 美容 ブランド 公式", "category": "뷰티 도구/기기"},
            {"q": "ボディローラー 美容 ブランド 公式", "category": "뷰티 도구/기기"},
        ],
    },
    {
        "label": "Japan Care",
        "country": "Japan",
        "group": "care",
        "focusOnly": True,
        "queries": [
            {"q": "コンタクトレンズ 洗浄液 ブランド 公式", "category": "생활/헬스케어"},
            {"q": "コンタクトレンズ ケア用品 製造販売元", "category": "생활/헬스케어"},
            {"q": "ハードコンタクトレンズ ケア用品 公式", "category": "생활/헬스케어"},
            {"q": "洗眼液 ブランド 公式", "category": "생활/헬스케어"},
        ],
    },
]

# Which lanes a focus run uses (main.py's 3rd argument). The plain "Japan" lane is shared
# with normal runs -- same query ledger, so learning carries over both ways.
FOCUS_LANES = {
    "japan": ["Japan", "Japan Beauty", "Japan Care"],
}
