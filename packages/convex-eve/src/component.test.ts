/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import { api } from "./component/_generated/api.js";
import schema from "./component/schema.js";
import { register } from "./test.js";

const modules = import.meta.glob("./component/**/*.ts");

test("component functions enforce actor isolation and validated returns", async () => {
  const t = convexTest(schema, modules);
  const threadId = await t.mutation(api.threads.create, {
    agentId: "coach",
    scopeId: "workspace-a",
    subjectId: "user-a",
    title: "Training",
  });

  const thread = await t.query(api.threads.get, {
    scopeId: "workspace-a",
    subjectId: "user-a",
    threadId,
  });
  expect(thread.title).toBe("Training");

  await expect(
    t.query(api.threads.get, {
      scopeId: "workspace-a",
      subjectId: "user-b",
      threadId,
    }),
  ).rejects.toThrow("thread_access_denied");

  await expect(
    t.mutation(api.threads.remove, {
      scopeId: "workspace-a",
      subjectId: "user-a",
      threadId,
    }),
  ).resolves.toBeNull();
});

test("published test helper registers the component", () => {
  const t = convexTest(schema, modules);
  expect(() => register(t, "nestedEve")).not.toThrow();
});

test("one generation serializes delivery claims and reconciles stream evidence", async () => {
  const t = convexTest(schema, modules);
  const actor = { scopeId: "workspace-a", subjectId: "user-a" };
  const threadId = await t.mutation(api.threads.create, {
    ...actor,
    agentId: "coach",
  });
  for (const clientMessageId of ["message-1", "message-2"]) {
    await t.mutation(api.messages.createPending, {
      ...actor,
      agentId: "coach",
      clientMessageId,
      message: clientMessageId,
      threadId,
    });
  }

  await expect(
    t.mutation(api.runtime.markDispatching, {
      ...actor,
      clientMessageId: "message-1",
      threadId,
    }),
  ).resolves.toMatchObject({ claimed: true });
  await expect(
    t.mutation(api.runtime.markDispatching, {
      ...actor,
      clientMessageId: "message-2",
      threadId,
    }),
  ).resolves.toMatchObject({ claimed: false });
  await expect(
    t.query(api.runtime.getNextQueuedDelivery, { ...actor, threadId }),
  ).resolves.toBeNull();

  await t.mutation(api.runtime.markDeliveryUnknown, {
    ...actor,
    clientMessageId: "message-1",
    error: "response lost after dispatch",
    threadId,
  });
  const unknown = await t.query(api.runtime.getDelivery, {
    ...actor,
    clientMessageId: "message-1",
    threadId,
  });
  expect(unknown.delivery.state).toBe("unknown");
  await expect(
    t.mutation(api.runtime.markDispatching, {
      ...actor,
      clientMessageId: "message-1",
      threadId,
    }),
  ).resolves.toMatchObject({ claimed: false });
  await expect(
    t.mutation(api.runtime.markDispatching, {
      ...actor,
      clientMessageId: "message-2",
      threadId,
    }),
  ).resolves.toMatchObject({ claimed: false });
  await expect(
    t.query(api.runtime.getNextQueuedDelivery, { ...actor, threadId }),
  ).resolves.toBeNull();

  await t.mutation(api.runtime.bindSession, {
    ...actor,
    eveSessionId: "eve-session-1",
    threadId,
  });
  await t.mutation(api.runtime.markStreaming, {
    ...actor,
    threadId,
    clientMessageId: "message-1",
    eveDeliveryId: "native-1",
  });
  const checkpoint = {
    streamVersion: 27,
    line: 2,
    index: 1,
    nextStreamIndex: 3,
    messages: [
      {
        id: "native-1:user",
        role: "user",
        parts: [{ type: "text", text: "message-1" }],
      },
    ],
    deliveries: [{ deliveryId: "native-1", consumed: true }],
    status: "streaming",
    sessionStatus: "active",
  };
  await t.mutation(api.runtime.ingestProjection, {
    ...actor,
    threadId,
    eveSessionId: "eve-session-1",
    checkpoint,
  });
  const streaming = await t.query(api.runtime.getDelivery, {
    ...actor,
    clientMessageId: "message-1",
    threadId,
  });
  expect(streaming.delivery.state).toBe("streaming");
  await expect(
    t.mutation(api.runtime.markDispatching, {
      ...actor,
      clientMessageId: "message-2",
      threadId,
    }),
  ).resolves.toMatchObject({ claimed: false });

  // An unrelated control receipt must not accept the active message.
  await t.mutation(api.runtime.ingestProjection, {
    ...actor,
    threadId,
    eveSessionId: "eve-session-1",
    checkpoint: {
      ...checkpoint,
      line: 3,
      index: 0,
      nextStreamIndex: 4,
      deliveries: [
        { deliveryId: "other-control", consumed: false, outcome: "applied" },
      ],
    },
  });
  expect(
    (
      await t.query(api.runtime.getDelivery, {
        ...actor,
        threadId,
        clientMessageId: "message-1",
      })
    ).delivery.state,
  ).toBe("streaming");
  await t.mutation(api.runtime.ingestProjection, {
    ...actor,
    threadId,
    eveSessionId: "eve-session-1",
    checkpoint: {
      ...checkpoint,
      line: 4,
      index: 2,
      nextStreamIndex: 5,
      deliveries: [
        { deliveryId: "native-1", consumed: true, outcome: "handled" },
      ],
      status: "ready",
      sessionStatus: "waiting",
    },
  });
  await expect(
    t.mutation(api.runtime.ingestProjection, {
      ...actor,
      threadId,
      eveSessionId: "eve-session-1",
      checkpoint,
    }),
  ).resolves.toEqual({ duplicate: true });
  await expect(
    t.mutation(api.runtime.ingestProjection, {
      ...actor,
      subjectId: "user-b",
      threadId,
      eveSessionId: "eve-session-1",
      checkpoint,
    }),
  ).rejects.toThrow("thread_access_denied");
  await expect(
    t.mutation(api.runtime.ingestProjection, {
      ...actor,
      threadId,
      eveSessionId: "other-session",
      checkpoint,
    }),
  ).rejects.toThrow("eve_session_binding_mismatch");
  await expect(
    t.mutation(api.runtime.ingestProjection, {
      ...actor,
      threadId,
      eveSessionId: "eve-session-1",
      checkpoint: { ...checkpoint, nextStreamIndex: 2 },
    }),
  ).rejects.toThrow("invalid_eve_projection");
  const accepted = await t.query(api.runtime.getDelivery, {
    ...actor,
    clientMessageId: "message-1",
    threadId,
  });
  expect(accepted.delivery.state).toBe("accepted");
  await expect(
    t.mutation(api.runtime.markDispatching, {
      ...actor,
      clientMessageId: "message-2",
      threadId,
    }),
  ).resolves.toMatchObject({ claimed: true });
  await expect(
    t.mutation(api.runtime.markStreaming, {
      ...actor,
      clientMessageId: "message-2",
      threadId,
      eveDeliveryId: "native-2",
    }),
  ).resolves.toBeNull();
  const second = await t.query(api.runtime.getDelivery, {
    ...actor,
    clientMessageId: "message-2",
    threadId,
  });
  expect(second.delivery.state).toBe("streaming");
});

