import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { StoreVisitItemForm } from "@/components/field/store-visit-item-form";
import { updateProduct } from "@/app/(dashboard)/field/products/actions";
import { auth } from "@/auth";
import { isOwnerOrAdmin } from "@/lib/auth/ownership";
import { db } from "@/lib/db";
import { getLocale } from "@/lib/i18n/get-locale";
import { getDictionary } from "@/lib/i18n/dictionary";
import { productListHref } from "@/lib/store-visit/product-list-href";

export const dynamic = "force-dynamic";

export default async function EditProductPage(props: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ q?: string; page?: string; pageSize?: string }>;
}) {
  const { id } = await props.params;
  // The list page/search the user came from, so Back and Save return there instead of page 1.
  const listHref = productListHref(await props.searchParams);
  const locale = await getLocale();
  const t = getDictionary(locale).field;
  const product = await db.product.findUnique({ where: { id } });
  if (!product) notFound();

  const session = await auth();
  if (!isOwnerOrAdmin(session?.user, product.createdById)) redirect(listHref);

  return (
    <main className="mx-auto w-full max-w-2xl space-y-5 px-4 py-8 sm:px-6 sm:py-10">
      <Link href={listHref} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> {t.back}
      </Link>
      <h1 className="text-2xl font-bold tracking-tight">{t.products.editTitle}</h1>
      <div className="rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6">
        <StoreVisitItemForm item={product} locale={locale} action={updateProduct.bind(null, id, listHref)} />
      </div>
    </main>
  );
}
