import { z } from "zod";
import { StoreType, StoreVisitProductCategory } from "@prisma/client";
import { isSafeText, UNSAFE_INPUT_MESSAGE } from "@/lib/security/sanitize-input";

const optionalSafeText = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v && v.length > 0 ? v : undefined))
  .refine((v) => v === undefined || isSafeText(v), UNSAFE_INPUT_MESSAGE);

export const storeFormSchema = z.object({
  name: z.string().trim().min(1, "Name is required").refine(isSafeText, UNSAFE_INPUT_MESSAGE),
  chain: optionalSafeText,
  storeType: z.nativeEnum(StoreType),
  address: optionalSafeText,
  city: optionalSafeText,
});
export type StoreFormValues = z.infer<typeof storeFormSchema>;

const requiredDate = z
  .string()
  .trim()
  .min(1, "Visit date is required")
  .transform((v) => new Date(v))
  .refine((v) => !Number.isNaN(v.getTime()), "Invalid date");

export const storeVisitFormSchema = z.object({
  storeId: z.string().trim().min(1, "Store is required"),
  visitDate: requiredDate,
  visitor: z.string().trim().min(1, "Visitor is required").refine(isSafeText, UNSAFE_INPUT_MESSAGE),
  memo: optionalSafeText,
});
export type StoreVisitFormValues = z.infer<typeof storeVisitFormSchema>;

const optionalNonNegativeInt = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v && v.length > 0 ? Number.parseInt(v, 10) : undefined))
  .refine((v) => v === undefined || (Number.isFinite(v) && v >= 0), "Must not be negative");

// A product entry belongs to exactly one visit -- brand/category/barcode/image and
// price/promo/stock/display are all filled in together, in one form, at once.
export const productFormSchema = z.object({
  brandName: optionalSafeText,
  productName: z.string().trim().min(1, "Product name is required").refine(isSafeText, UNSAFE_INPUT_MESSAGE),
  category: z.nativeEnum(StoreVisitProductCategory),
  subcategory: optionalSafeText,
  barcode: optionalSafeText,
  countryOfOrigin: optionalSafeText,
  manufacturer: optionalSafeText,
  packageSize: optionalSafeText,
  price: optionalNonNegativeInt,
  promotion: optionalSafeText,
  stockStatus: optionalSafeText,
  displayLocation: optionalSafeText,
  facingCount: optionalNonNegativeInt,
  memo: optionalSafeText,
});
export type ProductFormValues = z.infer<typeof productFormSchema>;
