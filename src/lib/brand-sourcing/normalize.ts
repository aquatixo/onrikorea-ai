import { isKnownCountryName } from "@/lib/brand-sourcing/countries";

export type NormalizedCandidate = {
  country: string | null;
  foundedYear: number | null;
  sku: string | null;
  notes: string[];
};

/**
 * Output formatting rules from the sourcing prompt: country name only (no city/state),
 * founded year as a bare 4-digit number, SKU without parenthetical asides -- any detail
 * that would otherwise be silently dropped gets preserved in `notes` instead.
 */
export function normalizeCandidateFields(input: {
  country?: string | null;
  foundedYear?: string | number | null;
  sku?: string | null;
}): NormalizedCandidate {
  const notes: string[] = [];

  let country = input.country?.trim() || null;
  if (country?.includes(",")) {
    const parts = country.split(",").map((p) => p.trim());
    const knownCountryToken = parts.find((p) => isKnownCountryName(p));
    if (knownCountryToken) {
      // Only rewrite when we can actually confirm which token is the country --
      // guessing by position (e.g. always "last part") gets it backwards depending
      // on whether the input is "City, Country" or "Country, Region" order.
      notes.push(`Original location: ${country}`);
      country = knownCountryToken;
    } else {
      notes.push(`Location could not be split into a single country automatically — needs manual review: ${country}`);
    }
  }

  let foundedYear: number | null = null;
  if (input.foundedYear !== undefined && input.foundedYear !== null && input.foundedYear !== "") {
    const match = String(input.foundedYear).match(/\d{4}/);
    foundedYear = match ? Number.parseInt(match[0], 10) : null;
  }

  let sku = input.sku?.trim() || null;
  if (sku) {
    const parenMatch = sku.match(/\(([^)]+)\)/);
    if (parenMatch) {
      notes.push(`SKU detail: ${parenMatch[1]}`);
      sku = sku.replace(/\s*\([^)]+\)\s*/g, " ").trim();
    }
  }

  return { country, foundedYear, sku, notes };
}
