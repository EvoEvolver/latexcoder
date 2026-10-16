import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { chmod, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { createTexLiveManager } from "../src/server/texlive.ts";
import { createLogger } from "../src/server/logger.ts";
import { withServer } from "./helpers/server.ts";

async function fakeInstaller(dir: string, body: string): Promise<string> {
  const script = path.join(dir, "install.sh");
  await writeFile(script, `#!/bin/sh\nset -eu\n${body}\n`);
  await chmod(script, 0o755);
  return script;
}

const succeedingInstaller = `mkdir -p "$TEXLIVE_DIR/bin/linux"
echo "fetching from \${TEXLIVE_REPOSITORY:-default-mirror}"
printf '#!/bin/sh\\necho latexmk-fake\\n' > "$TEXLIVE_DIR/bin/linux/latexmk"
chmod +x "$TEXLIVE_DIR/bin/linux/latexmk"
echo "TeX Live 2025" > "$TEXLIVE_DIR/.latexcoder-ready"`;

test("an installed TeX Live joins PATH at startup and is reported ready", async () => {
  const temporary = await mkdtemp(path.join(os.tmpdir(), "latexcoder-texlive-"));
  const originalPath = process.env.PATH;
  try {
    const dir = path.join(temporary, "texlive");
    await mkdir(path.join(dir, "bin", "linux"), { recursive: true });
    await writeFile(path.join(dir, "bin", "linux", "latexmk"), "#!/bin/sh\n");
    await writeFile(path.join(dir, ".latexcoder-ready"), "TeX Live 2025\n");
    const manager = createTexLiveManager({ dir, install: true, installer: path.join(temporary, "never-run.sh"), logger: createLogger(false) });
    assert.equal(manager.status().state, "ready");
    assert.ok(process.env.PATH!.split(path.delimiter)[0] === path.join(dir, "bin", "linux"));
    const other = Object.assign(new Error("x"), { code: "compiler_unavailable" });
    assert.equal(manager.explain(other), other, "a ready installation leaves errors alone");
    manager.close();
  } finally {
    process.env.PATH = originalPath;
    await rm(temporary, { recursive: true, force: true });
  }
});

test("a missing TeX Live is installed in the background and latexmk errors explain the wait", async () => {
  const temporary = await mkdtemp(path.join(os.tmpdir(), "latexcoder-texlive-"));
  const originalPath = process.env.PATH;
  try {
    const dir = path.join(temporary, "texlive");
    const gate = path.join(temporary, "gate");
    const installer = await fakeInstaller(temporary, `while [ ! -f "${gate}" ]; do sleep 0.05; done\n${succeedingInstaller}`);
    const logPath = path.join(temporary, "install.log");
    const manager = createTexLiveManager({ dir, install: true, installer, repository: "https://mirror.example/tlnet", logPath, logger: createLogger(false) });
    assert.equal(manager.status().state, "installing");
    assert.equal(manager.ready(), false);
    const unavailable = Object.assign(new Error("The selected compiler latexmk is not installed"), { code: "compiler_unavailable", status: 503 });
    const explained = manager.explain(unavailable) as Error & { code: string; status: number };
    assert.equal(explained.code, "texlive_installing");
    assert.equal(explained.status, 503);
    assert.match(explained.message, /still being installed/);
    const other = new Error("other");
    assert.equal(manager.explain(other), other, "only missing-compiler errors are explained");
    await writeFile(gate, "");
    assert.equal(await manager.whenSettled(), "ready");
    assert.equal(manager.status().state, "ready");
    assert.ok(process.env.PATH!.startsWith(path.join(dir, "bin", "linux")));
    assert.match(await readFile(logPath, "utf8"), /fetching from https:\/\/mirror.example\/tlnet/);
    assert.equal(manager.explain(unavailable), unavailable);
    manager.close();
  } finally {
    process.env.PATH = originalPath;
    await rm(temporary, { recursive: true, force: true });
  }
});

test("a failed installation is reported with its log and retried later", async () => {
  const temporary = await mkdtemp(path.join(os.tmpdir(), "latexcoder-texlive-"));
  try {
    const installer = await fakeInstaller(temporary, 'echo "mirror unreachable" >&2\nexit 7');
    const manager = createTexLiveManager({ dir: path.join(temporary, "texlive"), install: true, installer, logger: createLogger(false) });
    assert.equal(await manager.whenSettled(), "failed");
    const status = manager.status();
    assert.equal(status.attempts, 1);
    assert.ok(status.nextAttemptAt);
    assert.match(status.lastOutput, /mirror unreachable/);
    const explained = manager.explain(Object.assign(new Error("x"), { code: "compiler_unavailable" })) as Error;
    assert.match(explained.message, /could not be installed[\s\S]*mirror unreachable/);
    manager.close();
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
});

test("the server reports the installation and latexmk builds wait for it", async () => {
  const temporary = await mkdtemp(path.join(os.tmpdir(), "latexcoder-texlive-"));
  const originalPath = process.env.PATH;
  // Hide any latexmk on this machine so the server must rely on the managed TeX Live.
  process.env.PATH = (originalPath || "").split(path.delimiter).filter(entry => !existsSync(path.join(entry, "latexmk"))).join(path.delimiter);
  try {
    const gate = path.join(temporary, "gate");
    const installer = await fakeInstaller(temporary, `while [ ! -f "${gate}" ]; do sleep 0.05; done\n${succeedingInstaller}`);
    await withServer(async ({ base, texlive }) => {
      const ready = await (await fetch(`${base}/health/ready`)).json();
      assert.equal(ready.texlive.state, "installing");
      await fetch(`${base}/v1/settings`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ main: "main.tex", compiler: "latexmk" }) });
      const response = await fetch(`${base}/v1/compile`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ main: "main.tex" }) });
      assert.equal(response.status, 503);
      const body = await response.json();
      assert.equal(body.error.code, "texlive_installing");
      // Server-side errors keep their message out of responses; the build log keeps it.
      const build = await (await fetch(`${base}/v1/build`)).json();
      assert.match(build.build.log, /still being installed/);
      await writeFile(gate, "");
      assert.equal(await texlive.whenSettled(), "ready");
      assert.equal((await (await fetch(`${base}/health/ready`)).json()).texlive.state, "ready");
    }, { texliveDir: path.join(temporary, "texlive"), texliveInstall: true, texliveInstaller: installer });
  } finally {
    process.env.PATH = originalPath;
    await rm(temporary, { recursive: true, force: true });
  }
});
