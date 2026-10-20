import assert from "node:assert/strict";
import { chmod, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { withServer } from "./helpers/server.ts";

test("namespace failures are reported in health and as 503 rather than empty search results", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "latexcoder-sandbox-test-"));
  try {
    const bwrap = path.join(directory, "bwrap-fails");
    await writeFile(bwrap, "#!/bin/sh\necho 'bwrap: Creating new namespace failed: Permission denied' >&2\nexit 1\n");
    await chmod(bwrap, 0o755);
    await withServer(async ({ base }) => {
      const health = await (await fetch(base + "/health")).json();
      assert.equal(health.dependencies.bwrap.available, false);
      assert.match(health.dependencies.bwrap.error, /namespace/);
      for (const [endpoint, body] of [
        ["/v1/search", { pattern: "documentclass" }],
        ["/v1/search/project", { query: "documentclass", regex: true }],
      ] as const) {
        const response = await fetch(base + endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
        assert.equal(response.status, 503);
        assert.equal((await response.json()).error.code, "search_sandbox_unavailable");
      }
      const literal = await fetch(base + "/v1/search/project", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ query: "documentclass" }) });
      assert.equal(literal.status, 200);
      assert.ok((await literal.json()).matches.length);
    }, { bwrap });
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test("agent manuals preserve HTTPS behind a TLS-terminating proxy", async () => {
  await withServer(async ({ base }) => {
    const { share } = await (await fetch(base + "/v1/project/share", { method: "POST" })).json();
    for (const agentPath of [share.agentPath, share.proposalAgentPath]) {
      const response = await fetch(base + agentPath, { headers: { "X-Forwarded-Proto": "https" } });
      assert.equal(response.status, 200);
      const manual = await response.text();
      assert.ok(manual.includes(base.replace("http:", "https:") + "/v1/"));
      assert.ok(!manual.includes(base + "/v1/"));
    }
  });
});
