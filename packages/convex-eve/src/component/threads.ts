import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { generationDocValidator, threadDocValidator } from "./schema";
import { currentGeneration, MAX_TITLE_LENGTH, requireThread } from "./shared";

const actorArgs = { scopeId: v.string(), subjectId: v.string() } as const;

export const create = mutation({
  args: {
    ...actorArgs,
    agentId: v.string(),
    title: v.optional(v.string()),
  },
  returns: v.id("threads"),
  handler: async (ctx, args) => {
    const title = (args.title?.trim() || "New conversation").slice(
      0,
      MAX_TITLE_LENGTH,
    );
    if (!args.agentId.trim()) throw new ConvexError("agent_id_required");
    const now = Date.now();
    const threadId = await ctx.db.insert("threads", {
      scopeId: args.scopeId,
      ownerSubjectId: args.subjectId,
      agentId: args.agentId,
      title,
      status: "ready",
      currentGeneration: 0,
      createdAt: now,
      updatedAt: now,
    });
    await ctx.db.insert("generations", {
      threadId,
      generation: 0,
      nextStreamIndex: 0,
      projection: { messages: [] },
      status: "unbound",
      createdAt: now,
      updatedAt: now,
    });
    return threadId;
  },
});

export const get = query({
  args: { ...actorArgs, threadId: v.id("threads") },
  returns: threadDocValidator.extend({ generation: generationDocValidator }),
  handler: async (ctx, args) => {
    const thread = await requireThread(ctx, args.threadId, args);
    const generation = await currentGeneration(ctx, thread);
    return { ...thread, generation };
  },
});

export const remove = mutation({
  args: { ...actorArgs, threadId: v.id("threads") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const thread = await requireThread(ctx, args.threadId, args);
    const generations = await ctx.db
      .query("generations")
      .withIndex("by_thread_generation", (q) => q.eq("threadId", thread._id))
      .collect();
    const messages = await ctx.db
      .query("messages")
      .withIndex("by_thread_order", (q) => q.eq("threadId", thread._id))
      .collect();
    const deliveries = await ctx.db
      .query("deliveries")
      .withIndex("by_thread_client_message", (q) =>
        q.eq("threadId", thread._id),
      )
      .collect();

    for (const generation of generations) {
      const coordinates = await ctx.db
        .query("eventCoordinates")
        .withIndex("by_generation_stream_index", (q) =>
          q.eq("generationId", generation._id),
        )
        .collect();
      for (const coordinate of coordinates) await ctx.db.delete(coordinate._id);
    }
    for (const delivery of deliveries) await ctx.db.delete(delivery._id);
    for (const message of messages) await ctx.db.delete(message._id);
    for (const generation of generations) await ctx.db.delete(generation._id);
    await ctx.db.delete(thread._id);
    return null;
  },
});

export const list = query({
  args: { ...actorArgs, agentId: v.optional(v.string()) },
  returns: v.array(threadDocValidator),
  handler: async (ctx, args) => {
    const agentId = args.agentId;
    if (agentId) {
      return await ctx.db
        .query("threads")
        .withIndex("by_scope_subject_agent_updated", (q) =>
          q
            .eq("scopeId", args.scopeId)
            .eq("ownerSubjectId", args.subjectId)
            .eq("agentId", agentId),
        )
        .order("desc")
        .take(100);
    }
    return await ctx.db
      .query("threads")
      .withIndex("by_scope_subject_updated", (q) =>
        q.eq("scopeId", args.scopeId).eq("ownerSubjectId", args.subjectId),
      )
      .order("desc")
      .take(100);
  },
});
