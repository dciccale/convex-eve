import type { SessionStreamEvent } from "eve/client";
import { describe, expect, it, vi } from "vitest";
import { retireEveSession } from "./retire-eve-session";

function fixture(outcome: "applied" | "failed" = "applied", partial = false) {
  const calls: string[] = [];
  let current = "";
  function control(name: string) {
    return vi.fn(async () => {
      current = name;
      calls.push(name);
      return {
        deliveryId: name,
        sessionId: "session-1",
        result: vi.fn(),
        stream: async function* () {},
      };
    });
  }
  const session = {
    cancel: control("cancel"),
    clear: control("clear"),
    end: control("end"),
    stream: async function* (): AsyncGenerator<SessionStreamEvent> {
      yield {
        type: "delivery.settled",
        data: { deliveryId: current, outcome },
        meta: {
          at: "2026-11-09T00:00:00Z",
          position: { line: 1, index: 0 },
          endOfLine: false,
        },
      };
      if (partial) return;
      calls.push(`${current}:settled`);
      yield {
        type: "session.started",
        data: {},
        meta: {
          at: "2026-11-09T00:00:00Z",
          position: { line: 1, index: 1 },
          endOfLine: true,
        },
      };
    },
  };
  return { session, calls };
}

describe("retireEveSession", () => {
  it("waits for complete cancel, clear, and end settlement lines", async () => {
    const { session, calls } = fixture();
    await retireEveSession(session);
    expect(calls).toEqual([
      "cancel",
      "cancel:settled",
      "clear",
      "clear:settled",
      "end",
      "end:settled",
    ]);
    expect(session.end).toHaveBeenCalledWith({
      reason: "convex_thread_deleted",
    });
  });
  it("keeps the thread recoverable when a control fails", async () => {
    const { session } = fixture("failed");
    await expect(retireEveSession(session)).rejects.toThrow("did not complete");
    expect(session.clear).not.toHaveBeenCalled();
    expect(session.end).not.toHaveBeenCalled();
  });
  it("does not treat a truncated settlement line as retirement", async () => {
    const { session } = fixture("applied", true);
    await expect(retireEveSession(session)).rejects.toThrow("did not complete");
    expect(session.clear).not.toHaveBeenCalled();
  });
});
