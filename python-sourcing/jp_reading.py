"""Korean pronunciation for a Japanese brand name, shown in parentheses after it
("三ツ矢製菓 (미쓰야세이카)") so the team can read candidates written only in Japanese
(user, 2026-10-23). Deterministic, no LLM, no dictionary:

- A kana-only name (シード, メニコン, かぎや) is converted letter by letter.
- A name with kanji has no rule-based reading (a kanji has several), so the brand's own
  domain is used: Japanese companies register their name in romaji (mitsuyaseika.co.jp,
  tanseido-honpo.co.jp). A trade suffix the domain leaves out (小林製薬 on kobayashi.co.jp)
  is added from a small table.

Hangul follows the Korean standard for Japanese (외래어 표기법): ka/ta/cha at the start of
a word are 가/다/자 and 카/타/차 inside it, su/tsu/zu are 스/쓰/즈, long vowels are not
written, ん is a ㄴ final and a doubled consonant (っ) a ㅅ final.
"""

import re

from name_filter import brand_domain_label, has_latin_letters

_JP = re.compile(r"[぀-ヿ一-鿿]")
_KANJI = re.compile(r"[一-鿿々]")

# --- kana -> romaji ---------------------------------------------------------------------
_KANA: dict[str, str] = {}
_ROWS = {
    "": "あいうえお", "k": "かきくけこ", "s": "さしすせそ", "t": "たちつてと", "n": "なにぬねの",
    "h": "はひふへほ", "m": "まみむめも", "y": "や ゆ よ", "r": "らりるれろ", "w": "わ   を",
    "g": "がぎぐげご", "z": "ざじずぜぞ", "d": "だぢづでど", "b": "ばびぶべぼ", "p": "ぱぴぷぺぽ",
}
for _cons, _chars in _ROWS.items():
    for _vowel, _ch in zip("aiueo", _chars):
        if _ch != " ":
            _KANA[_ch] = _cons + _vowel
_KANA.update({"し": "shi", "ち": "chi", "つ": "tsu", "ふ": "fu", "じ": "ji", "ぢ": "ji", "づ": "zu", "を": "o", "ん": "N"})
for _base, _cons in (("き", "ky"), ("し", "sh"), ("ち", "ch"), ("に", "ny"), ("ひ", "hy"), ("み", "my"),
                     ("り", "ry"), ("ぎ", "gy"), ("じ", "j"), ("び", "by"), ("ぴ", "py")):
    for _small, _vowel in (("ゃ", "a"), ("ゅ", "u"), ("ょ", "o")):
        _KANA[_base + _small] = _cons + _vowel
_SMALL_VOWEL = {"ぁ": "a", "ぃ": "i", "ぅ": "u", "ぇ": "e", "ぉ": "o"}  # ティ, ファ, ウィ...


def _kana_to_romaji(text: str) -> str:
    hira = "".join(chr(ord(c) - 0x60) if "ァ" <= c <= "ヶ" else c for c in text)  # katakana -> hiragana
    out: list[str] = []
    i = 0
    while i < len(hira):
        two = hira[i : i + 2]
        if two in _KANA:
            out.append(_KANA[two])
            i += 2
            continue
        c = hira[i]
        if c == "っ":
            out.append("Q")  # doubles the next consonant
        elif c == "ー":
            pass  # long vowel: not written in Korean
        elif c in _SMALL_VOWEL and out:
            out[-1] = re.sub(r"[aiueo]$", "", out[-1]) + _SMALL_VOWEL[c]  # テ+ィ -> ti, フ+ァ -> fa
        elif c in _KANA:
            out.append(_KANA[c])
        else:
            out.append(" ")
        i += 1
    return "".join(out)


