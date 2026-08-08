export type StreamIndexDecision =
  | { kind: "duplicate" }
  | { kind: "next"; nextStreamIndex: number }
  | { expected: number; kind: "gap"; received: number }
  | { kind: "invalid" };

/** Classifies one explicit Eve stream coordinate without inspecting event IDs. */
export function decideStreamIndex(
  nextStreamIndex: number,
  streamIndex: number,
): StreamIndexDecision {
  if (!Number.isSafeInteger(streamIndex) || streamIndex < 0) {
    return { kind: "invalid" };
  }
  if (streamIndex < nextStreamIndex) return { kind: "duplicate" };
  if (streamIndex > nextStreamIndex) {
    return {
      expected: nextStreamIndex,
      kind: "gap",
      received: streamIndex,
    };
  }
  return { kind: "next", nextStreamIndex: streamIndex + 1 };
}
