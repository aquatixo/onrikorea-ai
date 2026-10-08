"use server";

import { auth, signOut } from "@/auth";
import { db } from "@/lib/db";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { changePasswordSchema } from "@/lib/validation/settings";
import { getLocale } from "@/lib/i18n/get-locale";
import { getDictionary } from "@/lib/i18n/dictionary";

export type ChangePasswordState = {
  errors?: Partial<Record<string, string[]>>;
  message?: string;
  success?: boolean;
};

export async function changePassword(
  prevState: ChangePasswordState,
  formData: FormData
): Promise<ChangePasswordState> {
  const t = getDictionary(await getLocale()).settings;

  const session = await auth();
  if (!session?.user?.id) {
    return { message: t.notSignedIn };
  }

  const parsed = changePasswordSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors;
    const localized: Partial<Record<string, string[]>> = {};
    for (const [field, messages] of Object.entries(fieldErrors)) {
      if (!messages || messages.length === 0) continue;
      if (field === "currentPassword") localized[field] = [t.currentPasswordRequired];
      if (field === "newPassword") localized[field] = [t.passwordTooShort];
      if (field === "confirmPassword") localized[field] = [t.passwordMismatch];
    }
    return { errors: localized, message: t.fixErrors };
  }

  const user = await db.user.findUnique({ where: { id: session.user.id } });
  if (!user) {
    return { message: t.notSignedIn };
  }

  const valid = await verifyPassword(parsed.data.currentPassword, user.passwordHash);
  if (!valid) {
    return { errors: { currentPassword: [t.currentPasswordWrong] }, message: t.fixErrors };
  }

  const newPasswordHash = await hashPassword(parsed.data.newPassword);
  await db.user.update({ where: { id: user.id }, data: { passwordHash: newPasswordHash } });

  // The session's auth stamp includes the password hash (lib/auth/auth-stamp.ts), so this
  // session is now invalid. Sign out here with a message that says why, instead of letting
  // the next click land on the generic "your account was changed" notice.
  await signOut({ redirectTo: "/login?passwordChanged=1" });
  return { success: true, message: t.passwordChanged };
}
