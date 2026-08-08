import {
  paginationOptsValidator,
  paginationResultValidator,
} from "convex/server";
import { ConvexError, v } from "convex/values";
import { paginator } from "convex-helpers/server/pagination";
import type { Doc } from "./_generated/dataModel";
import { mutation, query } from "./_generated/server";
import { schema } from "./schema";
import { currentGeneration, MAX_MESSAGE_LENGTH, requireThread } from "./shared";

const actorArgs = { scopeId: v.string(), subjectId: v.string() } as const;

function metadataStatus(
  status: Doc<"messages">["status"],
): "submitted" | "streaming" | "complete" | "failed" {
  return status === "pending" ? "submitted" : status;
}

const projectedMessageValidator = v.object({
  _creationTime: v.number(),
  _id: v.id("messages"),
  id: v.string(),
  metadata: v.object({
    status: v.union(
      v.literal("submitted"),
      v.literal("streaming"),
      v.literal("complete"),
      v.literal("failed"),
    ),
    turnId: v.optional(v.string()),
  }),
  order: v.number(),
  parts: v.array(v.any()),
  role: v.union(v.literal("user"), v.literal("assistant")),
  status: v.union(
    v.literal("pending"),
    v.literal("streaming"),
    v.literal("complete"),
    v.literal("failed"),
  ),
  threadId: v.id("threads"),
});

export const createPending = mutation({
  args: {
    ...actorArgs,
    agentId: v.string(),
    threadId: v.id("threads"),
    clientMessageId: v.string(),
    message: v.string(),
  },
  returns: v.object({
    deliveryId: v.id("deliveries"),
    messageId: v.id("messages"),
  }),
  handler: async (ctx, args) => {
    const text = args.message.trim();
    if (!text || text.length > MAX_MESSAGE_LENGTH) {
      throw new ConvexError("message_length_invalid");
    }
    const thread = await requireThread(ctx, args.threadId, args);
    if (thread.agentId !== args.agentId) {
      throw new ConvexError("thread_agent_mismatch");
    }
    if (thread.status === "closed") throw new ConvexError("thread_closed");

    const existing = await ctx.db
      .query("deliveries")
      .withIndex("by_thread_client_message", (q) =>
        q
          .eq("threadId", args.threadId)
          .eq("clientMessageId", args.clientMessageId),
      )
      .unique();
    if (existing) {
      return { deliveryId: existing._id, messageId: existing.messageId };
    }

    const generation = await currentGeneration(ctx, thread);
    const latest = await ctx.db
      .query("messages")
      .withIndex("by_thread_order", (q) => q.eq("threadId", thread._id))
      .order("desc")
      .first();
    const now = Date.now();
    const messageId = await ctx.db.insert("messages", {
      threadId: thread._id,
      generationId: generation._id,
      clientMessageId: args.clientMessageId,
      role: "user",
      status: "pending",
      order: (latest?.order ?? -1) + 1,
      parts: [{ state: "done", text, type: "text" }],
      createdAt: now,
      updatedAt: now,
    });
    const deliveryId = await ctx.db.insert("deliveries", {
      threadId: thread._id,
      generationId: generation._id,
      messageId,
      clientMessageId: args.clientMessageId,
      state: "queued",
      attemptCount: 0,
      createdAt: now,
      updatedAt: now,
    });
    await ctx.db.patch(thread._id, { status: "queued", updatedAt: now });
    return { deliveryId, messageId };
  },
});

export const list = query({
  args: {
    ...actorArgs,
    threadId: v.id("threads"),
    paginationOpts: paginationOptsValidator,
  },
  returns: paginationResultValidator(projectedMessageValidator),
  handler: async (ctx, args) => {
    await requireThread(ctx, args.threadId, args);
    const result = await paginator(ctx.db, schema)
      .query("messages")
      .withIndex("by_thread_order", (q) => q.eq("threadId", args.threadId))
      .order("desc")
      .paginate(args.paginationOpts);
    return {
      ...result,
      page: result.page.map((message) => ({
        _creationTime: message._creationTime,
        _id: message._id,
        id: message.eveMessageId ?? message.clientMessageId ?? message._id,
        metadata: {
          status: metadataStatus(message.status),
          ...(message.turnId ? { turnId: message.turnId } : {}),
        },
        order: message.order,
        parts: message.parts,
        role: message.role,
        status: message.status,
        threadId: message.threadId,
      })),
    };
  },
});
