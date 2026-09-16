"""Thin wrapper around the Brave Web Search API.

Verified request/response shape directly against Brave's docs (2026-09):
GET https://api.search.brave.com/res/v1/web/search
Header: X-Subscription-Token: <key>
Params: q, count (max 20)
Response: {"web": {"results": [{"title", "url", "description"}, ...]}}
"""

import requests
from config import BRAVE_SEARCH_API_KEY

BRAVE_ENDPOINT = "https://api.search.brave.com/res/v1/web/search"


def search(query: str, count: int = 8) -> list[dict]:
    if not BRAVE_SEARCH_API_KEY:
        raise RuntimeError("BRAVE_SEARCH_API_KEY is not set in .env")

    resp = requests.get(
        BRAVE_ENDPOINT,
        params={"q": query, "count": min(count, 20)},
        headers={"Accept": "application/json", "X-Subscription-Token": BRAVE_SEARCH_API_KEY},
        timeout=15,
    )
    resp.raise_for_status()
    data = resp.json()
    results = data.get("web", {}).get("results", [])
    return [
        {"title": r.get("title", ""), "url": r.get("url", ""), "description": r.get("description", "")}
        for r in results
    ]
