import type { ReactNode } from "react";
import { AppSidebar } from "@/components/app-sidebar";
import { auth } from "@/auth";
import { getLocale } from "@/lib/i18n/get-locale";
import { getUserName } from "@/lib/user/get-user-name";

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const locale = await getLocale();
  const userName = await getUserName();
  const session = await auth();

  return (
    <>
      <AppSidebar
        locale={locale}
        userName={userName}
        role={session?.user?.role ?? "USER"}
        allowedPages={session?.user?.allowedPages ?? []}
      />
      <div className="min-h-screen sm:pl-64">{children}</div>
    </>
  );
}
