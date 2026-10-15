import assert from "node:assert/strict";
import test from "node:test";
import { withEditor, createEditor, editorState, setCursor } from "./helpers/browser.ts";

const opening = "\\cmtbg{thread}{Ada}";
const closing = "\\cmted{Check this \\cmtrpl{reply}{Bob}{Agreed}}";
const source = `Before ${opening}brave world${closing} after`;
const bodyFrom = source.indexOf("brave"), bodyTo = bodyFrom + "brave world".length;

test("normal keyboard edits cross comment boundaries and undo restores the complete thread", async () => {
  await withEditor(async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    await createEditor(page, source);
    await page.evaluate(() => { globalThis.__paperTest.state.suggesting = false; });
    await page.evaluate(([from, to]) => {
      const view = globalThis.__paperTest.state.view;
      view.dispatch({ selection: { anchor: to, head: from } });
      view.focus();
    }, [0, bodyFrom + 3]);
    await page.keyboard.press("Backspace");
    assert.equal((await editorState(page)).doc, `${opening}ve world${closing} after`);
    assert.equal((await editorState(page)).head, 0);
    assert.doesNotMatch(await page.locator("#toast").innerText(), /Use Review actions/);
    await page.keyboard.press("ControlOrMeta+z");
    assert.equal((await editorState(page)).doc, source);
    await page.keyboard.press("ControlOrMeta+Shift+z");
    assert.equal((await editorState(page)).doc, `${opening}ve world${closing} after`);
    assert.deepEqual(errors, []);
  });
});

test("replacement keeps the comment but deleting its entire body removes the thread", async () => {
  await withEditor(async ({ page }) => {
    await createEditor(page, source);
    await page.evaluate(() => { globalThis.__paperTest.state.suggesting = false; });
    await page.evaluate(([anchor, head]) => {
      const view = globalThis.__paperTest.state.view;
      view.dispatch({ selection: { anchor, head } }); view.focus();
    }, [bodyFrom, bodyTo]);
    await page.keyboard.insertText("new text");
    assert.equal((await editorState(page)).doc, `Before ${opening}new text${closing} after`);
    await page.keyboard.type("!");
    assert.equal((await editorState(page)).doc, `Before ${opening}new text!${closing} after`);
    await page.evaluate(([anchor, head]) => {
      const view = globalThis.__paperTest.state.view;
      view.dispatch({ selection: { anchor, head } }); view.focus();
    }, [bodyFrom, bodyFrom + "new text!".length]);
    await page.keyboard.press("Delete");
    assert.equal((await editorState(page)).doc, "Before  after");
    assert.equal(await page.locator(".cm-review-comment").count(), 0);
  });
});

test("Backspace and Delete beside hidden markers edit neighbouring visible text", async () => {
  await withEditor(async ({ page }) => {
    await createEditor(page, source);
    await page.evaluate(() => { globalThis.__paperTest.state.suggesting = false; });
    await setCursor(page, bodyFrom);
    await page.keyboard.press("Backspace");
    assert.equal((await editorState(page)).doc, `Before${opening}brave world${closing} after`);
    await setCursor(page, bodyTo - 1);
    await page.keyboard.press("Delete");
    assert.equal((await editorState(page)).doc, `Before${opening}brave world${closing}after`);
    await page.keyboard.press("ControlOrMeta+a");
    await page.keyboard.press("Backspace");
    assert.equal((await editorState(page)).doc, "");
    await page.keyboard.press("ControlOrMeta+z");
    assert.equal((await editorState(page)).doc, source);
  });
});

test("mapped comment edits sync to collaborators and undo preserves remote edits", async () => {
  await withEditor(async ({ page, browser, base }) => {
    const { defaultProjectId: id } = await (await page.request.get(`${base}/v1/projects`)).json();
    await page.request.put(`${base}/v1/files?project=${id}&path=main.tex`, { data: source, headers: { "Content-Type": "text/plain" } });
    await page.goto(`${base}/projects/${id}?e2e=1`);
    await page.waitForFunction(() => globalThis.__paperE2E?.state.provider?.synced);
    const other = await browser.newPage();
    try {
      await other.goto(page.url());
      await other.waitForFunction(() => globalThis.__paperE2E?.state.provider?.synced);
      await page.evaluate(to => {
        const view = globalThis.__paperE2E.state.view;
        view.dispatch({ selection: { anchor: 0, head: to } }); view.focus();
      }, bodyFrom + 3);
      await page.keyboard.press("Backspace");
      const edited = `${opening}ve world${closing} after`;
      await other.waitForFunction(expected => globalThis.__paperE2E.state.view.state.doc.toString() === expected, edited);
      await other.evaluate(() => {
        const view = globalThis.__paperE2E.state.view;
        view.dispatch({ changes: { from: view.state.doc.length, insert: " REMOTE" } });
      });
      await page.waitForFunction(expected => globalThis.__paperE2E.state.view.state.doc.toString() === expected, edited + " REMOTE");
      await page.keyboard.press("ControlOrMeta+z");
      await other.waitForFunction(expected => globalThis.__paperE2E.state.view.state.doc.toString() === expected, source + " REMOTE");
      await page.reload();
      await page.waitForFunction(expected => globalThis.__paperE2E?.state.provider?.synced && globalThis.__paperE2E.state.view.state.doc.toString() === expected, source + " REMOTE");
    } finally { await other.close(); }
  });
});
