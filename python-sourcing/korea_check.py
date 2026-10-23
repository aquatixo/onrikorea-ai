"""
Korea-market presence check.

Naver's official Shopping Search API was retired 2026-07-31 with no replacement --
confirmed before building this, not assumed. Scraping Naver/Coupang/Gmarket/11st
directly is fragile and likely to get blocked. Instead, this reuses the same search
backend as discovery (see serper_search.py), scoped to Korean distributor/marketplace
terms.

This produces a SIGNAL, not a verdict -- hit count and the raw result titles/URLs are
stored as evidence for a human to actually read and judge (a search hit could be a real
distributor, a parallel-import reseller, or just an unrelated same-named company).
"""

import re
from urllib.parse import urlparse

from serper_search import search
from search_errors import SearchAuthError
from name_filter import has_latin_letters

KOREA_QUERY_TEMPLATES = [
    '"{name}" 한국 총판',
    '"{name}" 쿠팡',
]

# 조건 A 핵심 문구 -- 이미 공식/독점 총판이 있다는 명시적 신호. 이게 있으면 하드 제외.
# 2026-10-19: "공식 판매처", "브랜드관", "공식스토어", "독점수입"도 알아보도록 넓힘.
# 2026-10-23 재검토: 그러나 "정식수입 통관 제품"/"정식 수입 정품"은 병행수입 업자가 흔히 쓰는
# 말이라(= 정상 통관됐다는 뜻) 제외 신호가 아니다 -- 정식은 "정식수입원/정식수입사"만. 또
# "총판 모집"/"대리점 모집"(총판을 구한다), "공식 판매처가 아닙니다"(부정)는 반대 뜻이라 뺀다.
_NOT_RECRUITING_OR_NEGATED = r"(?!\s*(?:을|를)?\s*(?:모집|구함|구합니다|문의))(?!\S{0,2}\s*아(?:님|닙|닌))"
_OFFICIAL_PHRASES = re.compile(
    rf"(?:(?:공식|독점)\s*(?:수입(?:원|사)?|유통|총판|판매처|판매원|대리점)|"
    rf"정식\s*수입(?:원|사)|"
    rf"(?:한국|국내)\s*(?:공식\s*)?총판|"
    rf"공식\s*(?:스토어|몰|샵|쇼핑몰)|브랜드관){_NOT_RECRUITING_OR_NEGATED}"
)

# A hit only counts as Korea-market evidence if it actually lives on a Korean retail/
# marketplace domain -- without this, "{name} 쿠팡" (name + "Coupang") returns whatever
# the search engine thinks is relevant to those two words TOGETHER, which for a
# Japanese/European candidate is very often just that candidate's own (non-Korean) site,
# or an unrelated page that happens to mention both words separately. A real run showed
# this: "和菓子" 쿠팡 returned Japanese shopping pages, counted as "Korea distribution
# evidence" for a candidate that isn't even distributed in Korea at all. hitCount was
# measuring "did Serper return anything", not "is this actually sold in Korea".
_KOREA_RETAIL_DOMAINS = {
    "coupang.com", "naver.com", "smartstore.naver.com", "shopping.naver.com",
    "11st.co.kr", "gmarket.co.kr", "ssg.com", "lotteon.com", "kurly.com",
    "danawa.com", "auction.co.kr", "interpark.com", "oliveyoung.co.kr",
}


# Blogs, cafés, Q&A and news on a Korean domain are people writing ABOUT a product (a
# travel blog, a news item), not a shop selling it -- they used to count as sales evidence.
_NOT_A_SHOP_LABELS = {"blog", "cafe", "kin", "post", "news", "in"}
# Any other .kr site only counts when its name says it sells things: a bare .kr used to
# count too, and a music page (music.bugs.co.kr), a news site and a wiki became "sales".
_SHOP_HOST = re.compile(r"shop|mall|store|market|smartstore")


def _host(url: str) -> str:
    try:
        return urlparse(url).netloc.lower().removeprefix("www.")
    except Exception:
        return ""


def _is_korea_retail_hit(url: str) -> bool:
    host = _host(url)
    if not host or _NOT_A_SHOP_LABELS & set(host.split(".")[:-2] or [host.split(".")[0]]):
        return False
    if any(host == d or host.endswith("." + d) for d in _KOREA_RETAIL_DOMAINS):
        return True
    return host.endswith(".kr") and bool(_SHOP_HOST.search(host))


