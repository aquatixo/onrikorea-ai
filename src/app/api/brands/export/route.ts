import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getLocale } from "@/lib/i18n/get-locale";
import { getDictionary } from "@/lib/i18n/dictionary";
import { buildBrandsWorkbook } from "@/lib/brand-export/build-workbook";
import { parsePage, parsePageSize } from "@/lib/pagination";
import { requireSectionAccess } from "@/lib/auth/require-section-access";
import type { Brand, Prisma } from "@prisma/client";

function xlsxResponse(brands: Brand[], headers: readonly string[], filename: string) {
  return new Response(buildBrandsWorkbook(brands, headers), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}

export async function GET(request: NextRequest) {
  const denied = await requireSectionAccess("brands");
  if (denied) return denied;

  const t = getDictionary(await getLocale());
  const { searchParams } = new URL(request.url);
  const scope = searchParams.get("scope") === "page" ? "page" : "all";
  const q = (searchParams.get("q") ?? "").trim();
  // Same parsing as the list page, so a hand-edited ?page= can't turn into a huge offset.
  const page = parsePage(searchParams.get("page") ?? undefined);
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

  return xlsxResponse(brands, t.exportHeaders, scope === "page" ? `brands-page-${page}.xlsx` : "brands-all.xlsx");
}

// More than the whole table today (1,581) -- just a guard against an absurd request body.
const MAX_SELECTED = 5000;

/** "선택 다운로드": the brands ticked in the list (possibly across several pages), posted
 * as form fields named "ids" -- too many for a URL. Same columns and order as the other
 * downloads. */
export async function POST(request: NextRequest) {
  const denied = await requireSectionAccess("brands");
  if (denied) return denied;
  // Only our own page posts here: a cross-site form could otherwise make a signed-in
  // user's browser download a file (it couldn't read it, but there's no reason to allow it).
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) {
    return new Response("Forbidden", { status: 403 });
  }

  const form = await request.formData();
  const ids = [...new Set(form.getAll("ids").filter((v): v is string => typeof v === "string" && v.length > 0))].slice(
    0,
    MAX_SELECTED
  );
  const t = getDictionary(await getLocale());
  const brands = ids.length
    ? await db.brand.findMany({ where: { id: { in: ids } }, orderBy: { sourceNo: "asc" } })
    : [];
  return xlsxResponse(brands, t.exportHeaders, "brands-selected.xlsx");
}
