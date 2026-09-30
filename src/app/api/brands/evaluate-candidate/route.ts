import { NextRequest, NextResponse } from "next/server";
import { evaluateCandidate } from "@/lib/brand-sourcing/evaluate";
import { candidateEvaluationSchema } from "@/lib/validation/brand";
import { UNSAFE_INPUT_MESSAGE } from "@/lib/security/sanitize-input";
import { requireSectionAccess } from "@/lib/auth/require-section-access";

export async function POST(request: NextRequest) {
  const denied = await requireSectionAccess("brandSourcing");
  if (denied) return denied;

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = candidateEvaluationSchema.safeParse(rawBody);
  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors;
    const hasUnsafe = Object.values(fieldErrors).some((msgs) => msgs?.includes(UNSAFE_INPUT_MESSAGE));
    return NextResponse.json(
      { error: hasUnsafe ? "Input contains unsafe content" : "Invalid input", details: fieldErrors },
      { status: 400 }
    );
  }

  const result = await evaluateCandidate(parsed.data);
  return NextResponse.json(result);
}
