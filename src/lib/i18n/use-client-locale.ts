"use client";

import * as React from "react";
import type { Locale } from "@/lib/i18n/dictionary";
import { LOCALE_COOKIE } from "@/lib/i18n/locale-cookie";

const noSubscribe = () => () => {};

function readLocale(): Locale {
  const match = document.cookie.match(new RegExp(`(?:^|; )${LOCALE_COOKIE}=([^;]*)`));
  return match?.[1] === "en" ? "en" : "ko";
}

/** The language for a client component that isn't handed `locale` by its page (shared
 * dialogs, error boundaries). Read from the language cookie in the browser; the server
 * pass falls back to Korean. */
export function useClientLocale(): Locale {
  return React.useSyncExternalStore(noSubscribe, readLocale, () => "ko" as Locale);
}
