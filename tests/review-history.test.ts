import assert from "node:assert/strict";
import test from "node:test";
import * as Y from "yjs";
import { marked } from "marked";
import { archiveComment, normalizeMarkdownReviews, parseArchivedComments, parseReviews, reviewMarkers, reviewReply, stripReviewStorage } from "../src/shared/review.ts";
import { compileSourceMap } from "../src/shared/source-map.ts";
import { reopenCommentChanges } from "../src/shared/comment-history.ts";

const legacy = "\\cmtbg{t1}{Ada}claim\\cmted{Question\\cmtrpl{r1}{Bob}{Answer}}";

test("Markdown storage hides metadata from ordinary renderers and preserves arbitrary Unicode notes", () => {
  const note = "中文 --> {brace} \\macro\nsecond line";
  const markers = reviewMarkers("comment", "t1", "Ada", "markdown", note, [{ id: "r1", author: "Bob", body: "Answer -->" }]);
  const source = "A " + markers.opening + "claim" + markers.closing + ".";
  const item = parseReviews(source)[0];
  assert.equal(item.body, "claim");
  assert.equal(item.note, note);
  assert.equal(item.replies[0].body, "Answer -->");
  assert.equal(stripReviewStorage(source), "A claim.");
  const rendered = (marked.parse(source, { async: false }) as string).replace(/<!--[\s\S]*?-->/g, "");
  assert.match(rendered, /A claim/);
  assert.doesNotMatch(rendered, /latexcoder|Question|macro|Answer/);
});

test("legacy Markdown reviews migrate without changing visible content or replies", () => {
  const normalized = normalizeMarkdownReviews(legacy, "notes.md");
  assert.doesNotMatch(normalized, /\\cmtbg|\\cmted|\\cmtrpl/);
  assert.equal(stripReviewStorage(normalized), "claim");
  assert.equal(parseReviews(normalized)[0].replies[0].body, "Answer");
  assert.equal(normalizeMarkdownReviews(normalized, "notes.md"), normalized);
  assert.equal(normalizeMarkdownReviews(legacy, "main.tex"), legacy);
  for (const kind of ["addition", "deletion", "revision"] as const) {
    const markers = reviewMarkers(kind, "s1", "Ada", "markdown", "old");
    const source = markers.opening + "new" + markers.closing;
    assert.equal(parseReviews(source)[0].kind, kind);
    assert.equal(stripReviewStorage(source), kind === "deletion" ? "" : "new");
  }
});

test("concurrent Markdown replies remain separate, complete records", () => {
  const source = normalizeMarkdownReviews(legacy, "notes.md");
  const base = new Y.Doc();
  base.getText("content").insert(0, source);
  const left = new Y.Doc(), right = new Y.Doc();
  Y.applyUpdate(left, Y.encodeStateAsUpdate(base));
  Y.applyUpdate(right, Y.encodeStateAsUpdate(base));
  const at = parseReviews(source)[0].replyInsertAt!;
  left.getText("content").insert(at, reviewReply({ id: "left", author: "L", body: "One" }, "markdown"));
  right.getText("content").insert(at, reviewReply({ id: "right", author: "R", body: "Two" }, "markdown"));
  Y.applyUpdate(left, Y.encodeStateAsUpdate(right));
  Y.applyUpdate(right, Y.encodeStateAsUpdate(left));
  assert.equal(left.getText("content").toString(), right.getText("content").toString());
  const thread = parseReviews(left.getText("content").toString())[0];
  assert.equal(thread.repliesValid, true);
  assert.deepEqual(new Set(thread.replies.map(reply => reply.body)), new Set(["Answer", "One", "Two"]));
  for (const doc of [base, left, right]) doc.destroy();
});

test("archived threads preserve replies, do not affect compilation, and reopen only at a unique free quote", () => {
  for (const format of ["tex", "markdown"] as const) {
    const archive = archiveComment(parseReviews(legacy)[0], "resolved", "Lin", format);
    const source = "A claim." + archive;
    const thread = parseArchivedComments(source)[0];
    assert.equal(thread.changedBy, "Lin");
    assert.equal(thread.replies[0].body, "Answer");
    assert.equal(stripReviewStorage(source), "A claim.");
    assert.equal(compileSourceMap(source).text, "A claim.");
    const changes = reopenCommentChanges(source, thread, format)!;
    assert.ok(changes);
    let reopened = source;
    for (const change of [...changes].reverse()) reopened = reopened.slice(0, change.from) + change.insert + reopened.slice(change.to);
    assert.equal(parseArchivedComments(reopened).length, 0);
    assert.equal(parseReviews(reopened)[0].replies[0].body, "Answer");
    assert.equal(stripReviewStorage(reopened), "A claim.");
    for (const text of ["Missing.", "claim claim", legacy]) {
      const ambiguous = text + archive;
      assert.equal(reopenCommentChanges(ambiguous, parseArchivedComments(ambiguous)[0], format), null);
    }
  }
});
