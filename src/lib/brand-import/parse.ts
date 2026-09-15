import * as XLSX from "xlsx";
import { findUnsafeTextReason } from "@/lib/security/sanitize-input";

export type ParsedBrandRow = {
  rowNumber: number; // 1-indexed spreadsheet row (header = row 1, so first data row = 2)
  methodology: string | null;
  name: string;
  country: string | null;
  sku: string | null;
  foundedYear: number | null;
  website: string | null;
  contactPoint: string | null;
  coldEmail: boolean;
  reply: boolean;
};

export type ImportRowError =
  | { scope: "row"; row: number; code: "nameRequired" }
  | { scope: "row"; row: number; code: "invalidYear" }
  | { scope: "row"; row: number; code: "duplicateNameInFile"; name: string }
  | { scope: "row"; row: number; code: "duplicateWebsiteInFile"; website: string }
  | { scope: "row"; row: number; code: "nameExists"; name: string }
  | { scope: "row"; row: number; code: "websiteExists"; website: string }
  | { scope: "row"; row: number; code: "unsafeContent"; field: string };

export type ImportFileError =
  | { scope: "file"; code: "unreadableFile" }
  | { scope: "file"; code: "noSheets" }
  | { scope: "file"; code: "noDataRows" }
  | { scope: "file"; code: "noFileChosen" }
  | { scope: "file"; code: "importFailed" };

export type ImportError = ImportRowError | ImportFileError;

export type ParseResult = { ok: true; rows: ParsedBrandRow[] } | { ok: false; errors: ImportError[] };

function parseChecked(value: unknown): boolean {
  const v = String(value ?? "").trim().toLowerCase();
  return v === "o" || v === "1" || v === "true" || v === "y" || v === "yes";
}

function cell(row: unknown[], index: number): string {
  const v = row[index];
  return v === undefined || v === null ? "" : String(v).trim();
}

/**
 * Fixed column order, matching both the downloadable template and the existing
 * /api/brands/export layout: no, 방법론, Name, country, SKU, Year, Website,
 * Contact point, Cold Email, Reply. The header row (row 1) is always skipped --
 * this is designed around the template, not arbitrary spreadsheets.
 *
 * Column 0 ("no") is read from the template for compatibility but intentionally
 * ignored here -- it's a legacy row-order artifact from the original spreadsheet,
 * not a meaningful identifier. The importer assigns fresh sequential numbers on
 * insert (see import-actions.ts); name and website are what actually matter for
 * duplicate detection.
 */
export function parseBrandImportSheet(buffer: Buffer): ParseResult {
  let workbook: XLSX.WorkBook;
  try {
    workbook = XLSX.read(buffer, { type: "buffer" });
  } catch {
    return { ok: false, errors: [{ scope: "file", code: "unreadableFile" }] };
  }

  const sheetName = workbook.SheetNames[0];
  if (!sheetName) return { ok: false, errors: [{ scope: "file", code: "noSheets" }] };

  const sheet = workbook.Sheets[sheetName];
  const raw = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "" });
  const dataRows = raw.slice(1);

  const errors: ImportRowError[] = [];
  const rows: ParsedBrandRow[] = [];

  dataRows.forEach((row, i) => {
    const rowNumber = i + 2;
    const isBlank = row.every((c) => String(c ?? "").trim() === "");
    if (isBlank) return;

    const name = cell(row, 2);
    if (!name) {
      errors.push({ scope: "row", row: rowNumber, code: "nameRequired" });
      return;
    }

    let foundedYear: number | null = null;
    const yearRaw = cell(row, 5);
    if (yearRaw) {
      const parsedYear = Number.parseInt(yearRaw, 10);
      if (!Number.isFinite(parsedYear)) {
        errors.push({ scope: "row", row: rowNumber, code: "invalidYear" });
        return;
      }
      foundedYear = parsedYear;
    }

    const parsedRow: ParsedBrandRow = {
      rowNumber,
      methodology: cell(row, 1) || null,
      name,
      country: cell(row, 3) || null,
      sku: cell(row, 4) || null,
      foundedYear,
      website: cell(row, 6) || null,
      contactPoint: cell(row, 7) || null,
      coldEmail: parseChecked(row[8]),
      reply: parseChecked(row[9]),
    };

    const unsafeField = (["name", "methodology", "country", "sku", "website", "contactPoint"] as const).find(
      (field) => {
        const value = parsedRow[field];
        return value !== null && findUnsafeTextReason(value) !== null;
      }
    );
    if (unsafeField) {
      errors.push({ scope: "row", row: rowNumber, code: "unsafeContent", field: unsafeField });
      return;
    }

    rows.push(parsedRow);
  });

  if (rows.length === 0 && errors.length === 0) {
    return { ok: false, errors: [{ scope: "file", code: "noDataRows" }] };
  }
  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, rows };
}
