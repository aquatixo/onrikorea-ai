/**
 * One-time migration: reads the "전체 리스트" sheet from the legacy
 * 비서실 todo_241014.xlsx brand-sourcing tracker and upserts it into
 * Postgres via Prisma.
 *
 * Usage:
 *   npx tsx scripts/import-legacy-brands.ts "C:\path\to\비서실 todo_241014.xlsx"
 *
 * Safe to re-run: brands are upserted by `sourceNo` (the legacy 'no' column),
 * so running this twice won't create duplicate brands. Contacts are upserted
 * by (brandId, email). Outreach logs are only created if an equivalent one
 * (same brandId + type) doesn't already exist, so re-runs won't duplicate
 * history either — but this script is still meant to run ONCE per legacy
 * file; it's not the path for adding new brands going forward (that'll be a
 * proper Server Action with the name+domain duplicate check).
 */
import * as XLSX from "xlsx";
import { PrismaClient, Prisma, BrandStatus, OutreachType, OutreachStatus } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import "dotenv/config";

const SHEET_NAME = "전체 리스트";

const COLUMN_INDEX = {
  no: 0,
  methodology: 1,
  channel: 2,
  name: 3,
  country: 4,
  sku: 5,
  foundedYear: 6,
  website: 7,
  contactPoint: 8,
  coldEmail: 9,
  reply: 10,
} as const;

function cleanString(v: unknown): string | undefined {
  const s = (v ?? "").toString().trim();
  return s.length > 0 ? s : undefined;
}

function cleanInt(v: unknown): number | undefined {
  const n = Number.parseInt((v ?? "").toString().trim(), 10);
  return Number.isFinite(n) ? n : undefined;
}

function isTruthyFlag(v: unknown): boolean {
  const s = (v ?? "").toString().trim().toLowerCase();
  return s === "o" || s === "true" || s === "1" || s === "yes";
}

function extractDomain(website: string | undefined): string | undefined {
  if (!website) return undefined;
  try {
    const url = new URL(website.startsWith("http") ? website : `https://${website}`);
    return url.hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return undefined;
  }
}

