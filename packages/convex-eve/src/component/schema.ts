import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export const schema = defineSchema({
  threads: defineTable({
    scopeId: v.string(),
    ownerSubjectId: v.string(),
    agentId: v.string(),
    title: v.string(),
    status: v.union(
      v.literal("ready"),
      v.literal("queued"),
      v.literal("streaming"),
      v.literal("waiting_input"),
      v.literal("failed"),
      v.literal("closed"),
    ),
    currentGeneration: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_scope_subject_updated", [
      "scopeId",
      "ownerSubjectId",
      "updatedAt",
    ])
    .index("by_scope_subject_agent_updated", [
      "scopeId",
      "ownerSubjectId",
      "agentId",
      "updatedAt",
    ]),

  generations: defineTable({
    threadId: v.id("threads"),
    generation: v.number(),
    eveSessionId: v.optional(v.string()),
    nextStreamIndex: v.number(),
    projection: v.any(),
    status: v.union(
      v.literal("unbound"),
      v.literal("active"),
      v.literal("waiting"),
      v.literal("failed"),
      v.literal("retired"),
    ),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_thread_generation", ["threadId", "generation"])
    .index("by_eve_session", ["eveSessionId"]),

  messages: defineTable({
    threadId: v.id("threads"),
    generationId: v.id("generations"),
    eveMessageId: v.optional(v.string()),
    clientMessageId: v.optional(v.string()),
    turnId: v.optional(v.string()),
    role: v.union(v.literal("user"), v.literal("assistant")),
    status: v.union(
      v.literal("pending"),
      v.literal("streaming"),
      v.literal("complete"),
      v.literal("failed"),
    ),
    order: v.number(),
    parts: v.array(v.any()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_thread_order", ["threadId", "order"])
    .index("by_generation_eve_message", ["generationId", "eveMessageId"])
    .index("by_thread_client_message", ["threadId", "clientMessageId"]),

  deliveries: defineTable({
    threadId: v.id("threads"),
    generationId: v.id("generations"),
    messageId: v.id("messages"),
    clientMessageId: v.string(),
    state: v.union(
      v.literal("queued"),
      v.literal("dispatching"),
      v.literal("streaming"),
      v.literal("accepted"),
      v.literal("failed"),
    ),
    attemptCount: v.number(),
    error: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_thread_client_message", ["threadId", "clientMessageId"])
    .index("by_generation_state_created", [
      "generationId",
      "state",
      "createdAt",
    ]),

  eventCoordinates: defineTable({
    generationId: v.id("generations"),
    eveSessionId: v.string(),
    streamIndex: v.number(),
    eventId: v.optional(v.string()),
    eventType: v.string(),
    receivedAt: v.number(),
  })
    .index("by_generation_stream_index", ["generationId", "streamIndex"])
    .index("by_generation_event_id", ["generationId", "eventId"]),
});

export const threadDocValidator = schema.tables.threads.validator.extend({
  _id: v.id("threads"),
  _creationTime: v.number(),
});

export const generationDocValidator =
  schema.tables.generations.validator.extend({
    _id: v.id("generations"),
    _creationTime: v.number(),
  });

export const deliveryDocValidator = schema.tables.deliveries.validator.extend({
  _id: v.id("deliveries"),
  _creationTime: v.number(),
});

export default schema;
