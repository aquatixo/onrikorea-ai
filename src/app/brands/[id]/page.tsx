import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Globe, Mail, MessageCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { db } from "@/lib/db";
import { STATUS_STYLE } from "@/lib/brand-status";

export const dynamic = "force-dynamic";

function formatDate(d: Date) {
  return d.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export default async function BrandDetailPage(props: PageProps<"/brands/[id]">) {
  const { id } = await props.params;

  const brand = await db.brand.findUnique({
    where: { id },
    include: {
      contacts: true,
      outreachLogs: { orderBy: { createdAt: "desc" } },
    },
  });

  if (!brand) notFound();

  const fields: { label: string; value: React.ReactNode }[] = [
    { label: "No (sourceNo)", value: brand.sourceNo ?? "—" },
    { label: "방법론 (Methodology)", value: brand.methodology ?? "—" },
    { label: "채널 (Channel)", value: brand.channel ?? "—" },
    { label: "Country", value: brand.country ?? "—" },
    { label: "SKU", value: brand.sku ?? "—" },
    { label: "Founded", value: brand.foundedYear ?? "—" },
    { label: "Website domain", value: brand.websiteDomain ?? "—" },
    { label: "Contact point", value: brand.contactPoint ?? "—" },
    { label: "Cold email sent", value: brand.coldEmail ? "Yes" : "No" },
    { label: "Reply received", value: brand.reply ? "Yes" : "No" },
    { label: "Notes", value: brand.notes ?? "—" },
    { label: "Created", value: formatDate(brand.createdAt) },
    { label: "Updated", value: formatDate(brand.updatedAt) },
  ];

  return (
    <main className="mx-auto w-full max-w-4xl space-y-8 px-6 py-10 sm:px-8 sm:py-12">
      <Link
        href="/brands"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Back to brands
      </Link>

      <div className="space-y-4 rounded-3xl border border-border bg-card p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight">{brand.name}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {brand.country ?? "Unknown country"} · {brand.sku ?? "—"}
            </p>
          </div>
          <Badge className={`${STATUS_STYLE[brand.status]} px-2.5 py-1 text-sm`}>
            {brand.status}
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
            <Mail className="size-4" /> Contacts
          </h2>
          <div className="overflow-hidden rounded-xl border border-border">
            <ul className="divide-y divide-border">
              {brand.contacts.map((c) => (
                <li key={c.id} className="flex items-center justify-between px-4 py-3 text-sm">
                  <span>{c.email ?? c.name ?? "—"}</span>
                  {c.isPrimary && (
                    <span className="rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground">
                      Primary
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
            <MessageCircle className="size-4" /> Outreach history
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