_DOMAIN_ALIAS = re.compile(r"^[a-z][a-z-]{3,}$")
# Pieces of a domain that are not the brand ("sweets-kagiya", "y-tanbaya", "marutonet"),
# and shop-platform hosts whose first label is the shop, not a brand domain.
_GENERIC_DOMAIN_PIECES = {"sweets", "shop", "store", "online", "official", "web", "net", "jp", "japan", "www", "co"}
_SHOP_PLATFORMS = ("base.shop", "thebase.in", "base.ec", "stores.jp", "shop-pro.jp", "ocnk.net", "myshopify.com", "shopselect.net")


def korea_search_name(brand_name: str, website: str | None) -> str:
    """The name to look the brand up by on Korean shops. Korean listings write a Japanese
    brand in Latin letters or Hangul, never in kanji/kana ("巖手屋" is sold as "Iwateya" /
    "이와테야"), so a name with no Latin letters is searched by its own domain's name
    instead (iwateya.co.jp -> "iwateya"). Same number of searches either way; falls back
    to the original name when the domain isn't a usable word (too short, digits)."""
    if has_latin_letters(brand_name) or not website:
        return brand_name
    host = _host(website)
    if not host or any(host.endswith(p) for p in _SHOP_PLATFORMS):
        return brand_name
    stem = host.split(".")[0]
    if not _DOMAIN_ALIAS.match(stem):
        return brand_name
    pieces = [p for p in stem.split("-") if len(p) > 1 and p not in _GENERIC_DOMAIN_PIECES]
    alias = " ".join(pieces)
    return alias if len(alias.replace(" ", "")) >= 4 else brand_name


def check_korea_presence(brand_name: str) -> dict:
    hits = []
    failed = 0
    for template in KOREA_QUERY_TEMPLATES:
        query = template.format(name=brand_name)
        try:
            # Korean Google, in Korean -- without gl/hl these ran against US Google.
            results = search(query, count=3, gl="kr", hl="ko")
        except SearchAuthError:
            raise  # no key / no credits: stop the run, don't record "no Korea evidence"
        except Exception:
            # A failed search is "couldn't check", not "found nothing" -- counted so
            # classify_korea_status can say so instead of reporting no evidence.
            failed += 1
            results = []
        for r in results:
            hits.append({"query": query, **r})

    # "hits" (ALL of them, up to 6 -- 2 templates x up to 3 results) is what
    # classify_korea_status must classify against; "topHits" (capped to 5) is only for
    # the evidence/display list main.py builds separately. These used to be conflated --
    # classify_korea_status was called with the capped topHits, so if the one real
    # Korean-retail hit happened to be 6th (a brand's own site usually ranks 1st,
    # pushing a real Coupang listing further down), it silently never reached
    # classification at all.
    korea_hits = [h for h in hits if _is_korea_retail_hit(h.get("url", ""))]
    return {"hitCount": len(korea_hits), "hits": hits, "topHits": hits[:5], "failed": failed}


def _name_matcher(brand_name: str):
    """Word-boundary match for a Latin name, plain substring for a CJK one (see below)."""
    if has_latin_letters(brand_name):
        name_pattern = re.compile(r"\b" + re.escape(brand_name.lower()) + r"\b")
        return lambda text: bool(name_pattern.search(text.lower()))
    lowered_name = brand_name.lower()
    return lambda text: lowered_name in text.lower()


def korea_shop_hits(hits: list[dict], brand_name: str) -> list[dict]:
    """The hits that count as Korean sales evidence: on a Korean shop AND about this brand.
    Also what main.py stores as the candidate's evidence links -- it used to store the
    first three raw results instead (BBC, an Instagram reel, a game-music page)."""
    name_hit = _name_matcher(brand_name)
    return [
        h
        for h in hits
        if _is_korea_retail_hit(h.get("url", "")) and name_hit(f"{h.get('title', '')} {h.get('description', '')}")
    ]


