"use client";

import { useRouter } from "next/navigation";
import { TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

export function BrandRow({
  href,
  className,
  children,
}: {
  href: string;
  className?: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  return (
    <TableRow
      className={cn("cursor-pointer", className)}
      onClick={() => {
        // Dragging across a row to copy its text ends in a click too -- don't navigate away
        // from what the user just selected.
        if (window.getSelection()?.toString()) return;
        router.push(href);
      }}
    >
      {children}
    </TableRow>
  );
}
