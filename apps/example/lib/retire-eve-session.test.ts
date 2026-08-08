import { describe, expect, it, vi } from "vitest";
import { retireEveSession } from "./retire-eve-session";

describe("retireEveSession", () => {
  it("cancels, clears, and terminally resets the Eve session in order", async () => {
    const calls: string[] = [];
    const session = {
      cancel: vi.fn(async () => {
        calls.push("cancel");
        return { status: "no_active_turn" as const };
      }),
      clear: vi.fn(async () => {
        calls.push("clear");
        return { status: "no_active_session" as const };
      }),
      reset: vi.fn(async () => {
        calls.push("reset");
        return { status: "no_active_session" as const };
      }),
    };

    await retireEveSession(session);

    expect(calls).toEqual(["cancel", "clear", "reset"]);
    expect(session.reset).toHaveBeenCalledWith({
      reason: "convex_thread_deleted",
    });
  });

  it("stops when an earlier Eve control fails", async () => {
    const session = {
      cancel: vi.fn(async () => {
        throw new Error("cancel failed");
      }),
      clear: vi.fn(),
      reset: vi.fn(),
    };

    await expect(retireEveSession(session)).rejects.toThrow("cancel failed");
    expect(session.clear).not.toHaveBeenCalled();
    expect(session.reset).not.toHaveBeenCalled();
  });
});
