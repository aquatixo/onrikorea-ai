"""Live evaluation of site_profile.judge against REAL candidate sites from past runs.

Network required (fetches each site), but NO search API calls -- costs no credits. Run
this after any change to site_profile.py / relevance.py / name_filter.py instead of doing
a full sourcing run:

    python tests/eval_live_sites.py

Groups:
  junk     -- must be dropped. Every one of these actually reached the review list once.
  exporter -- established brands already in Brands that sell to importers; should be kept.
  producer -- real small makers seen in runs; kept only if they show a trade channel, so
              either outcome is acceptable -- reported for visibility, not scored.
Site behaviour changes over time (blocks, redesigns), so treat a single flip as a prompt
to look, not automatically as a regression.
"""

import sys
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from site_profile import build_profile, judge, resolved_name  # noqa: E402

SITES = [
    # --- junk: news / magazines / blogs ---
    ("junk", "Group Captain David Hutchinson Smith", "https://www.telegraph.co.uk/"),
    ("junk", "Manchego wins nail-biting World Cheese Awards 2012", "https://cheesechap.com/"),
    ("junk", "The World's Best Cheese", "https://www.nytimes.com/"),
    ("junk", "US cheese takes top spot at World Cheese Awards 2019", "https://www.dairyreporter.com/"),
    ("junk", "Cooking Italians", "https://cookingitalians.com/"),
    ("junk", "Montepulciano d'Abruzzo Mostaccioli Cookies", "https://lifeinabruzzo.com/"),
    ("junk", "bestofocnj.com", "https://bestofocnj.com/"),
    ("junk", "Benne Wafers In Olde Colony Bakery", "https://www.tasteatlas.com/"),
    # --- junk: tourism / local info / directories / associations ---
    ("junk", "Drôme Provençale", "https://dromeprovencale.fr/"),
    ("junk", "Quartiere", "https://quartiere-nuernberg.de/"),
    ("junk", "WILKERSON MORAVIAN BAKERY", "https://wilkerson-moravian-bakery.wheree.com/"),
    ("junk", "Bonbonmacherei in Berlin mit Schauküche", "https://in-berlin-brandenburg.com/"),
    ("junk", "American Bakers Association", "https://americanbakers.org/"),
    ("junk", "株式会社佐々木製菓", "https://iwatekensan.biz/"),
    ("junk", "小松製菓", "https://morioka.keizai.biz/"),
    ("junk", "お菓子OEMメーカー一覧", "https://shokuhin-oem.jp/"),
    ("junk", "お菓子メーカーの就職は企業研究から", "https://careerpark-agent.jp/"),
    # --- junk: retailers / gift hampers ---
    ("junk", "Olde Colony Bakery Original Charleston Benne Wafers", "https://essentiallycharleston.com/"),
    ("junk", "Fine Scottish Hampers", "https://finescottishhampers.com/"),
    ("junk", "Olde Colony Bakery Benne Wafers", "https://www.mastgeneralstore.com/"),
    ("junk", "Jakob Distler Süßwarengroßhandel in Nürnberg", "https://jakob-distler.de/"),
    ("junk", "Süßwaren Großhändler Albrecht Wiederverkäufer", "https://suesswaren-grosshaendler.de/"),
    ("junk", "Le Terroir", "https://le-terroir.com/"),
    ("junk", "Candies Supplier", "https://candiessupplier.com/"),
    # --- junk: real maker but a one-page micro business (fresh cakes to order) ---
    ("junk", "POPTY CARAS HANDMADE CAKES from Pembrokeshire, Wales", "https://www.poptycara.co.uk/"),
    # --- junk: portal / tourism guide / city magazine (title says so) ---
    ("junk", "FoodAlimentacion > Portal > Buscar empresa", "https://foodalimentacion.com/"),
    ("junk", "Idées cadeaux de Noël du Pays Basque", "https://guide-du-paysbasque.com/"),
    ("junk", "Stuttgart Inside App", "https://stuttgart-inside.de/"),
    # --- junk: fresh bread bakeries (real makers, but nothing importable) ---
    ("junk", "Bäckerei & Konditorei Holtkamp in Essen", "https://baeckereiholtkamp.de/"),
    ("junk", "RepasPAN", "https://repaspan.es/"),
    ("junk", "Popty Bach Y Wlad", "https://poptybachywlad.co.uk/"),
    # --- junk: product lines the company does not handle (coffee, tea, honey, pasta) ---
    ("junk", "Thiele Tee", "https://www.thiele-tee.de/"),
    ("junk", "Rustichella d'Abruzzo", "https://www.rustichella.it/"),
    ("junk", "Röstzeit", "https://roestzeit.de/"),
    ("junk", "Westhoff Kaffeerösterei", "https://www.westhoff.de/"),
    ("junk", "ETTLI Kaffee", "https://ettli.de/"),
    ("junk", "Joerges", "https://www.kaffee-joerges.de/"),
    ("junk", "Cafés Henri", "https://www.cafeshenri.fr/"),
    # --- junk: seed companies (Ark of Taste roster) ---
    ("junk", "Adaptive Seeds", "https://adaptiveseeds.com/"),
    ("junk", "Baker Creek Heirloom Seeds", "https://www.rareseeds.com/"),
    ("junk", "Harris Seeds", "https://www.harrisseeds.com/"),
    ("junk", "Seed Savers Exchange", "https://www.seedsavers.org/"),
    ("junk", "SOW TRUE SEED", "https://sowtrueseed.com/"),
    # --- exporter: established brands already in Brands (should be kept) ---
    ("exporter", "Amarelli", "https://www.amarelli.it/"),
    ("exporter", "Dolfin", "https://www.dolfin.be/"),
    ("exporter", "Konditorei Zauner", "https://www.zauner.at/"),

    ("exporter", "Lebkuchen-Schmidt", "https://www.lebkuchen-schmidt.com/"),
    ("exporter", "Dillon Candy Company", "https://dilloncandy.com/"),
    ("exporter", "Kägi", "https://www.kaegi.com/"),
    ("exporter", "Biscottificio Collu", "https://www.biscottificiocollu.com/"),

    # --- producer: real makers seen in runs (reported, not scored) ---
    ("producer", "Shriver's", "https://shrivers.com/"),
    ("producer", "New Orleans Famous Praline Company", "https://neworleansfamouspraline.com/"),
    ("producer", "Comptoir des Flandres", "https://comptoirdesflandres.com/"),
    ("producer", "La Maison Guella", "https://www.lamaisonguella.com/"),
    ("producer", "La Ronde Bretonne", "https://larondebretonne.fr/"),
    ("producer", "Lebküchnerei Woitinek", "https://lebkuchen-woitinek.de/"),
    ("producer", "Georg Goess", "https://www.georg-goess.de/"),
    ("producer", "Sorelle Nurzia", "https://sorellenurzia.com/"),
    ("producer", "Torrone Properzi", "https://torroneproperzi.com/"),
    ("producer", "Stollenmanufaktur Dresden", "https://stollenmanufaktur.de/"),
    ("producer", "Dresdner Mühlenbäckerei", "https://dresdner-muehlenbaeckerei.de/"),
    ("producer", "Eisold Genussmanufaktur", "https://eisold-genussmanufaktur.de/"),
    ("producer", "南部せんべい乃 巖手屋（いわてや）", "https://www.iwateya.co.jp/"),
    ("producer", "Kouign Amann de Saint-Malo", "https://kouignamanndesaintmalo.com/"),
    ("producer", "Confiteria ARVA", "https://confiteriaarva.com/"),
    ("producer", "Claeys Candy", "https://claeyscandy.com/"),
    ("producer", "Peanuts Pralines", "https://peanutspraline.com/"),
    ("producer", "Royal Praline Company", "https://royalpralinecompany.com/"),
    ("producer", "Bremer Bonbon Manufaktur", "https://bremer-bonbon-manufaktur.de/"),
    ("producer", "Welsh Cottage Cakes", "https://welshcottagecakes.co.uk/"),
    ("producer", "Whitley's Peanut Factory", "https://whitleyspeanut.com/"),
    ("producer", "Olde Colony Bakery", "https://www.oldecolonybakery.com/"),
    ("producer", "Hi Vue Maples", "https://hivuemaples.com/"),
    ("producer", "Agour", "https://agour.com/"),
    ("producer", "Biscuiterie La Lorientaise", "https://www.biscuiterielalorientaise.com/"),
    ("producer", "BRIEUC", "https://www.brieuc.bzh/"),
    ("producer", "Wiener Lebkuchen", "https://wiener-lebkuchen.com/"),
    ("producer", "Maison Fruidoraix", "https://fruidoraix.com/"),
    ("producer", "F.R.T.B.", "https://frtb.it/"),
    ("producer", "Ruth Hunt Candy Co.", "https://www.ruthhuntcandy.com/"),
    ("producer", "Johnsons Toffees", "https://www.johnsonstoffees.com/"),
    ("producer", "Amy Smiths Fudge", "https://amysmiths.co.uk/"),
    ("producer", "The Real Candy Co", "https://www.therealcandyco.co.uk/"),
    ("producer", "Giordano Cioccolato", "https://www.giordanocioccolato.it/"),
    ("producer", "Ziccat", "https://www.ziccat.it/"),
    ("producer", "Cioccolato Menicucci", "https://www.cioccolatomenicucci.it/"),
    ("producer", "Chocolat Encuentro", "https://www.chocolatencuentro.com/"),
    ("producer", "ILE DE RE CHOCOLATS", "https://iledere-chocolats.com/"),
    ("producer", "Hanse-Bonbon GmbH", "https://www.hansebonbon.de/"),
    ("producer", "Küfa Bonbons und Lutscher", "https://kuefa-bonbons.de/"),
    ("producer", "Farmhouse Fudge", "https://farmhousefudge.store/"),
    ("producer", "Fesey Schokoladenmanufaktur", "https://www.fesey.de/"),
    ("producer", "Turrones Jose Garrigos", "https://turronesjgarrigos.com/"),
    ("producer", "Stefan Vogler GmbH", "https://www.stefan-vogler.com/"),
    ("producer", "Arndt's Fudgery LLC", "https://fudgery.biz/"),
    ("producer", "Bonbon Müller", "https://bonbon-mueller.de/"),
    ("producer", "Bonbonmann", "https://bonbonmann.de/"),


]


