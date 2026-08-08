import { ConvexError, v } from "convex/values";
import type { MessageStreamEvent } from "eve/client";
import type { EveMessageData } from "eve/react";
import { decideStreamIndex } from "../cursor";
import { canClaimDelivery } from "../delivery";
import { applyEveEvent } from "../projection";
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
    if (!message) throw new ConvexError("delivery_message_not_found");
    const text = message.parts
      .filter(
        (part): part is { text: string; type: "text" } =>
          part?.type === "text" && typeof part.text === "string",
      )
      .map((part) => part.text)
      .join("\n");
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

export const ingestEvent = mutation({
  args: {
    ...actorArgs,
    threadId: v.id("threads"),
    eveSessionId: v.string(),
    streamIndex: v.number(),
    event: v.any(),
  },
  returns: v.object({ duplicate: v.boolean() }),
  handler: async (ctx, args) => {
    const thread = await requireThread(ctx, args.threadId, args);
    const generation = await currentGeneration(ctx, thread);
    if (generation.eveSessionId !== args.eveSessionId) {
      throw new ConvexError("eve_session_binding_mismatch");
    }
    const cursorDecision = decideStreamIndex(
      generation.nextStreamIndex,
      args.streamIndex,
    );
    if (cursorDecision.kind === "invalid")
      throw new ConvexError("invalid_stream_index");
    const existingCoordinate = await ctx.db
      .query("eventCoordinates")
      .withIndex("by_generation_stream_index", (q) =>
        q
          .eq("generationId", generation._id)
          .eq("streamIndex", args.streamIndex),
      )
      .unique();
    if (existingCoordinate || cursorDecision.kind === "duplicate") {
      return { duplicate: true };
    }
    if (cursorDecision.kind === "gap") {
      throw new ConvexError(
        `stream_gap:${cursorDecision.expected}:${cursorDecision.received}`,
      );
    }

    const event = args.event as {
      data?: Record<string, unknown>;
      meta?: { id?: string };
      type?: string;
    };
    if (!event || typeof event.type !== "string") {
      throw new ConvexError("invalid_eve_event");
    }
    const eventId =
      typeof event.meta?.id === "string"
        ? event.meta.id.slice(0, 300)
        : undefined;
    if (eventId) {
      const duplicateId = await ctx.db
        .query("eventCoordinates")
        .withIndex("by_generation_event_id", (q) =>
          q.eq("generationId", generation._id).eq("eventId", eventId),
        )
        .unique();
      if (duplicateId && duplicateId.streamIndex !== args.streamIndex) {
        throw new ConvexError("eve_event_id_reused");
      }
    }

    const projection = JSON.parse(
      JSON.stringify(
        applyEveEvent(
          generation.projection as EveMessageData,
          args.event as MessageStreamEvent,
        ),
      ),
    ) as EveMessageData;
    const now = Date.now();
    await synchronizeMessages(ctx, thread._id, generation._id, projection, now);
    await ctx.db.insert("eventCoordinates", {
      generationId: generation._id,
      eveSessionId: args.eveSessionId,
      streamIndex: args.streamIndex,
      eventId,
      eventType: event.type.slice(0, 200),
      receivedAt: now,
    });
    await ctx.db.patch(generation._id, {
      nextStreamIndex: cursorDecision.nextStreamIndex,
      projection,
      status:
        event.type === "session.failed"
          ? "failed"
          : event.type === "session.completed"
            ? "retired"
            : event.type === "session.waiting"
              ? "waiting"
              : "active",
      updatedAt: now,
    });

    const threadStatus =
      event.type === "input.requested"
        ? "waiting_input"
        : event.type === "session.failed" || event.type === "turn.failed"
          ? "failed"
          : event.type === "session.completed"
            ? "closed"
            : event.type === "session.waiting" ||
                event.type === "turn.completed"
              ? "ready"
              : "streaming";
    await ctx.db.patch(thread._id, { status: threadStatus, updatedAt: now });

    if (event.type === "message.received") {
      const pending = await ctx.db
        .query("deliveries")
        .withIndex("by_generation_state_created", (q) =>
          q.eq("generationId", generation._id).eq("state", "dispatching"),
        )
        .order("asc")
        .first();
      if (pending) {
        await ctx.db.patch(pending._id, { state: "accepted", updatedAt: now });
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

async function synchronizeMessages(
  ctx: MutationCtx,
  threadId: Id<"threads">,
  generationId: Id<"generations">,
  projection: EveMessageData,
  now: number,
) {
  for (const [order, projected] of projection.messages.entries()) {
    let existing = await ctx.db
      .query("messages")
      .withIndex("by_generation_eve_message", (q) =>
        q.eq("generationId", generationId).eq("eveMessageId", projected.id),
      )
      .unique();
    if (!existing && projected.role === "user") {
      const pendingDelivery = await ctx.db
        .query("deliveries")
        .withIndex("by_generation_state_created", (q) =>
          q.eq("generationId", generationId).eq("state", "dispatching"),
        )
        .order("asc")
        .first();
      if (pendingDelivery)
        existing = await ctx.db.get(pendingDelivery.messageId);
    }
    const status = normalizeStatus(projected.metadata?.status);
    if (existing) {
      await ctx.db.patch(existing._id, {
        eveMessageId: projected.id,
        order,
        parts: [...projected.parts],
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
        parts: [...projected.parts],
        role: projected.role,
        status,
        turnId: projected.metadata?.turnId,
        createdAt: now,
        updatedAt: now,
      });
    }
  }
}

function normalizeStatus(status: string | undefined) {
  if (status === "streaming") return "streaming" as const;
  if (status === "failed") return "failed" as const;
  if (status === "submitted") return "pending" as const;
  return "complete" as const;
}
