import { diffLines } from "diff";
import { parseArchivedComments, parseReviews } from "./review.ts";

// SyncTeX sees the compile projection, not the review macros in the editor.
export function compileSourceMap(source: string) {
  let text = "";
  const offsets: number[] = [];
  const append = (from: number, to: number) => {
    text += source.slice(from, to);
    for (let offset = from; offset < to; offset++) offsets.push(offset);
  };
  let cursor = 0;
  for (const item of [...parseReviews(source), ...parseArchivedComments(source)].sort((left, right) => left.from - right.from)) {
    append(cursor, item.from);
    if ("kind" in item && item.kind !== "deletion") append(item.bodyFrom, item.bodyTo);
    cursor = item.to;
  }
  append(cursor, source.length);
  const lines = [1];
  let originalLine = 1;
  let originalOffset = 0;
  for (let index = 0; index <= text.length; index++) {
    if (index !== 0 && text[index - 1] !== "\n") continue;
    const target = offsets[index] ?? source.length;
    while (originalOffset < target) if (source[originalOffset++] === "\n") originalLine++;
    lines[index === 0 ? 0 : lines.length] = originalLine;
  }
  return { text, lines, offsets };
}

export function projectedPosition(source: string, originalOffset: number) {
  const projection = compileSourceMap(source);
  let offset = projection.offsets.findIndex(value => value >= originalOffset);
  if (offset < 0) offset = projection.text.length;
  const prefix = projection.text.slice(0, offset);
  return { line: prefix.split("\n").length, column: offset - prefix.lastIndexOf("\n") };
}

// Carries a 1-based line from the source a PDF was compiled from into the
// source as it reads now, so PDF navigation still lands near the right place
// after edits. A line that was itself rewritten or deleted maps to where its
// replacement begins.
export function followLine(before: string, after: string, line: number): number {
  if (before === after) return line;
  let oldLine = 1;
  let newLine = 1;
  for (const part of diffLines(before, after)) {
    const count = part.count ?? 0;
    if (part.added) { newLine += count; continue; }
    if (part.removed) {
      if (line < oldLine + count) return Math.max(1, newLine);
      oldLine += count;
      continue;
    }
    if (line < oldLine + count) return newLine + (line - oldLine);
    oldLine += count;
    newLine += count;
  }
  return Math.max(1, Math.min(newLine, after.split("\n").length));
}
