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

from tavily_search import search

KOREA_QUERY_TEMPLATES = [
    '"{name}" 한국 총판',
    '"{name}" 쿠팡',
]


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
