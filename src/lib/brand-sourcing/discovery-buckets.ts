export type DiscoveryBucket = {
  /** Stored in SourcingCandidate.methodology so a run's results stay traceable to the bucket that found them. */
  label: string;
  /** Category/region brief injected into the discovery prompt. */
  brief: string;
};

/**
 * Deterministic category fan-out, derived from the user's stated sourcing focus
 * (snacks, nutritional supplements, baby cereal/porridge, chocolate — not beverages)
 * plus the heritage-brand criteria from the original cowork sourcing prompt. Kept as
 * four broad category buckets rather than category×region combos, to keep the run to
 * four parallel discovery calls + one verification pass.
 */
export const DISCOVERY_BUCKETS: DiscoveryBucket[] = [
  {
    label: "Brand Sourcing — Snacks",
    brief:
      "Heritage savory or sweet snack brands (crackers, chips, biscuits, cookies, nuts, dried fruit snacks) — a complete packaged consumer product, not a raw commodity.",
  },
  {
    label: "Brand Sourcing — Nutritional Supplements",
    brief:
      "Heritage nutritional supplement or vitamin brands — complete consumer products (capsules, powders, gummies), not raw ingredient/OEM-only suppliers.",
  },
  {
    label: "Brand Sourcing — Baby Cereal & Porridge",
    brief:
      "Heritage baby cereal, infant porridge, or weaning-food brands — complete packaged consumer products for infants/toddlers.",
  },
  {
    label: "Brand Sourcing — Chocolate",
    brief:
      "Heritage solid chocolate or confectionery brands — bars, pralines, truffles. Explicitly NOT drinking chocolate or any beverage.",
  },
];
