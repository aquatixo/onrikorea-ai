export type DiscoveryBucket = {
  /** Stored in SourcingCandidate.methodology so a run's results stay traceable to the bucket that found them. */
  label: string;
  /** Category/region brief injected into the discovery prompt. */
  brief: string;
};

/**
 * Narrowed to countries whose branding/language a Korean consumer finds recognizable
 * and reassuring at the point of purchase -- the "big 5" mainstream European languages
 * (English/French/Italian/German/Spanish) plus Japan and the US -- mirrors
 * python-sourcing/categories.py, see that file's header comment for the full rationale.
 * This replaces an earlier under-covered-region strategy (Portugal, Poland/Czechia/
 * Hungary, Nordic, Greece/Turkey, Netherlands) that was built purely around master-list
 * country-saturation data; a business call to favor consumer trust at the point of sale
 * over discovery efficiency, so expect a higher duplicate rate / lower per-query yield
 * than those dropped regions had, since most of these already have the most master-list
 * coverage.
 */
export const DISCOVERY_BUCKETS: DiscoveryBucket[] = [
  {
    label: "Brand Sourcing — Japan (Heritage Snacks & Confectionery)",
    // Kept deliberately simple, matching python-sourcing/categories.py's Japan bucket:
    // plain product terms only, no "long-established/family-owned" framing layered on.
    brief: "Japanese snack and confectionery brands (wagashi, senbei, candy, jelly, and similar sweets) — complete packaged consumer products.",
  },
  {
    label: "Brand Sourcing — France (Regional)",
    brief:
      "Heritage regional French specialty brands (Brittany, Alsace, Provence, the Basque Country, Bordeaux's canelé, the North) and fruit jelly candy (pâte de fruit) — a real local specialty item, not a generic national brand already well represented in the master list.",
  },
  {
    label: "Brand Sourcing — Italy (Southern Regional)",
    brief:
      "Heritage southern Italian specialty brands (Abruzzo, Puglia, Calabria, Basilicata, Molise) — ferratelle, torrone tenero, confetti di Sulmona, mostaccioli, taralli, southern liquirizia — a real local specialty item, distinct from the Milan/Florence-centric brands already well represented in the master list.",
  },
  {
    label: "Brand Sourcing — Germany & Austria (Regional)",
    brief:
      "Heritage regional German/Austrian specialty brands (Nuremberg gingerbread and plum-figure sweets/Zwetschgenmännla, Aachen/Dresden gingerbread and stollen, Swabian Springerle, effervescent candy powder/Brause, Tyrolean confectionery) — a real regional specialty item, not a generic national brand already well represented in the master list.",
  },
  {
    label: "Brand Sourcing — Spain (Northern Regional)",
    brief:
      "Heritage northern Spanish specialty brands (Basque Country, Navarre, La Rioja, Aragon, Cantabria, Asturias, Galicia) — traditional caramels, marzipan/turrón, drinking chocolate — a real local specialty item, not a generic national brand. Spain overall is well represented in the master list, but this specific region isn't.",
  },
  {
    label: "Brand Sourcing — UK (Scotland, Wales & Northern Ireland)",
    brief:
      "Heritage Scottish/Welsh/Northern Irish specialty brands (oatcakes, tablet, Edinburgh rock, shortbread, Welsh cakes, bara brith, brown lemonade) — a distinct market from England, whose brands already dominate the master list's UK count.",
  },
  {
    label: "Brand Sourcing — USA (Regional Heritage)",
    brief:
      "Heritage regional American specialty brands (New Jersey saltwater taffy, Vermont maple candy, Charleston benne wafers, New Orleans pecan pralines, Winston-Salem Moravian cookies, old-fashioned horehound candy, Mackinac Island fudge) — a real regional specialty item, not a generic national brand already well represented in the master list.",
  },
  {
    label: "Brand Sourcing — Awards & Trade Fair Exhibitors",
    brief:
      "Region-agnostic, list-shaped sources: food award winner/finalist lists (Great Taste, World Food Innovation, Slow Food Presidia, Specialty Food Association sofi Awards) and trade-fair exhibitor directories (Anuga, SIAL, ISM Cologne, Biofach, Speciality & Fine Food Fair, Fancy Food Show) — these self-select for small producers already seeking export/distribution partners.",
  },
];
