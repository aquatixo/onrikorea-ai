"""
Google Search retrieval via the Gemini API's grounding tool -- replaces tavily_search.py
(Tavily's free tier, 1,000 credits/month, wasn't enough for one full sourcing run, which
burns ~50-185 search calls; see main.py/korea_check.py for the actual call counts).

Response shape verified directly against Google's own docs (ai.google.dev, 2026-09) rather
than assumed -- the Interactions API is the current documented path for Google Search
grounding, not the older generate_content/GenerateContentConfig(tools=[...]) pattern an
earlier training snapshot might suggest:

    interaction = client.interactions.create(
        model=GEMINI_MODEL, input=prompt, tools=[{"type": "google_search"}]
    )

interaction.steps includes a "model_output" step whose text content blocks carry an
`annotations` list of `url_citation` objects ({url, title, start_index, end_index}) --
title there is just the source's domain (e.g. "aljazeera.com"), not a real page title, so
this prompts the model to state each result's actual name/snippet as plain text instead of
relying on that field, and only keeps a listed result when a citation's start_index falls
inside that same line -- a line with no citation attached has no verified source behind it
and is dropped, same "don't fabricate evidence" rule the rest of this pipeline follows
everywhere else (see main.py's module docstring).

Untested against a live API key as of this writing (none was configured yet) -- run one
real sourcing pass after adding GEMINI_API_KEY and sanity-check main.py's printed
"+ {name} -> {verdict}" lines look right; the list-format prompt below may need a tweak if
the model doesn't follow it exactly.
"""

import re

from google import genai

from config import GEMINI_API_KEY, GEMINI_MODEL

_client: "genai.Client | None" = None


def _get_client() -> "genai.Client":
    global _client
    if not GEMINI_API_KEY:
        raise RuntimeError("GEMINI_API_KEY is not set in .env")
    if _client is None:
        _client = genai.Client(api_key=GEMINI_API_KEY)
    return _client


_LIST_LINE = re.compile(r"^\s*\d+[.)]\s*TITLE:\s*(?P<title>.+?)\s*\|\s*SNIPPET:\s*(?P<snippet>.*?)\s*$")


def search(query: str, count: int = 8) -> list[dict]:
    prompt = (
        f"Search the web for: {query}\n\n"
        f"List up to {count} different, distinct web pages you actually found via "
        "search, one per line, most relevant first, in exactly this format and nothing "
        "else (no intro, no summary, no extra commentary):\n"
        "1. TITLE: <short page or business title> | SNIPPET: <one sentence about it>\n"
        "2. TITLE: ... | SNIPPET: ...\n"
    )
    interaction = _get_client().interactions.create(
        model=GEMINI_MODEL,
        input=prompt,
        tools=[{"type": "google_search"}],
    )

    results: list[dict] = []
    for step in interaction.steps:
        if step.type != "model_output":
            continue
        for block in step.content:
            if block.type != "text" or not block.annotations:
                continue
            text = block.text

            # Map each line's character range in `text` so a citation's start_index can
            # be traced back to "which numbered line is this evidence for".
            line_spans = []
            offset = 0
            for line in text.split("\n"):
                line_spans.append((offset, offset + len(line), line))
                offset += len(line) + 1

            for line_start, line_end, line in line_spans:
                m = _LIST_LINE.match(line)
                if not m:
                    continue
                citation_url = next(
                    (
                        a.url
                        for a in block.annotations
                        if a.type == "url_citation" and line_start <= a.start_index < line_end
                    ),
                    None,
                )
                if not citation_url:
                    continue  # no real cited source for this line -- drop it, don't guess
                results.append(
                    {
                        "title": m.group("title").strip(),
                        "url": citation_url,
                        "description": m.group("snippet").strip(),
                    }
                )

    return results[:count]
