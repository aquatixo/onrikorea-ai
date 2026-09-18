"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Building2,
  Search,
  CalendarClock,
  ClipboardList,
  ListTodo,
  Settings,
  Menu,
  X,
  MapPin,
  Store,
  Package,
} from "lucide-react";
import { cn } from "cn";
import { BrandMark } from "@/components/brand-mark";
import { ThemeToggle } from "@/components/theme-toggle";
import { LanguageToggle } from "@/components/language-toggle";
import { UserAvatar } from "@/components/user-avatar";
import { getDictionary, type Locale } from "@/lib/i18n/dictionary";

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  soon?: boolean;
};

type NavGroup = {
  label: string;
  items: NavItem[];
};

export function AppSidebar({ locale, userName }: { locale: Locale; userName: string }) {
  const t = getDictionary(locale);
  const pathname = usePathname();
  const [open, setOpen] = React.useState(false);

  const navGroups: NavGroup[] = [
    {
      label: t.nav.overview,
      items: [{ href: "/", label: t.nav.dashboard, icon: LayoutDashboard }],
    },
    {
      label: t.nav.sourcing,
      items: [
        { href: "/brands", label: t.nav.brands, icon: Building2 },
        { href: "/brands/sourcing", label: t.nav.brandSourcing, icon: Search },
      ],
    },
    {
      label: t.nav.planning,
      items: [
        { href: "/work", label: t.nav.work, icon: ListTodo },
        { href: "/schedules", label: t.nav.schedules, icon: CalendarClock, soon: true },
        { href: "/reports", label: t.nav.weeklyReport, icon: ClipboardList, soon: true },
      ],
    },
    {
      label: t.nav.field,
      items: [
        { href: "/field/stores", label: t.nav.stores, icon: Store },
        { href: "/field/store-visits", label: t.nav.storeVisits, icon: MapPin },
        { href: "/field/products", label: t.nav.products, icon: Package },
      ],
    },
    {
      label: t.nav.admin,
      items: [{ href: "/settings", label: t.nav.settings, icon: Settings, soon: true }],
    },
  ];

  return (
    <>
      <div className="flex h-14 items-center justify-between border-b border-border px-4 sm:hidden">
        <Link href="/" className="flex items-center gap-2">
          <BrandMark size={20} />
          <span className="text-sm font-bold tracking-tight">onrikorea.ai</span>
        </Link>
        <button
          onClick={() => setOpen(true)}
          aria-label="Open menu"
          className="rounded-md p-2 text-muted-foreground hover:bg-accent"
        >
          <Menu className="size-5" />
        </button>
      </div>

      {open && (
        <div className="fixed inset-0 z-40 bg-black/40 sm:hidden" onClick={() => setOpen(false)} />
      )}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex h-screen w-64 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-transform duration-200 sm:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex h-16 items-center justify-between px-4">
          <Link href="/" className="flex items-center gap-2">
            <BrandMark size={24} />
            <span className="text-base font-bold tracking-tight">
              onrikorea<span className="text-sidebar-foreground/50">.ai</span>
            </span>
          </Link>
          <button
            onClick={() => setOpen(false)}
            aria-label="Close menu"
            className="rounded-md p-1.5 hover:bg-sidebar-accent sm:hidden"
          >
            <X className="size-4" />
          </button>
        </div>

        <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-2">
          {navGroups.map((group) => (
            <div key={group.label}>
              <p className="px-3 pb-1.5 text-xs font-semibold tracking-wider text-sidebar-foreground/50 uppercase">
                {group.label}
              </p>
              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const isActive = pathname === item.href;
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.soon ? "#" : item.href}
                      aria-disabled={item.soon}
                      onClick={(e) => {
                        if (item.soon) e.preventDefault();
                        else setOpen(false);
                      }}
                      className={cn(
                        "flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                        isActive
                          ? "bg-sidebar-primary text-sidebar-primary-foreground"
                          : item.soon
                            ? "cursor-default text-sidebar-foreground/40"
                            : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                      )}
                    >
                      <span className="flex items-center gap-2">
                        <Icon className="size-4" />
                        {item.label}
                      </span>
                      {item.soon && (
                        <span className="rounded-full border border-sidebar-border px-1.5 py-0.5 text-[10px] font-medium text-sidebar-foreground/50">
                          {t.nav.soon}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="border-t border-sidebar-border p-3">
          <div className="mb-2 flex items-center gap-2.5 rounded-lg bg-sidebar-accent/60 px-2.5 py-2">
            <UserAvatar name={userName} size="sm" />
            <div className="min-w-0">
              <p className="truncate text-xs font-semibold text-sidebar-foreground">{userName}</p>
              <p className="text-[10px] text-sidebar-foreground/50">{t.nav.yourName}</p>
            </div>
          </div>
          <div className="space-y-1 px-1">
            <div className="flex items-center justify-between">
              <span className="text-xs text-sidebar-foreground/50">{t.nav.theme}</span>
              <ThemeToggle />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-sidebar-foreground/50">{t.nav.language}</span>
              <LanguageToggle locale={locale} />
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
