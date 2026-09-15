"use client";

import { useSearchParams } from "next/navigation";
import { FileSpreadsheet } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function BrandExportMenu({
  downloadAllLabel,
  downloadPageLabel,
  ariaLabel,
}: {
  downloadAllLabel: string;
  downloadPageLabel: string;
  ariaLabel: string;
}) {
  const searchParams = useSearchParams();
  const q = searchParams.get("q") ?? "";
  const page = searchParams.get("page") ?? "1";

  const qParam = q ? `&q=${encodeURIComponent(q)}` : "";
  const allHref = `/api/brands/export?scope=all${qParam}`;
  const pageHref = `/api/brands/export?scope=page&page=${page}${qParam}`;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="outline" size="icon" aria-label={ariaLabel}>
            <FileSpreadsheet className="size-4" />
          </Button>
        }
      />
      <DropdownMenuContent align="end">
        <DropdownMenuItem render={<a href={allHref}>{downloadAllLabel}</a>} />
        <DropdownMenuItem render={<a href={pageHref}>{downloadPageLabel}</a>} />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
