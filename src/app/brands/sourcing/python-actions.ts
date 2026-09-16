"use server";

import { execFile } from "child_process";
import { promisify } from "util";
import path from "path";
import { revalidatePath } from "next/cache";

const execFileAsync = promisify(execFile);

/**
 * Runs the Python evidence-only sourcing engine as a local subprocess. Local-only by
 * design (see chat history) -- this spawns a real Python process, which only works
 * wherever `npm run dev` is actually running, not on the deployed Vercel site.
 */
export async function runPythonBrandSourcing(): Promise<{ error?: string; output?: string }> {
  const scriptDir = path.join(process.cwd(), "python-sourcing");

  try {
    const { stdout } = await execFileAsync("python", ["main.py"], {
      cwd: scriptDir,
      env: process.env,
      timeout: 10 * 60 * 1000,
      maxBuffer: 10 * 1024 * 1024,
    });
    revalidatePath("/brands/sourcing");
    return { output: stdout };
  } catch (err) {
    const e = err as { stderr?: string; message?: string };
    return { error: e.stderr || e.message || "Python sourcing script failed." };
  }
}
