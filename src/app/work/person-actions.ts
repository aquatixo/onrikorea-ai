"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { isSafeText } from "@/lib/security/sanitize-input";
import { getLocale } from "@/lib/i18n/get-locale";
import { getDictionary } from "@/lib/i18n/dictionary";

// No auth/roles yet -- anyone can call this. TODO: gate behind an admin role once
// login exists (see AddPersonForm, and the "Admin" placeholder in get-user-name.ts).
export async function createPerson(name: string): Promise<{ success: true } | { error: string }> {
  const t = getDictionary(await getLocale()).work.form;

  const trimmed = name.trim();
  if (!trimmed) return { error: t.assigneeRequired };
  if (!isSafeText(trimmed)) return { error: t.unsafeContent };

  try {
    await db.person.create({ data: { name: trimmed } });
  } catch {
    return { error: t.personExists };
  }

  revalidatePath("/work");
  revalidatePath("/work/new");
  return { success: true };
}
