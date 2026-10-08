import Link from "next/link";
import { StatusScreen } from "@/components/status-screen";
import { buttonVariants } from "@/components/ui/button";
import { getLocale } from "@/lib/i18n/get-locale";
import { getDictionary } from "@/lib/i18n/dictionary";

export async function NotFoundScreen() {
  const t = getDictionary(await getLocale()).common;
  return (
    <StatusScreen code="404" title={t.pageNotFoundTitle} body={t.pageNotFoundBody}>
      <Link href="/" className={buttonVariants()}>
        {t.goHome}
      </Link>
    </StatusScreen>
  );
}