test("legacy records stay readable but cannot dispatch or ingest v27 projections", async () => {
  const t = convexTest(schema, modules);
  const actor = { scopeId: "workspace-a", subjectId: "user-a" };
  const threadId = await t.mutation(api.threads.create, {
    ...actor,
    agentId: "coach",
  });
  await t.run(async (ctx) => {
    const generation = await ctx.db.query("generations").first();
    if (!generation) throw new Error("missing fixture generation");
    await ctx.db.patch(generation._id, {
      streamVersion: undefined,
      projection: { messages: [] },
    });
  });
  expect(
    (await t.query(api.threads.get, { ...actor, threadId })).generation
      .streamVersion,
  ).toBeUndefined();
  await expect(
    t.mutation(api.messages.createPending, {
      ...actor,
      threadId,
      agentId: "coach",
      clientMessageId: "new",
      message: "hello",
    }),
  ).rejects.toThrow("legacy_thread_read_only");
  await expect(
    t.mutation(api.runtime.markDispatching, {
      ...actor,
      threadId,
      clientMessageId: "old",
    }),
  ).rejects.toThrow("legacy_thread_read_only");
});

test("storage strips sensitive parts and clear does not break delivery reconciliation", async () => {
  const t = convexTest(schema, modules);
  const actor = { scopeId: "workspace-a", subjectId: "user-a" };
  const threadId = await t.mutation(api.threads.create, {
    ...actor,
    agentId: "coach",
  });
  await t.mutation(api.messages.createPending, {
    ...actor,
    threadId,
    agentId: "coach",
    clientMessageId: "message",
    message: "hello",
  });
  await t.mutation(api.runtime.markDispatching, {
    ...actor,
    threadId,
    clientMessageId: "message",
  });
  await t.mutation(api.runtime.bindSession, {
    ...actor,
    threadId,
    eveSessionId: "session",
  });
  await t.mutation(api.runtime.markStreaming, {
    ...actor,
    threadId,
    clientMessageId: "message",
    eveDeliveryId: "native",
  });
  const checkpoint = {
    streamVersion: 27,
    line: 3,
    index: 2,
    nextStreamIndex: 4,
    status: "ready",
    sessionStatus: "waiting",
    deliveries: [{ deliveryId: "native", consumed: true, outcome: "handled" }],
    messages: [
      {
        id: "native:user",
        role: "user",
        parts: [{ type: "text", text: "hello" }],
      },
      {
        id: "assistant",
        role: "assistant",
        metadata: { result: "private-result" },
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
          },
        ],
      },
    ],
  };
  await t.mutation(api.runtime.ingestProjection, {
    ...actor,
    threadId,
    eveSessionId: "session",
    checkpoint,
  });
  const stored = await t.run(async (ctx) => ({
    messages: await ctx.db.query("messages").collect(),
    coordinates: await ctx.db.query("eventCoordinates").collect(),
    generations: await ctx.db.query("generations").collect(),
  }));
  expect(JSON.stringify(stored)).not.toContain("private-");
  expect(stored.coordinates[0]).toMatchObject({
    streamIndex: 3,
    eventIndex: 2,
  });
  await t.mutation(api.runtime.ingestProjection, {
    ...actor,
    threadId,
    eveSessionId: "session",
    checkpoint: {
      ...checkpoint,
      line: 4,
      index: 0,
      nextStreamIndex: 5,
      messages: [],
    },
  });
  expect(
    (
      await t.query(api.messages.list, {
        ...actor,
        threadId,
        paginationOpts: { numItems: 10, cursor: null },
      })
    ).page,
  ).toHaveLength(0);
  expect(
    (
      await t.query(api.runtime.getDelivery, {
        ...actor,
        threadId,
        clientMessageId: "message",
      })
    ).message,
  ).toBe("hello");
});

