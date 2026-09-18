import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { BrandForm } from "@/components/brand-form";
import { updateBrand } from "@/app/(dashboard)/brands/actions";
import { db } from "@/lib/db";
import { getLocale } from "@/lib/i18n/get-locale";
import { getDictionary } from "@/lib/i18n/dictionary";

export const dynamic = "force-dynamic";

export default async function EditBrandPage(
  props: PageProps<"/brands/[id]/edit"> & { searchParams: Promise<{ returnTo?: string }> }
) {
  const locale = await getLocale();
  const t = getDictionary(locale);
  const { id } = await props.params;
  const { returnTo } = await props.searchParams;
  // Only ever navigate back within /brands -- never follow an arbitrary URL from the query string.
  const safeReturnTo = returnTo && returnTo.startsWith("/brands") ? returnTo : undefined;
  const detailHref = safeReturnTo ? `/brands/${id}?returnTo=${encodeURIComponent(safeReturnTo)}` : `/brands/${id}`;

  const brand = await db.brand.findUnique({ where: { id } });
  if (!brand) notFound();

  const updateBrandWithId = updateBrand.bind(null, id, safeReturnTo);

  return (
    <main className="mx-auto w-full max-w-2xl space-y-5 px-4 py-8 sm:px-6 sm:py-10">
      <Link
        href={detailHref}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> {t.form.back}
      </Link>
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t.form.editTitle}</h1>
        <p className="text-sm text-muted-foreground">{brand.name}</p>
      </div>
      <div className="rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6">
        <BrandForm mode="update" brand={brand} locale={locale} action={updateBrandWithId} />
      </div>
    </main>
  );
}
