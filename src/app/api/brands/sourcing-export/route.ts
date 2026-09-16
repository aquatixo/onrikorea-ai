import { NextRequest } from "next/server";
import * as XLSX from "xlsx";
import { db } from "@/lib/db";
import { getLocale } from "@/lib/i18n/get-locale";
import { getDictionary } from "@/lib/i18n/dictionary";

export async function GET(request: NextRequest) {
  const locale = await getLocale();
  const t = getDictionary(locale);
  const { searchParams } = new URL(request.url);
  const runId = searchParams.get("runId");

  const run = runId
    ? await db.sourcingRun.findUnique({ where: { id: runId }, include: { candidates: true } })
    : await db.sourcingRun.findFirst({ orderBy: { createdAt: "desc" }, include: { candidates: true } });

  // Same column layout as the main Brands export (No/Methodology/Name/.../Cold Email/Reply)
  // so a downloaded sourcing sheet looks and works like the one everyone already knows --
  // Contact Point/Cold Email/Reply are always blank here, since none of that exists until
  // a candidate is actually added to Brands. Verdict/Notes are appended for review context.
  const headers = [...t.exportHeaders, t.sourcing.colVerdict, t.sourcing.colReason];

  const rows = (run?.candidates ?? []).map((c, i) => [
    i + 1,
    c.methodology ?? "",
    c.name,
    c.country ?? "",
    c.sku ?? "",
    c.foundedYear ?? "",
    c.website ?? "",
    "",
    "",
    "",
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
