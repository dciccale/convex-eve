import { describe, expect, it } from "vitest";
import { decideCheckpoint } from "./cursor";

describe("complete-line snapshot cursor", () => {
  it("accepts cumulative coverage and distinguishes stale replay", () => {
    expect(decideCheckpoint(7, { line: 7, index: 3, nextStreamIndex: 8 })).toBe(
      "next",
    );
    expect(
      decideCheckpoint(7, { line: 9, index: 1, nextStreamIndex: 12 }),
    ).toBe("next");
    expect(decideCheckpoint(7, { line: 6, index: 3, nextStreamIndex: 7 })).toBe(
      "duplicate",
    );
  });
  it("rejects invalid or incomplete line coordinates", () => {
    for (const point of [
      { line: -1, index: 0, nextStreamIndex: 1 },
      { line: 1, index: 0.5, nextStreamIndex: 2 },
      { line: 1, index: 0, nextStreamIndex: 1 },
    ]) {
      expect(decideCheckpoint(0, point)).toBe("invalid");
    }
  });
});
