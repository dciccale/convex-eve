import { conversationOf, type SessionStreamEvent } from "eve/client";
import {
  activeTurn,
  deliveries,
  idle,
  openInteractions,
  session,
  turns,
} from "eve/events";
import type { EveMessage, EveMessagePart } from "eve/react";
import { z } from "zod";

const id = z.string().min(1).max(500);
const label = z.string().transform((value) => value.slice(0, 500));
const text = z.string().transform((value) => value.slice(0, 64_000));
const optionalUrl = z
  .string()
  .transform((value) =>
    /^https?:\/\//.test(value) ? value.slice(0, 4096) : undefined,
  )
  .optional();
const answer = z.object({
  interactionId: id,
  optionId: id.optional(),
  text: text.optional(),
});

// Strip unknown fields at the component boundary. Sign-in credentials, tool
// payloads, reasoning, and structured results never enter component storage.
const interaction = z.object({
  interactionId: id,
  turnId: id,
  stepIndex: z.number().int().nonnegative(),
  taskId: id.optional(),
  request: z.object({
    kind: z.enum(["approval", "question", "sign-in", "budget"]),
    prompt: text,
    title: label.optional(),
    options: z
      .array(
        z.object({
          id,
          label,
          description: label.optional(),
          style: z.enum(["primary", "danger", "default"]).optional(),
        }),
      )
      .max(20)
      .optional(),
    allowFreeform: z.boolean().optional(),
    display: z.enum(["confirmation", "select", "text"]).optional(),
    signIn: z.object({ name: label, displayName: label.optional() }).optional(),
  }),
  call: z.object({ callId: id, name: label }).optional(),
  status: z.enum(["open", "settled"]),
  outcome: z
    .enum([
      "accepted",
      "declined",
      "invalid",
      "failed",
      "withdrawn",
      "interrupted",
      "abandoned",
      "expired",
    ])
    .optional(),
  answer: answer.optional(),
});
const toolBase = z.object({
  type: z.literal("tool"),
  callId: id,
  stepIndex: z.number().int().nonnegative(),
  kind: z.enum(["tool", "agent", "skill", "control"]),
  name: label,
  label,
  hidden: z.literal(true).optional(),
  interaction: interaction.optional(),
});
const part = z.union([
  z.object({
    type: z.literal("text"),
    id: id.optional(),
    text,
    state: z.enum(["done", "streaming"]).optional(),
    stepIndex: z.number().int().nonnegative().optional(),
  }),
  z.object({ type: z.literal("reasoning") }).transform(() => undefined),
  z.object({
    type: z.literal("file"),
    filename: label.optional(),
    mediaType: label,
    size: z.number().nonnegative().optional(),
    url: optionalUrl,
    stepIndex: z.number().int().nonnegative().optional(),
  }),
  interaction.extend({ type: z.literal("interaction") }),
  toolBase.extend({ state: z.literal("streaming") }).transform((value) => ({
    ...value,
    inputText: "[redacted by convex-eve]",
  })),
  toolBase.extend({
    state: z.enum([
      "requested",
      "approval",
      "running",
      "blocked",
      "completed",
      "failed",
      "rejected",
      "cancelled",
    ]),
  }),
]);
const message = z.object({
  id,
  role: z.enum(["user", "assistant"]),
  metadata: z
    .object({
      optimistic: z.literal(true).optional(),
      imported: z.literal(true).optional(),
      historyId: id.optional(),
      turnId: id.optional(),
      status: z
        .enum(["complete", "failed", "streaming", "submitted"])
        .optional(),
    })
    .optional(),
  parts: z
    .array(part)
    .transform((parts): EveMessagePart[] =>
      parts.filter((part) => part !== undefined),
    ),
}) satisfies z.ZodType<EveMessage>;

export function sanitizeEveMessage(value: unknown): EveMessage {
  return message.parse(value);
}

export const projectionCheckpointSchema = z
  .object({
    streamVersion: z.literal(27),
    line: z.number().int().nonnegative(),
    index: z.number().int().nonnegative(),
    nextStreamIndex: z.number().int().positive(),
    messages: z.array(message),
    status: z.enum(["closed", "failed", "ready", "streaming", "waiting_input"]),
    sessionStatus: z.enum(["active", "waiting", "retired", "failed"]),
    deliveries: z.array(
      z.object({
        deliveryId: id,
        consumed: z.boolean(),
        outcome: z
          .enum([
            "handled",
            "awaiting-input",
            "applied",
            "ignored",
            "refused",
            "failed",
          ])
          .optional(),
      }),
    ),
  })
  .refine(
    (value) => value.nextStreamIndex > value.line,
    "invalid_complete_line_cursor",
  );
export type ProjectionCheckpoint = z.infer<typeof projectionCheckpointSchema>;

/** Replay from line zero; persist only sanitized snapshots at complete lines. */
export async function* projectEveStream(
  source: AsyncIterable<SessionStreamEvent>,
  afterStreamIndex = 0,
): AsyncGenerator<ProjectionCheckpoint> {
  const events: SessionStreamEvent[] = [];
  let previous: SessionStreamEvent["meta"]["position"] | undefined;
  let complete = true;
  for await (const event of source) {
    if (events.length === 0 && event.type !== "session.started")
      throw new Error("eve_projection_requires_full_history");
    const coordinate = event.meta.position;
    if (
      previous &&
      (coordinate.line < previous.line ||
        (coordinate.line === previous.line &&
          coordinate.index <= previous.index))
    )
      continue;
    if (!complete && coordinate.line !== previous?.line)
      throw new Error("incomplete_eve_line");
    events.push(event);
    previous = coordinate;
    complete = event.meta.endOfLine !== false;
    if (!complete) continue;
    const nextStreamIndex = event.meta.next ?? coordinate.line + 1;
    if (nextStreamIndex <= afterStreamIndex) continue;
    const state = conversationOf(events);
    const view = state.view;
    const ended = session(view).status === "ended";
    const failed = session(view).outcome === "failed";
    const waiting = openInteractions(view).length > 0;
    const lastTurn = turns(view).at(-1);
    const status = ended
      ? failed
        ? "failed"
        : "closed"
      : waiting
        ? "waiting_input"
        : idle(view) && !activeTurn(view)
          ? lastTurn?.outcome === "failed"
            ? "failed"
            : "ready"
          : "streaming";
    yield projectionCheckpointSchema.parse({
      streamVersion: 27,
      ...coordinate,
      nextStreamIndex,
      messages: state.messages,
      status,
      sessionStatus: ended
        ? failed
          ? "failed"
          : "retired"
        : waiting || status === "ready"
          ? "waiting"
          : "active",
      deliveries: deliveries(view).map((delivery) => ({
        deliveryId: delivery.deliveryId,
        consumed: delivery.parts !== undefined && delivery.parts.length > 0,
        outcome: delivery.outcome,
      })),
    });
  }
  if (!complete) throw new Error("incomplete_eve_line");
}
