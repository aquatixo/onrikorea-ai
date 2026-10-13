"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { ExcelIcon } from "@/components/icons/excel-icon";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useBrandSelection } from "@/lib/brand-selection";
import { getDictionary, type Locale } from "@/lib/i18n/dictionary";

export function BrandExportMenu({ locale }: { locale: Locale }) {
  const t = getDictionary(locale).brands;
  const searchParams = useSearchParams();
  const selected = useBrandSelection();
  const formRef = React.useRef<HTMLFormElement>(null);
  const q = searchParams.get("q") ?? "";
  const page = searchParams.get("page") ?? "1";
  const pageSize = searchParams.get("pageSize") ?? "10";

  const qParam = q ? `&q=${encodeURIComponent(q)}` : "";
  const allHref = `/api/brands/export?scope=all${qParam}`;
  const pageHref = `/api/brands/export?scope=page&page=${page}&pageSize=${pageSize}${qParam}`;

  return (
    <>
      {/* The selected ids go in a POST body, not the URL: a few hundred brand ids would
          blow past URL length limits. The response is an attachment, so the browser just
          downloads it and stays on this page. */}
      <form ref={formRef} method="post" action="/api/brands/export" className="hidden">
        {[...selected].map((id) => (
          <input key={id} type="hidden" name="ids" value={id} />
        ))}
      </form>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button variant="outline" size="icon" aria-label={t.downloadAria}>
              <ExcelIcon className="size-4" />
            </Button>
          }
        />
        <DropdownMenuContent align="end">
          <DropdownMenuItem render={<a href={allHref}>{t.downloadAll}</a>} />
          <DropdownMenuItem render={<a href={pageHref}>{t.downloadPage}</a>} />
          {/* Greyed out until something is ticked; un-ticking happens in the list itself. */}
          <DropdownMenuItem disabled={selected.size === 0} onClick={() => formRef.current?.requestSubmit()}>
            {t.downloadSelected}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}
