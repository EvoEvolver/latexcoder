import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { withServer, testGit } from "./helpers/server.ts";
import { archiveComment, parseReviews, stripReviewStorage } from "../src/shared/review.ts";

const legacy = "\\cmtbg{t1}{Ada}claim\\cmted{Question\\cmtrpl{r1}{Bob}{Answer}}";

test("Markdown uploads and legacy files on disk migrate to portable hidden markers", async () => {
  await withServer(async ({ base, projectDir, collaboration }) => {
    const put = await fetch(base + "/v1/files?path=notes.md", { method: "PUT", body: legacy });
    assert.equal(put.status, 201);
    const stored = await (await fetch(base + "/v1/files?path=notes.md")).text();
    assert.doesNotMatch(stored, /\\cmtbg|\\cmted|\\cmtrpl/);
    assert.equal(parseReviews(stored)[0].replies[0].body, "Answer");
    await writeFile(path.join(projectDir, "old.md"), legacy);
    assert.equal(stripReviewStorage(collaboration.readText("old.md")), "claim");
    assert.doesNotMatch(await readFile(path.join(projectDir, "old.md"), "utf8"), /\\cmtbg/);
    const checkpoint = await fetch(base + "/v1/git/commit", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: "Check portable reviews" }),
    });
    assert.equal(checkpoint.status, 200);
    assert.equal(await testGit(projectDir, ["show", "HEAD:notes.md"]), stored);
  });
});

test("reviews API includes portable history only when requested", async () => {
  await withServer(async ({ base }) => {
    const resolved = archiveComment(parseReviews(legacy)[0], "resolved", "Lin", "tex");
    const detached = archiveComment(parseReviews(legacy)[0], "detached", "Mo", "tex");
    await fetch(base + "/v1/files?path=main.tex", { method: "PUT", body: "claim" + resolved + detached });
    const normal = (await (await fetch(base + "/v1/reviews")).json()).files.find(file => file.path === "main.tex");
    assert.equal(normal.reviews.length, 0);
    assert.equal(normal.archived, undefined);
    const history = (await (await fetch(base + "/v1/reviews?resolved=1")).json()).files.find(file => file.path === "main.tex");
    assert.deepEqual(history.archived.map(thread => thread.status), ["resolved", "detached"]);
    assert.equal(history.archived[0].replies[0].body, "Answer");
    assert.equal(history.archived[0].changedBy, "Lin");
  });
});
