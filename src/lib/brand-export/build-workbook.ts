import * as XLSX from "xlsx";
import type { Brand } from "@prisma/client";

/** coldEmail is tri-state (null = not decided yet) -- blank until someone answers,
 * then "O"/"X", matching the original spreadsheet's markers. */
function triStateMark(v: boolean | null): string {
  if (v === null) return "";
  return v ? "O" : "X";
}

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
    triStateMark(b.coldEmail),
    b.reply ? "O" : "X",
  ]);

  const sheet = XLSX.utils.aoa_to_sheet([[...headers], ...rows]);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, "Brands");
  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
}
