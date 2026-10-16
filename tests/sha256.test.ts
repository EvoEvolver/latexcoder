import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import { sha256Hex } from "../src/shared/sha256.ts";

test("sha256Hex matches Node's digest for ASCII, multi-byte text, and block boundaries", () => {
  const samples = ["", "abc", "a".repeat(55), "a".repeat(56), "a".repeat(63), "a".repeat(64), "a".repeat(65), "中文 — ünïcödé 🎉\n".repeat(37), "x".repeat(100_000)];
  for (const sample of samples) assert.equal(sha256Hex(sample), createHash("sha256").update(sample).digest("hex"), JSON.stringify(sample.slice(0, 20)) + sample.length);
  assert.equal(sha256Hex(new Uint8Array([1, 2, 3])), createHash("sha256").update(new Uint8Array([1, 2, 3])).digest("hex"));
});
