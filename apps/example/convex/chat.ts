import { paginationOptsValidator } from "convex/server";
import { ConvexError, v } from "convex/values";
import { Agent, projectEveStream } from "convex-eve";
import { Client, type ClientSession, parseAnswers } from "eve/client";
import { createEveSessionOnce, sendEveInput } from "../lib/create-eve-session";
import {
  classifyDeliveryFailure,
  type DispatchPhase,
} from "../lib/delivery-failure";
import { retireEveSession } from "../lib/retire-eve-session";
import { components, internal } from "./_generated/api";
import type { ActionCtx } from "./_generated/server";
import { action, internalAction, mutation, query } from "./_generated/server";

const actor = { scopeId: "demo", subjectId: "alex-morgan" } as const;
const coach = new Agent(components.eve, { agentId: "performance-coach" });

export const ensureThread = mutation({
  args: {},
  handler: async (ctx) => {
    const threads = await coach.listThreads(ctx, actor);
    const existing = threads.find(
      (thread: { agentId: string }) => thread.agentId === coach.config.agentId,
    );
    if (existing) return existing._id;
    return await coach.createThread(ctx, actor, {
      title: "Recovery-aware training",
    });
  },
});

export const createThread = mutation({
  args: {},
  handler: async (ctx) =>
    await coach.createThread(ctx, actor, { title: "New coach conversation" }),
});

export const deleteThread = action({
  args: { threadId: v.string() },
  handler: async (ctx, args) => {
    const thread = await coach.getThread(ctx, actor, args.threadId);
    const sessionId = thread.generation.eveSessionId;

    if (sessionId) {
      const session = eveClient().sessions.attach(sessionId, {
        streamIndex: 0,
      });
      if (thread.generation.streamVersion !== 27)
        throw new ConvexError("legacy_session_requires_original_deployment");
      await retireEveSession(session);
    }

    await coach.deleteThread(ctx, actor, args.threadId);
  },
});

export const listThreads = query({
  args: {},
  handler: async (ctx) => await coach.listThreads(ctx, actor),
});

export const getThread = query({
  args: { threadId: v.string() },
  handler: async (ctx, args) =>
    await coach.getThread(ctx, actor, args.threadId),
});

