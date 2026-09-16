import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Globe, Mail, MessageCircle, Pencil } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DeleteBrandButton } from "@/components/delete-brand-button";
import { db } from "@/lib/db";
import { STATUS_STYLE } from "@/lib/brand-status";
import { getLocale } from "@/lib/i18n/get-locale";
import { getDictionary } from "@/lib/i18n/dictionary";

export const dynamic = "force-dynamic";

function formatDate(d: Date) {
  return d.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export default async function BrandDetailPage(
  props: PageProps<"/brands/[id]"> & { searchParams: Promise<{ returnTo?: string }> }
) {
  const locale = await getLocale();
  const t = getDictionary(locale);
  const { id } = await props.params;
  const { returnTo } = await props.searchParams;
  // Only ever navigate back within /brands -- never follow an arbitrary URL from the query string.
  const backHref = returnTo && returnTo.startsWith("/brands") ? returnTo : "/brands";

  const brand = await db.brand.findUnique({
    where: { id },
    include: {
      contacts: true,
      outreachLogs: { orderBy: { createdAt: "desc" } },
    },
  });

  if (!brand) notFound();

  const yesNo = (v: boolean) => (v ? t.detail.yes : t.detail.no);
  const triState = (v: boolean | null) => (v === null ? t.detail.dash : yesNo(v));

  const fields: { label: string; value: React.ReactNode }[] = [
    { label: t.detail.sourceNo, value: brand.sourceNo ?? t.detail.dash },
    { label: t.detail.methodology, value: brand.methodology ?? t.detail.dash },
    { label: t.detail.channel, value: brand.channel ?? t.detail.dash },
    { label: t.detail.country, value: brand.country ?? t.detail.dash },
    { label: t.detail.sku, value: brand.sku ?? t.detail.dash },
    { label: t.detail.founded, value: brand.foundedYear ?? t.detail.dash },
    { label: t.detail.websiteDomain, value: brand.websiteDomain ?? t.detail.dash },
    { label: t.detail.contactPoint, value: brand.contactPoint ?? t.detail.dash },
    { label: t.detail.coldEmailSent, value: triState(brand.coldEmail) },
    { label: t.detail.replyReceived, value: yesNo(brand.reply) },
    { label: t.detail.notes, value: brand.notes ?? t.detail.dash },
    { label: t.detail.created, value: formatDate(brand.createdAt) },
    { label: t.detail.updated, value: formatDate(brand.updatedAt) },
  ];

  return (
    <main className="mx-auto w-full max-w-4xl space-y-5 px-4 py-8 sm:px-6 sm:py-10">
      <div className="flex items-center justify-between">
        <Link
          href={backHref}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" /> {t.detail.back}
        </Link>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            nativeButton={false}
            render={
              <Link href={`/brands/${brand.id}/edit?returnTo=${encodeURIComponent(backHref)}`}>
                <Pencil className="size-4" /> {t.detail.edit}
              </Link>
            }
          />
          <DeleteBrandButton
            brandId={brand.id}
            label={t.detail.delete}
            confirmText={t.detail.confirmDelete}
            returnTo={backHref}
          />
        </div>
      </div>

      <section className="relative overflow-hidden rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6">
        <div
          aria-hidden
          className="pointer-events-none absolute -top-20 -right-20 size-56 rounded-full bg-primary/10 blur-3xl"
        />
        <div className="relative space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-muted text-lg font-bold text-muted-foreground">
                {brand.name.slice(0, 1).toUpperCase()}
              </span>
              <div>
                <h1 className="text-xl font-extrabold tracking-tight sm:text-2xl">{brand.name}</h1>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  {brand.country ?? t.detail.unknownCountry} · {brand.sku ?? "—"}
                </p>
              </div>
            </div>
            <Badge className={`${STATUS_STYLE[brand.status]} px-2.5 py-1 text-sm`}>
              {t.status[brand.status]}
            </Badge>
          </div>

          {brand.website && (
            <a
              href={brand.website.startsWith("http") ? brand.website : `https://${brand.website}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1.5 text-sm text-primary transition hover:bg-muted/70"
            >
              <Globe className="size-4" />
              {brand.website}
            </a>
          )}
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6">
        <p className="mb-3 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          {t.detail.detailsHeading}
        </p>
        <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {fields.map((f) => (
            <div key={f.label} className="rounded-xl bg-muted/40 px-3.5 py-2.5">
              <dt className="text-xs font-medium text-muted-foreground">{f.label}</dt>
              <dd className="mt-0.5 text-sm break-words">{f.value}</dd>
            </div>
          ))}
        </dl>
      </section>

      {brand.contacts.length > 0 && (
        <section className="rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold">
            <Mail className="size-4 text-muted-foreground" /> {t.detail.contacts}
          </h2>
          <ul className="divide-y divide-border">
            {brand.contacts.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-3 py-2.5 text-sm first:pt-0 last:pb-0">
                <span className="flex items-center gap-2.5">
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground">
                    {(c.email ?? c.name ?? "?").slice(0, 1).toUpperCase()}
                  </span>
                  {c.email ?? c.name ?? "—"}
                </span>
                {c.isPrimary && (
                  <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                    {t.detail.primary}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {brand.outreachLogs.length > 0 && (
        <section className="rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold">
            <MessageCircle className="size-4 text-muted-foreground" /> {t.detail.outreachHistory}
          </h2>
          <ul className="divide-y divide-border">
            {brand.outreachLogs.map((log) => (
              <li key={log.id} className="flex items-center justify-between gap-3 py-2.5 text-sm first:pt-0 last:pb-0">
                <span>{log.type.replaceAll("_", " ")}</span>
                <span className="text-xs text-muted-foreground">{formatDate(log.createdAt)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
