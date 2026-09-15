import { NextRequest } from "next/server";
import * as XLSX from "xlsx";
import { db } from "@/lib/db";
import { getLocale } from "@/lib/i18n/get-locale";
import { getDictionary } from "@/lib/i18n/dictionary";
import type { Prisma } from "@prisma/client";

const PAGE_SIZE = 20;

export async function GET(request: NextRequest) {
  const t = getDictionary(await getLocale());
  const { searchParams } = new URL(request.url);
  const scope = searchParams.get("scope") === "page" ? "page" : "all";
  const q = (searchParams.get("q") ?? "").trim();
  const page = Number.parseInt(searchParams.get("page") ?? "1", 10) || 1;

  const where: Prisma.BrandWhereInput = q
    ? {
        OR: [
          { name: { contains: q, mode: "insensitive" } },
          { country: { contains: q, mode: "insensitive" } },
          { sku: { contains: q, mode: "insensitive" } },
        ],
      }
    : {};

  const brands = await db.brand.findMany({
    where,
    orderBy: { sourceNo: "asc" },
    ...(scope === "page" ? { skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE } : {}),
  });

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

  const sheet = XLSX.utils.aoa_to_sheet([[...t.exportHeaders], ...rows]);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, "Brands");
  const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

  const filename = scope === "page" ? `brands-page-${page}.xlsx` : "brands-all.xlsx";

  return new Response(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
