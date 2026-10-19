"""Shelf life: the company only imports food that keeps for 12 months or more (user,
2026-10-15) -- shipping, customs and shelf time in Korea eat most of anything shorter.

Deterministic, no LLM:
- shelf_life_months(text): reads a stated shelf life ("shelf life: 18 months",
  "MHD 12 Monate", "durata 24 mesi", "賞味期限 製造日より180日") and returns it in months.
  A site that sells several products states several -- the LONGEST one is returned, so a
  biscuit maker that also sells a 1-month fresh cake is judged by its biscuits.
- chilled_hits(text): how often the site says its products are kept cold or frozen.
- search_shelf_life(name, country): one Google search when the site states nothing.

Most brand homepages never state a shelf life at all, so "not stated" is the normal case
and is never a reason to drop a candidate on its own -- it is noted as unconfirmed.
"""

import re

from search_errors import SearchAuthError
from serper_search import search

MIN_SHELF_LIFE_MONTHS = 12

_UNITS = (
    r"months?|mths?|days?|weeks?|years?|yrs?|"  # en
    r"monate?n?|tage?n?|wochen|jahre?n?|"  # de
    r"mois|jours?|semaines?|ans?|"  # fr
    r"mesi|mese|giorni|settimane|anni|anno|"  # it
    r"meses|mes|d[ií]as|semanas|años|año|"  # es
    r"ヶ月|か月|カ月|ケ月|ヵ月|箇月|日間|日|年"  # ja
)
_KEYWORDS = (
    r"shelf[\s-]?life|best[\s-]before|"
    r"mindesthaltbarkeit\w*|\bmhd\b|haltbarkeit|haltbar|"
    r"\bdluo\b|\bddm\b|dur[ée]e\s+de\s+conservation|conservation|"
    r"conservabilit[àa]|durata|scadenza|"
    r"vida\s+[úu]til|caducidad|consumo\s+preferente|"
    r"賞味期限|消費期限|日持ち|保存期間"
)
# A number, or a range/list of two ("12-18", "12 and 18", "6〜12") -- the larger one counts.
_NUMBER = r"(?<![\d.,])(\d{1,3})(?:[.,]\d)?(?:\s*(?:-|–|~|〜|～|to|and|or|bis|und|à|et|a|e|y|o)\s*(\d{1,3}))?"
# "<keyword> ... 18 months" -- up to 40 characters between, no full stop or other digits
# in between ("shelf life: from production 18 months" yes; a date like "2026年10月" no,
# its digits are in the gap).
_AFTER = re.compile(rf"(?:{_KEYWORDS})[^.。\d]{{0,40}}?{_NUMBER}\s*({_UNITS})(?![a-zà-ÿ])", re.I)
# "18 months shelf life", "12 Monate haltbar", "24 mesi di conservabilità".
_BEFORE = re.compile(rf"{_NUMBER}\s*({_UNITS})(?![a-zà-ÿ])\s*(?:of|de|di|del|der|von)?\s*(?:{_KEYWORDS})", re.I)
# Periods written as words, after a keyword: "Haltbarkeit von 4 Wochen bis zu einem halben
# Jahr" (Felicitas), "keeps for a year", "賞味期限は半年".
_WORDED = {
    6: r"half\s+a\s+year|six\s+months|halbe[ns]?\s+jahr|sechs\s+monate|six\s+mois|demi[\s-]ann[ée]e|"
    r"mezzo\s+anno|sei\s+mesi|medio\s+año|seis\s+meses|半年",
    12: r"(?:a|one)\s+(?:full\s+)?year|ein(?:em|es)?\s+jahr|un\s+an\b|une\s+ann[ée]e|un\s+anno|un\s+año|一年",
    24: r"two\s+years|zwei\s+jahre|deux\s+ans|due\s+anni|dos\s+años|二年",
}
_AFTER_WORDED = re.compile(
    rf"(?:{_KEYWORDS})[^.。]{{0,60}}?(" + "|".join(f"(?P<m{k}>{v})" for k, v in _WORDED.items()) + ")",
    re.I,
)


def _to_months(n: int, unit: str) -> float:
    u = unit.lower()
    if u.startswith(("day", "tag", "jour", "giorn", "día", "dia")) or u in ("日", "日間"):
        return n / 30
    if u.startswith(("week", "woch", "semai", "settim", "seman")):
        return n * 7 / 30
    if u.startswith(("year", "yr", "jahr", "an", "ann", "año")) or u == "年":
        return n * 12
    return n  # months in every language


