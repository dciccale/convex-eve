import { paginationOptsValidator } from "convex/server";
import { ConvexError, v } from "convex/values";
import { Agent } from "convex-eve";
import { Client, type InputResponse } from "eve/client";
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
        streamIndex: thread.generation.nextStreamIndex,
      });
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
    responses: v.array(
      v.object({
        requestId: v.string(),
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
    if (input.delivery.state === "accepted") return;
    const claim = await ctx.runMutation(
      components.eve.runtime.markDispatching,
      {
        ...actor,
        ...args,
      },
    );
    if (!claim.claimed) return;

    try {
      const client = eveClient();
      if (input.generation.eveSessionId) {
        const session = client.sessions.attach(input.generation.eveSessionId, {
          streamIndex: input.generation.nextStreamIndex,
        });
        const response = await session.send(input.message);
        await persistResponse(
          ctx,
          args.threadId,
          session.state.sessionId,
          input.generation.nextStreamIndex,
          response,
        );
      } else {
        const { response, session } = await client.sessions.create({
          message: input.message,
        });
        await ctx.runMutation(components.eve.runtime.bindSession, {
          ...actor,
          eveSessionId: session.state.sessionId,
          threadId: args.threadId,
        });
        await persistResponse(
          ctx,
          args.threadId,
          session.state.sessionId,
          0,
          response,
        );
      }
    } catch (error) {
      await ctx.runMutation(components.eve.runtime.failDelivery, {
        ...actor,
        clientMessageId: args.clientMessageId,
        error: error instanceof Error ? error.message : String(error),
        threadId: args.threadId,
      });
    }
  },
});

export const dispatchResponse = internalAction({
  args: {
    threadId: v.string(),
    responses: v.array(
      v.object({
        requestId: v.string(),
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
    const response = await session.respond(args.responses as InputResponse[]);
    await persistResponse(
      ctx,
      args.threadId,
      session.state.sessionId,
      thread.generation.nextStreamIndex,
      response,
    );
  },
});

function eveClient() {
  const host = process.env.EVE_AGENT_URL;
  if (!host) throw new ConvexError("EVE_AGENT_URL is not configured");
  const token = process.env.EVE_AGENT_TOKEN;
  return new Client({
    host,
    auth: token ? { bearer: token } : undefined,
    redirect: token ? "error" : undefined,
  });
}

async function persistResponse(
  ctx: ActionCtx,
  threadId: string,
  eveSessionId: string,
  startIndex: number,
  response: AsyncIterable<unknown>,
) {
  let streamIndex = startIndex;
  for await (const event of response) {
    const serializable = JSON.parse(JSON.stringify(event));
    await ctx.runMutation(components.eve.runtime.ingestEvent, {
      ...actor,
      event: serializable,
      eveSessionId,
      streamIndex,
      threadId,
    });
    streamIndex += 1;
  }
}
