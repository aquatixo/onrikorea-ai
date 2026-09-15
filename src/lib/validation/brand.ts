import { z } from "zod";
import { BrandStatus } from "@prisma/client";

const optionalText = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v && v.length > 0 ? v : undefined));

export const brandFormSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
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
  coldEmail: z.coerce.boolean().optional().default(false),
  reply: z.coerce.boolean().optional().default(false),
  status: z.nativeEnum(BrandStatus),
  notes: optionalText,
});

export type BrandFormValues = z.infer<typeof brandFormSchema>;
