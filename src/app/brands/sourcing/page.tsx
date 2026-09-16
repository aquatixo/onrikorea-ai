import { db } from "@/lib/db";
import { getLocale } from "@/lib/i18n/get-locale";
import { getDictionary } from "@/lib/i18n/dictionary";
// TODO: needs ANTHROPIC_API_KEY set in Vercel before this can go live -- re-enable then.
// import { RunSourcingButton } from "@/components/run-sourcing-button";
import { RunPythonSourcingButton } from "@/components/run-python-sourcing-button";
import type { SourcingProgress } from "@/components/sourcing-progress-panel";
import { SourcingCandidateActions } from "@/components/sourcing-candidate-actions";
import { DeleteSourcingCandidateButton } from "@/components/delete-sourcing-candidate-button";
import { ExpandableName } from "@/components/expandable-name";
import { WebsiteLink } from "@/components/website-link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Download, Search, ListChecks } from "lucide-react";

export const dynamic = "force-dynamic";

const VERDICT_STYLE: Record<string, string> = {
  pass: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  flag: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
  reject: "bg-destructive/10 text-destructive",
};

export default async function BrandSourcingPage() {
  const locale = await getLocale();
  const t = getDictionary(locale);

  const latestRun = await db.sourcingRun.findFirst({
    orderBy: { createdAt: "desc" },
    include: { candidates: { orderBy: [{ verdict: "asc" }, { name: "asc" }] } },
  });

  const verdictLabel: Record<string, string> = {
    pass: t.sourcing.passLabel,
    flag: t.sourcing.flagLabel,
    reject: t.sourcing.rejectLabel,
  };

  return (
    <main className="mx-auto w-full max-w-6xl space-y-6 px-6 py-10 sm:px-8 sm:py-12">
      <div className="flex items-center gap-3">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10">
          <Search className="size-5 text-primary" />
        </span>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t.sourcing.title}</h1>
          <p className="text-sm text-muted-foreground">{t.sourcing.subtitle}</p>
        </div>
      </div>

      <div className="flex flex-wrap items-start gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm">
        {/* TODO: needs ANTHROPIC_API_KEY set in Vercel before this can go live -- swap back to <RunSourcingButton locale={locale} /> then. */}
        <Button disabled>{t.sourcing.runButton}</Button>
        <RunPythonSourcingButton
          locale={locale}
          latestRun={
            latestRun
              ? { id: latestRun.id, status: latestRun.status, progress: latestRun.progress as SourcingProgress | null }
              : null
          }
        />
      </div>

      {!latestRun || latestRun.candidates.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-border py-16 text-center">
          <ListChecks className="size-6 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">{t.sourcing.noRunsYet}</p>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-sm font-medium">{t.sourcing.resultsTitle(latestRun.candidates.length)}</p>
              <p className="text-xs text-muted-foreground">
                {t.sourcing.lastRunAt}: {latestRun.createdAt.toLocaleString(locale === "ko" ? "ko-KR" : "en-US")}
              </p>
            </div>
            <Button
              variant="outline"
              nativeButton={false}
              render={
                <a href={`/api/brands/sourcing-export?runId=${latestRun.id}`}>
                  <Download className="size-4" />
                  {t.sourcing.downloadExcel}
                </a>
              }
            />
          </div>

          <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
            {/* Action + Name are frozen (sticky) on the left so you always know which
                candidate a row is, and can act on it, no matter how far right you scroll
                through the rest of the columns. Header row is sticky on vertical scroll too. */}
            <div className="max-h-[70vh] overflow-auto">
              <Table className="table-fixed">
                <TableHeader className="sticky top-0 z-20 bg-card">
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="sticky left-0 z-30 w-[130px] bg-card">{t.sourcing.colAction}</TableHead>
                    <TableHead className="sticky left-[130px] z-30 w-[60px] bg-card">{t.sourcing.colDelete}</TableHead>
                    <TableHead className="sticky left-[190px] z-30 w-[190px] border-r border-border bg-card">
                      {t.sourcing.colName}
                    </TableHead>
                    <TableHead className="w-[50px]">{t.sourcing.colNo}</TableHead>
                    <TableHead className="w-[150px]">{t.brands.colMethodology}</TableHead>
                    <TableHead className="w-[90px]">{t.sourcing.colCountry}</TableHead>
                    <TableHead className="w-[120px]">{t.sourcing.colSku}</TableHead>
                    <TableHead className="w-[70px]">{t.sourcing.colYear}</TableHead>
                    <TableHead className="w-[170px]">{t.sourcing.colWebsite}</TableHead>
                    <TableHead className="w-[130px]">{t.sourcing.colContactPoint}</TableHead>
                    <TableHead className="w-[100px]">{t.sourcing.colColdEmail}</TableHead>
                    <TableHead className="w-[90px]">{t.sourcing.colReply}</TableHead>
                    <TableHead className="w-[80px]">{t.sourcing.colVerdict}</TableHead>
                    <TableHead className="w-[240px]">{t.sourcing.colReason}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {latestRun.candidates.map((c, i) => (
                    <TableRow key={c.id}>
                      <TableCell className="sticky left-0 z-10 bg-card align-top">
                        <SourcingCandidateActions candidateId={c.id} verdict={c.verdict} locale={locale} />
                      </TableCell>
                      <TableCell className="sticky left-[130px] z-10 bg-card align-top">
                        <DeleteSourcingCandidateButton candidateId={c.id} locale={locale} />
                      </TableCell>
                      <TableCell className="sticky left-[190px] z-10 border-r border-border bg-card align-top font-medium">
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
      )}
    </main>
  );
}
