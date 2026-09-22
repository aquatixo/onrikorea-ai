"""
Korea-market presence check.

Naver's official Shopping Search API was retired 2026-07-31 with no replacement --
confirmed before building this, not assumed. Scraping Naver/Coupang/Gmarket/11st
directly is fragile and likely to get blocked. Instead, this reuses the same Tavily
Search API as discovery, scoped to Korean distributor/marketplace terms.

This produces a SIGNAL, not a verdict -- hit count and the raw result titles/URLs are
stored as evidence for a human to actually read and judge (a search hit could be a real
distributor, a parallel-import reseller, or just an unrelated same-named company).
"""

import re

from tavily_search import search

KOREA_QUERY_TEMPLATES = [
    '"{name}" 한국 총판',
    '"{name}" 쿠팡',
]

# 조건 A 핵심 문구 -- 이미 공식/독점 총판이 있다는 명시적 신호. 이게 있으면 하드 제외.
_OFFICIAL_PHRASES = re.compile(r"공식\s*수입원|정식\s*수입원|공식\s*총판|독점\s*총판|공식\s*수입사")


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

    return {"hitCount": len(hits), "topHits": hits[:5]}


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
    name_pattern = re.compile(r"\b" + re.escape(brand_name.lower()) + r"\b")

    # "공식총판" is common Korean e-commerce boilerplate -- for a short/generic brand
    # name (Lance, Roka, Fini, Terra...) the search can return an unrelated hit that
    # merely happens to contain that phrase. Checking the joined text of every hit at
    # once let a totally unrelated hit's boilerplate reject a brand that never showed
    # up anywhere near it. Require the SAME hit to mention both the phrase and the
    # brand name, so an irrelevant hit can't veto an unrelated candidate.
    for h in hits:
        text = f"{h.get('title', '')} {h.get('description', '')}"
        if name_pattern.search(text.lower()) and _OFFICIAL_PHRASES.search(text):
            return (
                "official_distributor",
                "공식/정식 수입원 또는 총판 문구가 검색 결과에서 발견됨 — 기존 총판 존재로 추정, 소싱 대상에서 제외",
            )

    if len(hits) >= 3:
        return (
            "parallel_import",
            "다수의 판매 정황이 발견됐으나 공식 총판 표기는 없음 — 병행수입/구매대행 추정 (제외 아님, 우선 후보)",
        )

    if len(hits) >= 1:
        return (
            "cross_border",
            "소수의 판매 정황이 발견됐으나 공식 총판 표기는 없음 (제외 아님)",
        )

    return (
        "no_evidence_found",
        "한국 유통 관련 근거를 찾지 못함 — 유통이 없다는 증명은 아님, 검토 필요",
    )
