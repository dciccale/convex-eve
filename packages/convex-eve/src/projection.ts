import type { MessageStreamEvent } from "eve/client";
import { defaultMessageReducer } from "eve/client";
import type { EveMessage, EveMessageData, EveMessagePart } from "eve/react";

const MAX_TEXT_LENGTH = 64_000;
const MAX_LABEL_LENGTH = 500;

function bounded(value: unknown, maximum = MAX_LABEL_LENGTH): string {
  return String(value ?? "").slice(0, maximum);
}

function safeUrl(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  return value.startsWith("https://") || value.startsWith("http://")
    ? value.slice(0, 4_096)
    : undefined;
}

function sanitizeInputRequest(value: unknown) {
  if (!value || typeof value !== "object") return undefined;
  const request = value as Record<string, unknown>;
  if (typeof request.requestId !== "string") return undefined;
  const options = Array.isArray(request.options)
    ? request.options.slice(0, 20).map((option) => {
        const item = (option ?? {}) as Record<string, unknown>;
        return {
          description:
            typeof item.description === "string"
              ? bounded(item.description)
              : undefined,
          id: bounded(item.id, 200),
          label: bounded(item.label, 200),
          style:
            item.style === "danger" ||
            item.style === "default" ||
            item.style === "primary"
              ? item.style
              : undefined,
        };
      })
    : undefined;
  return {
    allowFreeform:
      typeof request.allowFreeform === "boolean"
        ? request.allowFreeform
        : undefined,
    display:
      request.display === "confirmation" ||
      request.display === "select" ||
      request.display === "text"
        ? request.display
        : undefined,
    kind: bounded(request.kind, 100),
    options,
    prompt: bounded(request.prompt, 2_000),
    requestId: bounded(request.requestId, 200),
  };
}

function sanitizePart(part: EveMessagePart): EveMessagePart | undefined {
  if (part.type === "reasoning") return undefined;
  if (part.type === "text") {
    return {
      state: part.state,
      stepIndex: part.stepIndex,
      text: bounded(part.text, MAX_TEXT_LENGTH),
      type: "text",
    };
  }
  if (part.type === "file") {
    return {
      filename: part.filename ? bounded(part.filename, 500) : undefined,
      mediaType: bounded(part.mediaType, 200),
      size: part.size,
      stepIndex: part.stepIndex,
      type: "file",
      url: safeUrl(part.url),
    };
  }
  if (part.type === "step-start") return { type: "step-start" };
  if (part.type === "authorization") {
    return {
      authorization: part.authorization
        ? {
            displayName: part.authorization.displayName
              ? bounded(part.authorization.displayName)
              : undefined,
            expiresAt: part.authorization.expiresAt,
            instructions: part.authorization.instructions
              ? bounded(part.authorization.instructions, 2_000)
              : undefined,
            url: safeUrl(part.authorization.url),
            userCode: part.authorization.userCode
              ? bounded(part.authorization.userCode, 200)
              : undefined,
          }
        : undefined,
      description: bounded(part.description, 2_000),
      displayName: bounded(part.displayName),
      name: bounded(part.name, 200),
      outcome: part.state === "completed" ? part.outcome : undefined,
      reason:
        part.state === "completed" && part.reason
          ? bounded(part.reason, 1_000)
          : undefined,
      state: part.state,
      stepIndex: part.stepIndex,
      turnId: bounded(part.turnId, 200),
      type: "authorization",
    } as EveMessagePart;
  }

  const eve = part.toolMetadata?.eve;
  const approval = part.approval
    ? {
        approved:
          "approved" in part.approval ? part.approval.approved : undefined,
        id: bounded(part.approval.id, 200),
        isAutomatic: part.approval.isAutomatic,
        reason: part.approval.reason
          ? bounded(part.approval.reason, 1_000)
          : undefined,
      }
    : undefined;
  const base = {
    approval,
    input: "[redacted by convex-eve]",
    state: part.state,
    stepIndex: part.stepIndex,
    toolCallId: bounded(part.toolCallId, 200),
    toolMetadata: eve
      ? {
          eve: {
            inputRequest: sanitizeInputRequest(eve.inputRequest),
            inputResponse: eve.inputResponse
              ? {
                  optionId: eve.inputResponse.optionId,
                  requestId: bounded(eve.inputResponse.requestId, 200),
                  text: eve.inputResponse.text
                    ? bounded(eve.inputResponse.text, 2_000)
                    : undefined,
                }
              : undefined,
            kind: eve.kind,
            name: bounded(eve.name, 200),
          },
        }
      : undefined,
    toolName: bounded(part.toolName, 200),
    type: "dynamic-tool" as const,
  };
  if (part.state === "output-available") {
    return {
      ...base,
      output: "[redacted by convex-eve]",
      partial: part.partial,
    } as EveMessagePart;
  }
  if (part.state === "output-error") {
    return {
      ...base,
      errorText: bounded(part.errorText, 1_000),
    } as EveMessagePart;
  }
  return base as EveMessagePart;
}

export function sanitizeEveMessage(message: EveMessage): EveMessage {
  const parts = message.parts
    .map(sanitizePart)
    .filter((part): part is EveMessagePart => part !== undefined);
  return {
    id: bounded(message.id, 300),
    metadata: message.metadata
      ? {
          optimistic: message.metadata.optimistic,
          status: message.metadata.status,
          turnId: message.metadata.turnId
            ? bounded(message.metadata.turnId, 200)
            : undefined,
        }
      : undefined,
    parts,
    role: message.role,
  };
}

export function applyEveEvent(
  projection: EveMessageData,
  event: MessageStreamEvent,
): EveMessageData {
  const next = defaultMessageReducer().reduce(projection, event);
  return { messages: next.messages.map(sanitizeEveMessage) };
}
