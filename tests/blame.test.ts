import assert from "node:assert/strict";
import test from "node:test";
import * as Y from "yjs";
import { attributedRuns, readBlameAttributes, LEGACY_CHANGE_ID } from "../src/shared/blame.ts";
import { attributeLocalEdits, blameRunsOf, createBlameChangeStore, BLAME_LOCAL_ORIGIN } from "../src/client/blame.ts";

test("attributed runs cover the text and fall back to legacy authorship", () => {
  const text = new Y.Doc().getText("content");
  text.insert(0, "abc", { lcAuthorId: "alice", lcAuthorName: "Alice", lcChangeId: "c1" });
  text.insert(3, "def");
  text.insert(6, "ghi", { lcChangeId: "c2" });
  // The unattributed insertion inherited Alice's attributes and merged into her run.
  assert.deepEqual(attributedRuns(text.toDelta()), [
    { changeId: "c1", authorId: "alice", authorName: "Alice", from: 0, to: 6 },
    { changeId: "c2", authorId: "legacy", authorName: "Existing content", from: 6, to: 9 },
  ]);
  assert.equal(readBlameAttributes(undefined), null);
  assert.equal(readBlameAttributes({ lcChangeId: 3 }), null);
});

test("local insertions are attributed to the current user, remote ones are left alone", async () => {
  const doc = new Y.Doc();
  const text = doc.getText("content");
  text.insert(0, "Alice wrote this. ", { lcAuthorId: "alice", lcAuthorName: "Alice", lcChangeId: "c-alice" });
  const stop = attributeLocalEdits(text, () => ({ authorId: "bob", authorName: "Bob" }));
  // Typing right after Alice's text inherits her attributes in Yjs; the attributor overrides them.
  const settle = () => new Promise(resolve => setTimeout(resolve, 0));
  doc.transact(() => text.insert(text.length, "Bob typed."), "editor");
  await settle();
  let runs = attributedRuns(text.toDelta());
  assert.deepEqual(runs.map(run => [run.authorId, text.toString().slice(run.from, run.to)]), [["alice", "Alice wrote this. "], ["bob", "Bob typed."]]);
  const first = runs[1].changeId;
  assert.match(first, /^ch_[0-9a-f]{32}$/);
  doc.transact(() => text.insert(text.length, " More."), "editor");
  await settle();
  runs = attributedRuns(text.toDelta());
  assert.equal(runs.length, 2, "consecutive typing shares a change id and merges into one run");
  assert.equal(runs[1].changeId, first);

  // A remote update carrying Carol's attribution keeps it.
  const remote = new Y.Doc();
  Y.applyUpdate(remote, Y.encodeStateAsUpdate(doc));
  remote.getText("content").insert(0, "Carol: ", { lcAuthorId: "carol", lcAuthorName: "Carol", lcChangeId: "c-carol" });
  Y.applyUpdate(doc, Y.encodeStateAsUpdate(remote, Y.encodeStateVector(doc)), "provider");
  await settle();
  runs = attributedRuns(text.toDelta());
  assert.equal(runs[0].authorId, "carol");
  assert.equal(runs.filter(run => run.authorId === "bob").length, 1);

  // Two edits in one tick: the second shifts the first, yet both get attributed where they are.
  doc.transact(() => text.insert(text.length, " Tail."), "editor");
  doc.transact(() => text.insert(0, "Head. "), "editor");
  await settle();
  runs = attributedRuns(text.toDelta());
  assert.equal(runs[0].authorId, "bob");
  assert.equal(text.toString().slice(runs[0].from, runs[0].to), "Head. ");
  assert.equal(runs.at(-1)!.authorId, "bob");
  stop();
  doc.transact(() => text.insert(text.length, " Unattributed."), "editor");
  await settle();
  const last = attributedRuns(text.toDelta()).at(-1)!;
  assert.equal(last.changeId, first, "after stopping, the insertion merely inherits its neighbour");
  assert.equal(blameRunsOf(text, new Map([[first, { authorId: "bob", authorName: "Bob", createdAt: 5, commit: "abc", gitAuthor: null }]])).find(run => run.changeId === first)?.commit, "abc");
  assert.equal(blameRunsOf(text, new Map()).find(run => run.changeId === LEGACY_CHANGE_ID), undefined);
  assert.equal(typeof BLAME_LOCAL_ORIGIN, "symbol");
});

test("the change store fetches unknown ids once and re-asks about uncommitted ones", async () => {
  const requested: string[][] = [];
  let updates = 0;
  let commit: string | null = null;
  const store = createBlameChangeStore(async ids => {
    requested.push(ids);
    return Object.fromEntries(ids.filter(id => id !== "unregistered").map(id => [id, { authorId: "a", authorName: "A", createdAt: 1, commit, gitAuthor: null }]));
  }, () => { updates += 1; });
  await store.ensure(["one", "two", "legacy", "unregistered"]);
  assert.deepEqual(requested, [["one", "two", "unregistered"]]);
  assert.equal(updates, 1);
  await store.ensure(["one", "two"]);
  assert.equal(requested.length, 1, "known ids are not fetched again");
  commit = "deadbeef";
  await store.refreshPending();
  assert.deepEqual(requested[1], ["one", "two"]);
  assert.equal(store.changes.get("one")?.commit, "deadbeef");
  assert.equal(updates, 2);
  await store.refreshPending();
  assert.equal(requested.length, 2, "committed changes are settled");
});
