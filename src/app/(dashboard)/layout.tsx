import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { AppSidebar } from "@/components/app-sidebar";
import { auth } from "@/auth";
import { getLocale } from "@/lib/i18n/get-locale";
import { getUserName } from "@/lib/user/get-user-name";

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const locale = await getLocale();
  const userName = await getUserName();
  const session = await auth();
  // proxy.ts already sent requests without a session cookie to /login, so no session here
  // means the cookie's session was invalidated (permissions/password changed by an admin).
  if (!session?.user) redirect("/login/expired");

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
