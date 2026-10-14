import { Badge } from "@/components/ui/badge";
import { BrandRow } from "@/components/brand-row";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { WebsiteLink } from "@/components/website-link";
import { STATUS_STYLE } from "@/lib/brand-status";
import { formatMonthDay, formatShortDateTime } from "@/lib/format-date";
import { getDictionary, type Locale } from "@/lib/i18n/dictionary";
import type { Brand, BrandLog, BrandStatus } from "@prisma/client";

type OverviewBrand = Brand & { logs: BrandLog[] };

/**
 * "한눈에 보기": every tracked brand on one page with its whole progress log, grouped the
 * way the team's old Excel sheet was -- in conversation first, then awaiting reply, then
 * everything else. A row opens the brand like the paged list does, except right after
 * selecting text in it, so the log can still be copied.
 */
export function CommunicationsOverview({
  brands,
  locale,
  returnTo,
}: {
  brands: OverviewBrand[];
  locale: Locale;
  returnTo: string;
}) {
  const t = getDictionary(locale);
  const groups: { key: string; title: string; match: (s: BrandStatus) => boolean }[] = [
    { key: "REPLIED", title: t.communications.filterReplied, match: (s) => s === "REPLIED" },
    { key: "CONTACTED", title: t.communications.filterContacted, match: (s) => s === "CONTACTED" },
    { key: "OTHER", title: t.communications.groupOther, match: (s) => s !== "REPLIED" && s !== "CONTACTED" },
  ];

  if (brands.length === 0) {
    return (
      <div className="rounded-2xl bg-card p-10 text-center text-sm text-muted-foreground shadow-sm ring-1 ring-foreground/10">
        {t.communications.noFound}
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {groups.map((group) => {
        const rows = brands.filter((b) => group.match(b.status));
        if (rows.length === 0) return null;
        return (
          <section key={group.key} className="space-y-3">
            <h2 className="text-lg font-semibold">
              {group.title} <span className="text-sm font-normal text-muted-foreground">{rows.length}</span>
            </h2>
            <div className="overflow-hidden rounded-2xl bg-card shadow-sm ring-1 ring-foreground/10">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="w-48">{t.communications.colName}</TableHead>
                      <TableHead className="w-24">{t.communications.colCountry}</TableHead>
                      <TableHead className="w-36">{t.communications.colSku}</TableHead>
                      <TableHead className="w-44">{t.communications.colWebsite}</TableHead>
                      <TableHead className="w-24">{t.communications.colStatus}</TableHead>
                      <TableHead className="min-w-96">{t.communications.colLog}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((brand) => (
                      <BrandRow
                        key={brand.id}
                        href={`/brands/${brand.id}?returnTo=${encodeURIComponent(returnTo)}`}
                        className="[&>td]:align-top"
                      >
                        <TableCell className="font-medium whitespace-normal">
                          {brand.name}
                        </TableCell>
                        <TableCell className="text-muted-foreground">{brand.country ?? "—"}</TableCell>
                        <TableCell className="text-muted-foreground whitespace-normal">{brand.sku ?? "—"}</TableCell>
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
                        <TableCell className="whitespace-normal">
                          {/* Oldest first, like the sheet -- read top to bottom as a timeline. The
                              date comes from the entry itself (imported notes had theirs moved
                              out of the text into createdAt). */}
                          <ul className="space-y-1 text-sm">
                            {brand.logs.map((log) => (
                              <li key={log.id} className="flex gap-2">
                                <span
                                  title={formatShortDateTime(log.createdAt, locale)}
                                  className="w-10 shrink-0 text-muted-foreground tabular-nums"
                                >
                                  {formatMonthDay(log.createdAt)}
                                </span>
                                <span className="min-w-0 whitespace-pre-wrap break-words">{log.body}</span>
                              </li>
                            ))}
                          </ul>
                        </TableCell>
                      </BrandRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          </section>
        );
      })}
    </div>
  );
}
