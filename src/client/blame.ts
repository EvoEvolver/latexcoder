import * as Y from "yjs";
import { attributedRuns, blameAttributes, LEGACY_CHANGE_ID, newChangeId, readBlameAttributes, type AttributedRun, type BlameAttribution, type TextDeltaOp } from "../shared/blame.ts";
import type { BlameChangeInfo, BlameRun } from "../shared/api-schema.ts";

/** Origin of the formatting transactions this editor adds to its own insertions. */
export const BLAME_LOCAL_ORIGIN = Symbol("latexcoder-local-blame");

// Consecutive typing shares one change id; after this pause a new one starts,
// so a checkpoint in between attributes each run to the right commit.
const CHANGE_ID_IDLE_MS = 5_000;

export type BlameIdentity = { authorId: string; authorName: string };

/**
 * Attributes every local insertion to the current user, right in the Yjs
 * text. The server and every other editor see the attribution in the same
 * update stream as the text, so nobody has to ask who typed what.
 */
export function attributeLocalEdits(text: Y.Text, identity: () => BlameIdentity | null): () => void {
  let changeId = newChangeId();
  let lastInsertAt = 0;
  let stopped = false;
  const observer = (event: Y.YTextEvent, transaction: Y.Transaction) => {
    if (!transaction.local || transaction.origin === BLAME_LOCAL_ORIGIN) return;
    const who = identity();
    if (!who) return;
    const now = Date.now();
    if (now - lastInsertAt > CHANGE_ID_IDLE_MS) changeId = newChangeId();
    const attribution: BlameAttribution = { ...who, changeId };
    const ranges: Array<{ from: Y.RelativePosition; to: Y.RelativePosition }> = [];
    let index = 0;
    for (const operation of event.delta as TextDeltaOp[]) {
      if (operation.retain) index += operation.retain;
      if (typeof operation.insert === "string") {
        // Yjs copies the neighbouring formatting onto an insertion, so text
        // typed after someone else's would otherwise carry their name.
        const existing = readBlameAttributes(operation.attributes);
        const end = index + operation.insert.length;
        if (existing?.changeId !== changeId) {
          ranges.push({ from: Y.createRelativePositionFromTypeIndex(text, index, 0), to: Y.createRelativePositionFromTypeIndex(text, end, -1) });
        }
        index = end;
      }
    }
    if (!ranges.length) return;
    lastInsertAt = now;
    // The editor binding applies local edits from inside a CodeMirror update,
    // and the binding dispatches again for every other Yjs transaction, so
    // the formatting waits until that update has finished. Relative positions
    // keep the ranges right should anything else change the text first.
    queueMicrotask(() => {
      const doc = text.doc;
      if (stopped || !doc) return;
      doc.transact(() => {
        for (const range of ranges) {
          const from = Y.createAbsolutePositionFromRelativePosition(range.from, doc);
          const to = Y.createAbsolutePositionFromRelativePosition(range.to, doc);
          if (from && to && from.type === text && to.type === text && to.index > from.index) text.format(from.index, to.index - from.index, blameAttributes(attribution));
        }
      }, BLAME_LOCAL_ORIGIN);
    });
  };
  text.observe(observer);
  return () => { stopped = true; text.unobserve(observer); };
}

/** Authorship runs of the text, completed with what is known about each change. */
export function blameRunsOf(text: Y.Text, changes: ReadonlyMap<string, BlameChangeInfo>): BlameRun[] {
  return attributedRuns(text.toDelta() as TextDeltaOp[]).map((run: AttributedRun) => {
    const change = changes.get(run.changeId);
    return { ...run, createdAt: change?.createdAt ?? null, commit: change?.commit ?? null, gitAuthor: change?.gitAuthor ?? null };
  });
}

export type BlameChangeStore = {
  changes: ReadonlyMap<string, BlameChangeInfo>;
  /** Fetches the ids not known yet; resolves once they arrived. */
  ensure(ids: Iterable<string>): Promise<void>;
  /** Asks again about every change that has not reached a commit yet. */
  refreshPending(): Promise<void>;
};

/**
 * Remembers when each change was made and which commit it reached. Change
 * ids the server has not registered yet stay unknown and are asked for again
 * on the next refresh.
 */
export function createBlameChangeStore(fetchChanges: (ids: string[]) => Promise<Record<string, BlameChangeInfo>>, onUpdate: () => void): BlameChangeStore {
  const changes = new Map<string, BlameChangeInfo>();
  let inflight: Promise<void> | null = null;
  const fetchAll = async (ids: string[]) => {
    if (!ids.length) return;
    const result = await fetchChanges(ids);
    let changed = false;
    for (const [id, change] of Object.entries(result)) {
      const previous = changes.get(id);
      if (!previous || previous.commit !== change.commit || previous.createdAt !== change.createdAt) changed = true;
      changes.set(id, change);
    }
    if (changed) onUpdate();
  };
  const queued = async (ids: string[]) => {
    const run = (inflight ?? Promise.resolve()).then(() => fetchAll(ids));
    inflight = run.catch(() => {});
    return run;
  };
  return {
    changes,
    ensure: ids => queued([...new Set(ids)].filter(id => id !== LEGACY_CHANGE_ID && !changes.has(id))),
    refreshPending: () => queued([...changes].filter(([, change]) => !change.commit).map(([id]) => id)),
  };
}
