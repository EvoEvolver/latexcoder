export type ReviewReply = { id: string; author: string; body: string };
export type ReviewMessage = ReviewReply & { root: boolean };
export type ReviewKind = "comment" | "revision" | "addition" | "deletion";
export type ReviewFormat = "tex" | "markdown";
export type ReviewItem = {
  kind: ReviewKind; id: string; author: string; body: string; note: string;
  replies: ReviewReply[]; repliesValid: boolean; messages: ReviewMessage[];
  format?: "markdown";
  from: number; bodyFrom: number; bodyTo: number; noteFrom: number | null; noteTo: number | null; replyInsertAt: number | null; to: number;
};

function parseBraced(source: string, start: number): { value: string; end: number } | null {
  if (source[start] !== "{") return null;
  let depth = 1;
  for (let index = start + 1; index < source.length; index += 1) {
    if (source[index] === "\\") {
      index += 1;
      continue;
    }
    if (source[index] === "{") depth += 1;
    if (source[index] === "}") depth -= 1;
    if (depth === 0) return { value: source.slice(start + 1, index), end: index + 1 };
  }
  return null;
}

function parseCommentNote(note: string, threadId: string, rootAuthor: string) {
  const opening = "\\cmtrpl";
  const firstReply = note.indexOf(opening);
  const rootBody = firstReply < 0 ? note : note.slice(0, firstReply).trimEnd();
  const replies: ReviewReply[] = [];
  let valid = true;
  let cursor = firstReply;
  while (cursor >= 0 && cursor < note.length) {
    while (/\s/.test(note[cursor] || "")) cursor += 1;
    if (cursor >= note.length) break;
    if (!note.startsWith(opening, cursor)) {
      valid = false;
      break;
    }
    const id = parseBraced(note, cursor + opening.length);
    const author = id && parseBraced(note, id.end);
    const body = author && parseBraced(note, author.end);
    if (!id || !author || !body || !id.value || replies.some(reply => reply.id === id.value)) {
      valid = false;
      break;
    }
    replies.push({ id: id.value, author: author.value, body: body.value });
    cursor = body.end;
  }
  return {
    note: rootBody,
    replies,
    repliesValid: valid,
    messages: [
      { id: threadId, author: rootAuthor, body: rootBody, root: true },
      ...replies.map(reply => ({ ...reply, root: false })),
    ],
  };
}

function parseReviewKind(source: string, kind: ReviewKind, opening: string, closing: string, closingHasArgument: boolean): ReviewItem[] {
  const items: ReviewItem[] = [];
  let cursor = 0;
  while (cursor < source.length) {
    const from = source.indexOf(opening, cursor);
    if (from < 0) break;
    const id = parseBraced(source, from + opening.length);
    const author = id && parseBraced(source, id.end);
    if (!id || !author) { cursor = from + opening.length; continue; }
    const closeAt = source.indexOf(closing, author.end);
    if (closeAt < 0) break;
    const note = closingHasArgument ? parseBraced(source, closeAt + closing.length) : null;
    if (closingHasArgument && !note) { cursor = closeAt + closing.length; continue; }
    // Empty groups delimit no-argument control words from following letters.
    // Consume them as storage while still accepting legacy ungrouped endings.
    const emptyGroupEnd = !closingHasArgument && source.startsWith("{}", closeAt + closing.length)
      ? closeAt + closing.length + 2
      : closeAt + closing.length;
    const to = note?.end ?? emptyGroupEnd;
    const comment = kind === "comment"
      ? parseCommentNote(note?.value ?? "", id.value, author.value)
      : null;
    items.push({
      kind,
      id: id.value,
      author: author.value,
      body: source.slice(author.end, closeAt),
      note: comment?.note ?? note?.value ?? "",
      replies: comment?.replies ?? [],
      repliesValid: comment?.repliesValid ?? true,
      messages: comment?.messages ?? [],
      from,
      bodyFrom: author.end,
      bodyTo: closeAt,
      noteFrom: note ? closeAt + closing.length + 1 : null,
      noteTo: note ? closeAt + closing.length + 1 + (comment?.note.length ?? note.value.length) : null,
      replyInsertAt: note ? note.end - 1 : null,
      to,
    });
    cursor = to;
  }
  return items;
}

