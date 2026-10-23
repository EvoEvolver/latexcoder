import assert from "node:assert/strict";
import { chmod, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { createFakeLatexmk, withServer } from "./helpers/server.ts";

test("source navigation maps edited lines to the cached PDF during and after failed compilation", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "latexcoder-stale-pdf-"));
  try {
    const compiler = await createFakeLatexmk(directory);
    await writeFile(compiler, await readFile(compiler, "utf8") + '\ntouch "$out/$base.synctex.gz"\n');
    const synctex = path.join(directory, "synctex-fake");
    await writeFile(synctex, '#!/bin/sh\nprintf "%s\\n" "$@" > "' + directory + '/sync-args"\nprintf "Page:1\\nx:80\\ny:120\\n"\n');
    await chmod(synctex, 0o755);
    await withServer(async ({ base, projects }) => {
      const source = "Before\n\\cmtbg{t}{Ada}Target sentence.\\cmted{Note\\nmore note}\nAfter";
      await fetch(base + "/v1/files?path=main.tex", { method: "PUT", body: source });
      const compiled = await fetch(base + "/v1/compile", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
      assert.equal(compiled.status, 200);
      const revision = (await compiled.json()).build.sourceRevision;
      const updated = "% new line\n" + source;
      await fetch(base + "/v1/files?path=main.tex", { method: "PUT", body: updated });
      const runtime = [...projects.values()][0];
      const locate = (extra: object = {}) => fetch(base + "/v1/build/position", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: "main.tex", source: updated, line: 3, ...extra }),
      });
      runtime.compilePromise = Promise.resolve({ success: false, build: runtime.build });
      let response = await locate();
      runtime.compilePromise = null;
      assert.equal(response.status, 200);
      assert.equal((await response.json()).revision, revision);
      assert.match(await readFile(path.join(directory, "sync-args"), "utf8"), /\n2:0:/, "inserted line maps back to compiled line two");
      await writeFile(compiler, "#!/bin/sh\necho 'Undefined control sequence'\nexit 1\n");
      const failed = await fetch(base + "/v1/compile", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
      assert.equal(failed.status, 422);
      const failedBuild = (await failed.json()).build;
      const from = updated.indexOf("Target");
      response = await locate({ from, to: from + "Target".length });
      assert.equal(response.status, 200, await response.clone().text());
      const position = await response.json();
      assert.equal(position.stale, true);
      assert.equal(position.revision, revision);
      assert.match(await readFile(path.join(directory, "sync-args"), "utf8"), /\n2:1:/, "selection maps through hidden review storage");
      const cached = await fetch(base + "/v1/build/pdf?cached=1");
      assert.equal(cached.status, 200);
      assert.equal(cached.headers.get("x-latex-coder-source-revision"), revision);
      const { build } = await (await fetch(base + "/v1/build")).json();
      assert.equal(build.finishedAt, failedBuild.finishedAt);
      assert.equal(build.stale, true);
      assert.equal((await readFile(path.join(directory, "count"), "utf8")).trim(), "1");
      const outdatedRequest = await locate({ source });
      assert.equal(outdatedRequest.status, 409, "actual concurrent source edits still require a retry");
    }, { compiler, synctex });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