# --- romaji -> hangul -------------------------------------------------------------------
# Hangul = 0xAC00 + (initial * 21 + vowel) * 28 + final.
# initials: ㄱ0 ㄴ2 ㄷ3 ㄹ5 ㅁ6 ㅂ7 ㅅ9 ㅆ10 ㅇ11 ㅈ12 ㅊ14 ㅋ15 ㅌ16 ㅍ17 ㅎ18
# vowels:   ㅏ0 ㅑ2 ㅔ5 ㅗ8 ㅘ9 ㅛ12 ㅜ13 ㅠ17 ㅡ18 ㅣ20      finals: ㄴ4 ㅅ19
_VOWEL = {"a": 0, "e": 5, "i": 20, "o": 8, "u": 13, "ya": 2, "yu": 17, "yo": 12}
# (word-initial, word-medial) initial for each romaji onset.
_ONSET = {
    "": (11, 11), "k": (0, 15), "g": (0, 0), "s": (9, 9), "sh": (9, 9), "z": (12, 12), "j": (12, 12),
    "t": (3, 16), "d": (3, 3), "ch": (12, 14), "ts": (10, 10), "n": (2, 2), "h": (18, 18), "f": (18, 18),
    "b": (7, 7), "p": (17, 17), "m": (6, 6), "y": (11, 11), "r": (5, 5), "w": (11, 11), "v": (7, 7),
}
_SYLLABLE = re.compile(r"(ky|gy|sh|ch|ts|ny|hy|my|ry|by|py|[jkgsztdnhfbpmyrwv])?(y?[aiueo])")


def _compose(initial: int, vowel: int) -> str:
    return chr(0xAC00 + (initial * 21 + vowel) * 28)


def _add_final(syllable: str, final: int) -> str:
    code = ord(syllable) - 0xAC00
    return chr(ord(syllable) + final) if 0 <= code < 11172 and code % 28 == 0 else syllable


def _romaji_word_to_hangul(word: str) -> str:
    # Long vowels are not written: ou/oo/uu/aa are one vowel ("tokyou" -> 도쿄).
    word = re.sub(r"(?<=o)[ou]|(?<=u)u|(?<=a)a", "", "".join(ch if ch in "NQ" else ch.lower() for ch in word))
    out: list[str] = []
    i = 0
    while i < len(word):
        c = word[i]
        nxt = word[i + 1] if i + 1 < len(word) else ""
        if c == "N" or (c == "n" and (not nxt or nxt not in "aiueoy")):
            out[-1:] = [_add_final(out[-1], 4)] if out else []  # ん -> ㄴ
            i += 1
            continue
        if c == "m" and nxt in ("b", "p", "m"):
            out[-1:] = [_add_final(out[-1], 4)] if out else []  # hompo = honpo
            i += 1
            continue
        if c == "Q" or (c == nxt and c in "kstpgbdz") or word.startswith("tch", i):
            out[-1:] = [_add_final(out[-1], 19)] if out else []  # っ -> ㅅ
            i += 1
            continue
        m = _SYLLABLE.match(word, i)
        if not m:
            i += 1
            continue
        onset, vowel = m.group(1) or "", m.group(2)
        if len(onset) == 2 and onset[1] == "y":
            onset, vowel = onset[0], "y" + vowel[-1]  # kya -> k + ya
        if onset == "y":
            onset, vowel = "", "y" + vowel[-1]  # ya/yu/yo -> 야/유/요
        if onset == "sh" and vowel in ("a", "u", "o"):
            vowel = "y" + vowel  # 샤 슈 쇼
        initial = _ONSET[onset][0 if not out else 1]
        v = 18 if onset in ("s", "ts", "z") and vowel == "u" else _VOWEL[vowel]  # 스 쓰 즈
        if vowel == "a" and onset in ("w", "f"):
            v = 9  # 와, ファ -> 화
        out.append(_compose(initial, v))
        i = m.end()
    return "".join(out)


def _romaji_to_hangul(romaji: str) -> str:
    return " ".join(_romaji_word_to_hangul(w) for w in re.split(r"[\s\-_]+", romaji) if w)


# A trade suffix the domain often leaves out (小林製薬 = kobayashi.co.jp).
_SUFFIX_ROMAJI = {
    "製菓": "seika", "製薬": "seiyaku", "本舗": "honpo", "本舖": "honpo", "総本家": "sohonke",
    "総本店": "sohonten", "本店": "honten", "製作所": "seisakusho", "産業": "sangyo", "食品": "shokuhin",
}
_GENERIC_DOMAIN_PIECES = {
    "sweets", "shop", "store", "online", "official", "web", "net", "jp", "japan", "co", "inc", "corp",
    "group", "holdings", "hd", "company", "global",
}