def run(row):
    group, name, url = row
    profile = build_profile(url)
    keep, code, why = judge(profile, name, url)
    final = resolved_name(profile, name, url) if keep else name
    return group, name, url, profile, keep, code, why, final


def main() -> int:
    with ThreadPoolExecutor(max_workers=8) as ex:
        results = list(ex.map(run, SITES))

    junk_leaks, exporter_misses = [], []
    for group, name, url, p, keep, code, why, final in results:
        flag = ""
        if group == "junk" and keep:
            flag = "  <<< JUNK KEPT"
            junk_leaks.append(name)
        if group == "exporter" and not keep:
            flag = "  <<< EXPORTER DROPPED"
            exporter_misses.append(name)
        sig = (
            f"pub={p.get('publisherHits', '-')}/{p.get('dateStamps', '-')} ret={p.get('retailerHits', '-')} "
            f"prod={p.get('producerHits', '-')} trade={'Y' if p.get('trade') else 'n'}"
        )
        shown = f"{name[:34]}" + (f" -> {final[:28]}" if final != name else "")
        print(f"[{group:8}] {'KEEP' if keep else 'drop'} {shown:66} {code:18} {sig}{flag}")
        if keep or flag:
            print(f"             {why[:150]}")

    n_junk = sum(1 for r in results if r[0] == "junk")
    n_exp = sum(1 for r in results if r[0] == "exporter")
    n_prod_kept = sum(1 for r in results if r[0] == "producer" and r[4])
    n_prod = sum(1 for r in results if r[0] == "producer")
    print(f"\njunk dropped: {n_junk - len(junk_leaks)}/{n_junk}   exporters kept: {n_exp - len(exporter_misses)}/{n_exp}   small producers kept: {n_prod_kept}/{n_prod}")
    return 1 if junk_leaks else 0


if __name__ == "__main__":
    sys.exit(main())
