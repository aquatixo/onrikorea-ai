"use server";

import { spawn } from "child_process";
import path from "path";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";

/**
 * Starts the Python evidence-only sourcing engine as a local subprocess and returns
 * immediately with the SourcingRun id -- the run keeps writing its progress into that
 * row (see python-sourcing/main.py's Progress class) so the client can poll
 * /api/brands/sourcing-progress instead of blocking on the whole script.
 *
 * Local-only by design (see chat history): this spawns a real Python process, which
 * only works wherever `npm run dev` is actually running, not on the deployed Vercel site.
 */
export async function startPythonBrandSourcing(): Promise<{ runId: string } | { error: string }> {
  const run = await db.sourcingRun.create({ data: { status: "running" } });
  const scriptDir = path.join(process.cwd(), "python-sourcing");

  try {
    const child = spawn("python", ["main.py", run.id], {
      cwd: scriptDir,
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
    });

    if (child.pid) {
      await db.sourcingRun.update({ where: { id: run.id }, data: { pid: child.pid } });
    }

    // Echo everything into this dev server's own terminal live, exactly like running
    // `python main.py` by hand -- the most direct place to watch a run. Also keep just
    // the tail in memory, purely for surfacing "what broke" in the DB/UI on a crash.
    let stderrTail = "";
    let stdoutTail = "";
    const MAX_TAIL = 4000;
    const tag = `[sourcing ${run.id.slice(0, 8)}]`;
    child.stderr?.on("data", (chunk: Buffer) => {
      const text = chunk.toString();
      stderrTail = (stderrTail + text).slice(-MAX_TAIL);
      process.stderr.write(`${tag} ${text}`);
    });
    child.stdout?.on("data", (chunk: Buffer) => {
      const text = chunk.toString();
      stdoutTail = (stdoutTail + text).slice(-MAX_TAIL);
      process.stdout.write(`${tag} ${text}`);
    });

    child.on("error", (err) => {
      db.sourcingRun
        .update({ where: { id: run.id }, data: { status: "error", progress: { stage: "error", message: err.message } } })
        .catch(() => {});
    });

    // Python's own crash handler (main.py) already writes status "error" with a real
    // message when it can reach the DB -- this is the fallback for cases it can't (e.g.
    // it crashed before even importing db.py, or the DB write itself failed).
    child.on("exit", (code) => {
      if (code === 0) return;
      db.sourcingRun
        .findUnique({ where: { id: run.id } })
        .then((current) => {
          if (!current || current.status !== "running") return; // already reported its own error/done
          return db.sourcingRun.update({
            where: { id: run.id },
            data: {
              status: "error",
              progress: { stage: "error", message: stderrTail || stdoutTail || `python exited with code ${code}` },
            },
          });
        })
        .catch(() => {});
    });

    child.unref();
    return { runId: run.id };
  } catch (err) {
    const e = err as Error;
    await db.sourcingRun.update({ where: { id: run.id }, data: { status: "error" } }).catch(() => {});
    return { error: e.message || "Failed to start the Python sourcing script." };
  }
}

export async function stopPythonBrandSourcing(runId: string): Promise<{ ok: true } | { error: string }> {
  const run = await db.sourcingRun.findUnique({ where: { id: runId } });
  if (!run) return { error: "Run not found." };

  if (run.pid) {
    try {
      process.kill(run.pid);
    } catch {
      // already exited -- nothing to do
    }
  }

  await db.sourcingRun.update({ where: { id: runId }, data: { status: "stopped" } });
  revalidatePath("/brands/sourcing");
  return { ok: true };
}
