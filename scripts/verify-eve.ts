import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { Client } from "eve/client";
import {
  createEveSessionOnce,
  sendEveInput,
} from "../apps/example/lib/create-eve-session";
import { retireEveSession } from "../apps/example/lib/retire-eve-session";
import {
  type ProjectionCheckpoint,
  projectEveStream,
} from "../packages/convex-eve/src/projection";

const root = resolve(import.meta.dirname, "..");
const directory = await mkdtemp(join(tmpdir(), "convex-eve-protocol-"));
const listener = createServer();
await new Promise<void>((resolve) => listener.listen(0, "127.0.0.1", resolve));
const address = listener.address();
if (!address || typeof address === "string") throw new Error("No test port");
const port = address.port;
await new Promise<void>((resolve) => listener.close(() => resolve()));
const host = `http://localhost:${port}`;
const log: string[] = [];
let child: ReturnType<typeof spawn> | undefined;

try {
  await mkdir(join(directory, "agent", "tools"), { recursive: true });
  await mkdir(join(directory, "agent", "channels"), { recursive: true });
  await writeFile(
    join(directory, "agent", "instructions.md"),
    "Use the fixture tools when asked. Reply briefly.\n",
  );
  await symlink(
    join(root, "apps/eve-agent/node_modules"),
    join(directory, "node_modules"),
  );
  await writeFile(
    join(directory, "package.json"),
    JSON.stringify({
      type: "module",
      dependencies: { eve: "1.0.0-rc.7", zod: "4.4.3", ai: "7.0.137" },
    }),
  );
  await writeFile(
    join(directory, "agent", "agent.ts"),
    `import { defineAgent } from "eve";
import { mockModel } from "eve/evals";
export default defineAgent({ model: mockModel(({ lastUserMessage, toolResults }) =>
  lastUserMessage.includes("approval") && toolResults.length === 0
    ? { toolCalls: [{ name: "confirm", input: {} }] }
    : "Fixture reply") });
`,
  );
  await writeFile(
    join(directory, "agent", "tools", "confirm.ts"),
    `import { defineTool } from "eve/tools";
import { always } from "eve/tools/approval";
import { z } from "zod";
export default defineTool({ description: "Confirm the fixture", inputSchema: z.object({}), approval: always(), execute: async () => ({ private: "tool-output" }) });
`,
  );
  await writeFile(
    join(directory, "agent", "channels", "eve.ts"),
    `import { eveChannel } from "eve/channels/eve";
export default eveChannel({ auth: [(request) => request.headers.get("authorization") === "Bearer fixture-token" ? { subject: "fixture", issuer: "fixture", principalId: "fixture", principalType: "service", authenticator: "fixture", attributes: {} } : null] });
`,
  );
  child = spawn(
    "node",
    [
      join(root, "apps/eve-agent/node_modules/eve/bin/eve.js"),
      "dev",
      "--no-default-extensions",
      "--port",
      String(port),
    ],
    { cwd: directory, stdio: ["ignore", "pipe", "pipe"] },
  );
  for (const stream of [child.stdout, child.stderr])
    stream?.on("data", (data) => {
      log.push(String(data));
    });
  const deadline = Date.now() + 90_000;
  while (true) {
    if (child.exitCode !== null)
      throw new Error(`Eve exited: ${child.exitCode}`);
    const response = await fetch(`${host}/eve/v1/health`).catch(
      () => undefined,
    );
    if (response?.ok) break;
    if (Date.now() > deadline) throw new Error("Eve startup timed out");
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  const token = "fixture-token";
  const client = new Client({ baseUrl: host, auth: { bearer: token } });
  async function capture(
    sessionId: string,
    deliveryId: string,
  ): Promise<ProjectionCheckpoint> {
    const session = client.sessions.attach(sessionId);
    const signal = AbortSignal.timeout(60_000);
    for await (const checkpoint of projectEveStream(
      session.stream({ startIndex: 0, signal }),
    )) {
      if (
        checkpoint.deliveries.some(
          (receipt) => receipt.deliveryId === deliveryId && receipt.outcome,
        )
      )
        return checkpoint;
    }
    throw new Error("No matching delivery settlement");
  }
  const created = await createEveSessionOnce({
    host,
    token,
    message: "hello",
    operationId: "fixture-create",
  });
  const first = await capture(created.sessionId, created.deliveryId);
  assert.equal(first.status, "ready");
  assert(
    first.messages.some((message) =>
      message.parts.some(
        (part) => part.type === "text" && part.text === "Fixture reply",
      ),
    ),
  );
  assert.deepEqual(
    await createEveSessionOnce({
      host,
      token,
      message: "hello",
      operationId: "fixture-create",
    }),
    created,
  );
  const input = {
    host,
    token,
    sessionId: created.sessionId,
    idempotencyKey: "fixture-message",
    input: { message: "follow-up", turnPolicy: "queue" as const },
  };
  const sent = await sendEveInput(input);
  assert.deepEqual(await sendEveInput(input), sent);
  const second = await capture(sent.sessionId, sent.deliveryId);
  assert.equal(
    second.messages.filter((message) => message.role === "user").length,
    2,
  );
  const approval = await sendEveInput({
    ...input,
    idempotencyKey: "fixture-approval",
    input: { message: "approval", turnPolicy: "queue" },
  });
  const paused = await capture(approval.sessionId, approval.deliveryId);
  assert.equal(paused.status, "waiting_input");
  const interaction = paused.messages
    .flatMap((message) => message.parts)
    .flatMap((part) =>
      part.type === "interaction"
        ? [part]
        : part.type === "tool" && part.interaction
          ? [part.interaction]
          : [],
    )
    .find((item) => item.status === "open");
  assert(interaction);
  const answered = await sendEveInput({
    ...input,
    idempotencyKey: "fixture-answer",
    input: {
      answers: [
        { interactionId: interaction.interactionId, optionId: "approve" },
      ],
    },
  });
  const resumed = await capture(answered.sessionId, answered.deliveryId);
  assert.equal(resumed.status, "ready");
  assert(!JSON.stringify(resumed).includes("tool-output"));
  const session = client.sessions.attach(created.sessionId);
  await retireEveSession(session);
  const final = await session.snapshot();
  assert(final.events.some((event) => event.type === "session.ended"));
  console.log(
    `Verified Eve 1.0.0-rc.7 over HTTP: create-once, keyed sends, grouped projections, approval, answer, clear, and end (${final.events.length} events).`,
  );
} catch (error) {
  console.error(log.join("").slice(-12_000));
  throw error;
} finally {
  child?.kill("SIGTERM");
  if (child && child.exitCode === null)
    await Promise.race([
      new Promise((resolve) => child?.once("exit", resolve)),
      new Promise((resolve) => setTimeout(resolve, 2000)),
    ]);
  await rm(directory, { recursive: true, force: true });
}
