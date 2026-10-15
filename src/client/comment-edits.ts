import { ChangeSet, findClusterBreak, type Transaction } from "@codemirror/state";
import { parseReviews, type ReviewItem } from "../shared/review.ts";

// Treat comment storage as text inserted concurrently with the user's edit.
// Mapping through a projection and back splits deletions around the storage,
// preserving thread IDs, authors and replies without replacing untouched text.
export function mapCommentEdit(transaction: Transaction, reviews: ReviewItem[]) {
  const comments = reviews.filter(item => item.kind === "comment");
  if (!comments.length) return null;
  const projection = ChangeSet.of(comments.flatMap(item => [
    { from: item.from, to: item.bodyFrom },
    { from: item.bodyTo, to: item.to },
  ]), transaction.startState.doc.length);
  let visibleChanges = transaction.changes.map(projection);
  let boundaryDelete = false;
  const visibleSource = projection.apply(transaction.startState.doc).toString();
  const edits: { from: number; to: number; insert: string }[] = [];
  transaction.changes.iterChanges((from, to, _newFrom, _newTo, inserted) => {
    let start = projection.mapPos(from, -1), end = projection.mapPos(to, 1);
    // Backspace/Delete immediately beside a hidden marker must delete the
    // neighbouring visible grapheme, rather than the marker or nothing at all.
    if (from < to && start === end && !inserted.length) {
      const backward = transaction.isUserEvent("delete.backward")
        && transaction.startState.selection.ranges.some(range => range.empty && range.head === to);
      const forward = transaction.isUserEvent("delete.forward")
        && transaction.startState.selection.ranges.some(range => range.empty && range.head === from);
      if (backward && start > 0) { start = findClusterBreak(visibleSource, start, false); boundaryDelete = true; }
      else if (forward && end < visibleSource.length) { end = findClusterBreak(visibleSource, end); boundaryDelete = true; }
    }
    edits.push({ from: start, to: end, insert: inserted.toString() });
  });
  if (boundaryDelete) visibleChanges = ChangeSet.of(edits, projection.newLength);

  const mapped = visibleChanges.map(projection.invertedDesc);
  const sourceEdits: { from: number; to: number; insert: string }[] = [];
  mapped.iterChanges((from, to) => {
    if (from < to) sourceEdits.push({ from, to, insert: "" });
  });
  // Mapping a zero-width insertion alone loses which side of a hidden marker
  // the caret was on. Retain that affinity in the original source coordinates.
  transaction.changes.iterChanges((from, _to, _newFrom, _newTo, inserted) => {
    if (!inserted.length) return;
    let at = from;
    for (const item of comments) {
      if (at >= item.from && at < item.bodyFrom) at = item.bodyFrom;
      else if (at >= item.bodyTo && at < item.to) at = item.bodyTo;
    }
    sourceEdits.push({ from: at, to: at, insert: inserted.toString() });
  });
  sourceEdits.sort((left, right) => left.from - right.from || left.to - right.to);
  let changes = ChangeSet.of(sourceEdits, transaction.startState.doc.length);
  let selection = boundaryDelete
    ? transaction.startState.selection.map(projection).map(visibleChanges)
    : transaction.newSelection.map(projection.mapDesc(transaction.changes));
  const updated = changes.apply(transaction.startState.doc);
  const updatedComments = parseReviews(updated.toString()).filter(item => item.kind === "comment");
  const updatedProjection = ChangeSet.of(updatedComments.flatMap(item => [
    { from: item.from, to: item.bodyFrom }, { from: item.bodyTo, to: item.to },
  ]), updated.length);
  selection = selection.map(updatedProjection.invertedDesc);
  const emptied = updatedComments.filter(item => !item.body.length
    && comments.some(original => original.id === item.id && original.body.length > 0));
  if (emptied.length) {
    const cleanup = ChangeSet.of(emptied.map(item => ({ from: item.from, to: item.to })), updated.length);
    changes = changes.compose(cleanup);
    selection = selection.map(cleanup);
  }
  // A sequential correction retains the original transaction's annotations,
  // history grouping, effects and selection direction in the editor filter.
  const correction = transaction.changes.invert(transaction.startState.doc).compose(changes);
  return { changes, correction, selection };
}
