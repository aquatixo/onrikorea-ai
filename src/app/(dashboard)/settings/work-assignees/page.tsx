import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { db } from "@/lib/db";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AddPersonForm } from "@/components/settings/add-person-form";
import { PersonRow } from "@/components/settings/person-row";
import { getLocale } from "@/lib/i18n/get-locale";
import { getDictionary } from "@/lib/i18n/dictionary";
import { isRealTeamUser } from "@/lib/dev-test-accounts";

export const dynamic = "force-dynamic";

export default async function PeoplePage() {
  const locale = await getLocale();
  const t = getDictionary(locale);
  const tp = t.settings.people;

  const [people, counts, users] = await Promise.all([
    db.person.findMany({ orderBy: { createdAt: "asc" } }),
    db.workItem.groupBy({ by: ["assigneeName"], _count: { _all: true } }),
    db.user.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, username: true } }),
  ]);
  const countByName = new Map(counts.map((c) => [c.assigneeName, c._count._all]));
  // Only registered, non-dev-test users not already on the roster can be added -- a
  // 담당자 must map to an existing login account (see createPerson), offering one
  // already added would just reproduce the "already exists" error after a wasted
  // click, and admin/user are seed accounts for local dev, never real teammates.
  const personNames = new Set(people.map((p) => p.name));
  const availableUsers = users.filter((u) => !personNames.has(u.name) && isRealTeamUser(u.username));

  return (
    <main className="mx-auto w-full max-w-4xl space-y-6 px-6 py-10 sm:px-8 sm:py-12">
      <Link href="/settings" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> {t.settings.back}
      </Link>
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{tp.title}</h1>
        <p className="text-sm text-muted-foreground">{tp.subtitle}</p>
      </div>

      <AddPersonForm locale={locale} availableUsers={availableUsers} />

      <div className="overflow-hidden rounded-2xl bg-card shadow-sm ring-1 ring-foreground/10">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>{tp.colName}</TableHead>
                <TableHead>{tp.colAssignedCount}</TableHead>
                <TableHead>{tp.colAction}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {people.map((p) => (
                <PersonRow
                  key={p.id}
                  id={p.id}
                  name={p.name}
                  assignedCount={countByName.get(p.name) ?? 0}
                  locale={locale}
                />
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </main>
  );
}
