import { z } from "zod";
import { isSafeText, UNSAFE_INPUT_MESSAGE } from "@/lib/security/sanitize-input";

const optionalSafeText = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v && v.length > 0 ? v : undefined))
  .refine((v) => v === undefined || isSafeText(v), UNSAFE_INPUT_MESSAGE);

export const workFormSchema = z.object({
  title: z.string().trim().min(1, "Title is required").refine(isSafeText, UNSAFE_INPUT_MESSAGE),
  assigneeName: z.string().trim().min(1, "Assignee is required").refine(isSafeText, UNSAFE_INPUT_MESSAGE),
  content: optionalSafeText,
});

export type WorkFormValues = z.infer<typeof workFormSchema>;

export const workCommentSchema = z.object({
  authorName: z.string().trim().min(1, "Name is required").refine(isSafeText, UNSAFE_INPUT_MESSAGE),
  body: z.string().trim().min(1, "Comment is required").refine(isSafeText, UNSAFE_INPUT_MESSAGE),
  parentId: z.string().trim().optional(),
});
