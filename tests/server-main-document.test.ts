import assert from "node:assert/strict";
import test from "node:test";
import { strToU8, zipSync } from "fflate";
import { withServer } from "./helpers/server.ts";

const document = "\\documentclass{article}\n\\begin{document}Hello\\end{document}";

test("ZIP import detects the actual root regardless of archive order or main.tex helpers", async () => {
  await withServer(async ({ base }) => {
    for (const entries of [
      { "qcircuit.tex": "\\ProvidesPackage{qcircuit}", "main.tex": "\\input{defs}", "lec.tex": document },
      { "lec.tex": document, "main.tex": "\\input{defs}", "qcircuit.tex": "\\ProvidesPackage{qcircuit}" },
    ]) {
      const archive = zipSync(Object.fromEntries(Object.entries(entries).map(([file, source]) => [file, strToU8(source)])));
      const response = await fetch(base + "/v1/projects?name=Lecture", {
        method: "POST", headers: { "Content-Type": "application/zip" }, body: Buffer.from(archive),
      });
      assert.equal(response.status, 201);
      const { project } = await response.json();
      assert.equal(project.build.main, "lec.tex");
      const settings = await (await fetch(base + "/v1/settings?project=" + project.id)).json();
      assert.equal(settings.settings.main, "lec.tex");
    }
  });
});

test("root recommendations inspect live collaborative text without changing manual settings", async () => {
  await withServer(async ({ base, collaboration }) => {
    const headers = { "Content-Type": "text/plain" };
    await fetch(base + "/v1/files?path=lecture.tex", { method: "PUT", headers, body: "a fragment on disk" });
    // Change both documents in Yjs, without depending on a flush to disk.
    collaboration.replaceText("main.tex", "\\section{A fragment}");
    collaboration.replaceText("lecture.tex", document);
    const detection = await fetch(base + "/v1/project/main-document");
    assert.equal(detection.status, 200);
    assert.equal(detection.headers.get("cache-control"), "no-store");
    assert.deepEqual(await detection.json(), { main: "lecture.tex" });
    assert.equal((await (await fetch(base + "/v1/settings")).json()).settings.main, "main.tex");

    const saved = await fetch(base + "/v1/settings", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ main: "lecture.tex", compiler: "auto" }),
    });
    assert.equal(saved.status, 200);
    collaboration.replaceText("main.tex", document);
    collaboration.replaceText("lecture.tex", "\\section{Manually selected chapter}");
    assert.deepEqual(await (await fetch(base + "/v1/project/main-document")).json(), { main: "main.tex" });
    assert.equal((await (await fetch(base + "/v1/settings")).json()).settings.main, "lecture.tex");
  });
});

test("main document detection returns no candidate for a project without TeX files", async () => {
  await withServer(async ({ base }) => {
    const response = await fetch(base + "/v1/projects", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: "Empty", empty: true }),
    });
    const { project } = await response.json();
    assert.deepEqual(await (await fetch(base + "/v1/project/main-document?project=" + project.id)).json(), { main: null });
  });
});
