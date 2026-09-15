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
  Settings,
  Menu,
  X,
} from "lucide-react";
import { cn } from "cn";
import { ThemeToggle } from "@/components/theme-toggle";

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

const NAV_GROUPS: NavGroup[] = [
  {
    label: "Overview",
    items: [{ href: "/", label: "Dashboard", icon: LayoutDashboard }],
  },
  {
    label: "Sourcing",
    items: [
      { href: "/brands", label: "Brands", icon: Building2 },
      { href: "/brands/sourcing", label: "Brand Sourcing", icon: Search, soon: true },
    ],
  },
  {
    label: "Planning",
    items: [
      { href: "/schedules", label: "Schedules", icon: CalendarClock, soon: true },
      { href: "/reports", label: "Weekly Report", icon: ClipboardList, soon: true },
    ],
  },
  {
    label: "Admin",
    items: [{ href: "/settings", label: "Settings", icon: Settings, soon: true }],
  },
];

export function AppSidebar() {
  const pathname = usePathname();
  const [open, setOpen] = React.useState(false);

  return (
    <>
      <div className="flex h-14 items-center justify-between border-b border-border px-4 sm:hidden">
        <Link href="/" className="flex items-center gap-2">
          <div className="flex size-7 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">
            O
          </div>
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
            <div className="flex size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sm font-bold text-sidebar-primary-foreground">
              O
            </div>
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
          {NAV_GROUPS.map((group) => (
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
                          Soon
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="flex items-center justify-between border-t border-sidebar-border px-4 py-3">
          <span className="text-xs text-sidebar-foreground/50">Theme</span>
          <ThemeToggle />
        </div>
      </aside>
    </>
  );
}
