import * as XLSX from "xlsx";
import type { Brand } from "@prisma/client";

/** Same column layout as the original spreadsheet -- shared by the manual export route and the SharePoint sync push. */
export function buildBrandsWorkbook(brands: Brand[], headers: readonly string[]) {
  const rows = brands.map((b) => [
    b.sourceNo ?? "",
    b.methodology ?? "",
    b.name,
    b.country ?? "",
    b.sku ?? "",
    b.foundedYear ?? "",
    b.website ?? "",
    b.contactPoint ?? "",
    b.coldEmail ? "O" : "",
    b.reply ? "O" : "",
  ]);

  const sheet = XLSX.utils.aoa_to_sheet([[...headers], ...rows]);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, "Brands");
  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
}
