/** Cumulative snapshots can cover skipped source lines, but never move back. */
export function decideCheckpoint(
  nextStreamIndex: number,
  checkpoint: { line: number; index: number; nextStreamIndex: number },
): "invalid" | "duplicate" | "next" {
  if (
    ![checkpoint.line, checkpoint.index, checkpoint.nextStreamIndex].every(
      Number.isSafeInteger,
    ) ||
    checkpoint.line < 0 ||
    checkpoint.index < 0 ||
    checkpoint.nextStreamIndex <= checkpoint.line
  )
    return "invalid";
  return checkpoint.nextStreamIndex <= nextStreamIndex ? "duplicate" : "next";
}