def classify_korea_status(
    hits: list[dict], brand_name: str, failed: int = 0, own_domain_label: str | None = None
) -> tuple[str, str]:
    """조건 A: "한국에서 검색이 되느냐"가 아니라 "지금 독점 총판 자리가 비어 있느냐"를 판정한다.
    공식/독점 총판 문구가 나오면 하드 제외. 마켓플레이스 판매 정황만 있고 공식 표기가
    없으면 -- 병행수입/구매대행 추정으로, 제외가 아니라 오히려 우선 후보로 취급한다
    (수요는 검증됐고 총판 자리는 비어 있다는 뜻).

    Returns (status, reason). status is never a claim that Korea distribution is
    definitively absent -- 0 hits means "no_evidence_found", not "confirmed absent".
    """
    # Word-boundary, not a bare substring check -- "lance" as `in` would still match
    # inside "freelance", "elegance", "reliance", "ambulance", which is exactly the
    # class of bug the same-hit requirement below was meant to close. A real run
    # rejected "Lance" again after that first fix, which is what exposed this.
    #
    # BUT \b only exists where a word character meets a non-word character -- Japanese/
    # Korean text has no spaces between "words" at all, so a CJK brand name embedded in
    # a run of continuous CJK text (e.g. "和菓子" inside "全国の和菓子店一覧") never has a
    # \b on either side, and this pattern would never match (verified empirically: it
    # doesn't). That silently disabled the official_distributor hard-exclude for every
    # non-Latin brand name. Latin names keep the \b (still needed for the Lance/
    # freelance case); non-Latin names fall back to a plain substring check instead.
    name_hit = _name_matcher(brand_name)

    # The brand's OWN Korean site (menicon.co.kr for menicon.co.jp) means it is already in
    # Korea through its own subsidiary -- it used to count as parallel-import evidence.
    if own_domain_label and len(own_domain_label) >= 4:
        for h in hits:
            host = _host(h.get("url", ""))
            if host.endswith(".kr") and host.split(".")[0] == own_domain_label:
                return (
                    "official_distributor",
                    f"브랜드 자체 한국 사이트 발견 ({host}) — 이미 한국 진출, 소싱 대상에서 제외",
                )

    # "공식총판" is common Korean e-commerce boilerplate -- for a short/generic brand
    # name (Lance, Roka, Fini, Terra...) the search can return an unrelated hit that
    # merely happens to contain that phrase. Checking the joined text of every hit at
    # once let a totally unrelated hit's boilerplate reject a brand that never showed
    # up anywhere near it. Require the SAME hit to mention both the phrase and the
    # brand name, so an irrelevant hit can't veto an unrelated candidate.
    #
    # Still not enough for a short/common acronym, though -- verified empirically:
    # "PBS" 한국 총판 returned (주)피비에스코리아, a completely unrelated Korean company
    # that is just also named "PBS" (a Public Broadcasting Service candidate has
    # nothing to do with it). The same-hit requirement above can't catch this, because
    # it genuinely IS the same hit -- both the name and the phrase appear together on
    # that one page, just about a different "PBS" entirely. Below some length, a name
    # match proves nothing on its own, so the hard exclude is skipped for short names
    # and falls through to the softer, non-rejecting signals instead.
    name_is_too_short_to_trust = len(brand_name.strip()) < 5
    if not name_is_too_short_to_trust:
        for h in hits:
            text = f"{h.get('title', '')} {h.get('description', '')}"
            if name_hit(text) and _OFFICIAL_PHRASES.search(text):
                return (
                    "official_distributor",
                    "공식/정식 수입원 또는 총판 문구가 검색 결과에서 발견됨 — 기존 총판 존재로 추정, 소싱 대상에서 제외",
                )

    # Counting ALL hits here (as before) measured "did Serper return anything for
    # these two keywords", not "is this actually sold in Korea" -- a hit on the
    # candidate's own (non-Korean) site, or an unrelated page, counted the same as a
    # real Coupang listing. Only a hit on an actual Korean retail/marketplace domain
    # (or any .kr site) counts toward the threshold below; see _is_korea_retail_hit.
    #
    # And the hit has to be ABOUT this brand -- an unrelated Coupang category page for the
    # same two search words used to count too, and three of those made "우선 후보".
    korea_hits = korea_shop_hits(hits, brand_name)

    if len(korea_hits) >= 3:
        return (
            "parallel_import",
            "다수의 판매 정황이 발견됐으나 공식 총판 표기는 없음 — 병행수입/구매대행 추정 (제외 아님, 우선 후보)",
        )

    if len(korea_hits) >= 1:
        return (
            "cross_border",
            "소수의 판매 정황이 발견됐으나 공식 총판 표기는 없음 (제외 아님)",
        )

    if failed >= len(KOREA_QUERY_TEMPLATES):
        return (
            "check_failed",
            "한국 유통 검색이 오류로 실패함 — 확인 못 함, 직접 검색 필요",
        )
    return (
        "no_evidence_found",
        "한국 유통 관련 근거를 찾지 못함 — 유통이 없다는 증명은 아님, 검토 필요"
        + (" (검색 일부 실패)" if failed else ""),
    )
