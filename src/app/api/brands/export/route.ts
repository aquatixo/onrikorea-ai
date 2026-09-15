import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getLocale } from "@/lib/i18n/get-locale";
import { getDictionary } from "@/lib/i18n/dictionary";
import { buildBrandsWorkbook } from "@/lib/brand-export/build-workbook";
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

  const buffer = buildBrandsWorkbook(brands, t.exportHeaders);
  const filename = scope === "page" ? `brands-page-${page}.xlsx` : "brands-all.xlsx";

  return new Response(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