export function parseReviews(source: string): ReviewItem[] {
  return [
    ...parseReviewKind(source, "comment", "\\cmtbg", "\\cmted", true),
    ...parseReviewKind(source, "revision", "\\revbg", "\\reved", true),
    ...parseReviewKind(source, "addition", "\\addbg", "\\added", false),
    ...parseReviewKind(source, "deletion", "\\delbg", "\\deled", false),
    ...parseMarkdownReviews(source),
  ]
    .sort((left, right) => left.from - right.from);
}

const reviewNames = {
  comment: ["cmtbg", "cmted"], revision: ["revbg", "reved"],
  addition: ["addbg", "added"], deletion: ["delbg", "deled"],
} as const;
export function reviewFormat(file: string): ReviewFormat { return /\.(md|markdown)$/i.test(file) ? "markdown" : "tex"; }
export function encodeReviewValue(value: unknown): string { return encodeURIComponent(JSON.stringify(value)).replaceAll("-", "%2D"); }
function markdownMarker(name: string, value: unknown): string {
  return "<!--latexcoder:" + name + ":" + encodeReviewValue(value) + "-->";
}
export function reviewReply(reply: ReviewReply, format: ReviewFormat): string {
  return format === "markdown" ? markdownMarker("reply", reply) : "\\cmtrpl{" + reply.id + "}{" + reply.author + "}{" + reply.body + "}";
}
export function reviewMarkers(kind: ReviewKind, id: string, author: string, format: ReviewFormat, note = "", replies: ReviewReply[] = []) {
  const [opening, closing] = reviewNames[kind];
  if (format === "markdown") return {
    opening: markdownMarker(opening, { id, author }),
    closing: markdownMarker(closing, note) + replies.map(reply => reviewReply(reply, format)).join(""),
  };
  return {
    opening: "\\" + opening + "{" + id + "}{" + author + "}",
    closing: "\\" + closing + (kind === "comment" || kind === "revision"
      ? "{" + note + replies.map(reply => reviewReply(reply, format)).join("") + "}" : "{}"),
  };
}

function parseMarkdownReviews(source: string): ReviewItem[] {
  const result: ReviewItem[] = [];
  const starts = /<!--latexcoder:(cmtbg|revbg|addbg|delbg):([^\r\n]*?)-->/g;
  for (let match; (match = starts.exec(source));) {
    try {
      const metadata: unknown = JSON.parse(decodeURIComponent(match[2]));
      if (!metadata || typeof metadata !== "object" || !("id" in metadata) || !("author" in metadata)
        || typeof metadata.id !== "string" || typeof metadata.author !== "string") continue;
      const kind = (Object.keys(reviewNames) as ReviewKind[]).find(kind => reviewNames[kind][0] === match[1])!;
      const closing = "<!--latexcoder:" + reviewNames[kind][1] + ":";
      const closeAt = source.indexOf(closing, starts.lastIndex);
      const end = closeAt < 0 ? -1 : source.indexOf("-->", closeAt + closing.length);
      if (end < 0) continue;
      const note: unknown = JSON.parse(decodeURIComponent(source.slice(closeAt + closing.length, end)));
      if (typeof note !== "string") continue;
      let to = end + 3, valid = true;
      const replies: ReviewReply[] = [];
      while (kind === "comment" && source.startsWith("<!--latexcoder:reply:", to)) {
        const replyEnd = source.indexOf("-->", to + 20);
        if (replyEnd < 0) { valid = false; break; }
        const value: unknown = JSON.parse(decodeURIComponent(source.slice(to + "<!--latexcoder:reply:".length, replyEnd)));
        if (!value || typeof value !== "object" || !("id" in value) || !("author" in value) || !("body" in value)
          || typeof value.id !== "string" || typeof value.author !== "string" || typeof value.body !== "string"
          || !value.id || replies.some(reply => reply.id === value.id)) { valid = false; break; }
        replies.push({ id: value.id, author: value.author, body: value.body });
        to = replyEnd + 3;
      }
      result.push({
        kind, id: metadata.id, author: metadata.author, body: source.slice(starts.lastIndex, closeAt), note,
        replies, repliesValid: valid, messages: kind === "comment" ? [
          { id: metadata.id, author: metadata.author, body: note, root: true },
          ...replies.map(reply => ({ ...reply, root: false })),
        ] : [], format: "markdown", from: match.index, bodyFrom: starts.lastIndex, bodyTo: closeAt,
        noteFrom: closeAt + closing.length, noteTo: end, replyInsertAt: to, to,
      });
      starts.lastIndex = to;
    } catch { /* Keep malformed storage visible so it can be repaired. */ }
  }
  return result;
}

