import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  Building2,
  Mail,
  Sparkles,
  ListTodo,
  Search,
  CalendarClock,
  ClipboardList,
  MapPin,
  Store,
  Package,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/user-avatar";
import { db } from "@/lib/db";
import { STATUS_STYLE } from "@/lib/brand-status";
import { WORK_STATUS_STYLE } from "@/lib/work-status";
import { getLocale } from "@/lib/i18n/get-locale";
import { getDictionary } from "@/lib/i18n/dictionary";
import { cn } from "cn";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const locale = await getLocale();
  const t = getDictionary(locale);

  const [brandCount, contactedCount, openWorkCount, inProgressCount, recentBrands, recentWork] = await Promise.all([
    db.brand.count(),
    db.brand.count({ where: { status: { in: ["CONTACTED", "REPLIED"] } } }),
    db.workItem.count({ where: { status: { not: "DONE" } } }),
    db.workItem.count({ where: { status: "IN_PROGRESS" } }),
    db.brand.findMany({ orderBy: { updatedAt: "desc" }, take: 5 }),
    db.workItem.findMany({ orderBy: { updatedAt: "desc" }, take: 5 }),
  ]);

  const modules = [
    { href: "/brands", label: t.nav.brands, icon: Building2, soon: false },
    { href: "/brands/sourcing", label: t.nav.brandSourcing, icon: Search, soon: false },
    { href: "/work", label: t.nav.work, icon: ListTodo, soon: false },
    { href: "/field/stores", label: t.nav.stores, icon: Store, soon: false },
    { href: "/field/store-visits", label: t.nav.storeVisits, icon: MapPin, soon: false },
    { href: "/field/products", label: t.nav.products, icon: Package, soon: false },
    { href: "/schedules", label: t.nav.schedules, icon: CalendarClock, soon: true },
    { href: "/reports", label: t.nav.weeklyReport, icon: ClipboardList, soon: true },
  ];

  return (
    <main className="mx-auto w-full max-w-6xl space-y-10 px-6 py-10 sm:px-8 sm:py-12">
      <section className="relative overflow-hidden rounded-3xl border border-border bg-card p-8 sm:p-12">
        <div
          aria-hidden
          className="pointer-events-none absolute -top-24 -right-24 size-72 rounded-full bg-primary/10 blur-3xl"
        />
        <div className="relative max-w-2xl space-y-5">
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-3 py-1 text-xs font-medium text-muted-foreground">
            <Sparkles className="size-3.5" /> {t.home.badge}
          </div>
          <h1 className="text-3xl leading-tight font-extrabold tracking-tight sm:text-5xl">
            {t.home.titleLine1}
            <br className="hidden sm:block" /> {t.home.titleLine2}
          </h1>
          <p className="max-w-lg text-base leading-relaxed text-muted-foreground sm:text-lg">
            {t.home.description}
          </p>
          <div className="flex flex-wrap gap-3 pt-1">
            <Button
              nativeButton={false}
              render={
                <Link href="/brands">
                  {t.home.viewBrands} <ArrowRight className="size-4" />
                </Link>
              }
            />
            <Button
              variant="outline"
              nativeButton={false}
              render={
                <Link href="/work">
                  {t.home.viewWork} <ArrowRight className="size-4" />
                </Link>
              }
            />
          </div>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label={t.home.brandsTracked} value={brandCount} icon={Building2} />
        <StatCard label={t.home.contacted} value={contactedCount} icon={Mail} />
        <StatCard label={t.home.openWork} value={openWorkCount} icon={ListTodo} />
        <StatCard label={t.home.inProgress} value={inProgressCount} icon={Sparkles} />
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground">{t.home.quickAccess}</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
          {modules.map((m) => {
            const Icon = m.icon;
            const content = (
              <>
                <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
                  <Icon className="size-5 text-primary" />
                </span>
                <span className="text-xs font-medium">{m.label}</span>
                {m.soon && (
                  <span className="rounded-full border border-border px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                    {t.nav.soon}
                  </span>
                )}
              </>
            );
            const className = cn(
              "flex flex-col items-center gap-2 rounded-2xl border border-border bg-card px-3 py-5 text-center shadow-sm transition-colors",
              m.soon ? "cursor-default opacity-50" : "hover:bg-muted/50"
            );
            return m.soon ? (
              <div key={m.href} aria-disabled className={className}>
                {content}
              </div>
            ) : (
              <Link key={m.href} href={m.href} className={className}>
                {content}
              </Link>
            );
          })}
        </div>
      </section>

      <section className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-muted-foreground">{t.home.recentlyUpdated}</h2>
            <Link
              href="/brands"
              className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
            >
              {t.home.viewAll} <ArrowUpRight className="size-3.5" />
            </Link>
          </div>
          <div className="overflow-hidden rounded-xl bg-card shadow-sm ring-1 ring-foreground/10">
            {recentBrands.length === 0 ? (
              <p className="p-6 text-center text-sm text-muted-foreground">{t.home.noBrandsYet}</p>
            ) : (
              <ul className="divide-y divide-border">
                {recentBrands.map((brand) => (
                  <li key={brand.id}>
                    <Link
                      href={`/brands/${brand.id}`}
                      className="flex items-center justify-between gap-4 px-4 py-3.5 transition-colors hover:bg-muted/50"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <span
                          className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground"
                          aria-hidden
                        >
                          <Building2 className="size-4" />
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{brand.name}</p>
                          <p className="truncate text-xs text-muted-foreground">
                            {brand.country ?? "—"} · {brand.sku ?? "—"}
                          </p>
                        </div>
                      </div>
                      <Badge className={cn(STATUS_STYLE[brand.status], "shrink-0")}>{t.status[brand.status]}</Badge>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-muted-foreground">{t.home.recentWork}</h2>
            <Link
              href="/work"
              className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
            >
              {t.home.viewAll} <ArrowUpRight className="size-3.5" />
            </Link>
          </div>
          <div className="overflow-hidden rounded-xl bg-card shadow-sm ring-1 ring-foreground/10">
            {recentWork.length === 0 ? (
              <p className="p-6 text-center text-sm text-muted-foreground">{t.home.noWorkYet}</p>
            ) : (
              <ul className="divide-y divide-border">
                {recentWork.map((item) => (
                  <li key={item.id}>
                    <Link
                      href={`/work/${item.id}`}
                      style={{ borderLeftColor: item.color || "transparent" }}
                      className="flex items-center gap-3 border-l-4 px-4 py-3.5 transition-colors hover:bg-muted/50"
                    >
                      <UserAvatar name={item.assigneeName} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{item.title}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {item.assigneeName}
                          {item.category ? ` · ${item.category}` : ""}
                        </p>
                      </div>
                      <Badge className={cn(WORK_STATUS_STYLE[item.status], "shrink-0")}>
                        {t.work.status[item.status]}
                      </Badge>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
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
    <Card size="sm">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-xs font-medium text-muted-foreground sm:text-sm">{label}</CardTitle>
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
          <Icon className="size-4 text-primary" />
        </span>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold sm:text-3xl">{value}</div>
      </CardContent>
    </Card>
  );
}
