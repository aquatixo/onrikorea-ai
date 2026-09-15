import { NextRequest } from "next/server";
import * as XLSX from "xlsx";
import { db } from "@/lib/db";
import { getLocale } from "@/lib/i18n/get-locale";

export async function GET(request: NextRequest) {
  const locale = await getLocale();
  const { searchParams } = new URL(request.url);
  const runId = searchParams.get("runId");

  const run = runId
    ? await db.sourcingRun.findUnique({ where: { id: runId }, include: { candidates: true } })
    : await db.sourcingRun.findFirst({ orderBy: { createdAt: "desc" }, include: { candidates: true } });

  const headers =
    locale === "ko"
      ? ["이름", "국가", "카테고리", "설립연도", "웹사이트", "판정", "메모"]
      : ["Name", "Country", "Category", "Founded", "Website", "Verdict", "Notes"];

  const rows = (run?.candidates ?? []).map((c) => [
    c.name,
    c.country ?? "",
    c.sku ?? "",
    c.foundedYear ?? "",
    c.website ?? "",
    c.verdict,
    c.reason,
  ]);

  const sheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, "Sourcing Candidates");
  const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

  return new Response(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="brand-sourcing-candidates.xlsx"`,
    },
  });
}
