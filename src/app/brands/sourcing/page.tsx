import { db } from "@/lib/db";
import { getLocale } from "@/lib/i18n/get-locale";
import { getDictionary } from "@/lib/i18n/dictionary";
// TODO: needs ANTHROPIC_API_KEY set in Vercel before this can go live -- re-enable then.
// import { RunSourcingButton } from "@/components/run-sourcing-button";
import { RunPythonSourcingButton } from "@/components/run-python-sourcing-button";
import { SourcingCandidateActions } from "@/components/sourcing-candidate-actions";
import { WebsiteLink } from "@/components/website-link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";

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
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t.sourcing.title}</h1>
        <p className="text-sm text-muted-foreground">{t.sourcing.subtitle}</p>
      </div>

      <div className="flex flex-wrap items-start gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm">
        {/* TODO: needs ANTHROPIC_API_KEY set in Vercel before this can go live -- swap back to <RunSourcingButton locale={locale} /> then. */}
        <Button disabled>{t.sourcing.runButton}</Button>
        <RunPythonSourcingButton locale={locale} />
      </div>

      {!latestRun || latestRun.candidates.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t.sourcing.noRunsYet}</p>
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

          <div className="overflow-x-auto rounded-2xl border border-border bg-card shadow-sm">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-medium">{t.sourcing.colName}</th>
                  <th className="px-3 py-2 font-medium">{t.sourcing.colSource}</th>
                  <th className="px-3 py-2 font-medium">{t.sourcing.colCountry}</th>
                  <th className="px-3 py-2 font-medium">{t.sourcing.colSku}</th>
                  <th className="px-3 py-2 font-medium">{t.sourcing.colYear}</th>
                  <th className="px-3 py-2 font-medium">{t.sourcing.colWebsite}</th>
                  <th className="px-3 py-2 font-medium">{t.sourcing.colVerdict}</th>
                  <th className="px-3 py-2 font-medium">{t.sourcing.colReason}</th>
                  <th className="px-3 py-2 font-medium">{t.sourcing.colAction}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {latestRun.candidates.map((c) => (
                  <tr key={c.id} className="align-top">
                    <td className="px-3 py-2 font-medium">{c.name}</td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">{c.methodology ?? "—"}</td>
                    <td className="px-3 py-2 text-muted-foreground">{c.country ?? "—"}</td>
                    <td className="px-3 py-2 text-muted-foreground">{c.sku ?? "—"}</td>
                    <td className="px-3 py-2 text-muted-foreground">{c.foundedYear ?? "—"}</td>
                    <td className="px-3 py-2">
                      {c.website ? <WebsiteLink website={c.website} /> : <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="px-3 py-2">
                      <Badge className={VERDICT_STYLE[c.verdict]}>{verdictLabel[c.verdict] ?? c.verdict}</Badge>
                    </td>
                    <td className="max-w-xs px-3 py-2 text-xs text-muted-foreground">{c.reason}</td>
                    <td className="px-3 py-2">
                      <SourcingCandidateActions candidateId={c.id} verdict={c.verdict} locale={locale} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </main>
  );
}
