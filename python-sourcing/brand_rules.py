"""OnriKorea-specific hard-exclude rules (조건 B/C from the sourcing spec) checked
against real candidate text -- search snippet first (cheap, pre-crawl), then the
scraped site text (more reliable, post-crawl).

A keyword hit here is a signal to record and reject on, not a claim that regex
understands the page -- "Milk Chocolate" containing "milk" or "BEER NUTS" containing
"beer" would be false positives for a naive substring check, so every pattern below
uses word boundaries and, where the word alone is too ambiguous (milk, beer), a more
specific compound term instead (e.g. "milk products" / "dairy", not bare "milk").
"""

import re

CATEGORY_EXCLUDE_PATTERNS = {
    "alcohol": r"\b(brewery|distiller|winery|whisky|whiskey|vodka|gin|rum|liqueur)\b",
    "dairy": r"\b(dairy|creamery|cheesemaker|yoghurt|yogurt|milk products)\b",
    "sauce": r"\b(sauce|ketchup|mustard|mayonnaise|marmalade|jam|chutney|pickle|relish)\b",
    # conservas (Spanish for canned goods) and jamón/jamon (ham) -- called out by name
    # in the parallel Claude-pipeline handoff doc as real seafood/fresh-meat risks in
    # Spanish-language buckets that plain English keywords never would have caught.
    "seafood": r"\b(seafood|canned fish|tuna|sardine|anchov|conservas)\b",
    "fresh": r"\b(butcher|charcuterie|fresh produce|greengrocer|abattoir|jam[oó]n|hamon)\b",
    "oem_b2b": r"\b(private label|contract manufactur|OEM|ODM|co-?pack|ingredient supplier|foodservice only)\b",
    "raw": r"\b(flour mill|milling company|bulk grain|commodity sugar)\b",
}

# 조건 C 하드 제외 -- 대형 글로벌 멀티내셔널의 계열사로 확인되면 즉시 제외
HARD_EXCLUDED_PARENTS = {
    "nestle", "danone", "pepsico", "mondelez", "coca-cola", "cocacola", "unilever",
    "ferrero", "jde peet's", "jde peets", "asahi", "campbell's", "campbells",
    "keurig dr pepper", "tchibo", "hero group", "arnott's", "arnotts", "goodman fielder",
    "mars", "hershey", "general mills", "kellanova", "kellogg", "conagra",
    "j.m. smucker", "smucker's", "hain celestial", "flowers foods", "post holdings",
    "pladis", "kraft heinz", "grupo bimbo", "barry callebaut",
    # 첫 실제 실행에서 이 두 곳의 본사 "about us" 페이지 자체가 후보로 그대로 들어옴
    "cargill", "orkla",
    # 병행 Claude 파이프라인 인수인계 문서(조건 C)에 명시된, 우리 목록에 없던 대형 계열사
    "lavazza", "illy", "barilla", "ebro foods", "intersnack", "julius meinl",
    "massimo zanetti",
}

# 조건 C -- 자사 기존 포트폴리오와 같은 모기업 계열 (공급선 분산 효과가 없어 제외)
# 오가닉스(Organix)가 Hero Group 소유라, Hero Group 계열은 전부 여기 해당. 사이트에는 보통
# 지역 법인명("Hero Canada", "Hero UK")으로 나오지 실제로 "Hero Group"이라고 안 쓰는 경우가
# 많아서(Baby Gourmet 실제 사례), 알려진 지역 법인명도 같이 넣어둔다.
OWN_PORTFOLIO_PARENTS = {
    "hero group", "hero canada", "hero uk", "hero spain", "hero españa",
}

_OWNERSHIP_PATTERN = re.compile(
    r"\b(?:acquired by|part of|a brand of|owned by)\s+([A-Za-z][\w&.\- ]{1,40})", re.I
)


def _find_known_parent(text: str, parents: set[str]) -> str | None:
    """Word-boundary match against a parent-name set -- a naive substring check would
    let "mars" match "marshmallow" or "marseille", which a short conglomerate name like
    this makes a real risk, not a theoretical one."""
    lower = text.lower()
    for parent in parents:
        if re.search(r"\b" + re.escape(parent) + r"\b", lower):
            return parent
    return None


def known_parent_in_name(name: str) -> tuple[str, str] | None:
    """Checks the CANDIDATE'S OWN guessed name against known multinational parents --
    complementary to ownership_signal, which only catches an explicit 'a brand of X'
    phrase on the scraped site. Some multinationals' own product lines (e.g. Mars's
    "American Heritage Chocolate", or mars.com's own "Mars Global" about page) never
    say "owned by Mars" anywhere -- the parent's name is just baked into the name
    itself. Returns (parent, rule_code) or None."""
    hit = _find_known_parent(name, HARD_EXCLUDED_PARENTS)
    if hit:
        return hit, "multinational_parent"
    hit = _find_known_parent(name, OWN_PORTFOLIO_PARENTS)
    if hit:
        return hit, "own_portfolio_parent"
    return None


# "Dairy-free" and "non-dairy" satisfy \bdairy\b just as well as a real dairy mention
# does -- a hyphen is a non-word character, so the boundary holds on both sides. A real
# run hard-rejected a supplement site (category "dairy") purely from this: supplement/
# snack marketing constantly advertises "dairy-free"/"gluten-free"/"seafood-free" as a
# selling point, which is the opposite of actually being in that category.
_NEGATION_PREFIX = re.compile(r"\b(non|free of|no)[\s-]*$")
_NEGATION_SUFFIX = re.compile(r"^[\s-]*free\b")


def category_signal(text: str) -> tuple[str, str] | None:
    """First hard-exclude category keyword hit in `text`, as (category_code, matched
    phrase) -- or None. Checked against the search snippet before crawling, and again
    against the scraped site text after (the site text is far more likely to actually
    mention it)."""
    if not text:
        return None
    lower = text.lower()
    for code, pattern in CATEGORY_EXCLUDE_PATTERNS.items():
        for m in re.finditer(pattern, lower):
            before, after = lower[: m.start()], lower[m.end() :]
            if _NEGATION_SUFFIX.match(after) or _NEGATION_PREFIX.search(before):
                continue
            return code, m.group(0)
    return None


def ownership_signal(text: str) -> tuple[str, str, str] | None:
    """Looks for an "acquired by / a brand of / owned by X" mention in scraped site
    text and checks X against the hard-excluded and own-portfolio parent lists.
    Returns (parent_name, rule_code, matched_phrase) or None. Needs real page text --
    this phrasing essentially never shows up in a short search snippet."""
    if not text:
        return None
    m = _OWNERSHIP_PATTERN.search(text)
    if not m:
        return None
    parent = m.group(1).strip().rstrip(".,")
    hit = _find_known_parent(parent, HARD_EXCLUDED_PARENTS)
    if hit:
        return parent, "multinational_parent", m.group(0)
    hit = _find_known_parent(parent, OWN_PORTFOLIO_PARENTS)
    if hit:
        return parent, "own_portfolio_parent", m.group(0)
    return None
