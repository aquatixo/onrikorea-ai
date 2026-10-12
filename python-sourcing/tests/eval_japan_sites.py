"""Live evaluation of site_profile.judge on JAPANESE sites -- the Japan-focus run's
quality gate. Same rules as eval_live_sites.py: network required, NO search API calls.

    python tests/eval_japan_sites.py

Groups:
  junk     -- must be dropped (name collisions, travel/listing/OEM-directory/job sites,
              fresh-only sweet shops that can't survive import shelf life).
  producer -- real makers a correct judge keeps; a drop is reported as a miss to look at.
              food: shelf-stable confectionery (yatsuhashi, castella, ebi-senbei, yokan...)
              beauty / care: the Japan-focus run's ReFa-style tool and ReNu-style lens-care
              lanes (categories.py "group") -- judged with that group's product words.
Site behaviour changes over time (blocks, redesigns), so treat a single flip as a prompt
to look, not automatically as a regression.
"""

import sys
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from site_profile import build_profile, judge, resolved_name  # noqa: E402

SITES = [
    # --- junk ---
    ("junk", "food", "かりんとう", "https://www.karinto.co.jp/"),  # a musician's site, not a maker
    ("junk", "food", "お菓子OEMメーカー一覧", "https://shokuhin-oem.jp/"),
    ("junk", "food", "お菓子メーカーの就職は企業研究から", "https://careerpark-agent.jp/"),
    ("junk", "food", "じゃらん 京都 和菓子", "https://www.jalan.net/"),
    ("junk", "food", "楽天市場 和菓子", "https://www.rakuten.co.jp/"),
    # --- producers: shelf-stable makers with department-store / retail distribution ---
    ("producer", "food", "聖護院八ッ橋総本店", "https://www.shogoin.co.jp/"),
    ("producer", "food", "井筒八ッ橋本舗", "https://www.yatsuhashi.co.jp/"),
    ("producer", "food", "福砂屋", "https://www.fukusaya.co.jp/"),
    ("producer", "food", "松翁軒", "https://www.shooken.com/"),
    ("producer", "food", "坂角総本舖", "https://www.bankaku.co.jp/"),
    ("producer", "food", "桂新堂", "https://www.keishindo.co.jp/"),
    ("producer", "food", "虎屋", "https://www.toraya-group.co.jp/"),
    ("producer", "food", "榮太樓總本鋪", "https://www.eitaro.com/"),
    ("producer", "food", "南部せんべい乃 巖手屋", "https://www.iwateya.co.jp/"),
    ("producer", "food", "石屋製菓", "https://www.ishiya.co.jp/"),
    ("producer", "food", "六花亭", "https://www.rokkatei.co.jp/"),
    ("producer", "food", "カンロ", "https://www.kanro.co.jp/"),
    ("producer", "food", "三幸製菓", "https://www.sanko-seika.co.jp/"),
    # --- beauty lane: ReFa-type rollers/devices are wanted; brushes, combs, hair appliances
    #     and review portals are junk ---
    ("producer", "beauty", "レダ", "https://www.leda.co.jp/"),
    ("junk", "beauty", "uka", "https://uka.co.jp/"),
    ("producer", "beauty", "WAVEWAVE", "https://www.wavewave.co.jp/"),
    ("junk", "beauty", "S HEART S", "https://www.s-heart-s.com/"),
    ("junk", "beauty", "白鳳堂", "https://www.hakuho-do.co.jp/"),
    ("junk", "beauty", "KINUJO", "https://kinujo.jp/"),
    ("junk", "beauty", "SALONIA", "https://salonia.jp/"),
    ("junk", "beauty", "美顔ローラーのおすすめ人気ランキング", "https://my-best.com/2009"),
    ("junk", "beauty", "美顔ローラー・小顔ローラー 価格比較", "https://kakaku.com/kaden/face-rollers/"),
    ("junk", "beauty", "アットコスメ", "https://www.cosme.net/"),
    # --- care lane: ReNu-style contact-lens / eye care makers ---
    ("producer", "care", "オフテクス", "https://www.ophtecs.co.jp/"),
    ("producer", "care", "メニコン", "https://www.menicon.co.jp/"),
    ("producer", "care", "シード", "https://www.seed.co.jp/"),
    ("junk", "care", "じゃらん", "https://www.jalan.net/"),
    # --- from the first real Japan-focus run (2026-10-12): middlemen that got through ---
    ("junk", "food", "goooods", "https://goooods.com/"),  # B2B wholesale marketplace
    ("junk", "food", "生産", "https://miyata-net.co.jp/"),  # confectionery trading company
    ("junk", "food", "受託製造企業（OEM", "https://www.food-oem.com/"),  # OEM maker directory
    ("junk", "food", "食品製造", "https://www.masdac.co.jp/"),  # food machinery maker
    ("junk", "food", "菓子卸 正氣屋製菓株式会社", "https://masaki-ya.co.jp/"),  # wholesaler
    ("junk", "beauty", "スパトリートメント カッサプレート", "https://wave-b2b.com/"),  # pro wholesale web shop
    ("junk", "care", "通販", "https://contactlife.sg/"),  # contact-lens web shop
    # ...and the rest of that run (names were search-title fragments). Brush makers and
    # OEM factories are out of scope since 2026-10-12 (user: never handled).
    ("producer", "food", "法人のお客様オリジナルカステラ", "https://www.n-izumiya.com/"),
    ("producer", "food", "販売", "https://www.y-tanbaya.co.jp/"),
    ("producer", "food", "マルト製菓株式会社", "https://marutonet.base.ec/"),
    ("producer", "food", "大口注文", "https://nyanraizu.com/"),
    ("junk", "food", "卸販売", "https://www.moonheart.co.jp/"),  # OEM factory
    ("junk", "beauty", "株式会社晃祐堂【KOYUDO】", "https://www.koyudo.co.jp/"),
    ("junk", "beauty", "熊野筆工房", "https://www.chikuhodo.com/"),
    ("junk", "beauty", "広島筆 ...", "https://www.artbrush-hiroshima.com/"),
    ("junk", "food", "直営店舗", "https://www.wakaoseika.co.jp/"),  # OEM factory
    ("junk", "food", "お菓子のOEM製造【レガラボ製菓】", "https://regalabo-oem.com/"),  # OEM factory
    ("junk", "food", "自然派クッキーの卸", "https://mkcookie.jp/"),  # OEM / wholesale
    # ReFa-type beauty device / roller brands -- what the beauty lane is FOR
    ("junk", "beauty", "ReFa", "https://www.refa.net/"),  # homepage is now mostly dryers/irons/combs (and ReFa is in Korea)
    ("producer", "beauty", "ヤーマン", "https://www.ya-man.com/"),
    ("producer", "beauty", "アクシージア", "https://axxzia.co.jp/"),
    ("producer", "beauty", "セルキュア", "https://belega-cellcure.com/"),
    ("producer", "beauty", "Exideal", "https://www.exideal.jp/"),
    ("producer", "beauty", "NIPLUX", "https://niplux.jp/"),
    # --- second Japan-focus run (2026-10-12, brand-oriented queries) ---
    ("junk", "food", "株式会社前田商店", "https://www.j-maeda.co.jp/"),  # ingredient/machinery trader
    ("producer", "food", "株式会社シュクレイ", "https://www.sucrey.co.jp/"),
    ("producer", "food", "クッキー", "https://www.mitsuyaseika.co.jp/"),
    ("producer", "food", "会社概要", "https://ginso.co.jp/"),
    ("producer", "food", "佐々木製菓", "https://www.sasakiseika.co.jp/"),
    ("producer", "food", "株式会社ロワールホールディングス", "http://loire-conf.co.jp/"),
    ("producer", "food", "会社概要", "https://www.ten-two.jp/"),
]


