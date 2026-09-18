"use client";

import { useRouter } from "next/navigation";
import { TableRow } from "@/components/ui/table";

/** Same pattern as BrandRow -- whole row navigates on click, not just one cell's text.
 * Any button/link inside the row (edit, delete, toggle) must stopPropagation in its own
 * onClick, or it'll also trigger this row-level navigation. */
export function ClickableRow({ href, children }: { href: string; children: React.ReactNode }) {
  const router = useRouter();
  return (
    <TableRow className="cursor-pointer" onClick={() => router.push(href)}>
      {children}
    </TableRow>
  );
}
