import Link from "next/link";
import { Plus, MapPin } from "lucide-react";
import { db } from "@/lib/db";
import { getLocale } from "@/lib/i18n/get-locale";
import { getDictionary } from "@/lib/i18n/dictionary";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ClickableRow } from "@/components/field/clickable-row";
import { STORE_VISIT_STATUS_STYLE } from "@/lib/field-status";

export const dynamic = "force-dynamic";

function formatDate(d: Date, locale: string) {
  return d.toLocaleDateString(locale === "ko" ? "ko-KR" : "en-US", { year: "numeric", month: "short", day: "numeric" });
}

export default async function StoreVisitsPage() {
  const locale = await getLocale();
  const t = getDictionary(locale).field;

  const visits = await db.storeVisit.findMany({
    orderBy: { visitDate: "desc" },
    include: { store: true, _count: { select: { items: true } } },
  });

  return (
    <main className="mx-auto w-full max-w-6xl space-y-6 px-6 py-10 sm:px-8 sm:py-12">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10">
            <MapPin className="size-5 text-primary" />
          </span>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{t.visits.title}</h1>
            <p className="text-sm text-muted-foreground">{t.visits.subtitle}</p>
          </div>
        </div>
        <Button
          nativeButton={false}
          render={
            <Link href="/field/store-visits/new">
              <Plus className="size-4" /> {t.visits.newVisit}
            </Link>
          }
        />
      </div>

      <div className="overflow-hidden rounded-2xl bg-card shadow-sm ring-1 ring-foreground/10">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>{t.visits.colVisitDate}</TableHead>
                <TableHead>{t.visits.colStore}</TableHead>
                <TableHead>{t.visits.colChain}</TableHead>
                <TableHead>{t.visits.colVisitor}</TableHead>
                <TableHead>{t.visits.colItems}</TableHead>
                <TableHead>{t.visits.colStatus}</TableHead>
                <TableHead>{t.visits.colUpdatedAt}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visits.length === 0 && (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
                    {t.visits.noFound}
                  </TableCell>
                </TableRow>
              )}
              {visits.map((visit) => (
                <ClickableRow key={visit.id} href={`/field/store-visits/${visit.id}`}>
                  <TableCell className="font-medium">{formatDate(visit.visitDate, locale)}</TableCell>
                  <TableCell className="text-muted-foreground">{visit.store.name}</TableCell>
                  <TableCell className="text-muted-foreground">{visit.store.chain ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{visit.visitor}</TableCell>
                  <TableCell className="text-muted-foreground">{visit._count.items}</TableCell>
                  <TableCell>
                    <Badge className={STORE_VISIT_STATUS_STYLE[visit.status]}>{t.visitStatus[visit.status]}</Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{formatDate(visit.updatedAt, locale)}</TableCell>
                </ClickableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </main>
  );
}
