import { NextRequest, NextResponse } from "next/server";
import { evaluateCandidate, type CandidateInput } from "@/lib/brand-sourcing/evaluate";

export async function POST(request: NextRequest) {
  let body: Partial<CandidateInput>;
  try {
    body = (await request.json()) as Partial<CandidateInput>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.name || typeof body.name !== "string" || body.name.trim().length === 0) {
    return NextResponse.json({ error: "'name' is required" }, { status: 400 });
  }

  const result = await evaluateCandidate({
    name: body.name,
    country: body.country ?? null,
    sku: body.sku ?? null,
    foundedYear: body.foundedYear ?? null,
    website: body.website ?? null,
    methodology: body.methodology ?? null,
    channel: body.channel ?? null,
    contactPoint: body.contactPoint ?? null,
  });

  return NextResponse.json(result);
}
