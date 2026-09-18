import Link from "next/link";
import { Plus, Package, Pencil } from "lucide-react";
import { db } from "@/lib/db";
import { getLocale } from "@/lib/i18n/get-locale";
import { getDictionary } from "@/lib/i18n/dictionary";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BrandSearch } from "@/components/brand-search";
import { ClickableRow } from "@/components/field/clickable-row";
import { StopPropagation } from "@/components/field/stop-propagation";
import { DeleteProductButton } from "@/components/field/delete-product-button";
import type { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

export default async function FieldProductsPage(props: { searchParams: Promise<{ q?: string }> }) {
  const locale = await getLocale();
  const t = getDictionary(locale).field;
  const { q: rawQ } = await props.searchParams;
  const q = (rawQ ?? "").trim();

  const where: Prisma.ProductWhereInput = q
    ? {
        OR: [
          { productName: { contains: q, mode: "insensitive" } },
          { brandName: { contains: q, mode: "insensitive" } },
          { barcode: { contains: q, mode: "insensitive" } },
        ],
      }
    : {};

  const products = await db.product.findMany({ where, orderBy: { productName: "asc" } });

  return (
    <main className="mx-auto w-full max-w-6xl space-y-6 px-6 py-10 sm:px-8 sm:py-12">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10">
            <Package className="size-5 text-primary" />
          </span>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{t.products.title}</h1>
            <p className="text-sm text-muted-foreground">{t.products.subtitle}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <BrandSearch defaultValue={q} placeholder={t.products.searchPlaceholder} />
          <Button
            nativeButton={false}
            render={
              <Link href="/field/products/new">
                <Plus className="size-4" /> {t.products.addProduct}
              </Link>
            }
          />
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl bg-card shadow-sm ring-1 ring-foreground/10">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>{t.products.colBrand}</TableHead>
                <TableHead>{t.products.colName}</TableHead>
                <TableHead>{t.products.colCategory}</TableHead>
                <TableHead>{t.products.colBarcode}</TableHead>
                <TableHead>{t.products.colAction}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {products.length === 0 && (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={5} className="h-32 text-center text-muted-foreground">
                    {t.products.noFound}
                  </TableCell>
                </TableRow>
              )}
              {products.map((p) => (
                <ClickableRow key={p.id} href={`/field/products/${p.id}/edit`}>
                  <TableCell className="text-muted-foreground">{p.brandName}</TableCell>
                  <TableCell className="font-medium">{p.productName}</TableCell>
                  <TableCell className="text-muted-foreground">{t.category[p.category]}</TableCell>
                  <TableCell className="text-muted-foreground">{p.barcode ?? "—"}</TableCell>
                  <TableCell>
                    <StopPropagation>
                      <div className="flex items-center gap-1.5">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          nativeButton={false}
                          render={<Link href={`/field/products/${p.id}/edit`}><Pencil className="size-4" /></Link>}
                        />
                        <DeleteProductButton productId={p.id} locale={locale} />
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
