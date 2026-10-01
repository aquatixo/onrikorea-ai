"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { isSafeText } from "@/lib/security/sanitize-input";
import { getLocale } from "@/lib/i18n/get-locale";
import { getDictionary } from "@/lib/i18n/dictionary";

// Matches the literal used in work/page.tsx and work/category-actions.ts -- "기타" is a
// sentinel assignee value for uncategorized work items, never a real Person row, so it
// can't be claimed as a person's name here (that would make the two indistinguishable).
const ETC_ASSIGNEE = "기타";

async function requireAdmin() {
  const session = await auth();
  return session?.user?.role === "ADMIN" ? session : null;
}

// Takes a registered User's id, not a free-typed name -- a 담당자 must be someone who
// already has a login account, so the only "name" this ever writes is one copied
// straight off that User row (see AddPersonForm, which only offers a <select> of
// existing users, never a text box).
export async function createPerson(userId: string): Promise<{ success: true } | { error: string }> {
  const t = getDictionary(await getLocale()).settings.people;
  const session = await requireAdmin();
  if (!session) return { error: getDictionary(await getLocale()).settings.notSignedIn };

  const user = await db.user.findUnique({ where: { id: userId }, select: { name: true } });
  if (!user) return { error: t.userNotFound };

  const trimmed = user.name.trim();
  if (!trimmed) return { error: t.nameRequired };
  if (trimmed === ETC_ASSIGNEE) return { error: t.reservedName };
  if (!isSafeText(trimmed)) return { error: t.unsafeContent };

  try {
    await db.person.create({ data: { name: trimmed } });
  } catch {
    return { error: t.personExists };
  }

  revalidatePath("/settings/work-assignees");
  revalidatePath("/work");
  revalidatePath("/work/new");
  return { success: true };
}

export async function renamePerson(id: string, name: string): Promise<{ success: true } | { error: string }> {
  const t = getDictionary(await getLocale()).settings.people;
  const session = await requireAdmin();
  if (!session) return { error: getDictionary(await getLocale()).settings.notSignedIn };

  const trimmed = name.trim();
  if (!trimmed) return { error: t.nameRequired };
  if (trimmed === ETC_ASSIGNEE) return { error: t.reservedName };
  if (!isSafeText(trimmed)) return { error: t.unsafeContent };

  const existing = await db.person.findUnique({ where: { id } });
  if (!existing) return { error: t.notFound };

  try {
    // assigneeName on WorkItem is a plain string, not a foreign key (see the Person
    // model's schema comment), so renaming a person only stays consistent with their
    // existing work items if every matching WorkItem row is updated in the same
    // transaction -- otherwise those items would silently keep showing the old name.
    await db.$transaction([
      db.person.update({ where: { id }, data: { name: trimmed } }),
      db.workItem.updateMany({ where: { assigneeName: existing.name }, data: { assigneeName: trimmed } }),
    ]);
  } catch {
    return { error: t.personExists };
  }

  revalidatePath("/settings/work-assignees");
  revalidatePath("/work");
  revalidatePath("/work/new");
  return { success: true };
}

export async function deletePerson(id: string): Promise<{ error?: string }> {
  const t = getDictionary(await getLocale()).settings.people;
  const session = await requireAdmin();
  if (!session) return { error: getDictionary(await getLocale()).settings.notSignedIn };

  const existing = await db.person.findUnique({ where: { id } });
  if (!existing) return {};

  const assignedCount = await db.workItem.count({ where: { assigneeName: existing.name } });
  if (assignedCount > 0) return { error: t.cannotDeleteHasWork };

  await db.person.delete({ where: { id } });
  revalidatePath("/settings/work-assignees");
  revalidatePath("/work");
  revalidatePath("/work/new");
  return {};
}
