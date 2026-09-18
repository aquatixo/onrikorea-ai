import type { ReactNode } from "react";
import { AppSidebar } from "@/components/app-sidebar";
import { getLocale } from "@/lib/i18n/get-locale";
import { getUserName } from "@/lib/user/get-user-name";

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const locale = await getLocale();
  const userName = await getUserName();

  return (
    <>
      <AppSidebar locale={locale} userName={userName} />
      <div className="min-h-screen sm:pl-64">{children}</div>
    </>
  );
}
