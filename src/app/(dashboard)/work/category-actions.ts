"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getLocale } from "@/lib/i18n/get-locale";
import { getDictionary } from "@/lib/i18n/dictionary";

const ETC_ASSIGNEE = "기타";

// Drag-and-drop in the sidebar moves a whole category (and every work item in it) from
// one assignee to another -- this is a bulk assigneeName update, not a new data model.
export async function reassignCategory(
  fromAssignee: string,
  category: string,
  toAssignee: string
): Promise<{ success: true } | { error: string }> {
  const t = getDictionary(await getLocale()).work.form;

  if (!fromAssignee || !category || !toAssignee || fromAssignee === toAssignee) {
    return { error: t.reassignFailed };
  }

  // Never trust the drop target's name as-is -- only allow a real Person or the "기타" bucket.
  const isValidTarget =
    toAssignee === ETC_ASSIGNEE || (await db.person.findUnique({ where: { name: toAssignee } })) !== null;
  if (!isValidTarget) return { error: t.reassignFailed };

  await db.workItem.updateMany({
    where: { assigneeName: fromAssignee, category },
    data: { assigneeName: toAssignee },
  });

  revalidatePath("/work");
  return { success: true };
}
