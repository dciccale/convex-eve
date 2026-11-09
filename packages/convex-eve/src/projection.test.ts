import type { SessionEvent, SessionStreamEvent } from "eve/client";
import { describe, expect, it } from "vitest";
import {
  type ProjectionCheckpoint,
  projectEveStream,
  sanitizeEveMessage,
} from "./projection";

function line(
  position: number,
  facts: SessionEvent[],
  next?: number,
): SessionStreamEvent[] {
  return facts.map((fact, index) => ({
    ...fact,
    meta: {
      at: "2026-11-09T00:00:00.000Z",
      position: { line: position, index },
      endOfLine: index === facts.length - 1,
      ...(next === undefined ? {} : { next }),
    },
  }));
}
const scope = { turnId: "turn-1", runId: "run-1" };
const prefix: SessionStreamEvent[] = [
  ...line(0, [{ type: "session.started", data: {} }]),
  ...line(1, [
    { type: "delivery.admitted", data: { deliveryId: "delivery-1" } },
  ]),
  ...line(2, [
    {
      type: "turn.started",
      data: {
        turnId: "turn-1",
        cause: { deliveryId: "delivery-1" },
        follows: null,
      },
    },
    {
      type: "delivery.consumed",
      data: {
        deliveryId: "delivery-1",
        turnId: "turn-1",
        parts: [{ kind: "text", text: "hello" }],
      },
    },
  ]),
  ...line(3, [
    {
      type: "model.requested",
      scope,
      data: { runId: "run-1", owner: { turnId: "turn-1" } },
    },
  ]),
  ...line(4, [
    {
      type: "model.started",
      scope,
      data: { runId: "run-1", modelId: "test", attempt: 0 },
    },
  ]),
];
const completed = [
  ...prefix,
  ...line(5, [
    {
      type: "content.delta",
      scope,
      data: { partId: "part-1", kind: "text", delta: "hi" },
    },
  ]),
  ...line(6, [
    {
      type: "content.completed",
      scope,
      data: { partId: "part-1", kind: "text", phase: "reply", value: "hi" },
    },
  ]),
  ...line(7, [
    {
      type: "model.settled",
      scope,
      data: { runId: "run-1", outcome: "completed" },
    },
  ]),
  ...line(
    8,
    [
      {
        type: "turn.settled",
        data: { turnId: "turn-1", outcome: "completed", reply: ["part-1"] },
      },
      {
        type: "delivery.settled",
        data: {
          deliveryId: "delivery-1",
          turnId: "turn-1",
          outcome: "handled",
        },
      },
    ],
    12,
  ),
];
async function collect(events: SessionStreamEvent[], after = 0) {
  async function* source() {
    yield* events;
  }
  const result: ProjectionCheckpoint[] = [];
  for await (const checkpoint of projectEveStream(source(), after))
    result.push(checkpoint);
  return result;
}

