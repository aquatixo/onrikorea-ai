import { NextRequest } from "next/server";
import * as XLSX from "xlsx";
import { db } from "@/lib/db";
import { getLocale } from "@/lib/i18n/get-locale";
import { getDictionary } from "@/lib/i18n/dictionary";
import { requireSectionAccess } from "@/lib/auth/require-section-access";
import { APP_TIME_ZONE } from "@/lib/format-date";
import type { Prisma, SourcingCandidate } from "@prisma/client";

// Same order as the table on screen: deleted ones most recently deleted first.
function orderFor(hidden: boolean): Prisma.SourcingCandidateOrderByWithRelationInput[] {
  return hidden ? [{ hiddenAt: "desc" }, { id: "asc" }] : [{ createdAt: "asc" }, { id: "asc" }];
}

async function xlsxResponse(candidates: SourcingCandidate[], hidden: boolean, filename: string) {
  const t = getDictionary(await getLocale());

  // Same column layout as the main Brands export (No/Methodology/Name/.../Cold Email/Reply)
  // so a downloaded sourcing sheet looks and works like the one everyone already knows --
  // Contact Point/Cold Email/Reply are always blank here, since none of that exists until
  // a candidate is actually added to Brands. Verdict/Notes are appended for review context,
  // and for deleted candidates the day they were deleted.
  const headers: string[] = [...t.exportHeaders, t.sourcing.colVerdict, t.sourcing.colReason];
  if (hidden) headers.push(t.sourcing.colHiddenAt);

  const rows = candidates.map((c, i) => [
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
    // Korea date as YYYY-MM-DD (en-CA formats dates that way).
    ...(hidden && c.hiddenAt ? [c.hiddenAt.toLocaleDateString("en-CA", { timeZone: APP_TIME_ZONE })] : []),
  ]);

  const sheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, hidden ? "Deleted Candidates" : "Sourcing Candidates");
  const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

  return new Response(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}

/** "전체 다운로드". ?hidden=1 exports the deleted candidates (/brands/sourcing/hidden)
 * instead, so what the team threw out can be used outside the app too. */
export async function GET(request: NextRequest) {
  const denied = await requireSectionAccess("brandSourcing");
  if (denied) return denied;

  const hidden = request.nextUrl.searchParams.get("hidden") === "1";
  // Every pending SourcingCandidate (across every run, not just the latest one) --
  // matches what the review table on screen shows, now that daily runs accumulate
  // candidates over several days instead of one run replacing the last.
  const candidates = await db.sourcingCandidate.findMany({
    where: { hiddenAt: hidden ? { not: null } : null },
    orderBy: orderFor(hidden),
  });
  return xlsxResponse(candidates, hidden, hidden ? "brand-sourcing-deleted.xlsx" : "brand-sourcing-candidates.xlsx");
}

// Far more than either list holds -- just a guard against an absurd request body.
const MAX_SELECTED = 5000;

/** "선택 다운로드": the ticked candidates, posted as form fields named "ids" (too many for a
 * URL), plus hidden=1 from the deleted list. Same columns and order as "전체 다운로드". */
export async function POST(request: NextRequest) {
  const denied = await requireSectionAccess("brandSourcing");
  if (denied) return denied;

  const form = await request.formData();
  const hidden = form.get("hidden") === "1";
  const ids = form
    .getAll("ids")
    .filter((v): v is string => typeof v === "string" && v.length > 0)
    .slice(0, MAX_SELECTED);

  const candidates = ids.length
    ? await db.sourcingCandidate.findMany({
        where: { id: { in: ids }, hiddenAt: hidden ? { not: null } : null },
        orderBy: orderFor(hidden),
      })
    : [];
  return xlsxResponse(
    candidates,
    hidden,
    hidden ? "brand-sourcing-deleted-selected.xlsx" : "brand-sourcing-candidates-selected.xlsx"
  );
}
