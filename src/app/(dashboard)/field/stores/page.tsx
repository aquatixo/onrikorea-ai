import Link from "next/link";
import { Plus, Store as StoreIcon, Pencil } from "lucide-react";
import { db } from "@/lib/db";
import { getLocale } from "@/lib/i18n/get-locale";
import { getDictionary } from "@/lib/i18n/dictionary";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ClickableRow } from "@/components/field/clickable-row";
import { StopPropagation } from "@/components/field/stop-propagation";
import { ToggleStoreActiveButton } from "@/components/field/toggle-store-active-button";
import { DeleteStoreButton } from "@/components/field/delete-store-button";

export const dynamic = "force-dynamic";

export default async function StoresPage() {
  const locale = await getLocale();
  const t = getDictionary(locale).field;

  const stores = await db.store.findMany({ orderBy: { name: "asc" } });

  return (
    <main className="mx-auto w-full max-w-6xl space-y-6 px-6 py-10 sm:px-8 sm:py-12">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10">
            <StoreIcon className="size-5 text-primary" />
          </span>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{t.stores.title}</h1>
            <p className="text-sm text-muted-foreground">{t.stores.subtitle}</p>
          </div>
        </div>
        <Button
          nativeButton={false}
          render={
            <Link href="/field/stores/new">
              <Plus className="size-4" /> {t.stores.addStore}
            </Link>
          }
        />
      </div>

      <div className="overflow-hidden rounded-2xl bg-card shadow-sm ring-1 ring-foreground/10">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>{t.stores.colName}</TableHead>
                <TableHead>{t.stores.colChain}</TableHead>
                <TableHead>{t.stores.colType}</TableHead>
                <TableHead>{t.stores.colCity}</TableHead>
                <TableHead>{t.stores.colActive}</TableHead>
                <TableHead>{t.stores.colAction}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {stores.length === 0 && (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                    {t.stores.noFound}
                  </TableCell>
                </TableRow>
              )}
              {stores.map((store) => (
                <ClickableRow key={store.id} href={`/field/stores/${store.id}/edit`}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2.5">
                      {store.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element -- external Vercel Blob URL, no remotePatterns configured
                        <img src={store.imageUrl} alt={store.name} className="size-8 shrink-0 rounded-full object-cover" />
                      ) : (
                        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                          <StoreIcon className="size-4" />
                        </span>
                      )}
                      {store.name}
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{store.chain ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{t.storeType[store.storeType]}</TableCell>
                  <TableCell className="text-muted-foreground">{store.city ?? "—"}</TableCell>
                  <TableCell>
                    <Badge
                      className={
                        store.isActive
                          ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                          : "bg-muted text-muted-foreground"
                      }
                    >
                      {store.isActive ? t.stores.activeLabel : "—"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <StopPropagation>
                      <div className="flex items-center gap-1.5">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          nativeButton={false}
                          render={<Link href={`/field/stores/${store.id}/edit`}><Pencil className="size-4" /></Link>}
                        />
                        <ToggleStoreActiveButton storeId={store.id} isActive={store.isActive} locale={locale} />
                        <DeleteStoreButton storeId={store.id} locale={locale} />
                      </div>
                    </StopPropagation>
                  </TableCell>
                </ClickableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </main>
  );
}
