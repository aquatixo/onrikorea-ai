"use client";

import * as React from "react";
import Link from "next/link";
import { StatusScreen } from "@/components/status-screen";
import { Button, buttonVariants } from "@/components/ui/button";
import { getDictionary } from "@/lib/i18n/dictionary";
import { useClientLocale } from "@/lib/i18n/use-client-locale";

// Any unexpected error while rendering a dashboard page. Sits inside the dashboard layout,
// so the sidebar stays usable. The real error is in the server/browser logs (digest links
// the two); the user only sees a plain message and a retry.
export default function DashboardError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  const locale = useClientLocale();
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
