import Link from "next/link";
import { ArrowLeft, Plus, Pencil } from "lucide-react";
import { db } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ClickableRow } from "@/components/field/clickable-row";
import { StopPropagation } from "@/components/field/stop-propagation";
import { DeleteUserButton } from "@/components/settings/delete-user-button";
import { PAGE_SECTIONS } from "@/lib/access-control";
import { getLocale } from "@/lib/i18n/get-locale";
import { getDictionary } from "@/lib/i18n/dictionary";

export const dynamic = "force-dynamic";

export default async function UsersPage() {
  const locale = await getLocale();
  const t = getDictionary(locale);
  const tu = t.settings.users;
  const users = await db.user.findMany({ orderBy: { createdAt: "asc" } });

  return (
    <main className="mx-auto w-full max-w-4xl space-y-6 px-6 py-10 sm:px-8 sm:py-12">
      <Link href="/settings" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> {t.settings.back}
      </Link>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{tu.title}</h1>
          <p className="text-sm text-muted-foreground">{tu.subtitle}</p>
        </div>
        <Button
          nativeButton={false}
          render={
            <Link href="/settings/users/new">
              <Plus className="size-4" /> {tu.addUser}
            </Link>
          }
        />
      </div>

      <div className="overflow-hidden rounded-2xl bg-card shadow-sm ring-1 ring-foreground/10">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>{tu.colUsername}</TableHead>
                <TableHead>{tu.colName}</TableHead>
                <TableHead>{tu.colRole}</TableHead>
                <TableHead>{tu.colPages}</TableHead>
                <TableHead>{tu.colAction}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((u) => (
                <ClickableRow key={u.id} href={`/settings/users/${u.id}/edit`}>
                  <TableCell className="font-medium">{u.username}</TableCell>
                  <TableCell className="text-muted-foreground">{u.name}</TableCell>
                  <TableCell>
                    <Badge variant={u.role === "ADMIN" ? "default" : "secondary"}>
                      {u.role === "ADMIN" ? tu.roleAdmin : tu.roleUser}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {u.role === "ADMIN"
                      ? tu.allPages
                      : u.allowedPages.length === 0
                        ? tu.noPages
                        : u.allowedPages.length === PAGE_SECTIONS.length
                          ? tu.allPages
                          : `${u.allowedPages.length}/${PAGE_SECTIONS.length}`}
                  </TableCell>
                  <TableCell>
                    <StopPropagation>
                      <div className="flex items-center gap-1.5">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          nativeButton={false}
                          render={<Link href={`/settings/users/${u.id}/edit`}><Pencil className="size-4" /></Link>}
                        />
                        <DeleteUserButton userId={u.id} locale={locale} />
                      </div>
                    </StopPropagation>
                  </TableCell>
                </ClickableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </main>
  );
}
