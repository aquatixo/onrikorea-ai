"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Download, Plus, Trash2 } from "lucide-react";
import {
  addSourcingCandidatesToBrands,
  deleteSourcingCandidates,
} from "@/app/(dashboard)/brands/sourcing/actions";
import { ExpandableName } from "@/components/expandable-name";
import { WebsiteLink } from "@/components/website-link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getDictionary, type Locale } from "@/lib/i18n/dictionary";
import type { SourcingCandidate } from "@prisma/client";

const VERDICT_STYLE: Record<string, string> = {
  pass: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  flag: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
  reject: "bg-destructive/10 text-destructive",
};

export function SourcingResultsTable({
  runId,
  createdAt,
  candidates,
  verdictLabel,
  locale,
}: {
  runId: string;
  createdAt: Date;
  candidates: SourcingCandidate[];
  verdictLabel: Record<string, string>;
  locale: Locale;
}) {
  const dict = getDictionary(locale);
  const t = dict.sourcing;
  const router = useRouter();
  const [selected, setSelected] = React.useState<Set<string>>(() => new Set());
  const [isPending, startTransition] = React.useTransition();
  const [summary, setSummary] = React.useState<string | null>(null);
  const headerCheckboxRef = React.useRef<HTMLInputElement>(null);

  const selectableCount = candidates.length;
  const allSelected = selectableCount > 0 && selected.size === selectableCount;

  React.useEffect(() => {
    if (headerCheckboxRef.current) {
      headerCheckboxRef.current.indeterminate = selected.size > 0 && !allSelected;
    }
  }, [selected, allSelected]);

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(candidates.map((c) => c.id)));
  }

  function handleAddSelected() {
    if (selected.size === 0) {
      alert(t.selectAtLeastOne);
      return;
    }
    if (!confirm(t.confirmAddSelected(selected.size))) return;

    setSummary(null);
    startTransition(async () => {
      const ids = Array.from(selected);
      const { addedIds, errors } = await addSourcingCandidatesToBrands(ids);
      setSummary(t.bulkAddSummary(Object.keys(addedIds).length, Object.keys(errors).length));
      setSelected(new Set());
      router.refresh();
    });
  }

  function handleDeleteSelected() {
    if (selected.size === 0) {
      alert(t.selectAtLeastOne);
      return;
    }
    if (!confirm(t.confirmDeleteSelected(selected.size))) return;

    setSummary(null);
    startTransition(async () => {
      await deleteSourcingCandidates(Array.from(selected));
      setSelected(new Set());
      router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-medium">{t.resultsTitle(candidates.length)}</p>
          <p className="text-xs text-muted-foreground">
            {t.lastRunAt}: {createdAt.toLocaleString(locale === "ko" ? "ko-KR" : "en-US")}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {selected.size > 0 && (
            <span className="text-sm font-medium text-muted-foreground">{t.selectedCount(selected.size)}</span>
          )}
          <Button
            variant="outline"
            nativeButton={false}
            render={
              <a href={`/api/brands/sourcing-export?runId=${runId}`}>
                <Download className="size-4" />
                {t.downloadExcel}
              </a>
            }
          />
          <Button disabled={isPending} onClick={handleAddSelected}>
            <Plus className="size-4" />
            {isPending ? t.addingSelected : t.addSelected}
          </Button>
          <Button variant="destructive" disabled={isPending} onClick={handleDeleteSelected}>
            <Trash2 className="size-4" /> {t.deleteSelected}
          </Button>
        </div>
      </div>
      {summary && <p className="text-xs text-muted-foreground">{summary}</p>}

      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        {/* Select + Name are frozen (sticky) on the left so you always know which candidate a
            row is no matter how far right you scroll. Header row is sticky on vertical scroll too. */}
        <div className="max-h-[70vh] overflow-auto">
          <Table className="table-fixed">
            <TableHeader className="sticky top-0 z-20 bg-card">
              <TableRow className="hover:bg-transparent">
                <TableHead className="sticky left-0 z-30 w-[44px] bg-card">
                  <div className="flex justify-center">
                    <input
                      ref={headerCheckboxRef}
                      type="checkbox"
                      checked={allSelected}
                      onChange={toggleAll}
                      aria-label={t.selectAll}
                      className="size-4 rounded border-border"
                    />
                  </div>
                </TableHead>
                <TableHead className="sticky left-[44px] z-30 w-[190px] border-r border-border bg-card">
                  {t.colName}
                </TableHead>
                <TableHead className="w-[50px]">{t.colNo}</TableHead>
                <TableHead className="w-[150px]">{dict.brands.colMethodology}</TableHead>
                <TableHead className="w-[90px]">{t.colCountry}</TableHead>
                <TableHead className="w-[120px]">{t.colSku}</TableHead>
                <TableHead className="w-[70px]">{t.colYear}</TableHead>
                <TableHead className="w-[170px]">{t.colWebsite}</TableHead>
                <TableHead className="w-[130px]">{t.colContactPoint}</TableHead>
                <TableHead className="w-[100px]">{t.colColdEmail}</TableHead>
                <TableHead className="w-[90px]">{t.colReply}</TableHead>
                <TableHead className="w-[80px]">{t.colVerdict}</TableHead>
                <TableHead className="w-[240px]">{t.colReason}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {candidates.map((c, i) => (
                <TableRow key={c.id} data-state={selected.has(c.id) ? "selected" : undefined}>
                  <TableCell className="sticky left-0 z-10 bg-card align-top">
                    <div className="flex justify-center">
                      <input
                        type="checkbox"
                        checked={selected.has(c.id)}
                        onChange={() => toggleOne(c.id)}
                        aria-label={c.name}
                        className="size-4 rounded border-border"
                      />
                    </div>
                  </TableCell>
                  <TableCell className="sticky left-[44px] z-10 border-r border-border bg-card align-top font-medium">
                    <ExpandableName name={c.name} />
                  </TableCell>
                  <TableCell className="align-top text-muted-foreground">{i + 1}</TableCell>
                  <TableCell
                    className="truncate align-top text-xs text-muted-foreground"
                    title={c.methodology ?? undefined}
                  >
                    {c.methodology ?? "—"}
                  </TableCell>
                  <TableCell className="truncate align-top text-muted-foreground">{c.country ?? "—"}</TableCell>
                  <TableCell className="truncate align-top text-muted-foreground" title={c.sku ?? undefined}>
                    {c.sku ?? "—"}
                  </TableCell>
                  <TableCell className="align-top text-muted-foreground">{c.foundedYear ?? "—"}</TableCell>
                  <TableCell className="truncate align-top">
                    {c.website ? (
                      <div className="truncate">
                        <WebsiteLink website={c.website} />
                      </div>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="align-top text-muted-foreground">—</TableCell>
                  <TableCell className="align-top text-muted-foreground">—</TableCell>
                  <TableCell className="align-top text-muted-foreground">—</TableCell>
                  <TableCell className="align-top">
                    <Badge className={VERDICT_STYLE[c.verdict]}>{verdictLabel[c.verdict] ?? c.verdict}</Badge>
                  </TableCell>
                  <TableCell className="truncate align-top text-xs text-muted-foreground" title={c.reason}>
                    {c.reason}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
