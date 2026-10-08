/**
 * Rejects (rather than silently stripping) script/markup injection in text input:
 * <script>/<iframe>/<object>/<embed>, event handler attributes inside a tag
 * (<img onerror=...>), and javascript:/vbscript:/data:text/html URIs. React already escapes
 * everything we render as text, so this isn't exploitable today, but `website` does flow
 * into an <a href> -- reject at the boundary rather than depend on that staying true
 * everywhere forever.
 *
 * Excel formula injection (a value starting with = + - @) is deliberately NOT checked here
 * any more. Rejecting those blocked ordinary notes ("- 1차 미팅", "+82 10-...", "@account",
 * "-10% 할인"), and the only place this data reaches a spreadsheet is the xlsx export
 * (/api/brands/export, /api/brands/sourcing-export), which writes every value as a text
 * cell -- Excel shows "=1+1" literally there instead of evaluating it. If a CSV export is
 * ever added, escape leading = + - @ in THAT export instead of blocking input.
 *
 * Event handlers only count inside a tag: the old bare `on\w+=` pattern also matched
 * plain text like "Monday = 휴무".
 */

const SCRIPT_PATTERNS: RegExp[] = [
  /<script/i,
  /<iframe/i,
  /<object/i,
  /<embed/i,
  /javascript:/i,
  /vbscript:/i,
  /data:text\/html/i,
  /<[^>]*\son\w+\s*=/i,
];

export type UnsafeTextReason = "script";

export const UNSAFE_INPUT_MESSAGE = "unsafe-input";

export function findUnsafeTextReason(value: string): UnsafeTextReason | null {
  return SCRIPT_PATTERNS.some((pattern) => pattern.test(value)) ? "script" : null;
}

export function isSafeText(value: string): boolean {
  return findUnsafeTextReason(value) === null;
}

/** True when a failed zod parse failed (at least partly) because of isSafeText. */
export function isUnsafeInputError(error: { issues: { message: string }[] }): boolean {
  return error.issues.some((issue) => issue.message === UNSAFE_INPUT_MESSAGE);
}
