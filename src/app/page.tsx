import Link from "next/link";
import { ArrowRight, ArrowUpRight, Building2, Mail, Sparkles } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [brandCount, contactedCount, recentBrands] = await Promise.all([
    db.brand.count(),
    db.brand.count({ where: { status: { in: ["CONTACTED", "REPLIED"] } } }),
    db.brand.findMany({ orderBy: { updatedAt: "desc" }, take: 5 }),
  ]);

  return (
    <main className="mx-auto w-full max-w-6xl space-y-10 px-6 py-10 sm:px-8 sm:py-12">
      <section className="relative overflow-hidden rounded-3xl border border-border bg-card p-8 sm:p-12">
        <div
          aria-hidden
          className="pointer-events-none absolute -top-24 -right-24 size-72 rounded-full bg-primary/10 blur-3xl"
        />
        <div className="relative max-w-2xl space-y-5">
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-3 py-1 text-xs font-medium text-muted-foreground">
            <Sparkles className="size-3.5" /> Sales automation platform
          </div>
          <h1 className="text-3xl leading-tight font-extrabold tracking-tight sm:text-5xl">
            Brand sourcing &amp; outreach,
            <br className="hidden sm:block" /> in one place
          </h1>
          <p className="max-w-lg text-base leading-relaxed text-muted-foreground sm:text-lg">
            Track sourced brands, evaluate candidates, and manage outreach — replacing the
            spreadsheet with one real database.
          </p>
          <div className="flex flex-wrap gap-3 pt-1">
            <Button
              nativeButton={false}
              render={
                <Link href="/brands">
                  View brands <ArrowRight className="size-4" />
                </Link>
              }
            />
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Brands tracked" value={brandCount} icon={Building2} />
        <StatCard label="Contacted" value={contactedCount} icon={Mail} />
        <Card className="border-dashed opacity-60">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Drafts in Outlook
            </CardTitle>
            <Mail className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">—</div>
            <p className="text-xs text-muted-foreground">Coming later</p>
          </CardContent>
        </Card>
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-muted-foreground">Recently updated</h2>
          <Link
            href="/brands"
            className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
          >
            View all <ArrowUpRight className="size-3.5" />
          </Link>
        </div>
        <div className="overflow-hidden rounded-xl border border-border">
          {recentBrands.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted-foreground">No brands yet.</p>
          ) : (
            <ul className="divide-y divide-border">
              {recentBrands.map((brand) => (
                <li key={brand.id} className="flex items-center justify-between gap-4 px-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{brand.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {brand.country ?? "—"} · {brand.sku ?? "—"}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-full border border-border px-2 py-0.5 text-xs font-medium text-muted-foreground">
                    {brand.status}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </main>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
        <Icon className="size-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-bold">{value}</div>
      </CardContent>
    </Card>
  );
}
