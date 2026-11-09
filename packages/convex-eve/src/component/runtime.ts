import { ConvexError, v } from "convex/values";
import { decideCheckpoint } from "../cursor";
import { canClaimDelivery } from "../delivery";
import {
  type ProjectionCheckpoint,
  projectionCheckpointSchema,
} from "../projection";
import type { Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { mutation, query } from "./_generated/server";
import {
  deliveryDocValidator,
  generationDocValidator,
  threadDocValidator,
} from "./schema";
import { currentGeneration, requireThread, safeError } from "./shared";

const actorArgs = { scopeId: v.string(), subjectId: v.string() } as const;

export const getDelivery = query({
  args: {
    ...actorArgs,
    threadId: v.id("threads"),
    clientMessageId: v.string(),
  },
  returns: v.object({
    delivery: deliveryDocValidator,
    generation: generationDocValidator,
    message: v.string(),
    thread: threadDocValidator,
  }),
  handler: async (ctx, args) => {
    const thread = await requireThread(ctx, args.threadId, args);
    const generation = await currentGeneration(ctx, thread);
    const delivery = await ctx.db
      .query("deliveries")
      .withIndex("by_thread_client_message", (q) =>
        q
          .eq("threadId", thread._id)
          .eq("clientMessageId", args.clientMessageId),
      )
      .unique();
    if (!delivery) throw new ConvexError("delivery_not_found");
    if (delivery.generationId !== generation._id) {
      throw new ConvexError("delivery_generation_mismatch");
    }
    const message = await ctx.db.get(delivery.messageId);
    if (!message && delivery.messageText === undefined)
      throw new ConvexError("delivery_message_not_found");
    const text =
      delivery.messageText ??
      message?.parts
        .filter(
          (part): part is { text: string; type: "text" } =>
            part?.type === "text" && typeof part.text === "string",
        )
        .map((part) => part.text)
        .join("\n") ??
      "";
    return { delivery, generation, message: text, thread };
  },
});

export const markDispatching = mutation({
  args: {
    ...actorArgs,
    threadId: v.id("threads"),
    clientMessageId: v.string(),
  },
  returns: v.object({ claimed: v.boolean(), deliveryId: v.id("deliveries") }),
  handler: async (ctx, args) => {
    const thread = await requireThread(ctx, args.threadId, args);
    const generation = await currentGeneration(ctx, thread);
    if (generation.streamVersion !== 27)
      throw new ConvexError("legacy_thread_read_only");
    const delivery = await ctx.db
      .query("deliveries")
      .withIndex("by_thread_client_message", (q) =>
        q
          .eq("threadId", thread._id)
          .eq("clientMessageId", args.clientMessageId),
      )
      .unique();
    if (!delivery) throw new ConvexError("delivery_not_found");
    if (!canClaimDelivery(delivery.state)) {
      return { claimed: false, deliveryId: delivery._id };
    }
    const dispatching = await ctx.db
      .query("deliveries")
      .withIndex("by_generation_state_created", (q) =>
        q.eq("generationId", delivery.generationId).eq("state", "dispatching"),
      )
      .first();
    const streaming = await ctx.db
      .query("deliveries")
      .withIndex("by_generation_state_created", (q) =>
        q.eq("generationId", delivery.generationId).eq("state", "streaming"),
      )
      .first();
    const unknown = await ctx.db
      .query("deliveries")
      .withIndex("by_generation_state_created", (q) =>
        q.eq("generationId", delivery.generationId).eq("state", "unknown"),
      )
      .first();
    if (dispatching || streaming || unknown) {
      return { claimed: false, deliveryId: delivery._id };
    }
    const now = Date.now();
    await ctx.db.patch(delivery._id, {
      attemptCount: delivery.attemptCount + 1,
      error: undefined,
      state: "dispatching",
      updatedAt: now,
    });
    await ctx.db.patch(thread._id, { status: "streaming", updatedAt: now });
    return { claimed: true, deliveryId: delivery._id };
  },
});

export const getNextQueuedDelivery = query({
  args: {
    ...actorArgs,
    threadId: v.id("threads"),
  },
  returns: v.union(v.null(), v.object({ clientMessageId: v.string() })),
  handler: async (ctx, args) => {
    const thread = await requireThread(ctx, args.threadId, args);
    const generation = await currentGeneration(ctx, thread);
    for (const state of ["dispatching", "streaming", "unknown"] as const) {
      const blocked = await ctx.db
        .query("deliveries")
        .withIndex("by_generation_state_created", (q) =>
          q.eq("generationId", generation._id).eq("state", state),
        )
        .first();
      if (blocked) return null;
    }
    const delivery = await ctx.db
      .query("deliveries")
      .withIndex("by_generation_state_created", (q) =>
        q.eq("generationId", generation._id).eq("state", "queued"),
      )
      .order("asc")
      .first();
    return delivery ? { clientMessageId: delivery.clientMessageId } : null;
  },
});

export const bindSession = mutation({
  args: {
    ...actorArgs,
    threadId: v.id("threads"),
    eveSessionId: v.string(),
  },
  returns: v.id("generations"),
  handler: async (ctx, args) => {
    const thread = await requireThread(ctx, args.threadId, args);
    const generation = await currentGeneration(ctx, thread);
    if (generation.streamVersion !== 27)
      throw new ConvexError("legacy_thread_read_only");
    if (
      generation.eveSessionId &&
      generation.eveSessionId !== args.eveSessionId
    ) {
      throw new ConvexError("eve_session_binding_conflict");
    }
    const claimed = await ctx.db
      .query("generations")
      .withIndex("by_eve_session", (q) =>
        q.eq("eveSessionId", args.eveSessionId),
      )
      .unique();
    if (claimed && claimed._id !== generation._id) {
      throw new ConvexError("eve_session_already_bound");
    }
    await ctx.db.patch(generation._id, {
      eveSessionId: args.eveSessionId,
      status: "active",
      updatedAt: Date.now(),
    });
    return generation._id;
  },
});

export const markStreaming = mutation({
  args: {
    ...actorArgs,
    threadId: v.id("threads"),
    clientMessageId: v.string(),
    eveDeliveryId: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const thread = await requireThread(ctx, args.threadId, args);
    const delivery = await ctx.db
      .query("deliveries")
      .withIndex("by_thread_client_message", (q) =>
        q
          .eq("threadId", thread._id)
          .eq("clientMessageId", args.clientMessageId),
      )
      .unique();
    if (!delivery) throw new ConvexError("delivery_not_found");
    if (delivery.state !== "dispatching" && delivery.state !== "unknown") {
      throw new ConvexError("delivery_transition_invalid");
    }
    if (delivery.eveDeliveryId && delivery.eveDeliveryId !== args.eveDeliveryId)
      throw new ConvexError("eve_delivery_binding_conflict");
    const now = Date.now();
    await ctx.db.patch(delivery._id, {
      error: undefined,
      state: "streaming",
      eveDeliveryId: args.eveDeliveryId,
      updatedAt: now,
    });
    await ctx.db.patch(thread._id, { status: "streaming", updatedAt: now });
    return null;
  },
});

/** Commit one cumulative host projection. The host must replay from line zero. */
export const ingestProjection = mutation({
  args: {
    ...actorArgs,
    threadId: v.id("threads"),
    eveSessionId: v.string(),
    checkpoint: v.any(),
  },
  returns: v.object({ duplicate: v.boolean() }),
  handler: async (ctx, args) => {
    const thread = await requireThread(ctx, args.threadId, args);
    const generation = await currentGeneration(ctx, thread);
    if (generation.streamVersion !== 27)
      throw new ConvexError("legacy_thread_read_only");
    if (generation.eveSessionId !== args.eveSessionId)
      throw new ConvexError("eve_session_binding_mismatch");
    const parsed = projectionCheckpointSchema.safeParse(args.checkpoint);
    if (!parsed.success) throw new ConvexError("invalid_eve_projection");
    const checkpoint = parsed.data;
    const decision = decideCheckpoint(generation.nextStreamIndex, checkpoint);
    if (decision === "invalid")
      throw new ConvexError("invalid_stream_position");
    if (decision === "duplicate") return { duplicate: true };
    const now = Date.now();
    await synchronizeMessages(ctx, thread._id, generation._id, checkpoint, now);
    await ctx.db.insert("eventCoordinates", {
      generationId: generation._id,
      eveSessionId: args.eveSessionId,
      streamIndex: checkpoint.line,
      eventIndex: checkpoint.index,
      eventType: "projection.checkpoint",
      receivedAt: now,
    });
    await ctx.db.patch(generation._id, {
      nextStreamIndex: checkpoint.nextStreamIndex,
      status: checkpoint.sessionStatus,
      updatedAt: now,
    });
    await ctx.db.patch(thread._id, {
      status: checkpoint.status,
      updatedAt: now,
    });
    const active = await activeDelivery(ctx, generation._id, [
      "dispatching",
      "streaming",
      "unknown",
    ]);
    if (active?.eveDeliveryId) {
      const receipt = checkpoint.deliveries.find(
        (item) => item.deliveryId === active.eveDeliveryId,
      );
      if (receipt?.outcome) {
        const failed =
          receipt.outcome === "failed" || receipt.outcome === "refused";
        await ctx.db.patch(active._id, {
          state: failed ? "failed" : "accepted",
          error: undefined,
          updatedAt: now,
        });
        if (failed && (await ctx.db.get(active.messageId)))
          await ctx.db.patch(active.messageId, {
            status: "failed",
            updatedAt: now,
          });
      } else if (receipt?.consumed) {
        await ctx.db.patch(active._id, {
          state: "streaming",
          error: undefined,
          updatedAt: now,
        });
      }
    }
    return { duplicate: false };
  },
});

export const failDelivery = mutation({
  args: {
    ...actorArgs,
    threadId: v.id("threads"),
    clientMessageId: v.string(),
    error: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const thread = await requireThread(ctx, args.threadId, args);
    const delivery = await ctx.db
      .query("deliveries")
      .withIndex("by_thread_client_message", (q) =>
        q
          .eq("threadId", thread._id)
          .eq("clientMessageId", args.clientMessageId),
      )
      .unique();
    if (!delivery) throw new ConvexError("delivery_not_found");
    if (delivery.state !== "dispatching") {
      throw new ConvexError("delivery_transition_invalid");
    }
    const now = Date.now();
    await ctx.db.patch(delivery._id, {
      error: safeError(args.error),
      state: "failed",
      updatedAt: now,
    });
    await ctx.db.patch(delivery.messageId, {
      status: "failed",
      updatedAt: now,
    });
    await ctx.db.patch(thread._id, { status: "failed", updatedAt: now });
    return null;
  },
});

export const markDeliveryUnknown = mutation({
  args: {
    ...actorArgs,
    threadId: v.id("threads"),
    clientMessageId: v.string(),
    error: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const thread = await requireThread(ctx, args.threadId, args);
    const delivery = await ctx.db
      .query("deliveries")
      .withIndex("by_thread_client_message", (q) =>
        q
          .eq("threadId", thread._id)
          .eq("clientMessageId", args.clientMessageId),
      )
      .unique();
    if (!delivery) throw new ConvexError("delivery_not_found");
    if (delivery.state !== "dispatching") {
      throw new ConvexError("delivery_transition_invalid");
    }
    const now = Date.now();
    await ctx.db.patch(delivery._id, {
      error: safeError(args.error),
      state: "unknown",
      updatedAt: now,
    });
    await ctx.db.patch(thread._id, { status: "failed", updatedAt: now });
    return null;
  },
});

export const recordReconciliationError = mutation({
  args: {
    ...actorArgs,
    threadId: v.id("threads"),
    clientMessageId: v.string(),
    error: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const thread = await requireThread(ctx, args.threadId, args);
    const delivery = await ctx.db
      .query("deliveries")
      .withIndex("by_thread_client_message", (q) =>
        q
          .eq("threadId", thread._id)
          .eq("clientMessageId", args.clientMessageId),
      )
      .unique();
    if (!delivery) throw new ConvexError("delivery_not_found");
    if (delivery.state !== "streaming" && delivery.state !== "unknown") {
      throw new ConvexError("delivery_transition_invalid");
    }
    const now = Date.now();
    await ctx.db.patch(delivery._id, {
      error: safeError(args.error),
      updatedAt: now,
    });
    await ctx.db.patch(thread._id, { status: "failed", updatedAt: now });
    return null;
  },
});

async function synchronizeMessages(
  ctx: MutationCtx,
  threadId: Id<"threads">,
  generationId: Id<"generations">,
  checkpoint: ProjectionCheckpoint,
  now: number,
) {
  for (const [order, projected] of checkpoint.messages.entries()) {
    let existing = await ctx.db
      .query("messages")
      .withIndex("by_generation_eve_message", (q) =>
        q.eq("generationId", generationId).eq("eveMessageId", projected.id),
      )
      .unique();
    if (!existing && projected.role === "user") {
      const pendingDelivery = await activeDelivery(ctx, generationId, [
        "streaming",
        "dispatching",
        "unknown",
      ]);
      if (
        pendingDelivery?.eveDeliveryId &&
        checkpoint.deliveries.some(
          (receipt) =>
            receipt.deliveryId === pendingDelivery.eveDeliveryId &&
            receipt.consumed &&
            projected.id === `${receipt.deliveryId}:user`,
        )
      )
        existing = await ctx.db.get(pendingDelivery.messageId);
    }
    const status = normalizeStatus(projected.metadata?.status);
    if (existing) {
      await ctx.db.patch(existing._id, {
        eveMessageId: projected.id,
        order,
        parts: JSON.parse(JSON.stringify(projected.parts)),
        role: projected.role,
        status,
        turnId: projected.metadata?.turnId,
        updatedAt: now,
      });
    } else {
      await ctx.db.insert("messages", {
        threadId,
        generationId,
        eveMessageId: projected.id,
        order,
        parts: JSON.parse(JSON.stringify(projected.parts)),
        role: projected.role,
        status,
        turnId: projected.metadata?.turnId,
        createdAt: now,
        updatedAt: now,
      });
    }
  }
  const retained = new Set(checkpoint.messages.map((message) => message.id));
  const stored = await ctx.db
    .query("messages")
    .withIndex("by_generation_eve_message", (q) =>
      q.eq("generationId", generationId),
    )
    .collect();
  for (const message of stored) {
    if (message.eveMessageId && !retained.has(message.eveMessageId))
      await ctx.db.delete(message._id);
  }
}

async function activeDelivery(
  ctx: MutationCtx,
  generationId: Id<"generations">,
  states: readonly ("dispatching" | "streaming" | "unknown")[],
) {
  for (const state of states) {
    const delivery = await ctx.db
      .query("deliveries")
      .withIndex("by_generation_state_created", (q) =>
        q.eq("generationId", generationId).eq("state", state),
      )
      .order("asc")
      .first();
    if (delivery) return delivery;
  }
  return null;
}

function normalizeStatus(status: string | undefined) {
  if (status === "streaming") return "streaming" as const;
  if (status === "failed") return "failed" as const;
  if (status === "submitted") return "pending" as const;
  return "complete" as const;
}