describe("v27 canonical projection", () => {
  it("commits grouped facts once and preserves source-line coverage", async () => {
    const checkpoints = await collect(completed);
    expect(checkpoints).toHaveLength(9);
    expect(checkpoints[2]).toMatchObject({
      line: 2,
      index: 1,
      nextStreamIndex: 3,
    });
    const final = checkpoints.at(-1);
    expect(final).toMatchObject({
      line: 8,
      index: 1,
      nextStreamIndex: 12,
      status: "ready",
    });
    expect(final?.messages.map((item) => item.id)).toEqual([
      "delivery-1:user",
      "turn-1:assistant",
    ]);
    expect(final?.messages[1]?.parts).toContainEqual({
      id: "part-1",
      type: "text",
      text: "hi",
      state: "done",
      stepIndex: 0,
    });
    expect(final?.deliveries).toContainEqual({
      deliveryId: "delivery-1",
      consumed: true,
      outcome: "handled",
    });
  });

  it("rebuilds after restart, skips committed lines, and absorbs replay", async () => {
    const expected = await collect(completed, 6);
    expect(await collect([...prefix, ...completed], 6)).toEqual(expected);
    expect(expected.map((item) => item.nextStreamIndex)).toEqual([7, 8, 12]);
    expect(expected.at(-1)?.messages[1]?.parts[0]).toMatchObject({
      text: "hi",
    });
  });

  it("does not checkpoint a partial line, and can replay it after interruption", async () => {
    const partial = line(5, [
      {
        type: "content.completed",
        scope,
        data: { partId: "part-1", kind: "text", phase: "reply", value: "hi" },
      },
      {
        type: "turn.settled",
        data: { turnId: "turn-1", outcome: "completed" },
      },
    ]);
    await expect(collect([...prefix, ...partial.slice(0, 1)])).rejects.toThrow(
      "incomplete_eve_line",
    );
    const resumed = await collect([
      ...prefix,
      ...partial.slice(0, 1),
      ...partial,
    ]);
    expect(resumed.at(-1)).toMatchObject({
      line: 5,
      index: 1,
      nextStreamIndex: 6,
    });
  });

  it("projects native tool approvals and pauses by delivery outcome", async () => {
    const checkpoints = await collect([
      ...prefix,
      ...line(5, [
        {
          type: "call.requested",
          scope,
          data: {
            callId: "call-1",
            owner: { runId: "run-1" },
            capability: { kind: "tool", name: "update", label: "Update plan" },
            input: { secret: "tool-input" },
          },
        },
      ]),
      ...line(6, [
        {
          type: "interaction.opened",
          scope,
          data: {
            interactionId: "interaction-1",
            subject: { callId: "call-1" },
            request: {
              kind: "approval",
              prompt: "Update plan?",
              options: [
                { id: "approve", label: "Approve" },
                { id: "deny", label: "Deny" },
              ],
            },
          },
        },
      ]),
      ...line(7, [
        {
          type: "turn.paused",
          data: {
            turnId: "turn-1",
            awaiting: [{ interactionId: "interaction-1" }],
          },
        },
        {
          type: "delivery.settled",
          data: {
            deliveryId: "delivery-1",
            outcome: "awaiting-input",
            turnId: "turn-1",
          },
        },
      ]),
    ]);
    expect(checkpoints.at(-1)).toMatchObject({
      status: "waiting_input",
      deliveries: [{ outcome: "awaiting-input" }],
    });
    expect(checkpoints.at(-1)?.messages[1]?.parts[0]).toMatchObject({
      type: "tool",
      state: "approval",
      interaction: { interactionId: "interaction-1", status: "open" },
    });
    expect(JSON.stringify(checkpoints)).not.toContain("tool-input");
  });

  it("removes reasoning, tool payloads, result data, and sign-in credentials at the storage boundary", () => {
    const safe = sanitizeEveMessage({
      id: "assistant",
      role: "assistant",
      metadata: { result: { secret: "result" } },
      parts: [
        { type: "reasoning", text: "private-reasoning" },
        {
          type: "tool",
          state: "completed",
          callId: "call",
          stepIndex: 0,
          kind: "tool",
          name: "test",
          label: "Test",
          input: "private-input",
          output: "private-output",
          error: { message: "private-error" },
        },
        {
          type: "interaction",
          interactionId: "sign-in",
          turnId: "turn",
          stepIndex: 0,
          status: "open",
          request: {
            kind: "sign-in",
            prompt: "Sign in",
            link: { url: "https://secret-link" },
            signIn: {
              name: "service",
              url: "https://secret-url",
              callbackUrl: "https://secret-callback",
              userCode: "private-code",
              grant: "private-grant",
            },
          },
        },
      ],
    });
    expect(safe.parts).toHaveLength(2);
    expect(JSON.stringify(safe)).not.toMatch(/private-|secret-/);
  });
  it("rejects a suffix used as a full-history rebuild", async () => {
    await expect(collect(completed.slice(1))).rejects.toThrow(
      "eve_projection_requires_full_history",
    );
  });
  it("maps native turn and session failures without relying on legacy names", async () => {
    const failed = await collect([
      ...prefix,
      ...line(5, [
        {
          type: "turn.settled",
          data: {
            turnId: "turn-1",
            outcome: "failed",
            error: { code: "fixture", message: "failed" },
          },
        },
        {
          type: "delivery.settled",
          data: { deliveryId: "delivery-1", outcome: "failed" },
        },
      ]),
    ]);
    expect(failed.at(-1)?.status).toBe("failed");
    const ended = await collect([
      ...completed,
      ...line(12, [{ type: "session.ended", data: { outcome: "completed" } }]),
    ]);
    expect(ended.at(-1)).toMatchObject({
      status: "closed",
      sessionStatus: "retired",
    });
  });
});
