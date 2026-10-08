"""Dynamic queries for a lane whose hand-written queries (categories.py) are used up.

Queries are combinations of query_vocab.VOCAB words: <product> <maker> [<region>] <suffix>.
Thousands per country, so a lane never runs dry -- the daily search budget is the limit.

Choosing the next query is deterministic (same ledger -> same choice):
1. Paging first: a generated query whose page produced verified candidates continues to its
   next result page, up to MAX_PAGE (measured: pages 1-3 still bring new makers, from
   page 4 results drift off-topic). Only for backends that support paging.
2. Otherwise the best-scoring combination not run yet. Every vocabulary word is scored
   from the ledger (static and generated queries alike) as (hits + 1) / (runs + 2): an
   untried word starts at 0.5, words whose queries found candidates rise, words that keep
   finding nothing sink -- but are never removed. Combinations are ordered so consecutive
   ties change the product first, then the maker, then the region.

Ledger key: the query text for page 1, "<text> [pN]" for later pages.
"""

import re

from query_vocab import VOCAB

MAX_PAGE = 3
_PAGE_SUFFIX = re.compile(r"\s\[p(\d+)\]$")


def ledger_key(text: str, page: int) -> str:
    return text if page == 1 else f"{text} [p{page}]"


def split_key(key: str) -> tuple[str, int]:
    m = _PAGE_SUFFIX.search(key)
    return (key[: m.start()], int(m.group(1))) if m else (key, 1)


def combinations(lane: str) -> list[dict]:
    v = VOCAB.get(lane)
    if not v:
        return []
    out = []
    for region in [""] + v["regions"]:
        for maker in v["makers"]:
            for product, category in v["products"]:
                parts = [product, maker] + ([region] if region else []) + ([v["suffix"]] if v["suffix"] else [])
                words = [product, maker] + ([region] if region else [])
                out.append({"text": " ".join(parts), "category": category, "words": words})
    return out


def word_scores(lane: str, ledger: list[dict]) -> dict[str, float]:
    v = VOCAB.get(lane)
    if not v:
        return {}
    vocab_words = [p for p, _ in v["products"]] + v["makers"] + v["regions"]
    rows = [(split_key(r["queryText"])[0].lower(), r.get("newCandidates") or 0) for r in ledger]
    scores = {}
    for w in vocab_words:
        lw = w.lower()
        matched = [hits for text, hits in rows if lw in text]
        scores[w] = (sum(matched) + 1) / (len(matched) + 2)
    return scores


def next_query(lane: str, ledger: list[dict], allow_paging: bool = True) -> dict | None:
    """Returns {"key", "text", "page", "category"} or None when every combination is used."""
    combos = combinations(lane)
    if not combos:
        return None
    by_text = {c["text"]: c for c in combos}
    done = {r["queryText"] for r in ledger}

    if allow_paging:
        for r in sorted(ledger, key=lambda r: r["queryText"]):
            text, page = split_key(r["queryText"])
            if text in by_text and (r.get("newCandidates") or 0) > 0 and page < MAX_PAGE:
                nxt = ledger_key(text, page + 1)
                if nxt not in done:
                    return {"key": nxt, "text": text, "page": page + 1, "category": by_text[text]["category"]}

    scores = word_scores(lane, ledger)
    best, best_score = None, -1.0
    for c in combos:
        if c["text"] in done:
            continue
        s = sum(scores[w] for w in c["words"]) / len(c["words"])
        if s > best_score + 1e-9:
            best, best_score = c, s
    if best is None:
        return None
    return {"key": best["text"], "text": best["text"], "page": 1, "category": best["category"]}
