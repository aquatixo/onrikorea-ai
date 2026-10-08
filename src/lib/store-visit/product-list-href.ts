import { parsePage, parsePageSize } from "@/lib/pagination";

export type ProductListParams = { page?: string | number; q?: string; pageSize?: string | number };

/**
 * URL of the Products list at a given page/search/page size. Every value is re-parsed, so
 * it's safe to build from raw query params (or from a form field the client could edit):
 * the result is always a /field/products URL, never somewhere else.
 */
export function productListHref({ page, q, pageSize }: ProductListParams): string {
  const params = new URLSearchParams();
  params.set("page", String(parsePage(page === undefined ? undefined : String(page))));
  const query = (q ?? "").trim();
  if (query) params.set("q", query);
  params.set("pageSize", String(parsePageSize(pageSize === undefined ? undefined : String(pageSize))));
  return `/field/products?${params.toString()}`;
}
