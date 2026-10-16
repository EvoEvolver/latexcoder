// Authorship travels inside the Yjs text as formatting attributes, so every
// editor holding the document can tell who wrote each run without asking the
// server. Editors attribute their own insertions (users are trusted not to
// forge them); the server registers the change ids it sees and later attaches
// the Git commit each one landed in.

export const BLAME_AUTHOR_ID = "lcAuthorId";
export const BLAME_AUTHOR_NAME = "lcAuthorName";
export const BLAME_CHANGE_ID = "lcChangeId";
export const LEGACY_CHANGE_ID = "legacy";
export const LEGACY_ACTOR = { id: "legacy", name: "Existing content" } as const;

export type BlameAttribution = { authorId: string; authorName: string; changeId: string };
export type TextDeltaOp = { retain?: number; delete?: number; insert?: string | object; attributes?: Record<string, unknown> };
export type AttributedRun = BlameAttribution & { from: number; to: number };

export function blameAttributes(attribution: BlameAttribution): Record<string, string> {
  return { [BLAME_AUTHOR_ID]: attribution.authorId, [BLAME_AUTHOR_NAME]: attribution.authorName, [BLAME_CHANGE_ID]: attribution.changeId };
}

/** The attribution carried by a delta operation, or null when it has none. */
export function readBlameAttributes(attributes: Record<string, unknown> | undefined): BlameAttribution | null {
  const changeId = attributes?.[BLAME_CHANGE_ID];
  if (typeof changeId !== "string" || !changeId) return null;
  const authorId = attributes?.[BLAME_AUTHOR_ID];
  const authorName = attributes?.[BLAME_AUTHOR_NAME];
  return {
    changeId,
    authorId: typeof authorId === "string" && authorId ? authorId : LEGACY_ACTOR.id,
    authorName: typeof authorName === "string" && authorName ? authorName : LEGACY_ACTOR.name,
  };
}

/** Splits a Y.Text delta into attributed runs covering the whole text. */
export function attributedRuns(delta: TextDeltaOp[]): AttributedRun[] {
  const runs: AttributedRun[] = [];
  let from = 0;
  for (const operation of delta) {
    if (typeof operation.insert !== "string") continue;
    const to = from + operation.insert.length;
    const attribution = readBlameAttributes(operation.attributes) ?? { changeId: LEGACY_CHANGE_ID, ...{ authorId: LEGACY_ACTOR.id, authorName: LEGACY_ACTOR.name } };
    runs.push({ ...attribution, from, to });
    from = to;
  }
  return runs;
}

export function newChangeId(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return `ch_${Array.from(bytes, byte => byte.toString(16).padStart(2, "0")).join("")}`;
}
