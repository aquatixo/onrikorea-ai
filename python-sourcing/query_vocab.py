"""Word lists the query generator (query_generator.py) combines into search queries once a
lane's hand-written queries in categories.py are used up.

A generated query is: <product> <maker word> [<region>] <exclude suffix>, and main.py
appends the bucket's tradeTerm at search time. Scope is confectionery, biscuits and
snacks ONLY -- coffee, tea, honey and pasta are not handled (2026-10), and fresh bread or
cream cakes can't be imported, so none of those appear here. Shelf life must be 12 months or
more (2026-10-15): short-lived items (macarons, madeleines, Stollen, Baumkuchen, filled
pralines, カステラ, 八ツ橋) and fresh-pastry maker words (pasticceria, Confiserie as a shop)
were removed. Baby food is out of scope (user, 2026-10-19).

Each product carries the Korean SKU label the candidate is filed under. Edit freely: the
generator picks up added words automatically and scores every word by how many verified
candidates the queries containing it actually produced.
"""

VOCAB = {
    "Germany": {
        "suffix": "-Rezept",
        "products": [
            ("Lebkuchen", "비스킷/쿠키/케이크"),
            ("Printen", "비스킷/쿠키/케이크"),
            ("Spekulatius", "비스킷/쿠키/케이크"),
            ("Marzipan", "캔디/컨펙셔너리"),
            ("Kräuterbonbons", "캔디/컨펙셔너리"),
            ("Lakritz", "캔디/컨펙셔너리"),
            ("Fruchtgummi", "젤리/구미"),
            ("Dominosteine", "캔디/컨펙셔너리"),
            ("Russisch Brot", "비스킷/쿠키/케이크"),
            ("Schokolade", "초콜릿"),
            ("Waffeln", "비스킷/쿠키/케이크"),
        ],
        "makers": ["Manufaktur", "Hersteller", "Familienbetrieb", "Traditionsunternehmen", "Süßwarenhersteller"],
        "regions": ["Nürnberg", "Aachen", "Dresden", "Lübeck", "Bayern", "Sachsen", "Schwarzwald", "Thüringen"],
    },
    "France": {
        "suffix": "-recette",
        "products": [
            ("calisson", "캔디/컨펙셔너리"),
            ("nougat", "캔디/컨펙셔너리"),
            ("berlingot", "캔디/컨펙셔너리"),
            ("caramel au beurre salé", "캔디/컨펙셔너리"),
            ("pâte de fruits", "젤리/구미"),
            ("dragées", "캔디/컨펙셔너리"),
            ("chocolat", "초콜릿"),
            ("bêtises", "캔디/컨펙셔너리"),
            ("galette bretonne", "비스킷/쿠키/케이크"),
            ("sablé", "비스킷/쿠키/케이크"),
            ("pain d'épices", "비스킷/쿠키/케이크"),
            ("canistrelli", "비스킷/쿠키/케이크"),
        ],
        "makers": ["fabrique", "confiserie artisanale", "biscuiterie", "entreprise familiale", "fabricant"],
        "regions": ["Bretagne", "Provence", "Alsace", "Pays Basque", "Normandie", "Nord", "Auvergne", "Lorraine"],
    },
    "Italy": {
        "suffix": "-ricetta",
        "products": [
            ("torrone", "캔디/컨펙셔너리"),
            ("croccante", "캔디/컨펙셔너리"),
            ("confetti", "캔디/컨펙셔너리"),
            ("liquirizia", "캔디/컨펙셔너리"),
            ("cioccolato", "초콜릿"),
            ("gianduiotti", "초콜릿"),
            ("caramelle", "캔디/컨펙셔너리"),
            ("amaretti", "비스킷/쿠키/케이크"),
            ("cantucci", "비스킷/쿠키/케이크"),
            ("ricciarelli", "비스킷/쿠키/케이크"),
            ("panforte", "비스킷/쿠키/케이크"),
            ("baci di dama", "비스킷/쿠키/케이크"),
            ("biscotti", "비스킷/쿠키/케이크"),
            ("taralli", "스낵/과자"),
            ("grissini", "스낵/과자"),
        ],
        "makers": ["produttore", "azienda artigianale", "biscottificio", "azienda dolciaria", "laboratorio artigianale"],
        "regions": ["Piemonte", "Sicilia", "Toscana", "Sardegna", "Puglia", "Calabria", "Abruzzo", "Campania"],
    },
    "Spain": {
        "suffix": "-receta",
        "products": [
            ("turrón", "캔디/컨펙셔너리"),
            ("mazapán", "캔디/컨펙셔너리"),
            ("yemas de Santa Teresa", "캔디/컨펙셔너리"),
            ("almendras garrapiñadas", "캔디/컨펙셔너리"),
            ("caramelos", "캔디/컨펙셔너리"),
            ("chocolate", "초콜릿"),
            ("polvorones", "비스킷/쿠키/케이크"),
            ("mantecados", "비스킷/쿠키/케이크"),
            ("rosquillas", "비스킷/쿠키/케이크"),
            ("carquiñoles", "비스킷/쿠키/케이크"),
            ("galletas", "비스킷/쿠키/케이크"),
        ],
        "makers": ["fábrica", "obrador artesano", "empresa familiar", "fabricante"],
        "regions": ["Jijona", "Toledo", "Estepa", "Castilla", "Asturias", "Galicia", "País Vasco", "Cataluña"],
    },
    "UK": {
        "suffix": "-recipe",
        "products": [
            ("fudge", "캔디/컨펙셔너리"),
            ("Scottish tablet", "캔디/컨펙셔너리"),
            ("toffee", "캔디/컨펙셔너리"),
            ("boiled sweets", "캔디/컨펙셔너리"),
            ("humbugs", "캔디/컨펙셔너리"),
            ("rock candy", "캔디/컨펙셔너리"),
            ("liquorice", "캔디/컨펙셔너리"),
            ("marshmallows", "캔디/컨펙셔너리"),
            ("chocolate", "초콜릿"),
            ("shortbread", "비스킷/쿠키/케이크"),
            ("biscuits", "비스킷/쿠키/케이크"),
            ("oatcakes", "스낵/과자"),
        ],
        "makers": ["manufacturer", "family business", "confectioner", "producer"],
        "regions": ["Scotland", "Wales", "Yorkshire", "Cornwall", "Devon", "Northern Ireland", "Lancashire", "Kent"],
    },
    "USA": {
        "suffix": "-recipe",
        "products": [
            ("saltwater taffy", "캔디/컨펙셔너리"),
            ("peanut brittle", "캔디/컨펙셔너리"),
            ("fudge", "캔디/컨펙셔너리"),
            ("caramels", "캔디/컨펙셔너리"),
            ("hard candy", "캔디/컨펙셔너리"),
            ("toffee", "캔디/컨펙셔너리"),
            ("maple candy", "캔디/컨펙셔너리"),
            ("licorice", "캔디/컨펙셔너리"),
            ("chocolate", "초콜릿"),
            ("pretzels", "스낵/과자"),
        ],
        "makers": ["manufacturer", "family owned candy company", "candy maker", "confectioner"],
        "regions": ["New England", "Vermont", "Pennsylvania", "Louisiana", "Georgia", "Texas", "Ohio", "California"],
    },
    "Japan": {
        "suffix": "",
        "products": [
            ("せんべい", "스낵/과자"),
            ("おかき", "스낵/과자"),
            ("かりんとう", "스낵/과자"),
            ("羊羹", "캔디/컨펙셔너리"),
            ("金平糖", "캔디/컨펙셔너리"),
            ("飴", "캔디/컨펙셔너리"),
            ("ラムネ菓子", "캔디/컨펙셔너리"),
            ("落雁", "캔디/컨펙셔너리"),
            ("クッキー", "비스킷/쿠키/케이크"),
            # Added 2026-10-12 for the Japan focus run -- shelf-stable lines only (no 生菓子).
            ("チョコレート", "초콜릿"),
            ("グミ", "젤리/구미"),
            ("ビスケット", "비스킷/쿠키/케이크"),
            ("豆菓子", "스낵/과자"),
            ("黒糖菓子", "캔디/컨펙셔너리"),
            ("ボーロ", "비스킷/쿠키/케이크"),
            ("揚げ餅", "스낵/과자"),
            ("えびせんべい", "스낵/과자"),
            ("甘納豆", "캔디/컨펙셔너리"),
            ("和三盆", "캔디/컨펙셔너리"),
        ],
        "makers": ["製造元", "老舗", "製菓", "本舗"],
        "regions": [
            "京都", "金沢", "新潟", "長崎", "岩手", "東京", "大阪", "福岡",
            "北海道", "沖縄", "鹿児島", "熊本", "広島", "静岡", "愛知", "宮城", "富山", "香川", "島根",
        ],
    },
    # Japan-focus-only lanes (categories.py "focusOnly"). No regions: a beauty-device or
    # lens-care brand is found by product + brand word, not by prefecture. Brand words,
    # not "メーカー"/"製造元": those returned OEM factories and brush workshops (first run,
    # 2026-10-12). No brushes/combs/grooming tools/masks/ointments -- never handled.
    "Japan Beauty": {
        "suffix": "",
        "products": [
            ("美顔ローラー", "뷰티 도구/기기"),
            ("ゲルマニウムローラー", "뷰티 도구/기기"),
            ("フェイスローラー", "뷰티 도구/기기"),
            ("ボディローラー", "뷰티 도구/기기"),
            ("かっさ", "뷰티 도구/기기"),
            ("美顔器", "뷰티 도구/기기"),
            ("EMS 美顔器", "뷰티 도구/기기"),
            ("LED 美顔器", "뷰티 도구/기기"),
            ("マイクロカレント 美顔器", "뷰티 도구/기기"),
            ("リフトケア 美容機器", "뷰티 도구/기기"),
            ("ボディケア 美容機器", "뷰티 도구/기기"),
            ("目元 美容機器", "뷰티 도구/기기"),
        ],
        "makers": ["ブランド 公式", "公式", "日本製 ブランド"],
        "regions": [],
    },
    "Japan Care": {
        "suffix": "",
        "products": [
            ("コンタクトレンズ 洗浄液", "생활/헬스케어"),
            ("コンタクトレンズ 保存液", "생활/헬스케어"),
            ("レンズケア用品", "생활/헬스케어"),
            ("ハードコンタクト ケア用品", "생활/헬스케어"),
            ("洗眼液", "생활/헬스케어"),
        ],
        "makers": ["ブランド 公式", "公式", "製造販売元"],
        "regions": [],
    },
}
