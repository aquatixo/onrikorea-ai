"use server";

import { redirect } from "next/navigation";
import { auth, signOut } from "@/auth";
import { db } from "@/lib/db";
import { hashPassword } from "@/lib/auth/password";
import { createUserSchema, updateUserSchema } from "@/lib/validation/settings";
import { UNSAFE_INPUT_MESSAGE } from "@/lib/security/sanitize-input";
import { getLocale } from "@/lib/i18n/get-locale";
import { getDictionary } from "@/lib/i18n/dictionary";

export type UserFormState = {
  errors?: Partial<Record<string, string[]>>;
  message?: string;
};

// Defense in depth -- proxy.ts already blocks non-admins from reaching /settings/users,
// but these Server Actions are callable directly, so they check for themselves too.
async function requireAdmin() {
  const session = await auth();
  return session?.user?.role === "ADMIN" ? session : null;
}

function localizeErrors(
  fieldErrors: Partial<Record<string, string[]>>,
  t: ReturnType<typeof getDictionary>["settings"]
): Partial<Record<string, string[]>> {
  const localized: Partial<Record<string, string[]>> = {};
  for (const [field, messages] of Object.entries(fieldErrors)) {
    if (!messages || messages.length === 0) continue;
    if (messages.includes(UNSAFE_INPUT_MESSAGE)) {
      localized[field] = [t.unsafeContent];
      continue;
    }
    if (field === "username") localized[field] = [t.users.usernameRequired];
    if (field === "name") localized[field] = [t.users.nameRequired];
    if (field === "role") localized[field] = [t.users.roleFieldError];
    if (field === "allowedPages") localized[field] = [t.users.pagesFieldError];
  }
  return localized;
}

async function defaultPasswordHash(): Promise<string> {
  const defaultPassword = process.env.DEFAULT_RESET_PASSWORD;
  if (!defaultPassword) throw new Error("DEFAULT_RESET_PASSWORD is not configured.");
  return hashPassword(defaultPassword);
}

export async function createUser(prevState: UserFormState, formData: FormData): Promise<UserFormState> {
  const t = getDictionary(await getLocale()).settings;
  const session = await requireAdmin();
  if (!session) return { message: t.notSignedIn };

  const raw = { ...Object.fromEntries(formData), allowedPages: formData.getAll("allowedPages") };
  const parsed = createUserSchema.safeParse(raw);
  if (!parsed.success) {
    return { errors: localizeErrors(parsed.error.flatten().fieldErrors, t), message: t.fixErrors };
  }

  const existing = await db.user.findUnique({ where: { username: parsed.data.username } });
  if (existing) {
    return { errors: { username: [t.users.usernameTaken] }, message: t.fixErrors };
  }

  const passwordHash = await defaultPasswordHash();
  await db.user.create({
    data: {
      username: parsed.data.username,
      name: parsed.data.name,
      passwordHash,
      role: parsed.data.role,
      allowedPages: parsed.data.role === "ADMIN" || parsed.data.role === "DEVELOPER" ? [] : parsed.data.allowedPages,
    },
  });
  redirect("/settings/users");
}

export async function updateUser(
  id: string,
  prevState: UserFormState,
  formData: FormData
): Promise<UserFormState> {
  const t = getDictionary(await getLocale()).settings;
  const session = await requireAdmin();
  if (!session) return { message: t.notSignedIn };

  const raw = { ...Object.fromEntries(formData), allowedPages: formData.getAll("allowedPages") };
  const parsed = updateUserSchema.safeParse(raw);
  if (!parsed.success) {
    return { errors: localizeErrors(parsed.error.flatten().fieldErrors, t), message: t.fixErrors };
  }

  const target = await db.user.findUnique({ where: { id }, select: { role: true, allowedPages: true } });
  if (!target) return { message: t.users.notFound };

  if (target.role === "ADMIN" && parsed.data.role !== "ADMIN") {
    const adminCount = await db.user.count({ where: { role: "ADMIN" } });
    if (adminCount <= 1) return { message: t.users.lastAdmin };
  }

  const allowedPages = parsed.data.role === "ADMIN" || parsed.data.role === "DEVELOPER" ? [] : parsed.data.allowedPages;
  await db.user.update({
    where: { id },
    data: {
      name: parsed.data.name,
      role: parsed.data.role,
      allowedPages,
      ...(parsed.data.resetPassword ? { passwordHash: await defaultPasswordHash() } : {}),
    },
  });

  // Editing your OWN role/pages/password invalidates your own session (auth-stamp.ts) --
  // go to the login page now rather than failing on the next click.
  const samePages = [...target.allowedPages].sort().join(",") === [...allowedPages].sort().join(",");
  if (session.user.id === id && (target.role !== parsed.data.role || !samePages || parsed.data.resetPassword)) {
    await signOut({ redirectTo: "/login?expired=1" });
  }
  redirect("/settings/users");
}

export async function deleteUser(id: string): Promise<{ error?: string }> {
  const t = getDictionary(await getLocale()).settings;
  const session = await requireAdmin();
  if (!session) return { error: t.notSignedIn };

  if (session.user.id === id) {
    return { error: t.users.cannotDeleteSelf };
  }

  const target = await db.user.findUnique({ where: { id }, select: { role: true } });
  if (!target) return {};

  if (target.role === "ADMIN") {
    const adminCount = await db.user.count({ where: { role: "ADMIN" } });
    if (adminCount <= 1) return { error: t.users.lastAdmin };
  }

  await db.user.delete({ where: { id } });
  redirect("/settings/users");
}
