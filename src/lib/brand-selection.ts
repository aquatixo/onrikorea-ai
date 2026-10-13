"use client";

import * as React from "react";

/**
 * Brands picked with the list's checkboxes, for "선택 다운로드". Kept in one module-level
 * store (not component state) so a selection survives paging, searching and changing the
 * page size -- every one of those is a navigation that re-renders the list -- and in
 * sessionStorage so it survives a reload of the same tab.
 */
const STORAGE_KEY = "brands:selected";

let selected: ReadonlySet<string> = load();
const listeners = new Set<() => void>();

function load(): ReadonlySet<string> {
  try {
    const raw = typeof window === "undefined" ? null : window.sessionStorage.getItem(STORAGE_KEY);
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

function commit(next: Set<string>) {
  selected = next;
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify([...next]));
  } catch {
    // Storage unavailable (private mode etc.) -- the in-memory selection still works.
  }
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