def shelf_life_months(text: str) -> int | None:
    """The longest shelf life stated in `text`, in whole months, or None if none is."""
    if not text:
        return None
    found = []
    for pattern in (_AFTER, _BEFORE):
        for m in pattern.finditer(text):
            n = max(int(m.group(1)), int(m.group(2) or 0))
            months = _to_months(n, m.group(3))
            # 1 day .. 5 years; anything else is a misread (a date, a price, an amount).
            if 1 / 30 <= months <= 60:
                found.append(months)
    for m in _AFTER_WORDED.finditer(text):
        found += [k for k in _WORDED if m.group(f"m{k}")]
    return round(max(found)) if found else None


# Kept cold or frozen = can't sit in a container for weeks. "Store in a cool, dry place"
# (kühl und trocken) is the normal wording for shelf-stable sweets, so only refrigerator /
# freezer words count, and "do not refrigerate" (chocolate makers say it often) is skipped.
#
# Two kinds. STORAGE wording says how the product itself must be kept. PRODUCT words
# (gelato, ice cream) only name a cold product -- Babbi, a wafer maker that also sells
# ingredients for gelato shops, says "gelato" dozens of times -- so they only add to the
# count once the site also has at least one storage instruction.
_CHILLED_STORAGE = re.compile(
    r"(?<!not\s)(?<!never\s)(?:keep|store)\s+(?:it\s+|them\s+)?(?:refrigerated|in\s+the\s+fridge|frozen)|"
    r"\bchilled\b|\bfrozen\s+(?:desserts?|cakes?|products?)|"
    r"tiefgekühlt|im\s+kühlschrank\s+(?:lagern|aufbewahren)|"
    r"[àa]\s+conserver\s+au\s+r[ée]frig[ée]rateur|\bsurgel[ée]s?\b|"
    r"conservare\s+in\s+frigorifero|\bsurgelat[oi]\b|"
    r"conservar\s+(?:en\s+)?(?:refrigeraci[oó]n|nevera|frigor[ií]fico)|\bcongelad[oa]s?\b|"
    r"要冷蔵|要冷凍|冷凍便|クール便",
    re.I,
)
_CHILLED_PRODUCT = re.compile(
    r"\bice[\s-]cream|\bgelat[oi]\b|\bsorbet|speiseeis|\bhelados?\b|生チョコ|ジェラート|アイスクリーム",
    re.I,
)


def chilled_hits(text: str) -> int:
    text = text or ""
    storage = len(_CHILLED_STORAGE.findall(text))
    return storage + len(_CHILLED_PRODUCT.findall(text)) if storage else 0


# Google, once per candidate whose own site states no shelf life. Retailer and wholesaler
# product pages often do ("Shelf life: 12 months", "賞味期限 製造日より360日").
_SEARCH_TERM = {
    "Germany": "Haltbarkeit",
    "France": "DLUO",
    "Italy": "shelf life",
    "Spain": "vida útil",
    "Japan": "賞味期限",
}


def search_shelf_life(name: str, country: str | None) -> dict:
    """{"months", "url"} for the longest shelf life found in Google results that mention
    this brand by name, {"months": None} when none does. A result has to name the brand
    in its own title/snippet -- the same search also returns other brands' products.
    Raises SearchAuthError (stop the run); any other search failure -> "failed": True."""
    term = _SEARCH_TERM.get(country or "", "shelf life")
    try:
        results = search(f'"{name}" {term}', count=8)
    except SearchAuthError:
        raise
    except Exception:
        return {"months": None, "failed": True}
    if re.search(r"[A-Za-z]", name):
        mentions = re.compile(r"(?<![a-z0-9])" + re.escape(name.lower()) + r"(?![a-z0-9])")
        names_brand = lambda text: bool(mentions.search(text.lower()))
    else:
        names_brand = lambda text: name in text
    best = None
    for r in results:
        text = f"{r.get('title', '')} {r.get('description', '')}"
        if not names_brand(text):
            continue
        months = shelf_life_months(text)
        if months is not None and (best is None or months > best["months"]):
            best = {"months": months, "url": r.get("url", "")}
    return best or {"months": None}
