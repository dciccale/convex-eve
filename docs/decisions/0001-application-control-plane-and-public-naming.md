# ADR 0001: Application control plane and public naming

- Status: Superseded by the Eve-backed Agent component v0.1 PRD
- Date: 2026-08-07
- Applies to: `convex-eve` 0.1 and the performance coach example

The naming analysis remains useful, but the broader application-control-plane
scope in this decision is historical. See
[`../convex-eve-agent-v0.1-prd.md`](../convex-eve-agent-v0.1-prd.md) for the
current direction.

## Context

Applications integrating an Eve harness need durable threads, reactive message
history, run state, tool activity, approvals, usage, pagination, and optimistic
UI behavior. `@convex-dev/agent` already offers many of those application
ergonomics, but combines them with an AI SDK execution model: model generation,
prompt context, tools, and message persistence are coordinated by its Agent
class.

In this project, Eve owns that execution lifecycle. Installing another agent
runtime only to reuse its thread and message storage would create two competing
models of context, streaming, tool calls, and session continuation.

The package name and import path already identify the Eve integration. Repeating
`Eve` in every method and hook name would make application code noisier without
making the operation more precise.

## Decision

`convex-eve` is independent from `@convex-dev/agent`. It provides the
application-facing control plane needed for chat and non-chat agent products:

- stable application threads;
- normalized messages and message parts;
- runs, steps, tool activity, approvals, and input requests;
- realtime Convex queries and stable pagination;
- optimistic, idempotent command submission;
- usage, synchronization, and failure projections; and
- reset and replacement of the Eve session behind a stable thread.

Eve remains authoritative for model loops, instructions, context, skills,
tools, subagents, sandboxes, workflows, and the ordered session event stream.
Convex projections are application views, not a second workflow journal.

We will not build a generic runtime-agnostic Convex agent component in 0.1. If
the projection layer later proves useful outside Eve, it may be extracted behind
the existing `convex-eve` API after its invariants are proven in production.

## Public naming

Use the following naming rules:

1. The server client instance provides the namespace, so its methods stay
   concise:

   ```ts
   export const eve = new ConvexEve(components.eve);

   await eve.createThread(ctx, input);
   await eve.sendMessage(ctx, input);
   await eve.listMessages(ctx, input);
   ```

2. Application-facing projection types use their domain names without a
   product prefix. A thread, message, or run does not become Eve-specific merely
   because Eve produced the underlying events:

   ```ts
   import type { Message, MessagePart, Thread } from "convex-eve";
   ```

   The package import already supplies the namespace. Consumers that have a
   local collision can use ordinary TypeScript aliases:

   ```ts
   import type { Message as AgentMessage } from "convex-eve";
   ```

3. React exports live under `convex-eve/react`. The import path supplies the
   product context, so hook names describe only what they do:

   ```ts
   import {
     useSendMessage,
     useThread,
     useThreads,
     useUIMessages,
   } from "convex-eve/react";
   ```

   Do not use names such as `useEveMessages` or `useEveThread`.

4. React hooks remain thin helpers over host-exported Convex functions. They do
   not bypass host authentication or expose component functions directly to a
   browser.

5. Prefixes are reserved for types whose semantics genuinely belong to a
   boundary. For example, an `EveSessionEvent` is an event from Eve, while a
   `BridgeCommandV1` is a versioned bridge payload. Do not use `Eve`, `Convex`,
   or `ConvexEve` merely to avoid possible import-name collisions.

6. The core persistence contract does not depend on the AI SDK `UIMessage`
   type. `Message` and `MessagePart` are canonical application projections.
   `UIMessage` is a rendering view, and optional AI SDK conversion belongs in a
   separate export such as `convex-eve/ai`.

## Thread and session identity

An application thread is stable product identity. It points to at most one
active root Eve session generation. Resetting or replacing that session does
not change the thread ID or erase the application-visible history unless the
host explicitly requests deletion.

Every projected Eve event is ordered by `(eveSessionId, streamIndex)`. Message
IDs, event IDs, and Convex document IDs are never used as stream ordering keys.

## Consequences

- A chat application needs only `convex-eve`, Eve, and its host Convex
  functions; it does not also install `@convex-dev/agent`.
- Non-chat applications use the same threads, runs, commands, approvals, and
  projections without importing React or AI SDK helpers.
- We must implement message projection, pagination, optimistic correlation, and
  React helpers ourselves.
- RAG, model context, and agent orchestration stay in Eve or in application
  tools; they are not duplicated in the component.
- Compatibility with `@convex-dev/agent` is not promised. A future migration or
  interoperability adapter would be an optional package surface.
