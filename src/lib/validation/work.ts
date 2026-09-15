import { z } from "zod";
import { isSafeText, UNSAFE_INPUT_MESSAGE } from "@/lib/security/sanitize-input";

const optionalSafeText = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v && v.length > 0 ? v : undefined))
  .refine((v) => v === undefined || isSafeText(v), UNSAFE_INPUT_MESSAGE);

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

const optionalColor = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v && v.length > 0 ? v : undefined))
  .refine((v) => v === undefined || HEX_COLOR.test(v), "Invalid color");

const optionalDate = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v && v.length > 0 ? new Date(v) : undefined))
  .refine((v) => v === undefined || !Number.isNaN(v.getTime()), "Invalid date");

const dateRangeRefinement = (v: { startDate?: Date; endDate?: Date }) =>
  !v.startDate || !v.endDate || v.startDate <= v.endDate;
const dateRangeIssue = { message: "End date must be on or after the start date", path: ["endDate"] };

export const workFormSchema = z
  .object({
    title: z.string().trim().min(1, "Title is required").refine(isSafeText, UNSAFE_INPUT_MESSAGE),
    assigneeName: z.string().trim().min(1, "Assignee is required").refine(isSafeText, UNSAFE_INPUT_MESSAGE),
    category: optionalSafeText,
    content: optionalSafeText,
    color: optionalColor,
    startDate: optionalDate,
    endDate: optionalDate,
  })
  .refine(dateRangeRefinement, dateRangeIssue);

export type WorkFormValues = z.infer<typeof workFormSchema>;

/** Same fields as create -- the Edit page mirrors Add Work exactly, plus an explicit file-removal flag. */
export const workEditSchema = z
  .object({
    title: z.string().trim().min(1, "Title is required").refine(isSafeText, UNSAFE_INPUT_MESSAGE),
    assigneeName: z.string().trim().min(1, "Assignee is required").refine(isSafeText, UNSAFE_INPUT_MESSAGE),
    category: optionalSafeText,
    content: optionalSafeText,
    color: optionalColor,
    startDate: optionalDate,
    endDate: optionalDate,
    removeFile: z.coerce.boolean().optional().default(false),
  })
  .refine(dateRangeRefinement, dateRangeIssue);

export type WorkEditValues = z.infer<typeof workEditSchema>;

export const workCommentSchema = z.object({
  authorName: z.string().trim().min(1, "Name is required").refine(isSafeText, UNSAFE_INPUT_MESSAGE),
  body: z.string().trim().min(1, "Comment is required").refine(isSafeText, UNSAFE_INPUT_MESSAGE),
  parentId: z.string().trim().optional(),
});
