import { describe, expect, it } from "vitest";
import { decideStreamIndex } from "./cursor";

describe("Eve stream cursor", () => {
  it("advances only the exact next stream index", () => {
    expect(decideStreamIndex(7, 7)).toEqual({
      kind: "next",
      nextStreamIndex: 8,
    });
  });

  it("distinguishes replay from a gap", () => {
    expect(decideStreamIndex(7, 6)).toEqual({ kind: "duplicate" });
    expect(decideStreamIndex(7, 9)).toEqual({
      expected: 7,
      kind: "gap",
      received: 9,
    });
  });

  it("rejects invalid coordinates", () => {
    expect(decideStreamIndex(0, -1)).toEqual({ kind: "invalid" });
    expect(decideStreamIndex(0, 0.5)).toEqual({ kind: "invalid" });
  });
});
