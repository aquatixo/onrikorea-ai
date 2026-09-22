"""Curated brand-name exclusion registry, seeded from the parallel Claude-based
sourcing pipeline's own handoff document (브랜드소싱_인수인계.md, 9 rounds, 2026-09-22,
section 11). That pipeline already spent real WebSearch budget confirming these
specific brands are invalid candidates -- checking a candidate's name against this
list is a free, zero-Tavily-cost way to avoid rediscovering something already
confirmed bad.

This is NOT a substitute for category_signal/known_parent_in_name in brand_rules.py --
it only catches the specific brands that pipeline has actually looked at. A
multinational-owned brand neither pipeline has seen yet (e.g. Gerber/Nestle,
Tetley/Tata) will still slip through undetected; a curated list can only ever be as
complete as the research that fed it, which is an inherent limit, not a bug.
"""

import re
import unicodedata

# A few letters carry no combining accent for NFKD to strip (they're a distinct base
# letter, not a letter+accent) -- same mapping used in name_filter.py's domain-match
# fix, needed here too so "Sætre"/"Sørlandschips" normalize to the same ASCII form as
# the plain-ASCII keys below.
_NO_DECOMPOSITION_MAP = str.maketrans(
    {"ı": "i", "İ": "i", "ø": "o", "Ø": "o", "æ": "ae", "Æ": "ae", "œ": "oe", "Œ": "oe", "ß": "ss"}
)

_LEGAL_SUFFIX = re.compile(
    r"\b(ltd|limited|inc|incorporated|llc|gmbh|a/s|aps|ab|oy|s\.?p\.?a\.?|s\.?r\.?l\.?|bv|nv|sa|co|company|corp|the|srl|spa)\b",
    re.IGNORECASE,
)


def _strip_diacritics(text: str) -> str:
    decomposed = unicodedata.normalize("NFKD", text.translate(_NO_DECOMPOSITION_MAP))
    return "".join(ch for ch in decomposed if not unicodedata.combining(ch))


def normalize_brand_name(name: str) -> str:
    """Same normalization the handoff doc's own dedup script uses (see its §7) --
    strip parentheticals, accents, legal suffixes, punctuation, collapse whitespace --
    so "G.B. Ambrosoli S.p.A." and "Ambrosoli" compare equal."""
    s = re.sub(r"\(.*?\)", "", name)
    s = _strip_diacritics(s)
    s = _LEGAL_SUFFIX.sub(" ", s)
    s = re.sub(r"[^\w\s]", " ", s)
    return re.sub(r"\s+", " ", s.strip().lower())


# 조건 A 위반 -- 한국 공식 총판 존재 이미 확인됨
_KOREA_DISTRIBUTED = {
    "whittaker's": "뉴질랜드 — 쿠팡 브랜드관 외 다채널 정식 판매",
    "arataki honey": "뉴질랜드 — 전문 수입사 통해 등급별 판매",
    "moonpie": "미국 — SSG·11번가·수입상 판매 (총판 여부 미확인, 재검토 대상)",
    "agrimontana": "이탈리아 — 쉐프스푸드 B2B 식자재 채널",
    "majani 1796": "이탈리아 — dal1796.co.kr 한국 공식몰, 29CM 브랜드관",
    "la galvanina": "이탈리아 — 코스트코 코리아 정규 SKU 등재",
    "pastificio felicetti": "이탈리아 — gedfood.co.kr 수입원 정황",
    "zaini milano": "이탈리아 — @zainikorea 한국 공식 계정, 11번가·G마켓 정규 유통",
    "chocolates trapa": "스페인 — 오아시스마켓 상시 판매 (+ Grupo Lacasa 소유)",
    "bonilla a la vista": "스페인 — 마켓컬리·SSG·올리브영 등 다수 정규 채널",
    "caffe guglielmo": "이탈리아 — 자사 사이트에 한국 진출 명기",
}

