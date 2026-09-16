export type DiscoveryBucket = {
  /** Stored in SourcingCandidate.methodology so a run's results stay traceable to the bucket that found them. */
  label: string;
  /** Category/region brief injected into the discovery prompt. */
  brief: string;
};

/**
 * Deterministic category fan-out, derived from the user's stated sourcing focus
 * plus the heritage-brand criteria from the original cowork sourcing prompt. Each
 * bucket is its own parallel discovery call -- more buckets means broader category
 * coverage but scales discovery-stage cost roughly linearly (each is a separate
 * Sonnet 5 + web search call).
 */
export const DISCOVERY_BUCKETS: DiscoveryBucket[] = [
  {
    label: "Brand Sourcing — Snacks",
    brief:
      "Heritage savory snack brands (chips, crackers, nuts, dried fruit snacks) — a complete packaged consumer product, not a raw commodity.",
  },
  {
    label: "Brand Sourcing — Biscuits & Shortcakes",
    brief:
      "Heritage biscuit, cookie, shortbread, or shortcake brands — complete packaged consumer products.",
  },
  {
    label: "Brand Sourcing — Confectionery & Candy",
    brief:
      "Heritage confectionery/candy brands (hard candy, boiled sweets, toffees, lollipops) — not chocolate or jellies, which have their own buckets.",
  },
  {
    label: "Brand Sourcing — Jellies & Gummies",
    brief:
      "Heritage fruit jelly or gummy candy brands — complete packaged consumer products.",
  },
  {
    label: "Brand Sourcing — Chocolate",
    brief:
      "Heritage solid chocolate or confectionery brands — bars, pralines, truffles. Explicitly NOT drinking chocolate or any beverage.",
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
];
