import assert from "node:assert/strict";
import test from "node:test";
import { EditorSelection, EditorState } from "@codemirror/state";
import { mapCommentEdit } from "../src/client/comment-edits.ts";
import { parseReviews, stripReviewStorage } from "../src/shared/review.ts";

const opening = "\\cmtbg{thread}{Ada}";
const closing = "\\cmted{Clarify this \\cmtrpl{reply}{Bob}{Agreed}}";
const source = `Before ${opening}brave world${closing} after`;
const bodyFrom = source.indexOf("brave"), bodyTo = bodyFrom + "brave world".length;

function edit(from: number, to: number, insert = "", text = source) {
  const state = EditorState.create({ doc: text, selection: { anchor: from, head: to } });
  const transaction = state.update({ changes: { from, to, insert }, selection: { anchor: from + insert.length }, userEvent: "input.type" });
  const mapped = mapCommentEdit(transaction, parseReviews(text))!;
  const result = state.update(transaction, { changes: mapped.correction, selection: mapped.selection, sequential: true });
  assert.equal(result.newDoc.toString(), mapped.changes.apply(state.doc).toString());
  return { text: result.newDoc.toString(), selection: result.newSelection };
}

test("comment edits map across either boundary without losing thread metadata", () => {
  const left = edit(0, bodyFrom + 3);
  assert.equal(left.text, `${opening}ve world${closing} after`);
  assert.equal(stripReviewStorage(left.text), "ve world after");
  assert.equal(left.selection.main.head, 0);
  const right = edit(bodyFrom + 6, source.length, "earth");
  assert.equal(right.text, `Before ${opening}brave earth${closing}`);
  assert.equal(stripReviewStorage(right.text), "Before brave earth");
  const thread = parseReviews(right.text)[0];
  assert.equal(thread.id, "thread");
  assert.equal(thread.replies[0].body, "Agreed");
  assert.equal(right.selection.main.head, thread.bodyTo);
});

test("deleting all annotated text removes its comment and replacing it preserves the thread", () => {
  assert.equal(edit(bodyFrom, bodyTo).text, "Before  after");
  assert.equal(edit(0, source.length).text, "");
  assert.equal(edit(bodyFrom, bodyTo, "replacement").text, `Before ${opening}replacement${closing} after`);
  assert.equal(edit(0, source.length, "replacement").text, "replacement");
});

test("typing or pasting at a hidden marker maps to the visible text boundary", () => {
  assert.equal(edit(bodyFrom - 2, bodyFrom - 2, "Hi ").text, `Before ${opening}Hi brave world${closing} after`);
  assert.equal(edit(bodyTo + 3, bodyTo + 3, "!").text, `Before ${opening}brave world!${closing} after`);
});

test("multiple edits and reversed selections keep mapped caret positions", () => {
  const state = EditorState.create({ doc: source, extensions: EditorState.allowMultipleSelections.of(true) });
  const transaction = state.update({
    changes: [{ from: 0, to: bodyFrom + 2 }, { from: bodyFrom + 6, to: source.length, insert: "earth" }],
    selection: EditorSelection.create([EditorSelection.cursor(0), EditorSelection.range(5, 1)], 1),
  });
  const mapped = mapCommentEdit(transaction, parseReviews(source))!;
  assert.equal(stripReviewStorage(mapped.changes.apply(state.doc).toString()), "ave earth");
  assert.equal(mapped.selection.ranges.length, 2);
  assert.equal(mapped.selection.mainIndex, 1);
  assert.ok(mapped.selection.main.anchor > mapped.selection.main.head);
});

test("one deletion can span several comments while preserving the remaining thread", () => {
  const text = `${opening}one${closing} gap \\cmtbg{second}{Bob}two\\cmted{Note} tail`;
  const result = edit(0, text.indexOf("two") + 1, "", text).text;
  assert.equal(result, "\\cmtbg{second}{Bob}wo\\cmted{Note} tail");
});

test("Backspace and Delete at hidden storage delete a visible Unicode grapheme", () => {
  const text = `👩‍💻${opening}é${closing}👋`;
  const comment = parseReviews(text)[0];
  for (const backward of [true, false]) {
    const from = backward ? comment.bodyFrom - 1 : comment.bodyTo;
    const to = from + 1;
    const state = EditorState.create({ doc: text, selection: { anchor: backward ? to : from } });
    const transaction = state.update({ changes: { from, to }, userEvent: backward ? "delete.backward" : "delete.forward" });
    const mapped = mapCommentEdit(transaction, [comment])!;
    const result = mapped.changes.apply(state.doc).toString();
    assert.equal(stripReviewStorage(result), backward ? "é👋" : "👩‍💻é");
    assert.equal(parseReviews(result)[0].body, "é");
  }
});

test("deleting a last annotated grapheme cleans up storage and leaves no dangling markers", () => {
  const text = `${opening}👩‍💻${closing}`;
  const item = parseReviews(text)[0];
  assert.equal(edit(item.bodyFrom, item.bodyTo, "", text).text, "");
});

test("arbitrary replacements match the visible source projection across multiple threads", () => {
  const text = `A${opening}one${closing} gap \\cmtbg{second}{Bob}two\\cmted{Note}Z`;
  const comments = parseReviews(text);
  const hidden = comments.flatMap(item => [{ from: item.from, to: item.bodyFrom }, { from: item.bodyTo, to: item.to }]);
  const visibleOffset = (position: number) => position - hidden.reduce((count, range) => count + Math.max(0, Math.min(position, range.to) - range.from), 0);
  const positions = [0, text.length, ...comments.flatMap(item => [item.from, item.from + 1, item.bodyFrom - 1,
    item.bodyFrom, item.bodyFrom + 1, item.bodyTo - 1, item.bodyTo, item.bodyTo + 1, item.to - 1, item.to])].sort((a, b) => a - b);
  const visible = stripReviewStorage(text);
  for (const from of positions) for (const to of positions.filter(position => position >= from)) {
    for (const insert of ["", "new\ntext", "😀"]) {
      const edited = edit(from, to, insert, text);
      const result = edited.text;
      assert.equal(stripReviewStorage(result), visible.slice(0, visibleOffset(from)) + insert + visible.slice(visibleOffset(to)),
        `edit ${from}:${to} inserting ${JSON.stringify(insert)}`);
      for (const item of parseReviews(result)) assert.ok(comments.some(original => original.id === item.id && original.note === item.note));
      const head = edited.selection.main.head;
      const hiddenBeforeHead = parseReviews(result).flatMap(item => [
        { from: item.from, to: item.bodyFrom }, { from: item.bodyTo, to: item.to },
      ]).reduce((count, range) => count + Math.max(0, Math.min(head, range.to) - range.from), 0);
      assert.equal(head - hiddenBeforeHead, visibleOffset(from) + insert.length, "caret follows the visible replacement");
    }
  }
});
