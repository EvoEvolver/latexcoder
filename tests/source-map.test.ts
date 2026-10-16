import assert from "node:assert/strict";
import test from "node:test";
import { compileSourceMap, followLine } from "../src/shared/source-map.ts";
import { stripReviewStorage } from "../src/shared/review.ts";

test("compile source map preserves projection and maps removed multiline review metadata", () => {
  const source = "Before\n\\cmtbg{one}{Name}Body\\cmted{Comment\non another line}\nAfter";
  const result = compileSourceMap(source);
  assert.equal(result.text, stripReviewStorage(source));
  assert.deepEqual(result.lines, [1, 2, 4]);
});

test("followLine carries a compiled line into the edited source", () => {
  const before = "a\nb\nc\nd\n";
  assert.equal(followLine(before, before, 3), 3);
  assert.equal(followLine(before, "new\nnew\na\nb\nc\nd\n", 3), 5, "lines inserted above shift it down");
  assert.equal(followLine(before, "b\nc\nd\n", 3), 2, "a deleted line above shifts it up");
  assert.equal(followLine(before, "a\nb\nC!\nd\n", 3), 3, "a rewritten line maps to its replacement");
  assert.equal(followLine(before, "a\nb\nd\n", 3), 3, "a deleted line maps to what follows");
  assert.equal(followLine(before, "a\n", 4), 2, "never past the end of the new text");
});
