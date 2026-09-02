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
  await t.mutation(api.runtime.ingestEvent, {
    ...actor,
    event: {
      data: { message: "message-1", sequence: 0, turnId: "turn-1" },
      meta: { at: "2026-09-02T00:00:00.000Z", id: "evt-1" },
      type: "message.received",
    },
    eveSessionId: "eve-session-1",
    streamIndex: 0,
    threadId,
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

  await t.mutation(api.runtime.ingestEvent, {
    ...actor,
    event: {
      data: {
        continuationToken: "eve-session-1",
        wait: "next-user-message",
      },
      meta: { at: "2026-09-02T00:00:01.000Z", id: "evt-2" },
      type: "session.waiting",
    },
    eveSessionId: "eve-session-1",
    streamIndex: 1,
    threadId,
  });
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
    }),
  ).resolves.toBeNull();
  const second = await t.query(api.runtime.getDelivery, {
    ...actor,
    clientMessageId: "message-2",
    threadId,
  });
  expect(second.delivery.state).toBe("streaming");
});
