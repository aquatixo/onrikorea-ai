import type { StoreVisitStatus, StoreVisitProductCategory, StoreType, StoreVisitPhotoType } from "@prisma/client";

export const STORE_VISIT_STATUS_STYLE: Record<StoreVisitStatus, string> = {
  DRAFT: "bg-muted text-muted-foreground",
  IN_PROGRESS: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  COMPLETED: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
};

export const STORE_VISIT_STATUS_VALUES: StoreVisitStatus[] = ["DRAFT", "IN_PROGRESS", "COMPLETED"];

export const PRODUCT_CATEGORY_VALUES: StoreVisitProductCategory[] = [
  "SNACK", "CHOCOLATE", "BISCUIT", "COOKIE", "CANDY", "JELLY", "NUTS", "FOOD", "BEVERAGE", "OTHER",
];

export const STORE_TYPE_VALUES: StoreType[] = [
  "DEPARTMENT_STORE", "HYPERMARKET", "CONVENIENCE_STORE", "WAREHOUSE", "DRUGSTORE", "OTHER",
];

export const PHOTO_TYPE_VALUES: StoreVisitPhotoType[] = [
  "PRODUCT", "PRICE_TAG", "DISPLAY", "PROMOTION", "STORE", "OTHER",
];
