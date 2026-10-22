"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { LOCALE_COOKIE } from "@/lib/i18n/locale-cookie";
import { getDictionary, type Locale } from "@/lib/i18n/dictionary";

export function LanguageToggle({ locale }: { locale: Locale }) {
  const router = useRouter();
  const next: Locale = locale === "en" ? "ko" : "en";

  function handleClick() {
    document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=${60 * 60 * 24 * 365}`;
    router.refresh();
  }

  return (
    <Button variant="ghost" size="sm" onClick={handleClick} aria-label={getDictionary(locale).common.changeLanguage}>
      {locale === "en" ? "ENG" : "KOR"}
    </Button>
  );
}
