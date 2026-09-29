import { MessagesSquare } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BrandRow } from "@/components/brand-row";
import { WebsiteLink } from "@/components/website-link";
import { CommunicationStatusFilter } from "@/components/communication-status-filter";
import { db } from "@/lib/db";
import { STATUS_STYLE } from "@/lib/brand-status";
import { getLocale } from "@/lib/i18n/get-locale";
import { getDictionary } from "@/lib/i18n/dictionary";
import type { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

export default async function BrandCommunicationsPage(props: { searchParams: Promise<{ status?: string }> }) {
  const locale = await getLocale();
  const t = getDictionary(locale);
  const { status: rawStatus } = await props.searchParams;
  const statusFilter = rawStatus === "REPLIED" || rawStatus === "CONTACTED" ? rawStatus : "ALL";

  // "Actively tracked" is defined by having a progress log, not by status -- status
  // alone would also match brands from months-old outreach that are no longer being
  // worked, since it's never reset once set (see BrandLog's schema comment).
  const where: Prisma.BrandWhereInput = {
    logs: { some: {} },
    ...(statusFilter !== "ALL" ? { status: statusFilter } : {}),
  };

  const brands = await db.brand.findMany({
    where,
    include: {
      logs: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  });

  brands.sort((a, b) => (b.logs[0]?.createdAt.getTime() ?? 0) - (a.logs[0]?.createdAt.getTime() ?? 0));

  return (
    <main className="mx-auto w-full max-w-6xl space-y-6 px-6 py-10 sm:px-8 sm:py-12">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10">
            <MessagesSquare className="size-5 text-primary" />
          </span>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{t.communications.title}</h1>
            <p className="text-sm text-muted-foreground">{t.communications.subtitle}</p>
          </div>
        </div>
        <CommunicationStatusFilter value={statusFilter} locale={locale} />
      </div>

      <p className="text-sm text-muted-foreground">{t.communications.countTracked(brands.length)}</p>

      <div className="overflow-hidden rounded-2xl bg-card shadow-sm ring-1 ring-foreground/10">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>{t.communications.colName}</TableHead>
                <TableHead>{t.communications.colCountry}</TableHead>
                <TableHead>{t.communications.colSku}</TableHead>
                <TableHead>{t.communications.colWebsite}</TableHead>
                <TableHead>{t.communications.colStatus}</TableHead>
                <TableHead>{t.communications.colLatest}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {brands.length === 0 && (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                    {t.communications.noFound}
                  </TableCell>
                </TableRow>
              )}
              {brands.map((brand) => (
                <BrandRow
                  key={brand.id}
                  href={`/brands/${brand.id}?returnTo=${encodeURIComponent("/brands/communications")}`}
                >
                  <TableCell className="font-medium">{brand.name}</TableCell>
                  <TableCell className="text-muted-foreground">{brand.country ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{brand.sku ?? "—"}</TableCell>
                  <TableCell>
                    {brand.website ? (
                      <WebsiteLink website={brand.website} />
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge className={STATUS_STYLE[brand.status]}>{t.status[brand.status]}</Badge>
                  </TableCell>
                  <TableCell className="max-w-xs truncate text-muted-foreground">
                    {brand.logs[0]?.body ?? "—"}
                  </TableCell>
                </BrandRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </main>
  );
}
