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

export default async function BrandDetailPage(props: PageProps<"/brands/[id]">) {
  const locale = await getLocale();
  const t = getDictionary(locale);
  const { id } = await props.params;

  const brand = await db.brand.findUnique({
    where: { id },
    include: {
      contacts: true,
      outreachLogs: { orderBy: { createdAt: "desc" } },
    },
  });

  if (!brand) notFound();

  const yesNo = (v: boolean) => (v ? t.detail.yes : t.detail.no);

  const fields: { label: string; value: React.ReactNode }[] = [
    { label: t.detail.sourceNo, value: brand.sourceNo ?? t.detail.dash },
    { label: t.detail.methodology, value: brand.methodology ?? t.detail.dash },
    { label: t.detail.channel, value: brand.channel ?? t.detail.dash },
    { label: t.detail.country, value: brand.country ?? t.detail.dash },
    { label: t.detail.sku, value: brand.sku ?? t.detail.dash },
    { label: t.detail.founded, value: brand.foundedYear ?? t.detail.dash },
    { label: t.detail.websiteDomain, value: brand.websiteDomain ?? t.detail.dash },
    { label: t.detail.contactPoint, value: brand.contactPoint ?? t.detail.dash },
    { label: t.detail.coldEmailSent, value: yesNo(brand.coldEmail) },
    { label: t.detail.replyReceived, value: yesNo(brand.reply) },
    { label: t.detail.notes, value: brand.notes ?? t.detail.dash },
    { label: t.detail.created, value: formatDate(brand.createdAt) },
    { label: t.detail.updated, value: formatDate(brand.updatedAt) },
  ];

  return (
    <main className="mx-auto w-full max-w-4xl space-y-8 px-6 py-10 sm:px-8 sm:py-12">
      <div className="flex items-center justify-between">
        <Link
          href="/brands"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" /> {t.detail.back}
        </Link>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            nativeButton={false}
            render={
              <Link href={`/brands/${brand.id}/edit`}>
                <Pencil className="size-4" /> {t.detail.edit}
              </Link>
            }
          />
          <DeleteBrandButton brandId={brand.id} label={t.detail.delete} confirmText={t.detail.confirmDelete} />
        </div>
      </div>

      <div className="space-y-4 rounded-3xl border border-border bg-card p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight">{brand.name}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {brand.country ?? t.detail.unknownCountry} · {brand.sku ?? "—"}
            </p>
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
            className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
          >
            <Globe className="size-4" />
            {brand.website}
          </a>
        )}
      </div>

      <div className="overflow-hidden rounded-xl border border-border">
        <dl className="divide-y divide-border">
          {fields.map((f) => (
            <div key={f.label} className="grid grid-cols-1 gap-1 px-5 py-3 sm:grid-cols-3 sm:gap-4 sm:py-3.5">
              <dt className="text-sm font-medium text-muted-foreground">{f.label}</dt>
              <dd className="col-span-2 text-sm break-words">{f.value}</dd>
            </div>
          ))}
        </dl>
      </div>

      {brand.contacts.length > 0 && (
        <section className="space-y-3">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
            <Mail className="size-4" /> {t.detail.contacts}
          </h2>
          <div className="overflow-hidden rounded-xl border border-border">
            <ul className="divide-y divide-border">
              {brand.contacts.map((c) => (
                <li key={c.id} className="flex items-center justify-between px-4 py-3 text-sm">
                  <span>{c.email ?? c.name ?? "—"}</span>
                  {c.isPrimary && (
                    <span className="rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground">
                      {t.detail.primary}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {brand.outreachLogs.length > 0 && (
        <section className="space-y-3">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
            <MessageCircle className="size-4" /> {t.detail.outreachHistory}
          </h2>
          <div className="overflow-hidden rounded-xl border border-border">
            <ul className="divide-y divide-border">
              {brand.outreachLogs.map((log) => (
                <li key={log.id} className="flex items-center justify-between px-4 py-3 text-sm">
                  <span>{log.type.replaceAll("_", " ")}</span>
                  <span className="text-xs text-muted-foreground">{formatDate(log.createdAt)}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}
    </main>
  );
}
