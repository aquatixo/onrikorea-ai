"""Positive check: does this candidate's own site read like a food/confectionery
business at all?

Until this existed, the pipeline only had NEGATIVE filters (blocklists, excluded
categories) plus name<->domain matching -- and any company whose name matches its own
domain passes that last one, whatever it sells. Real run: ~20 heirloom-seed companies
(from a Slow Food "Ark of Taste" roster) and a handful of Japanese job/OEM-list pages
all came back as brand candidates, because nothing ever asked "does this site sell
food". Deterministic keyword counting only -- no LLM.
"""

import re

# Stems, matched as substrings (case-insensitive) so "Welshcakes", "Bonbonmacherei",
# "Pasticceria" all count. Deliberately NOT included: bare "sweet" (sweet corn seeds),
# bare "tea" (substring of "steam", "team"), "cookie" is counted only after cookie-banner
# boilerplate is stripped (see _COOKIE_BANNER).
_FOOD_STEMS = (
    # English
    "biscuit", "cookie", "cake", "chocolat", "candy", "candies", "confection", "bakery",
    "bakes", "baked", "pastr", "sweets", "wafer", "caramel", "toffee", "brittle", "fudge",
    "praline", "snack", "shortbread", "gingerbread", "marshmallow", "licorice", "liquorice",
    "nougat", "marzipan", "lollipop", "gummy", "gummies", "truffle", "coffee", "honey",
    # pasta and coffee -- a dry run dropped Rustichella d'Abruzzo (pasta exporter, zero
    # hits) and a coffee roaster whose only matched word was "Kaffee"
    "pasta", "pastificio", "espresso", "roaster", "roastery", "rösterei", "roesterei",
    "torrefaz", "tostador", "torréfact",
    # liquorice in each language -- Amarelli's homepage only ever says "liquirizia"
    "liquirizia", "lakritz", "regaliz", "réglisse", "reglisse", "lakrids", "salmiak",
    # German
    "bonbon", "gebäck", "gebaeck", "lebkuchen", "konditor", "bäcker", "baecker", "süßwaren",
    "suesswaren", "schokolade", "keks", "plätzchen", "stollen", "praline", "kaffee", "honig",
    # French
    "confiserie", "pâtisserie", "patisserie", "gâteau", "gateau", "chocolat", "sablé",
    "boulangerie", "biscuiterie", "caramel", "nougat", "calisson", "madeleine",
    # Italian
    "biscotti", "dolci", "pasticceria", "cioccolat", "caramelle", "torrone", "panettone",
    "amaretti", "cantucci", "croccante", "miele", "confett", "dragée", "dragee", "mandorl",
    # Spanish / Portuguese
    "dulce", "galleta", "pastelería", "pasteleria", "turrón", "turron", "mazapán", "bollería",
    "chocolate", "pão de ló", "doce", "bolacha", "queijada",
    # Japanese / Korean
    "菓子", "和菓子", "洋菓子", "せんべい", "煎餅", "饅頭", "羊羹", "チョコ", "クッキー", "ケーキ",
    "飴", "あめ", "まんじゅう", "과자", "쿠키", "초콜릿",
)

# Whole-word, case-insensitive: short or collision-prone terms.
_FOOD_WORDS = re.compile(r"\b(tea|thé|tee|té|cocoa|cacao|jam|nuts?|cereal)\b", re.I)

_NONFOOD_STEMS = (
    "seed", "garden", "gardening", "heirloom", "vegetable", "fertiliz", "perennial",
    "planting", "germination", "nursery", "求人", "採用情報", "転職", "recruit", "career",
    "hotel", "tourism", "tourist", "real estate", "software", "apparel", "clothing",
)

# "This site uses cookies" etc. -- would otherwise count as a food word on every site.
_COOKIE_BANNER = re.compile(
    r"[^.!?\n]{0,80}\bcookies?\b[^.!?\n]{0,80}(policy|settings|preferences|consent|"
    r"browser|accept|manage|enable|track|experience|analytics|necessary)[^.!?\n]{0,40}"
    r"|(accept|manage|reject|allow|decline)\s+(all\s+)?cookies?"
    r"|\bcookies?\s+(policy|settings|preferences|consent|notice|banner)",
    re.I,
)

# Below this length the page is almost certainly a JS shell or an error page -- there's
# nothing to judge, so don't pretend to (see check_food_relevance).
_MIN_TEXT_LEN = 400

_MIN_FOOD_HITS = 3
_MIN_DISTINCT_FOOD_TERMS = 2
_MIN_FOOD_DENSITY_PER_1K = 0.5


