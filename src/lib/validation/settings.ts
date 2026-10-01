import { z } from "zod";
import { isSafeText, UNSAFE_INPUT_MESSAGE } from "@/lib/security/sanitize-input";
import { PAGE_SECTIONS } from "@/lib/access-control";

// At least 8 characters, one letter, one digit, one special character.
const PASSWORD_COMPLEXITY = /^(?=.*[A-Za-z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;

// No isSafeText check here -- unlike every other form in this app, a password is never
// rendered back out anywhere (only hashed), so the script/formula-injection guard
// doesn't apply.
export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Current password is required"),
    newPassword: z.string().regex(PASSWORD_COMPLEXITY, "Password does not meet requirements"),
    confirmPassword: z.string().min(1, "Please confirm the new password"),
  })
  .refine((v) => v.newPassword === v.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export type ChangePasswordValues = z.infer<typeof changePasswordSchema>;

const allowedPagesField = z.array(z.enum(PAGE_SECTIONS)).default([]);

export const createUserSchema = z.object({
  username: z.string().trim().min(1, "Username is required").max(150).refine(isSafeText, UNSAFE_INPUT_MESSAGE),
  name: z.string().trim().min(1, "Name is required").refine(isSafeText, UNSAFE_INPUT_MESSAGE),
  role: z.enum(["ADMIN", "DEVELOPER", "USER"]),
  allowedPages: allowedPagesField,
});

export type CreateUserValues = z.infer<typeof createUserSchema>;

export const updateUserSchema = z.object({
  name: z.string().trim().min(1, "Name is required").refine(isSafeText, UNSAFE_INPUT_MESSAGE),
  role: z.enum(["ADMIN", "DEVELOPER", "USER"]),
  allowedPages: allowedPagesField,
  resetPassword: z.coerce.boolean().optional().default(false),
});

export type UpdateUserValues = z.infer<typeof updateUserSchema>;
