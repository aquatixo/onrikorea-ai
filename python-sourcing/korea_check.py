"""
Korea-market presence check.

Naver's official Shopping Search API was retired 2026-07-31 with no replacement --
confirmed before building this, not assumed. Scraping Naver/Coupang/Gmarket/11st
directly is fragile and likely to get blocked. Instead, this reuses the same search
backend as discovery (see serper_search.py), scoped to Korean distributor/marketplace
terms.

This produces a SIGNAL, not a verdict -- hit count and the raw result titles/URLs are
stored as evidence for a human to actually read and judge (a search hit could be a real
distributor, a parallel-import reseller, or just an unrelated same-named company).
"""

import re
from urllib.parse import urlparse

from serper_search import search
from name_filter import has_latin_letters

KOREA_QUERY_TEMPLATES = [
    '"{name}" 한국 총판',
    '"{name}" 쿠팡',
]

# 조건 A 핵심 문구 -- 이미 공식/독점 총판이 있다는 명시적 신호. 이게 있으면 하드 제외.
_OFFICIAL_PHRASES = re.compile(r"공식\s*수입원|정식\s*수입원|공식\s*총판|독점\s*총판|공식\s*수입사")

# A hit only counts as Korea-market evidence if it actually lives on a Korean retail/
# marketplace domain -- without this, "{name} 쿠팡" (name + "Coupang") returns whatever
# the search engine thinks is relevant to those two words TOGETHER, which for a
# Japanese/European candidate is very often just that candidate's own (non-Korean) site,
# or an unrelated page that happens to mention both words separately. A real run showed
# this: "和菓子" 쿠팡 returned Japanese shopping pages, counted as "Korea distribution
# evidence" for a candidate that isn't even distributed in Korea at all. hitCount was
# measuring "did Serper return anything", not "is this actually sold in Korea".
_KOREA_RETAIL_DOMAINS = {
    "coupang.com", "naver.com", "smartstore.naver.com", "shopping.naver.com",
    "11st.co.kr", "gmarket.co.kr", "ssg.com", "lotteon.com", "kurly.com",
    "danawa.com", "auction.co.kr", "interpark.com", "oliveyoung.co.kr",
}


def _is_korea_retail_hit(url: str) -> bool:
    try:
        host = urlparse(url).netloc.lower().removeprefix("www.")
    except Exception:
        return False
    if host.endswith(".kr"):
        return True
    return any(host == d or host.endswith("." + d) for d in _KOREA_RETAIL_DOMAINS)


def check_korea_presence(brand_name: str) -> dict:
    hits = []
    for template in KOREA_QUERY_TEMPLATES:
        query = template.format(name=brand_name)
        try:
            results = search(query, count=3)
        except Exception:
            results = []
        for r in results:
            hits.append({"query": query, **r})

    # "hits" (ALL of them, up to 6 -- 2 templates x up to 3 results) is what
    # classify_korea_status must classify against; "topHits" (capped to 5) is only for
    # the evidence/display list main.py builds separately. These used to be conflated --
    # classify_korea_status was called with the capped topHits, so if the one real
    # Korean-retail hit happened to be 6th (a brand's own site usually ranks 1st,
    # pushing a real Coupang listing further down), it silently never reached
    # classification at all.
    korea_hits = [h for h in hits if _is_korea_retail_hit(h.get("url", ""))]
    return {"hitCount": len(korea_hits), "hits": hits, "topHits": hits[:5]}