async function main() {
  const filePath = process.argv[2];
  if (!filePath) {
    console.error("Usage: npx tsx scripts/import-legacy-brands.ts <path-to-xlsx>");
    process.exit(1);
  }

  console.log(`Reading ${filePath} ...`);
  const workbook = XLSX.readFile(filePath);
  const sheet = workbook.Sheets[SHEET_NAME];
  if (!sheet) {
    console.error(`Sheet "${SHEET_NAME}" not found. Sheets in file: ${workbook.SheetNames.join(", ")}`);
    process.exit(1);
  }

  const rows: unknown[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true });
  const dataRows = rows.slice(1).filter((row) => cleanString(row[COLUMN_INDEX.no]) !== undefined);
  console.log(`Found ${dataRows.length} data rows.`);

  const adapter = new PrismaPg(process.env.DATABASE_URL!);
  const db = new PrismaClient({ adapter });

  let created = 0;
  let updated = 0;
  const skippedDuplicates: { sourceNo: number; name: string }[] = [];
  const skippedDuplicateNo: { sourceNo: number; name: string; keptName: string }[] = [];
  const seenSourceNo = new Map<number, string>(); // sourceNo -> name of the row we kept

  for (const row of dataRows) {
    const sourceNo = cleanInt(row[COLUMN_INDEX.no]);
    const name = cleanString(row[COLUMN_INDEX.name]);
    if (sourceNo === undefined || name === undefined) continue; // skip malformed rows

    // The source sheet's 'no' column is supposed to be unique per row. If it isn't, upserting by
    // sourceNo would silently overwrite one brand's fields with another's while leaving the first
    // row's Contact/OutreachLog records orphaned on that brand. Keep only the first occurrence.
    const alreadySeenName = seenSourceNo.get(sourceNo);
    if (alreadySeenName !== undefined) {
      skippedDuplicateNo.push({ sourceNo, name, keptName: alreadySeenName });
      continue;
    }
    seenSourceNo.set(sourceNo, name);

    const website = cleanString(row[COLUMN_INDEX.website]);
    const coldEmailSent = isTruthyFlag(row[COLUMN_INDEX.coldEmail]);
    const replied = isTruthyFlag(row[COLUMN_INDEX.reply]);

    const status: BrandStatus = replied ? "REPLIED" : coldEmailSent ? "CONTACTED" : "NEW";

    const contactPoint = cleanString(row[COLUMN_INDEX.contactPoint]);
    const contactEmail = contactPoint?.includes("@") ? contactPoint : undefined;
    // If the "contact point" wasn't an email (often a contact-page URL instead), keep it as a note
    // rather than silently dropping it.
    const notes = contactPoint && !contactEmail ? `Contact page: ${contactPoint}` : undefined;

    const existing = await db.brand.findUnique({ where: { sourceNo } });

    let brand;
    try {
      brand = await db.brand.upsert({
        where: { sourceNo },
        update: {
          methodology: cleanString(row[COLUMN_INDEX.methodology]),
          channel: cleanString(row[COLUMN_INDEX.channel]),
          name,
          website,
          websiteDomain: extractDomain(website),
          country: cleanString(row[COLUMN_INDEX.country]),
          sku: cleanString(row[COLUMN_INDEX.sku]),
          foundedYear: cleanInt(row[COLUMN_INDEX.foundedYear]),
          contactPoint,
          coldEmail: coldEmailSent,
          reply: replied,
          status,
          notes,
        },
        create: {
          sourceNo,
          methodology: cleanString(row[COLUMN_INDEX.methodology]),
          channel: cleanString(row[COLUMN_INDEX.channel]),
          name,
          website,
          websiteDomain: extractDomain(website),
          country: cleanString(row[COLUMN_INDEX.country]),
          sku: cleanString(row[COLUMN_INDEX.sku]),
          foundedYear: cleanInt(row[COLUMN_INDEX.foundedYear]),
          contactPoint,
          coldEmail: coldEmailSent,
          reply: replied,
          status,
          notes,
        },
      });
    } catch (e) {
      // P2002 = unique constraint violation. This specific table only has two unique
      // constraints (sourceNo, which the upsert's `where` already targets safely, and
      // name+websiteDomain) — so a P2002 here means this row is a genuine duplicate of
      // a DIFFERENT brand already in the table (same name+domain, different sourceNo).
      // Skip it and keep going rather than aborting the whole migration.
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
        skippedDuplicates.push({ sourceNo, name });
        continue;
      }
      throw e;
    }

    existing ? updated++ : created++;

    if (contactEmail) {
      await db.contact.upsert({
        where: { brandId_email: { brandId: brand.id, email: contactEmail } },
        update: {},
        create: { brandId: brand.id, email: contactEmail, isPrimary: true },
      });
    }

    if (coldEmailSent) {
      const already = await db.outreachLog.findFirst({
        where: { brandId: brand.id, type: OutreachType.COLD_EMAIL_SENT },
      });
      if (!already) {
        await db.outreachLog.create({
          data: { brandId: brand.id, type: OutreachType.COLD_EMAIL_SENT, status: OutreachStatus.SENT },
        });
      }
    }

    if (replied) {
      const already = await db.outreachLog.findFirst({
        where: { brandId: brand.id, type: OutreachType.REPLY_RECEIVED },
      });
      if (!already) {
        await db.outreachLog.create({
          data: { brandId: brand.id, type: OutreachType.REPLY_RECEIVED, status: OutreachStatus.SENT },
        });
      }
    }

    if ((created + updated) % 200 === 0) {
      console.log(`... ${created + updated}/${dataRows.length}`);
    }
  }

  console.log(
    `Done. Created: ${created}, Updated: ${updated}, Skipped name+domain duplicates: ${skippedDuplicates.length}, Skipped duplicate 'no' rows: ${skippedDuplicateNo.length}`
  );
  if (skippedDuplicates.length > 0) {
    console.log("Skipped rows (same name+website domain as another brand already in the table):");
    for (const dup of skippedDuplicates) {
      console.log(`  sourceNo=${dup.sourceNo} name="${dup.name}"`);
    }
  }
  if (skippedDuplicateNo.length > 0) {
    console.log("Skipped rows (duplicate 'no' value in the source sheet — kept the first occurrence):");
    for (const dup of skippedDuplicateNo) {
      console.log(`  no=${dup.sourceNo} name="${dup.name}" (kept "${dup.keptName}" instead)`);
    }
  }
  await db.$disconnect();
}

main().catch((e) => {
  console.error("FAILED:", e);
  process.exit(1);
});