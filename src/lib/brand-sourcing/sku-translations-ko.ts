/**
 * English -> Korean SKU/category translation. Every existing Brand row uses Korean SKU
 * labels (e.g. "초콜릿", "비스킷/쿠키/케이크"), so a sourcing pipeline's English category
 * guess needs to be translated before it's stored, not left as "Chocolate".
 *
 * Full-phrase matches cover the fixed python-sourcing/categories.py bucket names exactly;
 * the word-by-word fallback covers Claude's freeform SKU guesses reasonably well without
 * needing a full translation service for a handful of food-category words.
 */
const SKU_PHRASE_KO: Record<string, string> = {
  "snacks": "스낵/과자",
  "biscuits & shortcakes": "비스킷/쿠키/케이크",
  "confectionery & candy": "캔디/컨펙셔너리",
  "jellies & gummies": "젤리/구미",
  "chocolate": "초콜릿",
  "nutritional supplements": "건강기능식품",
  "baby cereal & porridge": "이유식/시리얼",
};

const SKU_WORD_KO: Record<string, string> = {
  snack: "스낵", snacks: "스낵", chips: "칩", crackers: "크래커", cracker: "크래커",
  biscuit: "비스킷", biscuits: "비스킷", cookie: "쿠키", cookies: "쿠키", cake: "케이크",
  shortbread: "쇼트브레드", shortcake: "쇼트케이크",
  candy: "캔디", candies: "캔디", confectionery: "컨펙셔너리", sweets: "사탕", toffee: "토피",
  jelly: "젤리", jellies: "젤리", gummy: "구미", gummies: "구미",
  chocolate: "초콜릿", pralines: "프랄린", truffles: "트러플",
  supplement: "건강기능식품", supplements: "건강기능식품", vitamin: "비타민", vitamins: "비타민",
  cereal: "시리얼", porridge: "이유식", baby: "유아용",
  coffee: "커피", tea: "차", beverage: "음료", beverages: "음료", drink: "음료", drinks: "음료",
  honey: "꿀", nuts: "견과류", "dried fruit": "건과일",
};

function translateWord(word: string): string {
  const key = word.trim().toLowerCase();
  return SKU_WORD_KO[key] ?? word;
}

export function toKoreanSku(sku: string): string {
  const trimmed = sku.trim();
  const phraseMatch = SKU_PHRASE_KO[trimmed.toLowerCase()];
  if (phraseMatch) return phraseMatch;

  // Split on the same separators the existing Korean SKU data already uses ("/", "&",
  // ",") and translate what we recognize, leaving anything unrecognized as-is rather
  // than guessing wrong.
  const parts = trimmed.split(/\s*[/&,]\s*|\s+and\s+/i).filter(Boolean);
  if (parts.length <= 1) return translateWord(trimmed);
  return parts.map(translateWord).join("/");
}
