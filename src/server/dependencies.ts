import path from "node:path";
import os from "node:os";
import { mkdtemp, rm } from "node:fs/promises";
import { executablePath, runRipgrep } from "./process.ts";

export type DependencyStatus = { available: boolean; path: string | null; error?: string };
export type DependencyReport = Record<"git" | "rg" | "bwrap" | "synctex" | "compiler", DependencyStatus>;

export async function checkDependencies(stateDir: string, configured: { compiler?: string; synctex?: string; rg?: string; bwrap?: string }): Promise<DependencyReport> {
  const compilerCandidates = [configured.compiler, path.join(stateDir, "bin", "tectonic"), "tectonic", "latexmk"].filter((value): value is string => Boolean(value));
  let compiler: string | null = null;
  for (const candidate of compilerCandidates) {
    compiler = await executablePath(candidate);
    if (compiler) break;
  }
  const entries = await Promise.all([
    executablePath("git"),
    executablePath(configured.rg || process.env.LATEXCODER_RG_BIN || "rg"),
    executablePath(configured.bwrap || process.env.LATEXCODER_BWRAP_BIN || "bwrap"),
    executablePath(configured.synctex || process.env.LATEXCODER_SYNCTEX_BIN || "synctex"),
  ]);
  const status = (value: string | null): DependencyStatus => ({ available: Boolean(value), path: value });
  const sandbox = status(entries[2]);
  if (sandbox.path && entries[1]) {
    const directory = await mkdtemp(path.join(os.tmpdir(), "latexcoder-search-probe-"));
    try {
      const result = await runRipgrep(directory, ["--version"], { bwrap: sandbox.path, rg: entries[1], timeoutMs: 3000 });
      if (result.code !== 0) throw new Error(result.stderr.toString().trim() || "Search sandbox probe failed");
    } catch (error) {
      sandbox.available = false;
      sandbox.error = error instanceof Error ? error.message : String(error);
    } finally { await rm(directory, { recursive: true, force: true }); }
  }
  return { git: status(entries[0]), rg: status(entries[1]), bwrap: sandbox, synctex: status(entries[3]), compiler: status(compiler) };
}
