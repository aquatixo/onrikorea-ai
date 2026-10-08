"use client";

import * as React from "react";
import Link from "next/link";
import { StatusScreen } from "@/components/status-screen";
import { Button, buttonVariants } from "@/components/ui/button";
import { getDictionary, type Locale } from "@/lib/i18n/dictionary";
import { LOCALE_COOKIE } from "@/lib/i18n/locale-cookie";

const noSubscribe = () => () => {};

function readLocale(): Locale {
  const match = document.cookie.match(new RegExp(`(?:^|; )${LOCALE_COOKIE}=([^;]*)`));
  return match?.[1] === "en" ? "en" : "ko";
}

// Any unexpected error while rendering a dashboard page. Sits inside the dashboard layout,
// so the sidebar stays usable. The real error is in the server/browser logs (digest links
// the two); the user only sees a plain message and a retry.
export default function DashboardError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  // Read the language cookie in the browser only (the server pass falls back to Korean).
  const locale = React.useSyncExternalStore(noSubscribe, readLocale, () => "ko" as Locale);
  React.useEffect(() => {
    console.error(error);
  }, [error]);
  const t = getDictionary(locale).common;

  return (
    <StatusScreen title={t.errorTitle} body={t.errorBody} code={error.digest ? `#${error.digest}` : undefined}>
      <Button onClick={() => retry()}>{t.retry}</Button>
      <Link href="/" className={buttonVariants({ variant: "outline" })}>
        {t.goHome}
      </Link>
    </StatusScreen>
  );
}