export function normalizeMarkdownReviews(source: string, file: string): string {
  if (reviewFormat(file) !== "markdown") return source;
  let result = source;
  for (const item of parseReviews(source).reverse()) {
    if (item.format === "markdown" || !item.repliesValid) continue;
    const markers = reviewMarkers(item.kind, item.id, item.author, "markdown", item.note, item.replies);
    result = result.slice(0, item.from) + markers.opening + item.body + markers.closing + result.slice(item.to);
  }
  for (const item of parseArchivedComments(result).reverse()) {
    if (result.startsWith("<!--", item.from)) continue;
    const { from, to, ...record } = item;
    result = result.slice(0, from) + markdownMarker("thread", record) + result.slice(to);
  }
  return result;
}

export type ArchivedComment = {
  id: string; author: string; body: string; note: string; replies: ReviewReply[];
  status: "resolved" | "detached"; changedAt: string; changedBy: string;
  from: number; to: number;
};

export function archiveComment(item: Pick<ReviewItem, "id" | "author" | "body" | "note" | "replies">, status: ArchivedComment["status"], changedBy: string, format: ReviewFormat): string {
  const payload = encodeReviewValue({
    id: item.id, author: item.author, body: item.body, note: item.note, replies: item.replies,
    status, changedAt: new Date().toISOString(), changedBy,
  });
  return format === "markdown" ? "<!--latexcoder:thread:" + payload + "-->" : "\n% latexcoder:thread:" + payload + "\n";
}

export function parseArchivedComments(source: string): ArchivedComment[] {
  const records: ArchivedComment[] = [];
  const markers = /\r?\n% latexcoder:thread:([^\r\n]*)(?:\r?\n)?|<!--latexcoder:thread:([^\r\n]*?)-->/g;
  for (const match of source.matchAll(markers)) {
    try {
      const value = JSON.parse(decodeURIComponent(match[1] ?? match[2]));
      if (!value || !["id", "author", "body", "note", "changedAt", "changedBy"].every(key => typeof value[key] === "string")
        || !["resolved", "detached"].includes(value.status) || !Array.isArray(value.replies)
        || !value.replies.every((reply: Record<string, unknown>) => reply && typeof reply === "object" && ["id", "author", "body"].every(key => typeof reply[key] === "string"))) continue;
      records.push({
        id: value.id, author: value.author, body: value.body, note: value.note, replies: value.replies,
        status: value.status, changedAt: value.changedAt, changedBy: value.changedBy,
        from: match.index, to: match.index + match[0].length,
      });
    } catch { /* Leave malformed records visible and recoverable. */ }
  }
  return records;
}

export function stripReviewStorage(source: string): string {
  const reviews = [
    ...parseReviews(source).map(item => ({ ...item, replacement: item.kind === "deletion" ? "" : item.body })),
    ...parseArchivedComments(source).map(item => ({ ...item, replacement: "" })),
  ].sort((left, right) => left.from - right.from);
  let visible = source;
  for (const item of reviews.reverse()) {
    visible = `${visible.slice(0, item.from)}${item.replacement}${visible.slice(item.to)}`;
  }
  return visible;
}
