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
