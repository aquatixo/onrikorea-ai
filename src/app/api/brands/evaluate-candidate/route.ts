import { timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { evaluateCandidate } from "@/lib/brand-sourcing/evaluate";
import { candidateEvaluationSchema } from "@/lib/validation/brand";
import { UNSAFE_INPUT_MESSAGE } from "@/lib/security/sanitize-input";
import { requireSectionAccess } from "@/lib/auth/require-section-access";

// python-sourcing/main.py calls this route directly (server-to-server, same machine)
// with no browser session to send -- evaluate_client.py instead sends this shared
// secret (INTERNAL_API_SECRET in .env, read by both sides) so it can skip the
// session-based requireSectionAccess check below without reopening this route to
// unauthenticated outside callers generally.
function hasValidInternalSecret(request: NextRequest): boolean {
  const expected = process.env.INTERNAL_API_SECRET;
  const provided = request.headers.get("x-internal-secret");
  if (!expected || !provided) return false;
  const expectedBuf = Buffer.from(expected);
  const providedBuf = Buffer.from(provided);
  return expectedBuf.length === providedBuf.length && timingSafeEqual(expectedBuf, providedBuf);
}

export async function POST(request: NextRequest) {
  if (!hasValidInternalSecret(request)) {
    const denied = await requireSectionAccess("brandSourcing");
    if (denied) return denied;
  }

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
