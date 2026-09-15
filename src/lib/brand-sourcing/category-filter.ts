export type CategoryVerdict = {
  excluded: boolean;
  reason?: string;
};

const HARD_EXCLUDE_RULES: { pattern: RegExp; reason: string }[] = [
  {
    pattern: /\balcohol|beer|wine|whisk[ey]y|liquor|spirits?|vodka|rum\b|\bgin\b/i,
    reason: "Alcohol category is hard-excluded",
  },
  {
    pattern: /\bdairy\b|\bmilk\b|\bcheese\b|\byogurt\b|plant[- ]based milk|oat milk|almond milk/i,
    reason: "Dairy / plant-based milk is hard-excluded",
  },
  {
    pattern: /\bsauce\b|\bspread\b|\bjam\b|marmalade|mustard/i,
    reason: "Sauces / spreads / jam / mustard are hard-excluded",
  },
  {
    pattern: /seafood|canned fish|\btuna\b|\bsalmon\b|sardine/i,
    reason: "Seafood / canned fish is hard-excluded",
  },
  {
    pattern: /fresh produce|fresh meat|charcuterie|fresh fruit|fresh vegetable/i,
    reason: "Fresh produce / fresh meat / charcuterie is hard-excluded",
  },
  {
    pattern: /\bOEM\b|\bODM\b|private label only|b2b[- ]only/i,
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
