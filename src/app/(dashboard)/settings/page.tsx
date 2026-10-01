import Link from "next/link";
import { Settings, KeyRound, Users, UserCog } from "lucide-react";
import { auth } from "@/auth";
import { getLocale } from "@/lib/i18n/get-locale";
import { getDictionary } from "@/lib/i18n/dictionary";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const locale = await getLocale();
  const t = getDictionary(locale).settings;
  const session = await auth();
  const isAdmin = session?.user?.role === "ADMIN";

  const cards = [
    { href: "/settings/password", label: t.changePasswordCard, desc: t.changePasswordCardDesc, icon: KeyRound },
    ...(isAdmin
      ? [
          { href: "/settings/users", label: t.userManagementCard, desc: t.userManagementCardDesc, icon: Users },
          { href: "/settings/work-assignees", label: t.peopleManagementCard, desc: t.peopleManagementCardDesc, icon: UserCog },
        ]
      : []),
  ];

  return (
    <main className="mx-auto w-full max-w-4xl space-y-6 px-6 py-10 sm:px-8 sm:py-12">
      <div className="flex items-center gap-3">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10">
          <Settings className="size-5 text-primary" />
        </span>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t.title}</h1>
          <p className="text-sm text-muted-foreground">{t.subtitle}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <Link
              key={card.href}
              href={card.href}
              className="flex flex-col items-start gap-3 rounded-2xl border border-border bg-card p-5 text-left shadow-sm transition-colors hover:bg-muted/50"
            >
              <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
                <Icon className="size-5 text-primary" />
              </span>
              <div>
                <p className="text-sm font-semibold">{card.label}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{card.desc}</p>
              </div>
            </Link>
          );
        })}
      </div>
    </main>
  );
}
