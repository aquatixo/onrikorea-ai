"use client";

import * as React from "react";

/**
 * Brands picked with the list's checkboxes, for "선택 다운로드". Shared by the row
 * checkboxes, the header checkbox and the export menu (separate client components), so it
 * lives in one module-level store rather than component state. It only ever holds the
 * brands on the page being shown: BrandSelectAllHead clears it whenever the page changes
 * (paging, searching, page size) -- to pick more at once, show more rows (up to 100).
 */
let selected: ReadonlySet<string> = new Set();
const listeners = new Set<() => void>();

function commit(next: ReadonlySet<string>) {
  selected = next;
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

const EMPTY: ReadonlySet<string> = new Set();

export function useBrandSelection(): ReadonlySet<string> {
  return React.useSyncExternalStore(subscribe, () => selected, () => EMPTY);
}

export function setBrandsSelected(ids: string[], checked: boolean) {
  const next = new Set(selected);
  for (const id of ids) {
    if (checked) next.add(id);
    else next.delete(id);
  }
  commit(next);
}

export function clearBrandSelection() {
  if (selected.size) commit(new Set());
}