export const listMessages = query({
  args: {
    threadId: v.string(),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => await coach.listUIMessages(ctx, actor, args),
});

export const sendMessage = mutation({
  args: {
    threadId: v.string(),
    clientMessageId: v.string(),
    message: v.string(),
  },
  handler: async (ctx, args) => {
    const saved = await coach.saveMessage(ctx, actor, args);
    await ctx.scheduler.runAfter(0, internal.chat.dispatchMessage, {
      clientMessageId: args.clientMessageId,
      threadId: args.threadId,
    });
    return saved;
  },
});

export const respondToInput = mutation({
  args: {
    threadId: v.string(),
    answers: v.array(
      v.object({
        interactionId: v.string(),
        optionId: v.optional(v.string()),
        text: v.optional(v.string()),
      }),
    ),
  },
  handler: async (ctx, args) => {
    await coach.getThread(ctx, actor, args.threadId);
    await ctx.scheduler.runAfter(0, internal.chat.dispatchResponse, args);
  },
});

export const dispatchMessage = internalAction({
  args: {
    threadId: v.string(),
    clientMessageId: v.string(),
  },
  handler: async (ctx, args) => {
    const input = await ctx.runQuery(components.eve.runtime.getDelivery, {
      ...actor,
      ...args,
    });
    if (input.generation.streamVersion !== 27) return;
    if (input.delivery.state === "accepted") {
      await scheduleNextMessage(ctx, args.threadId);
      return;
    }
    const claim = await ctx.runMutation(
      components.eve.runtime.markDispatching,
      {
        ...actor,
        ...args,
      },
    );
    if (!claim.claimed) return;

    let phase: DispatchPhase = "preflight";
    try {
      const client = eveClient();
      if (input.generation.eveSessionId) {
        const session = client.sessions.attach(input.generation.eveSessionId, {
          streamIndex: input.generation.nextStreamIndex,
        });
        phase = "request";
        const response = await sendEveInput({
          host: eveHost(),
          token: process.env.EVE_AGENT_TOKEN,
          sessionId: session.id,
          idempotencyKey: `convex-eve:${input.delivery._id}`,
          input: { message: input.message, turnPolicy: "queue" },
        });
        phase = "accepted";
        await ctx.runMutation(components.eve.runtime.markStreaming, {
          ...actor,
          ...args,
          eveDeliveryId: response.deliveryId,
        });
        await scheduleReconciliation(ctx, args, 0, 30_000);
        await persistSession(
          ctx,
          args.threadId,
          session,
          input.generation.nextStreamIndex,
          response.deliveryId,
        );
      } else {
        phase = "request";
        const created = await createEveSessionOnce({
          host: eveHost(),
          message: input.message,
          operationId: `convex-eve:${input.delivery._id}`,
          token: process.env.EVE_AGENT_TOKEN,
        });
        phase = "accepted";
        const session = client.sessions.attach(created.sessionId, {
          streamIndex: 0,
        });
        await ctx.runMutation(components.eve.runtime.bindSession, {
          ...actor,
          eveSessionId: session.state.sessionId,
          threadId: args.threadId,
        });
        await ctx.runMutation(components.eve.runtime.markStreaming, {
          ...actor,
          ...args,
          eveDeliveryId: created.deliveryId,
        });
        await scheduleReconciliation(ctx, args, 0, 30_000);
        await persistSession(
          ctx,
          args.threadId,
          session,
          0,
          created.deliveryId,
        );
      }
      await scheduleNextMessage(ctx, args.threadId);
    } catch (error) {
      if (classifyDeliveryFailure(phase, error) === "failed") {
        await ctx.runMutation(components.eve.runtime.failDelivery, {
          ...actor,
          ...args,
          error: errorText(error),
        });
        return;
      }
      await markForReconciliation(ctx, args, error);
      await scheduleReconciliation(ctx, args, 0, 1_000);
    }
  },
});

export const reconcileMessage = internalAction({
  args: {
    threadId: v.string(),
    clientMessageId: v.string(),
    attempt: v.number(),
  },
  handler: async (ctx, args) => {
    const input = await ctx.runQuery(components.eve.runtime.getDelivery, {
      ...actor,
      clientMessageId: args.clientMessageId,
      threadId: args.threadId,
    });
    if (input.generation.streamVersion !== 27) return;
    if (input.delivery.state === "accepted") {
      await scheduleNextMessage(ctx, args.threadId);
      return;
    }
    if (
      input.delivery.state !== "dispatching" &&
      input.delivery.state !== "streaming" &&
      input.delivery.state !== "unknown"
    ) {
      return;
    }

    try {
      let sessionId = input.generation.eveSessionId;
      let startIndex = input.generation.nextStreamIndex;
      if (!sessionId) {
        const created = await createEveSessionOnce({
          host: eveHost(),
          message: input.message,
          operationId: `convex-eve:${input.delivery._id}`,
          token: process.env.EVE_AGENT_TOKEN,
        });
        sessionId = created.sessionId;
        startIndex = 0;
        await ctx.runMutation(components.eve.runtime.bindSession, {
          ...actor,
          eveSessionId: sessionId,
          threadId: args.threadId,
        });
        await ctx.runMutation(components.eve.runtime.markStreaming, {
          ...actor,
          clientMessageId: args.clientMessageId,
          threadId: args.threadId,
          eveDeliveryId: created.deliveryId,
        });
      }

      const session = eveClient().sessions.attach(sessionId, {
        streamIndex: startIndex,
      });
      await persistSession(ctx, args.threadId, session, startIndex);
      const refreshed = await ctx.runQuery(components.eve.runtime.getDelivery, {
        ...actor,
        clientMessageId: args.clientMessageId,
        threadId: args.threadId,
      });
      if (refreshed.delivery.state === "accepted") {
        await scheduleNextMessage(ctx, args.threadId);
        return;
      }
    } catch (error) {
      await markForReconciliation(ctx, args, error);
    }

    const nextAttempt = Math.min(args.attempt + 1, 5);
    await scheduleReconciliation(
      ctx,
      args,
      nextAttempt,
      reconciliationDelayMs(nextAttempt),
    );
  },
});

export const dispatchResponse = internalAction({
  args: {
    threadId: v.string(),
    answers: v.array(
      v.object({
        interactionId: v.string(),
        optionId: v.optional(v.string()),
        text: v.optional(v.string()),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const thread = await ctx.runQuery(components.eve.threads.get, {
      ...actor,
      threadId: args.threadId,
    });
    const sessionId = thread.generation.eveSessionId;
    if (!sessionId) throw new ConvexError("eve_session_not_bound");
    const session = eveClient().sessions.attach(sessionId, {
      streamIndex: thread.generation.nextStreamIndex,
    });
    if (thread.generation.streamVersion !== 27)
      throw new ConvexError("legacy_thread_read_only");
    const answers = parseAnswers(args.answers);
    const bytes = new TextEncoder().encode(JSON.stringify(answers));
    const digest = await crypto.subtle.digest("SHA-256", bytes);
    const key = Array.from(new Uint8Array(digest), (byte) =>
      byte.toString(16).padStart(2, "0"),
    ).join("");
    const response = await sendEveInput({
      host: eveHost(),
      token: process.env.EVE_AGENT_TOKEN,
      sessionId,
      idempotencyKey: `convex-eve:answer:${key}`,
      input: { answers },
    });
    await persistSession(
      ctx,
      args.threadId,
      session,
      thread.generation.nextStreamIndex,
      response.deliveryId,
    );
  },
});

function eveClient() {
  const host = eveHost();
  const token = process.env.EVE_AGENT_TOKEN;
  return new Client({
    baseUrl: host,
    auth: token ? { bearer: token } : undefined,
    redirect: token ? "error" : undefined,
  });
}

function eveHost() {
  const host = process.env.EVE_AGENT_URL;
  if (!host) throw new ConvexError("EVE_AGENT_URL is not configured");
  return host;
}

async function scheduleNextMessage(ctx: ActionCtx, threadId: string) {
  const next = await ctx.runQuery(
    components.eve.runtime.getNextQueuedDelivery,
    {
      ...actor,
      threadId,
    },
  );
  if (next) {
    await ctx.scheduler.runAfter(0, internal.chat.dispatchMessage, {
      clientMessageId: next.clientMessageId,
      threadId,
    });
  }
}

async function markForReconciliation(
  ctx: ActionCtx,
  args: { clientMessageId: string; threadId: string },
  error: unknown,
) {
  const current = await ctx.runQuery(components.eve.runtime.getDelivery, {
    ...actor,
    ...args,
  });
  if (current.delivery.state === "dispatching") {
    await ctx.runMutation(components.eve.runtime.markDeliveryUnknown, {
      ...actor,
      ...args,
      error: errorText(error),
    });
  } else if (
    current.delivery.state === "streaming" ||
    current.delivery.state === "unknown"
  ) {
    await ctx.runMutation(components.eve.runtime.recordReconciliationError, {
      ...actor,
      ...args,
      error: errorText(error),
    });
  }
}

async function scheduleReconciliation(
  ctx: ActionCtx,
  args: { clientMessageId: string; threadId: string },
  attempt: number,
  delayMs: number,
) {
  await ctx.scheduler.runAfter(delayMs, internal.chat.reconcileMessage, {
    ...args,
    attempt,
  });
}

function reconciliationDelayMs(attempt: number) {
  return Math.min(30_000, 1_000 * 2 ** attempt);
}

function errorText(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

async function persistSession(
  ctx: ActionCtx,
  threadId: string,
  session: ClientSession,
  afterStreamIndex: number,
  deliveryId?: string,
) {
  // SessionView is opaque. Rebuild from Eve on each action instead of persisting
  // internal tables, raw event payloads, or signed inbox routing credentials.
  const source = session.stream({
    startIndex: 0,
    follow: deliveryId !== undefined,
  });
  for await (const checkpoint of projectEveStream(source, afterStreamIndex)) {
    await ctx.runMutation(components.eve.runtime.ingestProjection, {
      ...actor,
      threadId,
      eveSessionId: session.id,
      checkpoint: JSON.parse(JSON.stringify(checkpoint)),
    });
    if (
      deliveryId &&
      checkpoint.deliveries.some(
        (receipt) => receipt.deliveryId === deliveryId && receipt.outcome,
      )
    )
      return;
  }
}
