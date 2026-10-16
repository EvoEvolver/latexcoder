import { spawn, type ChildProcess } from "node:child_process";
import { createWriteStream, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { apiError } from "./core.ts";
import type { Logger } from "./logger.ts";

const APP_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const RETRY_DELAY_MS = 5 * 60_000;
const MAX_ATTEMPTS = 6;

export type TexLiveState = "ready" | "installing" | "failed" | "absent";
export type TexLiveStatus = {
  state: TexLiveState;
  dir: string;
  startedAt: string | null;
  finishedAt: string | null;
  attempts: number;
  nextAttemptAt: string | null;
  lastOutput: string;
  logPath: string | null;
};

export type TexLiveOptions = {
  /** Where TeX Live lives; its bin/linux directory joins PATH once installed. */
  dir: string;
  /** Install into `dir` when nothing is there yet. */
  install: boolean;
  repository?: string;
  installer?: string;
  logPath?: string;
  logger: Logger;
};

export type TexLiveManager = {
  status(): TexLiveStatus;
  ready(): boolean;
  /** Turns a missing-latexmk error into one that says the installation is still running. */
  explain(error: unknown): unknown;
  whenSettled(): Promise<TexLiveState>;
  close(): void;
};

export function texLiveReady(dir: string): boolean {
  return existsSync(path.join(dir, ".latexcoder-ready")) && existsSync(path.join(dir, "bin", "linux", "latexmk"));
}

function prependPath(binDir: string): void {
  const entries = (process.env.PATH || "").split(path.delimiter);
  if (!entries.includes(binDir)) process.env.PATH = [binDir, ...entries].filter(Boolean).join(path.delimiter);
}

/**
 * Keeps a persistent TeX Live beside the state directory. The server starts
 * serving right away; when the installation is missing it runs in the
 * background and latexmk becomes available the moment it finishes, so a
 * redeploy never downloads TeX Live again.
 */
export function createTexLiveManager(options: TexLiveOptions): TexLiveManager {
  const dir = path.resolve(options.dir);
  const binDir = path.join(dir, "bin", "linux");
  const installer = options.installer || path.join(APP_DIR, "scripts/install-texlive.sh");
  const logPath = options.logPath ?? null;
  let state: TexLiveState = texLiveReady(dir) ? "ready" : "absent";
  let startedAt: string | null = null, finishedAt: string | null = null, nextAttemptAt: string | null = null;
  let attempts = 0, lastOutput = "";
  let child: ChildProcess | null = null;
  let retryTimer: ReturnType<typeof setTimeout> | undefined;
  let closed = false;
  const settled: Array<(state: TexLiveState) => void> = [];
  const settle = () => { for (const resolve of settled.splice(0)) resolve(state); };

  if (state === "ready") prependPath(binDir);

  const start = () => {
    if (closed) return;
    attempts += 1;
    state = "installing";
    startedAt = new Date().toISOString();
    finishedAt = null; nextAttemptAt = null; lastOutput = "";
    options.logger.info("texlive.install.started", { dir, attempt: attempts, logPath });
    const log = logPath ? createWriteStream(logPath, { flags: attempts === 1 ? "w" : "a" }) : null;
    child = spawn("sh", [installer], {
      cwd: APP_DIR,
      env: { ...process.env, TEXLIVE_DIR: dir, ...(options.repository ? { TEXLIVE_REPOSITORY: options.repository } : {}) },
      stdio: ["ignore", "pipe", "pipe"],
    });
    const append = (chunk: Buffer) => {
      lastOutput = (lastOutput + chunk.toString()).slice(-4000);
      log?.write(chunk);
    };
    child.stdout?.on("data", append);
    child.stderr?.on("data", append);
    child.on("error", error => { append(Buffer.from(`${error.message}\n`)); });
    child.on("close", code => {
      child = null;
      log?.end();
      finishedAt = new Date().toISOString();
      if (code === 0 && texLiveReady(dir)) {
        state = "ready";
        prependPath(binDir);
        options.logger.info("texlive.install.finished", { dir, attempt: attempts });
      } else {
        state = "failed";
        options.logger.error("texlive.install.failed", new Error(`installer exited with code ${code}`), { dir, attempt: attempts, output: lastOutput.slice(-1500) });
        if (!closed && attempts < MAX_ATTEMPTS) {
          nextAttemptAt = new Date(Date.now() + RETRY_DELAY_MS).toISOString();
          retryTimer = setTimeout(start, RETRY_DELAY_MS);
          retryTimer.unref?.();
        }
      }
      settle();
    });
  };

  if (state === "absent" && options.install) start();

  const status = (): TexLiveStatus => ({ state, dir, startedAt, finishedAt, attempts, nextAttemptAt, lastOutput, logPath });

  return {
    status,
    ready: () => state === "ready",
    explain(error) {
      const code = error instanceof Error && "code" in error ? (error as { code?: unknown }).code : undefined;
      if (code !== "compiler_unavailable" || state === "ready" || state === "absent") return error;
      const minutes = startedAt ? Math.max(1, Math.round((Date.now() - Date.parse(startedAt)) / 60_000)) : 0;
      const message = state === "installing"
        ? `TeX Live is still being installed on this server (running for ${minutes} min). latexmk compiles will work once it finishes; Tectonic can be used meanwhile.`
        : `TeX Live could not be installed on this server${nextAttemptAt ? "; another attempt is scheduled" : ""}. The log ends with:\n${lastOutput.slice(-800)}`;
      return apiError("texlive_installing", message, 503, { texlive: status() });
    },
    whenSettled: () => state === "installing" ? new Promise(resolve => settled.push(resolve)) : Promise.resolve(state),
    close() {
      closed = true;
      clearTimeout(retryTimer);
      child?.kill();
    },
  };
}
