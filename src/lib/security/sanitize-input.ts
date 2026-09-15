/**
 * Rejects (rather than silently stripping) two categories of hostile text input:
 *
 * 1. Script/markup injection -- <script>, event handler attributes (onerror=, onclick=),
 *    javascript:/vbscript:/data:text/html URIs. React already escapes everything we render
 *    as text, so this isn't exploitable today, but `website` does flow into an <a href> and
 *    every field gets written back out through the Excel export routes -- reject at the
 *    boundary rather than depend on that staying true everywhere forever.
 * 2. Excel/CSV formula injection -- a cell starting with =, +, -, @, or a tab/CR is
 *    interpreted as a formula by Excel/LibreOffice when re-opened, which is exactly what
 *    happens to this data via /api/brands/export and /api/brands/sourcing-export.
 */

const SCRIPT_PATTERNS: RegExp[] = [
  /<script/i,
  /<iframe/i,
  /<object/i,
  /<embed/i,
  /javascript:/i,
  /vbscript:/i,
  /data:text\/html/i,
  /on\w+\s*=/i,
];

const FORMULA_LEAD_CHARS = new Set(["=", "+", "-", "@", "\t", "\r"]);

export type UnsafeTextReason = "script" | "formula";

export const UNSAFE_INPUT_MESSAGE = "unsafe-input";

export function findUnsafeTextReason(value: string): UnsafeTextReason | null {
  if (SCRIPT_PATTERNS.some((pattern) => pattern.test(value))) return "script";
  const leadChar = value.trimStart()[0];
  if (leadChar && FORMULA_LEAD_CHARS.has(leadChar)) return "formula";
  return null;
}

export function isSafeText(value: string): boolean {
  return findUnsafeTextReason(value) === null;
}
