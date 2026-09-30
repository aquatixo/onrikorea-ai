import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getLocale } from "@/lib/i18n/get-locale";
import { getDictionary } from "@/lib/i18n/dictionary";
import { buildBrandsWorkbook } from "@/lib/brand-export/build-workbook";
import { parsePageSize } from "@/lib/pagination";
import { requireSectionAccess } from "@/lib/auth/require-section-access";
import type { Prisma } from "@prisma/client";

export async function GET(request: NextRequest) {
  const denied = await requireSectionAccess("brands");
  if (denied) return denied;

  const t = getDictionary(await getLocale());
  const { searchParams } = new URL(request.url);
  const scope = searchParams.get("scope") === "page" ? "page" : "all";
  const q = (searchParams.get("q") ?? "").trim();
  const page = Number.parseInt(searchParams.get("page") ?? "1", 10) || 1;
  // Must match the page size the browser's own list view is currently showing --
  // this used to be a hardcoded 20 regardless of what the visible page actually used,
  // so "download current page" silently returned an empty file whenever the viewer
  // had picked any other page size (e.g. skip=(150-1)*20=2980 against a 1498-row table).
  const pageSize = parsePageSize(searchParams.get("pageSize") ?? undefined);

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
    ...(scope === "page" ? { skip: (page - 1) * pageSize, take: pageSize } : {}),
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
