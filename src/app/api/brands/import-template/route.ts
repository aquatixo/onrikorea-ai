import * as XLSX from "xlsx";
import { getLocale } from "@/lib/i18n/get-locale";
import { getDictionary } from "@/lib/i18n/dictionary";
import { requireSectionAccess } from "@/lib/auth/require-section-access";

export async function GET() {
  const denied = await requireSectionAccess("brands");
  if (denied) return denied;

  const t = getDictionary(await getLocale());

  const sheet = XLSX.utils.aoa_to_sheet([[...t.exportHeaders]]);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, "Brands");
  const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

  return new Response(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="brands-import-template.xlsx"`,
    },
  });
}