# Product words in a shop name ("おかき処 播磨屋" on harimaya.com) -- not in the domain.
_GENERIC_KANA = {
    "おかき", "せんべい", "おせんべい", "あられ", "かりんとう", "まんじゅう", "もなか", "ようかん", "だんご",
    "クッキー", "チョコ", "チョコレート", "キャンディ", "キャンデー", "ドロップ", "ラムネ", "グミ", "ビスケット",
    "サブレ", "おかし", "スイーツ", "ケーキ", "カステラ", "コンタクトレンズ",
}


def _loose_romaji(text: str) -> str:
    """Spelling-tolerant romaji for comparing a name with a domain: no long vowels
    (baikou = baiko, ohno = ono), no doubled consonants, m before b/p is n (hompo = honpo),
    and the other common spelling system (tsu/tu, shi/si, chi/ti, fu/hu, ji/zi)."""
    t = text.lower().replace("q", "").replace(" ", "")
    for hepburn, kunrei in (("tsu", "tu"), ("shi", "si"), ("chi", "ti"), ("fu", "hu"), ("ji", "zi")):
        t = t.replace(hepburn, kunrei)
    t = re.sub(r"(?<=o)h(?![aiueoy])", "", t)
    t = re.sub(r"(?<=o)[ou]|(?<=u)u|(?<=a)a|(?<=e)i|(?<=i)i", "", t)
    t = re.sub(r"m(?=[bp])", "n", t)
    return re.sub(r"([bcdfghjklmnprstvwz])\1", r"\1", t)


def _kana_in_domain(name: str, romaji: str) -> bool:
    """Every kana word of the name (2+ kana) is spelled in the domain. A shop domain can
    name a PRODUCT instead of the shop: "さぬき和三盆のばいこう堂" on wasanbon-shop.com
    (和三盆 = the sugar) was read "와산본" (2026-10-29 run). 三ツ矢製菓 on mitsuyaseika.co.jp
    has no 2-kana word and is unaffected."""
    domain = _loose_romaji(romaji)
    for run in re.findall(r"[ぁ-んァ-ヶー]+", name):
        for word in run.split("の"):  # 菓子のくろだ: の is a particle, not part of a name
            if len(word) < 2 or word in _GENERIC_KANA:
                continue
            # ゴンチャロフ is goncharofu, the domain says goncharoff: a loanword's final u.
            spelled = re.sub(r"u$", "", _loose_romaji(_kana_to_romaji(word).replace("N", "n")))
            if spelled.strip() and spelled not in domain:
                return False
    return True


def korean_reading(name: str, website: str | None) -> str | None:
    """The Korean pronunciation of a Japanese-only name, or None when there is nothing to add
    (the name has Latin letters, isn't Japanese, or a kanji name's domain gives no reading)."""
    if not name or has_latin_letters(name) or not _JP.search(name):
        return None
    if not _KANJI.search(name):
        reading = _romaji_to_hangul(_kana_to_romaji(name))
        return reading or None
    label = brand_domain_label(website or "")
    pieces = [p for p in re.split(r"[-_]", label) if len(p) > 1 and p not in _GENERIC_DOMAIN_PIECES]
    if not pieces or not all(re.fullmatch(r"[a-z]+", p) for p in pieces):
        return None
    romaji = " ".join(pieces)
    if not _kana_in_domain(name, romaji):
        return None
    for suffix, sr in _SUFFIX_ROMAJI.items():
        if name.endswith(suffix) and not romaji.replace(" ", "").endswith(sr):
            romaji += " " + sr
            break
    return _romaji_to_hangul(romaji) or None


def with_korean_reading(name: str, website: str | None) -> str:
    """ "三ツ矢製菓" -> "三ツ矢製菓 (미쓰야세이카)"; unchanged when there's no reading."""
    if "(" in name or "（" in name:
        return name  # already has a reading or a note in brackets
    reading = korean_reading(name, website)
    return f"{name} ({reading})" if reading else name
