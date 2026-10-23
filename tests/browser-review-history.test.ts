import assert from "node:assert/strict";
import test from "node:test";
import { selectionContextMenu, withEditor } from "./helpers/browser.ts";
import { parseArchivedComments, parseReviews, stripReviewStorage } from "../src/shared/review.ts";

const reviewed = "Before \\cmtbg{t1}{Ada}old claim\\cmted{Please clarify\\cmtrpl{r1}{Bob}{Agreed}} after";

test("comment creation, edits and replies submit only outside IME composition", async () => {
  await withEditor(async ({ page, base }) => {
    await page.request.put(base + "/v1/files?path=main.tex", { data: "A claim.", headers: { "Content-Type": "text/plain" } });
    await page.goto(base + "/?e2e=1");
    await page.waitForFunction(() => globalThis.__paperE2E?.state.provider?.synced);
    await selectionContextMenu(page, "claim", false);
    await page.locator('[data-editor-action="comment"]').click();
    const source = () => page.evaluate(() => globalThis.__paperE2E.state.view.state.doc.toString());
    const composingEnter = async (selector: string) => {
      const input = page.locator(selector);
      await input.dispatchEvent("compositionstart", { data: "" });
      await input.dispatchEvent("keydown", { key: "Enter", isComposing: true });
      await input.dispatchEvent("keydown", { key: "Enter" }); // IMEs without isComposing.
      assert.equal(await input.isVisible(), true);
      await input.dispatchEvent("compositionend", { data: "中文" });
      await input.dispatchEvent("keydown", { key: "Enter", keyCode: 229 }); // Safari ordering.
      assert.equal(await input.isVisible(), true);
    };
    await page.locator("#review-text").fill("中文评论");
    await composingEnter("#review-text");
    assert.equal(parseReviews(await source()).length, 0);
    await page.locator("#review-text").press("Shift+Enter");
    assert.equal(await page.locator("#review-dialog").isVisible(), true);
    await page.locator("#review-text").press("Enter");
    assert.equal(parseReviews(await source())[0].note, "中文评论");

    if (!await page.locator("#review-pane").isVisible()) await page.locator("#toggle-review").click();
    await page.locator(".review-item.comment").getByRole("button", { name: "Edit", exact: true }).click();
    await page.locator("#review-text").fill("修改后的评论");
    await composingEnter("#review-text");
    assert.equal(parseReviews(await source())[0].note, "中文评论");
    await page.locator("#review-text").press("Enter");
    assert.equal(parseReviews(await source())[0].note, "修改后的评论");

    await page.locator(".review-item.comment").getByRole("button", { name: "Reply", exact: true }).click();
    await page.locator(".comment-reply-form textarea").fill("中文回复");
    await composingEnter(".comment-reply-form textarea");
    assert.equal(parseReviews(await source())[0].replies.length, 0);
    await page.locator(".comment-reply-form textarea").press("Enter");
    assert.equal(parseReviews(await source())[0].replies[0].body, "中文回复");
  });
});

