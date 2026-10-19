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
from search_errors import SearchAuthError

_ENDPOINT = "https://google.serper.dev/search"


def search(query: str, count: int = 8, page: int = 1, gl: str | None = None, hl: str | None = None) -> list[dict]:
    """gl/hl: Google's country/language for the results ("kr"/"ko" for the Korea check --
    without them Korean queries ran against US Google and missed Naver/Coupang listings)."""
    if not SERPER_API_KEY:
        raise SearchAuthError("SERPER_API_KEY가 .env에 없습니다")

    body = {"q": query, "num": min(count, 20)}
    if page > 1:
        body["page"] = page
    if gl:
        body["gl"] = gl
    if hl:
        body["hl"] = hl
    response = requests.post(
        _ENDPOINT,
        headers={"X-API-KEY": SERPER_API_KEY, "Content-Type": "application/json"},
        json=body,
        timeout=20,
    )
    if response.status_code in (401, 403):
        raise SearchAuthError(f"Serper가 API 키를 거부했습니다 (HTTP {response.status_code}) — .env의 SERPER_API_KEY를 확인하세요")
    if response.status_code in (400, 402) and "credit" in response.text.lower():
        raise SearchAuthError(f"Serper 크레딧이 소진되었습니다 (HTTP {response.status_code})")
    response.raise_for_status()
    organic = response.json().get("organic", [])
    return [
        {"title": r.get("title", ""), "url": r.get("link", ""), "description": r.get("snippet", "")}
        for r in organic
    ]
