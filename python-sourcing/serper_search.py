"""
Thin wrapper around the Serper.dev API (a Google SERP proxy) -- replaces gemini_search.py,
whose Google Search grounding turned out to require billing even on a free-tier key: a
live test confirmed the API key itself works fine for plain (non-grounded) generation,
but every grounded call 429'd with "exceeded your current quota", on both the Interactions
API and the older generate_content+Tool path. Serper's free tier gives 2,500 queries with
no credit card, which comfortably covers this pipeline's daily volume (~100-185 search
calls/run) for a couple of weeks before any payment decision is needed.

Verified request/response shape against Serper's own widely-documented API (2026-09):
    POST https://google.serper.dev/search
    headers: {"X-API-KEY": <key>, "Content-Type": "application/json"}
    body: {"q": <query>, "num": <count>}
    -> {"organic": [{"title", "link", "snippet", "position", ...}, ...]}

Same search(query, count) -> list of {"title","url","description"} dicts as the old
tavily_search.py/gemini_search.py, so main.py and korea_check.py need only an import swap.
"""

import requests

from config import SERPER_API_KEY

_ENDPOINT = "https://google.serper.dev/search"


def search(query: str, count: int = 8, page: int = 1) -> list[dict]:
    if not SERPER_API_KEY:
        raise RuntimeError("SERPER_API_KEY is not set in .env")

    body = {"q": query, "num": min(count, 20)}
    if page > 1:
        body["page"] = page
    response = requests.post(
        _ENDPOINT,
        headers={"X-API-KEY": SERPER_API_KEY, "Content-Type": "application/json"},
        json=body,
        timeout=20,
    )
    response.raise_for_status()
    organic = response.json().get("organic", [])
    return [
        {"title": r.get("title", ""), "url": r.get("link", ""), "description": r.get("snippet", "")}
        for r in organic
    ]