def has_food_words(text: str) -> bool:
    lowered = (text or "").lower()
    return any(s.lower() in lowered for s in _FOOD_STEMS) or bool(_FOOD_WORDS.search(lowered))


def _count_stems(text: str, stems: tuple[str, ...]) -> tuple[int, set[str]]:
    total = 0
    distinct: set[str] = set()
    for stem in stems:
        n = text.count(stem)
        if n:
            total += n
            distinct.add(stem)
    return total, distinct


_CORP_PREFIX = re.compile(r"株式会社|有限会社|合同会社|\(株\)|（株）|㈱|\(有\)|（有）")
_BRACKETED = re.compile(r"[（(][^）)]*[）)]")


def name_on_site(name: str, text: str | None) -> bool | None:
    """For a name with no Latin letters (Japanese/Korean/Chinese): does the candidate's own
    site text actually contain that name? This is the non-Latin counterpart of
    domain_matches_name, which cannot compare such a name against a domain. Measured on real
    pages: a real maker's homepage contains its own name (iwateya.co.jp -> 巖手屋), while a
    regional buyer-directory and a local news site that merely *mention* the company do not.
    None = not enough page text to judge (never drop on that)."""
    if not text or len(text) < 150:
        return None
    core = _BRACKETED.sub(" ", _CORP_PREFIX.sub("", name))
    segments = [s for s in re.split(r"\s+", core) if len(s) >= 2]
    if not segments:
        return None
    return any(seg in text for seg in segments)


def check_food_relevance(text: str | None, extra_text: str = "") -> tuple[bool | None, str]:
    """Returns (verdict, why). verdict True = reads as food business, False = doesn't,
    None = can't tell (page text too short to judge -- caller should NOT drop on None,
    a JS-rendered brand site would otherwise be a false reject)."""
    if not text or len(text) < _MIN_TEXT_LEN:
        # Too little page text (JS shell) to judge the SITE -- but the candidate's own
        # name/snippet can still be conclusive: "High Desert Seed + Gardens" has no food
        # word and two non-food ones. Only drop on that clear a signal; otherwise unknown.
        extra = extra_text.lower()
        extra_nonfood, _ = _count_stems(extra, _NONFOOD_STEMS)
        extra_food, _ = _count_stems(extra, tuple(s.lower() for s in _FOOD_STEMS))
        if extra_nonfood >= 1 and extra_food == 0 and not _FOOD_WORDS.search(extra):
            return False, f"본문 판정 불가지만 이름/스니펫이 비식품 (비식품 단어 {extra_nonfood}개, 식품 단어 없음)"
        return None, "페이지 본문이 짧아 판정 불가"

    cleaned = _COOKIE_BANNER.sub(" ", f"{text} {extra_text}").lower()

    stem_hits, stem_terms = _count_stems(cleaned, tuple(s.lower() for s in _FOOD_STEMS))
    word_matches = _FOOD_WORDS.findall(cleaned)
    food_hits = stem_hits + len(word_matches)
    food_terms = stem_terms | {w.lower() for w in word_matches}

    nonfood_hits, _ = _count_stems(cleaned, _NONFOOD_STEMS)

    if food_hits < _MIN_FOOD_HITS or len(food_terms) < _MIN_DISTINCT_FOOD_TERMS:
        return False, f"식품 관련 단어가 거의 없음 (hits={food_hits}, terms={len(food_terms)})"
    # Density, not just count: a lifestyle/travel blog mentions "cookies" a few times
    # across thousands of words (measured: 4 hits in 13k chars = 0.3 per 1k chars), while
    # real brand sites measured 2.2-12 per 1k chars. 0.5 sits between them with room for
    # a brand's long About pages diluting its own homepage.
    # Computed on the PAGE text only -- the candidate name/snippet is a few words and (for a
    # recipe post) is itself full of food words, which would inflate the density.
    page_cleaned = _COOKIE_BANNER.sub(" ", text).lower()
    page_hits = _count_stems(page_cleaned, tuple(s.lower() for s in _FOOD_STEMS))[0] + len(_FOOD_WORDS.findall(page_cleaned))
    density = page_hits * 1000 / max(len(page_cleaned), 1)
    if density < _MIN_FOOD_DENSITY_PER_1K:
        return False, f"식품 단어 밀도가 낮음 (1000자당 {density:.1f}회) -- 블로그/매거진형 사이트로 추정"
    if food_hits < 2 * nonfood_hits:
        return False, f"식품 단어보다 비식품 단어가 더 많음 (식품 {food_hits} vs 비식품 {nonfood_hits})"
    return True, f"식품 관련 단어 {food_hits}회/{len(food_terms)}종"
