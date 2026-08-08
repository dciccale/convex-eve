import type { MessageStreamEvent } from "eve/client";
import { describe, expect, it } from "vitest";
import { applyEveEvent, sanitizeEveMessage } from "./projection";

const meta = { at: "2026-08-07T00:00:00.000Z", id: "evt_1" };

describe("Eve-native message projection", () => {
  it("uses Eve message ids and parts for received and streamed text", () => {
    const received = {
      data: { message: "hello", sequence: 0, turnId: "turn_1" },
      meta,
      type: "message.received",
    } as MessageStreamEvent;
    const appended = {
      data: {
        messageDelta: "hi",
        messageSoFar: "hi",
        sequence: 0,
        stepIndex: 0,
        turnId: "turn_1",
      },
      meta: { ...meta, id: "evt_2" },
      type: "message.appended",
    } as MessageStreamEvent;
    const first = applyEveEvent({ messages: [] }, received);
    const second = applyEveEvent(first, appended);
    expect(second.messages.map((message) => message.id)).toEqual([
      "turn_1:user",
      "turn_1:assistant",
    ]);
    expect(second.messages[1]?.parts).toContainEqual({
      state: "streaming",
      stepIndex: 0,
      text: "hi",
      type: "text",
    });
  });

  it("does not persist reasoning or complete tool payloads", () => {
    const message = sanitizeEveMessage({
      id: "turn_1:assistant",
      parts: [
        { state: "done", text: "private chain", type: "reasoning" },
        {
          input: { private: "input" },
          output: { private: "output" },
          state: "output-available",
          toolCallId: "call_1",
          toolName: "lookup",
          type: "dynamic-tool",
        },
      ],
      role: "assistant",
    });
    expect(message.parts).toHaveLength(1);
    expect(message.parts[0]).toMatchObject({
      input: "[redacted by convex-eve]",
      output: "[redacted by convex-eve]",
    });
  });
});
