import { cookies } from "next/headers";
import type { Locale } from "@/lib/i18n/dictionary";
import { LOCALE_COOKIE } from "@/lib/i18n/locale-cookie";

export async function getLocale(): Promise<Locale> {
  const store = await cookies();
  const value = store.get(LOCALE_COOKIE)?.value;
  return value === "en" ? "en" : "ko";
}
