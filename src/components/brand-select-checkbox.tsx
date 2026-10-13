"use client";

import * as React from "react";
import { TableCell, TableHead } from "@/components/ui/table";
import { setBrandsSelected, useBrandSelection } from "@/lib/brand-selection";

// The whole row navigates to the brand on click (BrandRow), so the checkbox cell swallows
// its own clicks -- ticking a box, or just missing it by a few pixels, never opens a brand.
function stop(e: React.MouseEvent) {
  e.stopPropagation();
}

/** One row's checkbox cell. */
export function BrandSelectCell({ id, label }: { id: string; label: string }) {
  const selected = useBrandSelection();
  return (
    <TableCell className="w-10" onClick={stop}>
      <input
        type="checkbox"
        checked={selected.has(id)}
        onChange={(e) => setBrandsSelected([id], e.currentTarget.checked)}
        aria-label={label}
        className="size-4 rounded border-border"
      />
    </TableCell>
  );
}

/** Header checkbox: selects or clears every brand on the CURRENT page. */
export function BrandSelectAllHead({ ids, label }: { ids: string[]; label: string }) {
  const selected = useBrandSelection();
  const ref = React.useRef<HTMLInputElement>(null);
  const onPage = ids.filter((id) => selected.has(id)).length;
  const all = ids.length > 0 && onPage === ids.length;

  React.useEffect(() => {
    if (ref.current) ref.current.indeterminate = onPage > 0 && !all;
  }, [onPage, all]);

  return (
    <TableHead className="w-10">
      <input
        ref={ref}
        type="checkbox"
        checked={all}
        disabled={ids.length === 0}
        onChange={() => setBrandsSelected(ids, !all)}
        aria-label={label}
        className="size-4 rounded border-border"
      />
    </TableHead>
  );
}