test.each(["failed", "refused", "awaiting-input"] as const)(
  "matching %s receipts settle the delivery even when clear removes its message",
  async (outcome) => {
    const t = convexTest(schema, modules);
    const actor = { scopeId: "workspace-a", subjectId: "user-a" };
    const threadId = await t.mutation(api.threads.create, {
      ...actor,
      agentId: "coach",
    });
    await t.mutation(api.messages.createPending, {
      ...actor,
      threadId,
      agentId: "coach",
      clientMessageId: "message",
      message: "hello",
    });
    await t.mutation(api.runtime.markDispatching, {
      ...actor,
      threadId,
      clientMessageId: "message",
    });
    await t.mutation(api.runtime.bindSession, {
      ...actor,
      threadId,
      eveSessionId: "session",
    });
    await t.mutation(api.runtime.markStreaming, {
      ...actor,
      threadId,
      clientMessageId: "message",
      eveDeliveryId: "native",
    });
    const checkpoint = {
      streamVersion: 27,
      line: 1,
      index: 1,
      nextStreamIndex: 2,
      status: "streaming",
      sessionStatus: "active",
      deliveries: [{ deliveryId: "native", consumed: true }],
      messages: [
        {
          id: "native:user",
          role: "user",
          parts: [{ type: "text", text: "hello" }],
        },
      ],
    };
    await t.mutation(api.runtime.ingestProjection, {
      ...actor,
      threadId,
      eveSessionId: "session",
      checkpoint,
    });
    await t.mutation(api.runtime.ingestProjection, {
      ...actor,
      threadId,
      eveSessionId: "session",
      checkpoint: {
        ...checkpoint,
        line: 2,
        index: 2,
        nextStreamIndex: 3,
        messages: [],
        deliveries: [{ deliveryId: "native", consumed: true, outcome }],
      },
    });
    const result = await t.query(api.runtime.getDelivery, {
      ...actor,
      threadId,
      clientMessageId: "message",
    });
    expect(result.delivery.state).toBe(
      outcome === "awaiting-input" ? "accepted" : "failed",
    );
  },
);