def classify_korea_status(hits: list[dict], brand_name: str) -> tuple[str, str]:
    """조건 A: "한국에서 검색이 되느냐"가 아니라 "지금 독점 총판 자리가 비어 있느냐"를 판정한다.
    공식/독점 총판 문구가 나오면 하드 제외. 마켓플레이스 판매 정황만 있고 공식 표기가
    없으면 -- 병행수입/구매대행 추정으로, 제외가 아니라 오히려 우선 후보로 취급한다
    (수요는 검증됐고 총판 자리는 비어 있다는 뜻).

    Returns (status, reason). status is never a claim that Korea distribution is
    definitively absent -- 0 hits means "no_evidence_found", not "confirmed absent".
    """
    # Word-boundary, not a bare substring check -- "lance" as `in` would still match
    # inside "freelance", "elegance", "reliance", "ambulance", which is exactly the
    # class of bug the same-hit requirement below was meant to close. A real run
    # rejected "Lance" again after that first fix, which is what exposed this.
    #
    # BUT \b only exists where a word character meets a non-word character -- Japanese/
    # Korean text has no spaces between "words" at all, so a CJK brand name embedded in
    # a run of continuous CJK text (e.g. "和菓子" inside "全国の和菓子店一覧") never has a
    # \b on either side, and this pattern would never match (verified empirically: it
    # doesn't). That silently disabled the official_distributor hard-exclude for every
    # non-Latin brand name. Latin names keep the \b (still needed for the Lance/
    # freelance case); non-Latin names fall back to a plain substring check instead.
    if has_latin_letters(brand_name):
        name_pattern = re.compile(r"\b" + re.escape(brand_name.lower()) + r"\b")
        name_hit = lambda text: bool(name_pattern.search(text.lower()))
    else:
        lowered_name = brand_name.lower()
        name_hit = lambda text: lowered_name in text.lower()

    # "공식총판" is common Korean e-commerce boilerplate -- for a short/generic brand
    # name (Lance, Roka, Fini, Terra...) the search can return an unrelated hit that
    # merely happens to contain that phrase. Checking the joined text of every hit at
    # once let a totally unrelated hit's boilerplate reject a brand that never showed
    # up anywhere near it. Require the SAME hit to mention both the phrase and the
    # brand name, so an irrelevant hit can't veto an unrelated candidate.
    #
    # Still not enough for a short/common acronym, though -- verified empirically:
    # "PBS" 한국 총판 returned (주)피비에스코리아, a completely unrelated Korean company
    # that is just also named "PBS" (a Public Broadcasting Service candidate has
    # nothing to do with it). The same-hit requirement above can't catch this, because
    # it genuinely IS the same hit -- both the name and the phrase appear together on
    # that one page, just about a different "PBS" entirely. Below some length, a name
    # match proves nothing on its own, so the hard exclude is skipped for short names
    # and falls through to the softer, non-rejecting signals instead.
    name_is_too_short_to_trust = len(brand_name.strip()) < 5
    if not name_is_too_short_to_trust:
        for h in hits:
            text = f"{h.get('title', '')} {h.get('description', '')}"
            if name_hit(text) and _OFFICIAL_PHRASES.search(text):
                return (
                    "official_distributor",
                    "공식/정식 수입원 또는 총판 문구가 검색 결과에서 발견됨 — 기존 총판 존재로 추정, 소싱 대상에서 제외",
                )

    # Counting ALL hits here (as before) measured "did Serper return anything for
    # these two keywords", not "is this actually sold in Korea" -- a hit on the
    # candidate's own (non-Korean) site, or an unrelated page, counted the same as a
    # real Coupang listing. Only a hit on an actual Korean retail/marketplace domain
    # (or any .kr site) counts toward the threshold below; see _is_korea_retail_hit.
    korea_hits = [h for h in hits if _is_korea_retail_hit(h.get("url", ""))]

    if len(korea_hits) >= 3:
        return (
            "parallel_import",
            "다수의 판매 정황이 발견됐으나 공식 총판 표기는 없음 — 병행수입/구매대행 추정 (제외 아님, 우선 후보)",
        )

    if len(korea_hits) >= 1:
        return (
            "cross_border",
            "소수의 판매 정황이 발견됐으나 공식 총판 표기는 없음 (제외 아님)",
        )

    return (
        "no_evidence_found",
        "한국 유통 관련 근거를 찾지 못함 — 유통이 없다는 증명은 아님, 검토 필요",
    )
