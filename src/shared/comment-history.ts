import { parseArchivedComments, parseReviews, reviewMarkers, type ArchivedComment, type ReviewFormat } from "./review.ts";

export function reopenCommentChanges(source: string, thread: ArchivedComment, format: ReviewFormat) {
  if (!thread.body) return null;
  const protectedRanges = [...parseReviews(source), ...parseArchivedComments(source)];
  const matches: number[] = [];
  for (let at = source.indexOf(thread.body); at >= 0; at = source.indexOf(thread.body, at + 1)) {
    if (!protectedRanges.some(range => at < range.to && at + thread.body.length > range.from)) matches.push(at);
    if (matches.length > 1) return null;
  }
  if (matches.length !== 1) return null;
  const markers = reviewMarkers("comment", thread.id, thread.author, format, thread.note, thread.replies);
  return [
    { from: matches[0], to: matches[0] + thread.body.length, insert: markers.opening + thread.body + markers.closing },
    { from: thread.from, to: thread.to, insert: "" },
  ].sort((left, right) => left.from - right.from);
}
