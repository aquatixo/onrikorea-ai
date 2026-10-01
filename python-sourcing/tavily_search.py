"""Thin wrapper around the Tavily Search API (tavily-python SDK).

Verified request/response shape directly against Tavily's own docs:
TavilyClient(api_key).search(query=..., search_depth=..., max_results=...) ->
{"results": [{"title", "url", "content", "score", ...}], ...}

Re-added alongside serper_search.py (not instead of it) -- Serper and Tavily each have
their own free-tier quota, and main.py can run either backend independently, tracking
its own lane/budget progress per backend (see SourcingLaneState/SourcingQueryLedger/
SourcingDailyBudget in prisma/schema.prisma). Same search(query, count) -> list of
title/url/description dicts as serper_search.py, so main.py needs no logic changes
beyond picking which module to import.
"""

from tavily import TavilyClient
from config import TAVILY_API_KEY

_client: TavilyClient | None = None


def _get_client() -> TavilyClient:
    global _client
    if not TAVILY_API_KEY:
        raise RuntimeError("TAVILY_API_KEY is not set in .env")
    if _client is None:
        _client = TavilyClient(TAVILY_API_KEY)
    return _client


def search(query: str, count: int = 8) -> list[dict]:
    response = _get_client().search(query=query, search_depth="basic", max_results=min(count, 20))
    results = response.get("results", [])
    return [
        {"title": r.get("title", ""), "url": r.get("url", ""), "description": r.get("content", "")}
        for r in results
    ]
