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

import re

from tavily import TavilyClient
from config import TAVILY_API_KEY
from name_filter import NON_BRAND_DOMAINS

_client: TavilyClient | None = None

# Tavily's own docs describe `exclude_domains` (array, max 150) as the real mechanism
# for what categories.py's queries were written assuming Google's trailing "-word"
# operator does inline -- Google honors that directly in the query string (and Serper,
# a Google proxy, inherits it), Tavily's docs never describe any such in-string syntax.
# Stripped here rather than at the categories.py source so the exact same query text
# keeps working for Serper too, without two copies of every query.
_GOOGLE_EXCLUDE_OPERATOR = re.compile(r"\s-\S+")
_MAX_EXCLUDE_DOMAINS = 150

# exact_match was ALSO tried for the quoted anniversary queries ('"depuis 18"' etc.) --
# reverted. Those quotes are a Google partial-decade-prefix trick (match any page
# mentioning "depuis 18xx"), not a literal phrase that appears verbatim anywhere, which
# is specifically what Tavily's own docs say exact_match is for ("a specific name or
# phrase that must appear verbatim"). Verified empirically against the real 3 queries:
# exact_match=True returned 0 results for one of them outright, and for the other two
# didn't zero out but measurably replaced real candidate hits (franceconfiserie.com,
# an actual artisan workshop) with worse ones (a news article, a company directory
# listing, Instagram) -- the opposite of the intended effect. Left off entirely; the
# quoted text still reaches Tavily as plain query text, which already surfaced
# reasonable results without it.


def _get_client() -> TavilyClient:
    global _client
    if not TAVILY_API_KEY:
        raise RuntimeError("TAVILY_API_KEY is not set in .env")
    if _client is None:
        _client = TavilyClient(TAVILY_API_KEY)
    return _client


def search(query: str, count: int = 8) -> list[dict]:
    clean_query = _GOOGLE_EXCLUDE_OPERATOR.sub("", query).strip()
    response = _get_client().search(
        query=clean_query,
        search_depth="basic",
        max_results=min(count, 20),
        exclude_domains=list(NON_BRAND_DOMAINS)[:_MAX_EXCLUDE_DOMAINS],
    )
    results = response.get("results", [])
    return [
        {"title": r.get("title", ""), "url": r.get("url", ""), "description": r.get("content", "")}
        for r in results
    ]
