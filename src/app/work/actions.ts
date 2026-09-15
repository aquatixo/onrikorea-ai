"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { workFormSchema, workEditSchema, workCommentSchema } from "@/lib/validation/work";
import { UNSAFE_INPUT_MESSAGE } from "@/lib/security/sanitize-input";
import { uploadWorkAttachment, deleteWorkAttachment } from "@/lib/blob";
import { getLocale } from "@/lib/i18n/get-locale";
import { getDictionary } from "@/lib/i18n/dictionary";
import { getUserName } from "@/lib/user/get-user-name";
import type { WorkStatus } from "@prisma/client";

export type WorkFormState = {
  errors?: Partial<Record<string, string[]>>;
  message?: string;
};

function localizeFieldErrors(
  fieldErrors: Partial<Record<string, string[]>>,
  t: ReturnType<typeof getDictionary>["work"]["form"]
): Partial<Record<string, string[]>> {
  const localized: Partial<Record<string, string[]>> = {};
  for (const [field, messages] of Object.entries(fieldErrors)) {
    if (!messages || messages.length === 0) continue;
    if (messages.includes(UNSAFE_INPUT_MESSAGE)) {
      localized[field] = [t.unsafeContent];
      continue;
    }
    if (field === "title") localized[field] = [t.titleRequired];
    if (field === "assigneeName") localized[field] = [t.assigneeRequired];
  }
  return localized;
}

function realFile(formData: FormData, key: string): File | null {
  const value = formData.get(key);
  return value instanceof File && value.size > 0 ? value : null;
}

export async function createWork(prevState: WorkFormState, formData: FormData): Promise<WorkFormState> {
  const t = getDictionary(await getLocale()).work.form;

  const parsed = workFormSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { errors: localizeFieldErrors(parsed.error.flatten().fieldErrors, t), message: t.fixErrors };
  }

  const file = realFile(formData, "file");
  let fileUrl: string | undefined;
  let fileName: string | undefined;
  if (file) {
    try {
      const uploaded = await uploadWorkAttachment(file);
      fileUrl = uploaded.url;
      fileName = uploaded.fileName;
    } catch {
      return { message: t.fileUploadFailed };
    }
  }

  const work = await db.workItem.create({ data: { ...parsed.data, fileUrl, fileName } });
  redirect(`/work/${work.id}`);
}

export async function updateWork(id: string, prevState: WorkFormState, formData: FormData): Promise<WorkFormState> {
  const t = getDictionary(await getLocale()).work.form;

  const parsed = workEditSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { errors: localizeFieldErrors(parsed.error.flatten().fieldErrors, t), message: t.fixErrors };
  }

  const existing = await db.workItem.findUnique({ where: { id }, select: { fileUrl: true } });
  if (!existing) return { message: t.fixErrors };

  const file = realFile(formData, "file");
  let fileUrl: string | null | undefined;
  let fileName: string | null | undefined;

  if (file) {
    try {
      const uploaded = await uploadWorkAttachment(file);
      fileUrl = uploaded.url;
      fileName = uploaded.fileName;
      if (existing.fileUrl) await deleteWorkAttachment(existing.fileUrl);
    } catch {
      return { message: t.fileUploadFailed };
    }
  } else if (parsed.data.removeFile && existing.fileUrl) {
    await deleteWorkAttachment(existing.fileUrl);
    fileUrl = null;
    fileName = null;
  }

  await db.workItem.update({
    where: { id },
    data: {
      title: parsed.data.title,
      assigneeName: parsed.data.assigneeName,
      category: parsed.data.category ?? null,
      color: parsed.data.color ?? null,
      content: parsed.data.content ?? null,
      startDate: parsed.data.startDate ?? null,
      endDate: parsed.data.endDate ?? null,
      ...(fileUrl !== undefined ? { fileUrl, fileName } : {}),
    },
  });

  redirect(`/work/${id}`);
}

export async function updateWorkStatus(id: string, status: WorkStatus): Promise<{ error?: string }> {
  try {
    await db.workItem.update({ where: { id }, data: { status } });
  } catch {
    return { error: "Failed to update status." };
  }
  revalidatePath(`/work/${id}`);
  revalidatePath("/work");
  return {};
}

export async function addWorkComment(input: {
  workItemId: string;
  body: string;
  parentId?: string;
}): Promise<{ success: true } | { error: string }> {
  const t = getDictionary(await getLocale()).work.detail;

  // Author always comes from the server-side name cookie, never from the client call --
  // so posting a comment always reflects whoever actually set their name in the sidebar,
  // not whatever a tampered request claims.
  const authorName = await getUserName();
  if (!authorName) return { error: t.nameRequired };

  const parsed = workCommentSchema.safeParse({ ...input, authorName });
  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors;
    if (fieldErrors.body) return { error: t.bodyRequired };
    return { error: t.bodyRequired };
  }

  await db.workComment.create({
    data: {
      workItemId: input.workItemId,
      authorName: parsed.data.authorName,
      body: parsed.data.body,
      parentId: parsed.data.parentId,
    },
  });

  revalidatePath(`/work/${input.workItemId}`);
  return { success: true };
}