test("paragraph replacement re-anchors a thread, Resolve archives it, and Reopen survives reload", async () => {
  await withEditor(async ({ page, base }) => {
    const id = (await (await page.request.get(base + "/v1/projects")).json()).defaultProjectId;
    await page.request.put(base + "/v1/files?project=" + id + "&path=main.tex", { data: reviewed, headers: { "Content-Type": "text/plain" } });
    await page.goto(base + "/projects/" + id + "?e2e=1");
    await page.waitForFunction(() => globalThis.__paperE2E?.state.provider?.synced);
    await page.evaluate(() => {
      const view = globalThis.__paperE2E.state.view;
      view.dispatch({ selection: { anchor: 0, head: view.state.doc.length } });
      view.focus();
    });
    await page.keyboard.insertText("A clearer paragraph.");
    const source = async () => page.evaluate(() => globalThis.__paperE2E.state.view.state.doc.toString());
    assert.equal(parseReviews(await source())[0].body, "A clearer paragraph.");
    assert.equal(parseReviews(await source())[0].replies[0].body, "Agreed");
    await page.locator("#toggle-review").click();
    await page.locator(".review-item").getByRole("button", { name: "Resolve", exact: true }).click();
    await page.locator('.comment-archive[data-status="resolved"]').waitFor();
    const archived = parseArchivedComments(await source())[0];
    assert.equal(archived.body, "A clearer paragraph.");
    assert.equal(archived.replies[0].body, "Agreed");
    await page.locator("#suggest-edit").click();
    await page.evaluate(() => {
      const view = globalThis.__paperE2E.state.view;
      view.dispatch({ selection: { anchor: 0, head: view.state.doc.length } });
      view.focus();
    });
    await page.keyboard.insertText("A suggested paragraph.");
    assert.equal(parseArchivedComments(await source()).length, 1, "suggestions preserve hidden discussion history");
    const suggestion = page.locator(".review-item").filter({ has: page.getByRole("button", { name: "Reject", exact: true }) });
    await suggestion.getByRole("button", { name: "Reject", exact: true }).click();
    assert.equal(stripReviewStorage(await source()), "A clearer paragraph.");
    await page.locator("#suggest-edit").click();
    await page.waitForFunction(() => document.querySelector("#sync-state")?.textContent === "Saved live");
    await page.reload();
    await page.waitForFunction(() => globalThis.__paperE2E?.state.provider?.synced);
    if (!await page.locator("#review-pane").isVisible()) await page.locator("#toggle-review").click();
    const history = page.locator('.comment-archive[data-status="resolved"]');
    await history.locator("summary").click();
    await history.getByRole("button", { name: "Reopen", exact: true }).click();
    await page.locator(".review-item.comment").waitFor();
    assert.equal(parseArchivedComments(await source()).length, 0);
    assert.equal(parseReviews(await source())[0].replies[0].body, "Agreed");
    assert.equal(stripReviewStorage(await source()), "A clearer paragraph.");
  });
});

test("Markdown comment edits, replies and suggestions keep portable storage", async () => {
  await withEditor(async ({ page, base }) => {
    const id = (await (await page.request.get(base + "/v1/projects")).json()).defaultProjectId;
    await page.request.put(base + "/v1/files?project=" + id + "&path=notes.md", { data: reviewed, headers: { "Content-Type": "text/plain" } });
    await page.goto(base + "/projects/" + id + "?e2e=1");
    await page.waitForFunction(() => globalThis.__paperE2E?.state.provider?.synced);
    await page.locator('[data-tree-path="notes.md"]').click();
    await page.waitForFunction(() => globalThis.__paperE2E.state.activeFile === "notes.md" && globalThis.__paperE2E.state.provider?.synced);
    await page.locator("#toggle-review").click();
    await page.locator(".review-item.comment").getByRole("button", { name: "Edit", exact: true }).click();
    await page.locator("#review-text").fill("Keep {braces} --> 中文");
    await page.locator("#review-text").press("Enter");
    await page.locator(".review-item.comment").getByRole("button", { name: "Reply", exact: true }).click();
    await page.locator(".comment-reply-form textarea").fill("Reply --> safely");
    await page.locator(".comment-reply-form textarea").press("Enter");
    const source = await page.evaluate(() => globalThis.__paperE2E.state.view.state.doc.toString());
    assert.doesNotMatch(source, /\\cmtbg|\\cmted|\\cmtrpl/);
    assert.equal(parseReviews(source)[0].note, "Keep {braces} --> 中文");
    assert.equal(parseReviews(source)[0].replies.at(-1)?.body, "Reply --> safely");
    await page.locator("#markdown-rendered").click();
    assert.equal(await page.locator("#markdown-preview").innerText(), "Before old claim after");
    await page.locator("#markdown-source").click();
    await page.locator("#suggest-edit").click();
    await page.evaluate(() => {
      const view = globalThis.__paperE2E.state.view;
      view.dispatch({ selection: { anchor: 0 } }); view.focus();
    });
    await page.keyboard.insertText("Suggested ");
    const suggested = await page.evaluate(() => globalThis.__paperE2E.state.view.state.doc.toString());
    assert.equal(parseReviews(suggested)[0].kind, "addition");
    assert.equal(parseReviews(suggested)[0].format, "markdown");
    assert.doesNotMatch(suggested, /\\addbg|\\added/);
    await page.waitForFunction(() => document.querySelector("#sync-state")?.textContent === "Saved live");
    const stored = await (await page.request.get(base + "/v1/files?project=" + id + "&path=notes.md")).text();
    assert.equal(stored, suggested);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: "/tmp/latexcoder-portable-comments-mobile.png" });
  });
});
