import { z } from "zod";
import { BrandStatus } from "@prisma/client";
import { isSafeText, UNSAFE_INPUT_MESSAGE } from "@/lib/security/sanitize-input";

const optionalText = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v && v.length > 0 ? v : undefined))
  .refine((v) => v === undefined || isSafeText(v), UNSAFE_INPUT_MESSAGE);

export const brandFormSchema = z.object({
  name: z.string().trim().min(1, "Name is required").refine(isSafeText, UNSAFE_INPUT_MESSAGE),
  methodology: optionalText,
  channel: optionalText,
  country: optionalText,
  sku: optionalText,
  foundedYear: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v && v.length > 0 ? Number.parseInt(v, 10) : undefined))
    .refine((v) => v === undefined || Number.isFinite(v), "Founded year must be a number"),
  website: optionalText,
  contactPoint: optionalText,
  // Tri-state: no answer yet (null) until someone explicitly picks yes/no -- unlike
  // `reply`, which only ever becomes true after a real event (a reply arriving), so
  // "not yet" and "no" are the same thing for it and it stays a plain boolean.
  coldEmail: z
    .string()
    .optional()
    .transform((v) => (v === "true" ? true : v === "false" ? false : null)),
  reply: z.coerce.boolean().optional().default(false),
  status: z.nativeEnum(BrandStatus),
  notes: optionalText,
});

export type BrandFormValues = z.infer<typeof brandFormSchema>;

const nullableSafeText = (maxLength: number) =>
  z
    .string()
    .trim()
    .max(maxLength)
    .nullish()
    .transform((v) => (v && v.length > 0 ? v : null))
    .refine((v) => v === null || isSafeText(v), UNSAFE_INPUT_MESSAGE);

// Validates the JSON body of /api/brands/evaluate-candidate -- the one route in this
// app that takes raw request.json() input instead of a FormData-backed Server Action,
// so it needs its own explicit schema rather than inheriting one from a <form>.
export const candidateEvaluationSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(200).refine(isSafeText, UNSAFE_INPUT_MESSAGE),
  country: nullableSafeText(100),
  sku: nullableSafeText(100),
  foundedYear: z.union([z.string().max(20), z.number()]).nullish(),
  website: nullableSafeText(500),
  methodology: nullableSafeText(200),
  channel: nullableSafeText(200),
  contactPoint: nullableSafeText(300),
});

export type CandidateEvaluationInput = z.infer<typeof candidateEvaluationSchema>;
