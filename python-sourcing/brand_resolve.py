"""Resolves a harvested producer NAME (from roster_harvest.py, no website yet) to its
own official site -- the second half of the 2-stage redesign.

This is domain_matches_name's correct home. In the discovery path (main.py), it answers
"is this search result a brand's own page" for a result the search engine chose on its
own -- a category mismatch verified repeatedly this project (portals/magazines/
directories that share a domain with their own name pass it just as well as a real
brand does, because the question it actually answers is narrower: "does this URL belong
to this exact name"). Here, the name is already known-real (a third party -- an awards
body, a trade show, a PDO consortium -- already vouched for its existence by listing
it), so the question domain_matches_name asks is exactly the right one to ask.
"""

from name_filter import (
    is_blocked_domain,
    is_article_page,
    is_recipe_page,
    is_adult_content,
    is_portal_page,
    domain_matches_name,
)

_MAX_SEARCH_CALLS_PER_NAME = 2


def resolve_site(name: str, country: str | None, search_fn) -> dict:
    """search_fn is serper_search.search or tavily_search.search -- (query, count) ->
    list of {"title", "url", "description"}. Returns {"website", "searchCalls", "reason"}.
    reason is one of: "resolved" | "no_domain_match" | "no_results" | "all_filtered"."""
    search_calls = 0
    country_part = f" {country}" if country else ""

    for query in (f'"{name}" official site{country_part}', f"{name}{country_part}"):
        search_calls += 1
        try:
            results = search_fn(query, count=5)
        except Exception:
            results = []
        if not results:
            if search_calls >= _MAX_SEARCH_CALLS_PER_NAME:
                return {"website": None, "searchCalls": search_calls, "reason": "no_results"}
            continue

        any_survived = False
        for r in results:
            if (
                is_blocked_domain(r["url"])
                or is_article_page(r["url"])
                or is_recipe_page(r["url"], r.get("title", ""), r.get("description", ""))
                or is_adult_content(r.get("title", ""), r["url"], r.get("description", ""))
                or is_portal_page(r.get("description", ""))
            ):
                continue
            any_survived = True
            if domain_matches_name(name, r["url"]):
                return {"website": r["url"], "searchCalls": search_calls, "reason": "resolved"}

        if search_calls >= _MAX_SEARCH_CALLS_PER_NAME:
            reason = "no_domain_match" if any_survived else "all_filtered"
            return {"website": None, "searchCalls": search_calls, "reason": reason}

    return {"website": None, "searchCalls": search_calls, "reason": "no_results"}
