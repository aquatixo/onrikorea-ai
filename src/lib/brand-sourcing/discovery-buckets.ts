export type DiscoveryBucket = {
  /** Stored in SourcingCandidate.methodology so a run's results stay traceable to the bucket that found them. */
  label: string;
  /** Category/region brief injected into the discovery prompt. */
  brief: string;
};

/**
 * Deterministic region fan-out, rebuilt around a REGION axis instead of a
 * PRODUCT-CATEGORY axis -- mirrors python-sourcing/categories.py, see that file's
 * header comment for the full rationale (a master-list country-distribution check
 * showed the old category-shaped buckets mostly re-searched countries the master
 * list already had heavy coverage of). Each bucket is its own parallel discovery
 * call -- more buckets means broader coverage but scales discovery-stage cost
 * roughly linearly (each is a separate Sonnet 5 + web search call).
 */
export const DISCOVERY_BUCKETS: DiscoveryBucket[] = [
  {
    label: "Brand Sourcing — Japan (Heritage Snacks & Confectionery)",
    brief:
      "Heritage Japanese snack and confectionery brands (wagashi, senbei, candy, jelly, and similar sweets) — complete packaged consumer products from a long-established, family-owned maker.",
  },
  {
    label: "Brand Sourcing — Portugal",
    brief:
      "Heritage Portuguese heritage food brands — traditional biscuits, convent pastries, coffee roasters — from a long-established, family-owned maker. Search in Portuguese; a generic English query barely surfaces this market.",
  },
  {
    label: "Brand Sourcing — Poland, Czechia & Hungary",
    brief:
      "Heritage Polish/Czech/Hungarian heritage food brands — gingerbread, traditional caramels/candy, spa wafers, chocolate — from a long-established, family-owned maker. Search in the local language.",
  },
  {
    label: "Brand Sourcing — Sweden, Finland & Iceland",
    brief:
      "Heritage Swedish/Finnish/Icelandic heritage food brands — licorice, gingerbread/crispbread, hard candy, chocolate — from a long-established, family-owned maker. Search in the local language. Denmark/Norway snacks and baking are deliberately excluded here: that shelf is a confirmed oligopoly (KiMs, OK Snacks, Maarud, Sørlandschips) with no independent heritage brands left.",
  },
  {
    label: "Brand Sourcing — Greece & Turkey",
    brief:
      "Heritage Greek/Turkish heritage food brands — traditional biscuits, Turkish delight/loukoumi, halva, roasted coffee — from a long-established, family-owned maker. Search in the local language.",
  },
  {
    label: "Brand Sourcing — France (Regional)",
    brief:
      "Heritage regional French specialty brands (Brittany, Alsace, Provence, the Basque Country, the North) — a real local specialty item, not a generic national brand already well represented in the master list.",
  },
  {
    label: "Brand Sourcing — Germany & Austria (Regional)",
    brief:
      "Heritage regional German/Austrian specialty brands (Nuremberg/Aachen/Dresden gingerbread and stollen, Swabian Springerle, Tyrolean confectionery) — a real regional specialty item, not a generic national brand already well represented in the master list.",
  },
  {
    label: "Brand Sourcing — Awards & Trade Fair Exhibitors",
    brief:
      "Region-agnostic, list-shaped sources: food award winner/finalist lists (Great Taste, World Food Innovation, Slow Food Presidia) and trade-fair exhibitor directories (Anuga, SIAL, ISM Cologne, Biofach, Speciality & Fine Food Fair) — these self-select for small producers already seeking export/distribution partners.",
  },
];
