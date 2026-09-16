import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(request: Request) {
  const runId = new URL(request.url).searchParams.get("runId");
  if (!runId) return NextResponse.json({ error: "Missing runId" }, { status: 400 });

  const run = await db.sourcingRun.findUnique({
    where: { id: runId },
    select: { status: true, progress: true, _count: { select: { candidates: true } } },
  });
  if (!run) return NextResponse.json({ error: "Run not found" }, { status: 404 });

  return NextResponse.json({
    status: run.status,
    progress: run.progress,
    candidateCount: run._count.candidates,
  });
}