def run(row):
    group, product_group, name, url = row
    profile = build_profile(url)
    keep, code, why = judge(profile, name, url, product_group)
    shown = f"{product_group}:{name}" + (f" -> {resolved_name(profile, name, url)}" if keep else "")
    return group, shown, url, profile, keep, code, why


def main() -> int:
    with ThreadPoolExecutor(max_workers=8) as ex:
        results = list(ex.map(run, SITES))

    junk_leaks, misses = [], []
    for group, name, url, p, keep, code, why in results:
        flag = ""
        if group == "junk" and keep:
            flag = "  <<< JUNK KEPT"
            junk_leaks.append(name)
        if group == "producer" and not keep:
            flag = "  <<< MAKER DROPPED"
            misses.append(name)
        sig = (
            f"prod={p.get('producerHits', '-')} trade={'Y' if p.get('trade') else 'n'} "
            f"fresh={p.get('freshHits', '-')}/{p.get('shelfHits', '-')} off={p.get('offTargetHits', '-')}/{p.get('targetHits', '-')}"
        )
        print(f"[{group:8}] {'KEEP' if keep else 'drop'} {name[:44]:46} {code:20} {sig}{flag}")
        print(f"             {why[:160]}")

    n_junk = sum(1 for r in results if r[0] == "junk")
    n_prod = sum(1 for r in results if r[0] == "producer")
    print(f"\njunk dropped: {n_junk - len(junk_leaks)}/{n_junk}   makers kept: {n_prod - len(misses)}/{n_prod}")
    return 1 if junk_leaks else 0


if __name__ == "__main__":
    sys.exit(main())
