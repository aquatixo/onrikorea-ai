import { BrandMark } from "@/components/brand-mark";
import { ThemeToggle } from "@/components/theme-toggle";
import { LanguageToggle } from "@/components/language-toggle";
import { LoginForm } from "@/components/login-form";
import { getLocale } from "@/lib/i18n/get-locale";
import { getDictionary } from "@/lib/i18n/dictionary";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>;
}) {
  const locale = await getLocale();
  const t = getDictionary(locale).login;
  const { callbackUrl } = await searchParams;

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-4 py-10">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 opacity-[0.15] blur-3xl"
        style={{
          backgroundImage:
            "radial-gradient(40% 35% at 20% 20%, #E0457B 0%, transparent 100%)," +
            "radial-gradient(40% 35% at 80% 15%, #F7931E 0%, transparent 100%)," +
            "radial-gradient(45% 40% at 85% 85%, #3B9FE0 0%, transparent 100%)," +
            "radial-gradient(35% 35% at 15% 85%, #8DC63F 0%, transparent 100%)",
        }}
      />

      <div className="absolute top-4 right-4 flex items-center gap-1">
        <LanguageToggle locale={locale} />
        <ThemeToggle />
      </div>

      <div className="w-full max-w-sm space-y-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <BrandMark size={36} />
          <div className="space-y-1">
            <h1 className="text-xl font-bold tracking-tight">{t.title}</h1>
            <p className="text-sm text-muted-foreground">{t.subtitle}</p>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-7">
          <LoginForm locale={locale} callbackUrl={callbackUrl ?? "/"} />
        </div>

        <p className="text-center text-xs text-muted-foreground">{t.footer}</p>
      </div>
    </main>
  );
}
