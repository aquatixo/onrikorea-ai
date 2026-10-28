import { EyeOff } from "lucide-react";
import { db } from "@/lib/db";
import { getLocale } from "@/lib/i18n/get-locale";
import { getDictionary } from "@/lib/i18n/dictionary";
import { SourcingResultsTable } from "@/components/sourcing-results-table";

export const dynamic = "force-dynamic";

/** Candidates deleted from the review list ("후보 삭제" hides them). Same table as
 * /brands/sourcing, with restore and a link back. */
export default async function HiddenSourcingCandidatesPage() {
  const locale = await getLocale();
  const t = getDictionary(locale);

  // Most recently deleted first -- the one you just removed by mistake is at the top.
  const candidates = await db.sourcingCandidate.findMany({
    where: { hiddenAt: { not: null } },
    orderBy: [{ hiddenAt: "desc" }, { id: "asc" }],
  });

  const verdictLabel: Record<string, string> = {
    pass: t.sourcing.passLabel,
    flag: t.sourcing.flagLabel,
    reject: t.sourcing.rejectLabel,
  };

  return (
    <main className="mx-auto w-full max-w-6xl space-y-6 px-6 py-10 sm:px-8 sm:py-12">
      <div className="flex items-center gap-3">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-muted">
          <EyeOff className="size-5 text-muted-foreground" />
        </span>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t.sourcing.hiddenTitle}</h1>
          <p className="text-sm text-muted-foreground">{t.sourcing.hiddenSubtitle}</p>
        </div>
      </div>

      <SourcingResultsTable
        mode="hidden"
        lastRunAt={null}
        candidates={candidates}
        verdictLabel={verdictLabel}
        locale={locale}
      />
      {candidates.length === 0 && <p className="text-center text-sm text-muted-foreground">{t.sourcing.noHidden}</p>}
    </main>
  );
}
