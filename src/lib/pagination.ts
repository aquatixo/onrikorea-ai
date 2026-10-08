/** Returns the page numbers to render around currentPage, clamped to [1, totalPages]. */
export function getPageWindow(currentPage: number, totalPages: number, maxLinks: number): number[] {
  let start = Math.max(1, currentPage - Math.floor(maxLinks / 2));
  const end = Math.min(totalPages, start + maxLinks - 1);
  start = Math.max(1, end - maxLinks + 1);
  return Array.from({ length: end - start + 1 }, (_, i) => start + i);
}

export const PAGE_SIZE_OPTIONS = [10, 20, 30, 40, 50] as const;
export const DEFAULT_PAGE_SIZE = 10;

/** Parses a `pageSize` query param, falling back to DEFAULT_PAGE_SIZE for anything not in PAGE_SIZE_OPTIONS. */
export function parsePageSize(raw: string | undefined): number {
  const n = Number.parseInt(raw ?? "", 10);
  return (PAGE_SIZE_OPTIONS as readonly number[]).includes(n) ? n : DEFAULT_PAGE_SIZE;
}

// Far past any real list (10,000 pages x 50 rows) but small enough that (page - 1) * pageSize
// stays a valid database offset -- a hand-edited ?page=99999999999999999999 used to crash
// the page with a database error instead of just showing an empty page.
const MAX_PAGE = 10_000;

/** Parses a `page` query param: a whole number from 1 to MAX_PAGE, else 1. */
export function parsePage(raw: string | undefined): number {
  const n = Number.parseInt(raw ?? "1", 10);
  return Number.isFinite(n) && n > 0 ? Math.min(n, MAX_PAGE) : 1;
}