# 조건 C 위반 -- 대형/다국적 소유 확인됨 (브랜드 자체 이름으로는 모기업이 드러나지 않는 것들 --
# known_parent_in_name/ownership_signal이 못 잡는 부류라서 이름으로 직접 등록해둔다)
_MULTINATIONAL_OWNED_BRANDS = {
    # 뉴질랜드
    "bell tea": "뉴질랜드", "robert harris": "뉴질랜드", "allpress": "뉴질랜드",
    "phoenix organics": "뉴질랜드", "mother earth": "뉴질랜드", "copper kettle": "뉴질랜드",
    "ernest adams": "뉴질랜드",
    # 노르웨이 (대부분 Orkla 계열)
    "nidar": "노르웨이", "freia": "노르웨이", "saetre": "노르웨이", "friele": "노르웨이",
    "solo": "노르웨이", "maarud": "노르웨이", "sorlandschips": "노르웨이",
    "kjeldsberg": "노르웨이", "joh johannson": "노르웨이", "rora": "노르웨이",
    # 덴마크
    "kelsen": "덴마크 — Ferrero 계열", "odense marcipan": "덴마크", "rynkeby": "덴마크",
    "merrild": "덴마크",
    # 영국
    "scott's porage": "영국", "irn-bru": "영국", "tudor crisps": "영국",
    "matthew algie": "영국", "brodies 1867": "영국", "nambarrie": "영국",
    # 미국
    "tom's foods": "미국", "lance": "미국 — Campbell's(Snyder's-Lance) 계열",
    "golden flake": "미국", "sun drop": "미국", "dr pepper": "미국", "barq's": "미국",
    "krispy kreme": "미국",
    # 이탈리아
    "streglio": "이탈리아", "caffe molinari": "이탈리아", "novi": "이탈리아",
    "cremcaffe": "이탈리아", "antica pasticceria muzzi": "이탈리아",
    # 스페인
    "galletas artiach": "스페인", "fontaneda": "스페인", "delaviuda": "스페인",
    "el almendro": "스페인", "chocolates valor": "스페인",
    # 캐나다 -- 자사 포트폴리오(Hero Group)와 동일 모기업
    "baby gourmet": "캐나다 — Hero Group 계열 (오가닉스와 공급선 중복)",
    # 미국 -- 병행 파이프라인 문서에는 없고, 일반 상식(공개된 기업 인수 사실)으로 추가:
    # Ferrero가 2018년 Ferrara Candy Company를 인수. 실시간 리서치로 재확인된 건 아님.
    "ferrara": "미국 — Ferrero가 2018년 인수 (일반 지식 기반, 실시간 확인 아님)",
}

# 조건 B 위반 -- 카테고리 하드제외 확인됨
_CATEGORY_EXCLUDED_BRANDS = {
    "rebecca ruth candy": "버번 함유", "mt olive pickle": "피클", "lee's pork rinds": "OEM",
    "baxters of speyside": "수프·소스", "rachel's organic": "유제품", "halen mon": "소금",
    "barker's of geraldine": "잼", "aurion": "제분", "ok snacks": "PB/OEM",
    "dk snack": "PB/OEM", "paolo lazzaroni": "주류 전용", "el gaitero": "주력이 시드라(알코올)",
    "horchateria daniel": "냉장·초단기 유통기한", "lugar da veiga": "OEM 성격",
}

# 조건 D·E 위반 -- 검증 불가 또는 폐업/파산/업종불일치 확인됨
_INVALID_OR_DEFUNCT_BRANDS = {
    "salerno": "검증 불가", "mikesell's": "검증 불가", "awrey's bakery": "폐업",
    "pearson's candy": "운영 불안정", "peyrano": "파산", "piccolo": "도메인 매물(영국 이유식)",
    "wescobee": "국가 오인", "amaizin": "실체 불명", "sabadi": "신생 (헤리티지 미확인)",
    "ercoli 1928": "업종 오인", "torronificio barbieri": "호텔업으로 전환",
    "pemberton's victorian chocolates": "폐업", "hval sjokoladefabrikk": "사이트 오염",
    "cornelius knudsen": "업종 무관", "vetusta nursia": "관광 사이트",
}

_ALL_REGISTRIES: list[tuple[str, dict[str, str]]] = [
    ("korea_distributed", _KOREA_DISTRIBUTED),
    ("multinational_owned", _MULTINATIONAL_OWNED_BRANDS),
    ("category_excluded", _CATEGORY_EXCLUDED_BRANDS),
    ("invalid_or_defunct", _INVALID_OR_DEFUNCT_BRANDS),
]

# The dict literals above are written as readable display names (some with
# apostrophes, e.g. "Whittaker's"), not already run through normalize_brand_name --
# and normalize_brand_name turns "Whittaker's" into "whittaker s" (the apostrophe
# becomes a space, not nothing), which doesn't match the literal key "whittaker's".
# Re-keying every registry through the same normalizer at import time means the
# lookup and the keys are guaranteed to use identical normalization, instead of
# relying on every key being hand-typed in already-normalized form (verified by a
# real test catching "Whittaker's" silently failing to match before this fix).
_NORMALIZED_REGISTRIES: list[tuple[str, dict[str, str]]] = [
    (category, {normalize_brand_name(k): v for k, v in registry.items()})
    for category, registry in _ALL_REGISTRIES
]


def known_excluded_brand(name: str) -> tuple[str, str] | None:
    """Checks a candidate's normalized name against every curated registry above.
    Returns (category, reason) or None. Exact-match only, deliberately -- same
    precision-first philosophy as the handoff doc's own L1 dedup tier (auto-exclude
    only on exact match; a fuzzy/partial name match here could just as easily be an
    unrelated brand that happens to share a common word)."""
    key = normalize_brand_name(name)
    if not key:
        return None
    for category, registry in _NORMALIZED_REGISTRIES:
        if key in registry:
            return category, registry[key]
    return None
