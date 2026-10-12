"""Offline tests for name_filter.japanese_site_name -- real <title>s from Japanese maker
sites (2026-10-12 Japan-focus run + tests/eval_japan_sites.py).

    python tests/test_japanese_names.py
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from name_filter import japanese_site_name  # noqa: E402

CASES = [
    ("【公式】長崎　和泉屋｜長崎カステラ", "和泉屋"),
    ("マルト製菓株式会社", "マルト製菓"),
    ("たんばや製菓 |山形県酒田市でカステラ・どら焼きの製造販売を行っております", "たんばや製菓"),
    ("熊野筆・化粧筆｜株式会社晃祐堂【KOYUDO】", "晃祐堂"),
    ("【公式サイト】竹宝堂｜熊野筆工房", "竹宝堂"),
    ("お菓子のかぎや オンラインショップ", "かぎや"),
    ("熊野筆のメイクブラシ（化粧筆）を通販でお求めなら｜広島筆産業株式会社", "広島筆産業"),
    ("洋菓子のOEM製造・仕入れ・卸売【名月製菓】", "名月製菓"),
    ("若尾製菓（株）｜洋菓子のOEM製造・受託製造を行う製菓会社", "若尾製菓"),
    ("有限会社エムケイアンドアソシエイツ｜自然派クッキーの卸、OEM製造", "エムケイアンドアソシエイツ"),
    ("白鳳堂 - 公式オンラインショップ", "白鳳堂"),
    ("創業元禄二年　聖護院八ッ橋総本店｜味は伝統", "聖護院八ッ橋総本店"),
    ("南部せんべい乃 巖手屋（いわてや）", "巖手屋"),
    ("創業160年 海老御菓子處 桂新堂 【 公式 】 えびせんべいの桂新堂 | 名古屋土産", "桂新堂"),
    ("石屋製菓（ISHIYA）-しあわせをつくるお菓子", "石屋製菓"),
    ("株式会社レダオフィシャルサイト", "レダ"),
    # brand names with no maker ending open the title (rule 4)
    ("オフテクス｜コンタクトレンズケアの総合メーカー", "オフテクス"),
    ("ヤーマン公式通販サイト | ヤーマンオンラインストア", "ヤーマン"),
    ("コンタクトレンズのメニコン", "メニコン"),
    ("【公式】コンタクトレンズのシード「SEED」", "シード"),
    ("洋菓子のモロゾフ:チョコレート・プリン・チーズケーキ|モロゾフ株式会社公式サイト", "モロゾフ"),
    ("株式会社シュクレイ | 喜びをつくる人たちと、未来をつくる。", "シュクレイ"),
    ("会社概要 | 株式会社TEN-TWO", "TEN-TWO"),
    # nothing name-shaped -> None, so the caller keeps its own name
    ("美顔ローラーのおすすめ人気ランキング", None),
    ("Brioche Pasquier - Boulangerie", None),
    ("和菓子", None),
]

if __name__ == "__main__":
    failed = 0
    for title, expected in CASES:
        got = japanese_site_name(title, None)
        ok = got == expected
        failed += not ok
        print(f"[{'PASS' if ok else 'FAIL'}] {title[:40]} -> {got!r}" + ("" if ok else f" (expected {expected!r})"))
    print(f"\n{len(CASES) - failed}/{len(CASES)} passed, {failed} failed")
    sys.exit(1 if failed else 0)
