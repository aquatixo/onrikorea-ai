export type CategoryVerdict = {
  excluded: boolean;
  reason?: string;
};

// Every alternative is wrapped inside the single \b(...)\b group -- a bare
// `\balcohol|beer|wine\b` chain only binds \b to its immediate neighbor, so
// everything in the middle (beer, wine, liquor, spirits, vodka) would match as an
// unguarded substring anywhere. Currently dormant in practice (this only ever runs
// against our own fixed SKU labels, none of which happen to contain these
// substrings), but a real bug in shared evaluation logic that a future free-text
// SKU (e.g. a re-enabled LLM pipeline) would hit for real.
const HARD_EXCLUDE_RULES: { pattern: RegExp; reason: string }[] = [
  {
    pattern: /\b(alcohol|beer|wine|whisky|whiskey|liquor|spirits?|vodka|rum|gin)\b/i,
    reason: "Alcohol category is hard-excluded",
  },
  {
    pattern: /\b(dairy|milk|cheese|yogurt|plant[- ]based milk|oat milk|almond milk)\b/i,
    reason: "Dairy / plant-based milk is hard-excluded",
  },
  {
    pattern: /\b(sauce|spread|jam|marmalade|mustard)\b/i,
    reason: "Sauces / spreads / jam / mustard are hard-excluded",
  },
  {
    pattern: /\b(seafood|canned fish|tuna|salmon|sardine)\b/i,
    reason: "Seafood / canned fish is hard-excluded",
  },
  {
    pattern: /\b(fresh produce|fresh meat|charcuterie|fresh fruit|fresh vegetable)\b/i,
    reason: "Fresh produce / fresh meat / charcuterie is hard-excluded",
  },
  {
    pattern: /\b(OEM|ODM|private label only|b2b[- ]only)\b/i,
    reason: "OEM/ODM-only (B2B only) brands are hard-excluded",
  },
];

/** Category hard-excludes from the sourcing prompt, checked against the candidate's SKU/category text. */
export function evaluateCategory(sku: string | null | undefined): CategoryVerdict {
  if (!sku) return { excluded: false };
  for (const rule of HARD_EXCLUDE_RULES) {
    if (rule.pattern.test(sku)) {
      return { excluded: true, reason: rule.reason };
    }
  }
  return { excluded: false };
}
