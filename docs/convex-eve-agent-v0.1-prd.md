---
date: 2026-08-07
status: DRAFT
product_direction: ACCEPTED
target_version: 0.1.0
owner_repo: convex-eve
working_package_name: "convex-eve"
license_target: Apache-2.0
eve_baseline_investigated: 0.31.0
related_prior_exploration: convex-eve-v0.1-prd.md
---

# Eve-backed Agent Component v0.1 PRD

## Executive decision

Build `convex-eve` as a focused Convex component for application-facing agent
experiences backed by Eve. The component owns threads, messages, renderable
message parts, pagination, streaming projections, human-input state, and React
helpers. Eve owns the complete agent harness and execution lifecycle.

The component is intentionally chat-oriented. It is not a general control plane
for every Eve session and is not required to call Eve from a Convex backend.
Non-chat applications should use `eve/client` directly and compose ordinary
Convex functions, tables, scheduled functions, Workpool, or Workflow according
to their application needs.

The package remains independent from `@convex-dev/agent`. It may preserve
familiar thread, message, pagination, `UIMessage`, and React ergonomics where
the semantics match, but it does not wrap that component and does not emulate
its AI SDK execution APIs.

The intended public identity is:

```text
Repository and package: convex-eve
Installed component:    eve
Server abstraction:     Agent
Execution harness:      Eve
```

## Product thesis

Eve makes agents substantially more capable than a model-provider abstraction:
instructions, skills, tools, subagents, sandboxes, connections, schedules,
state, durable sessions, turns, steps, human input, and event streams belong to
the Eve harness.

Convex applications still need a product-facing conversation model:

- stable threads owned by application users or subjects;
- messages available through reactive queries;
- structured parts for text, files, tool activity, and approvals;
- optimistic user-message submission;
- streaming assistant updates;
- stable pagination while streams are changing;
- thread metadata, listing, deletion, and retention; and
- a secure mapping between an application thread and an Eve session.

That mapping and projection layer is the product. General workflow durability,
queueing, and retries are infrastructure dependencies, not a unique domain that
`convex-eve` should recreate.

### Eve-native persistence decision

The component must use Eve's existing chat semantics instead of defining a
parallel protocol:

- `ClientSessionState` (`sessionId`, `streamIndex`) is the continuation cursor;
- `MessageStreamEvent` is the authoritative execution stream;
- `EveMessage`, `EveMessagePart`, and `EveMessageData` are the canonical UI
  shapes;
- Eve's `defaultMessageReducer` defines how events become UI messages; and
- `message.received`, rather than the outbound HTTP request alone, confirms
  that Eve accepted a user message.

Eve describes its session state as a remote stream cursor rather than a
transcript and recommends that database-backed chats persist events as they
arrive. It also recommends saving an application chat row and pending user
message before sending when a refresh or navigation could interrupt the
request. `convex-eve` implements that database-backed pattern for Convex.

The component may sanitize the canonical projection for persistence policy,
but it must retain Eve discriminators, identifiers, lifecycle states, and
reducer behavior. It must not invent substitute tool, approval, message, or
session concepts when Eve already names them.

```text
Application UI
      |
      v
Host Convex functions: auth, ownership, product policy
      |
      v
convex-eve: threads, messages, UI parts, pagination, Eve bindings
      |
      v
Eve adapter: message delivery and ordered event synchronization
      |
      v
Eve: sessions, turns, steps, model loop, skills, tools, subagents, sandbox
```

## Why this should be a component

The component is justified by a reusable stateful domain, not by the fact that
Eve is an external service.

Every adopting application would otherwise need to independently design:

- thread ownership and metadata;
- message ordering and status transitions;
- user-message deduplication;
- streaming text projection;
- tool-call and result parts;
- approval and question parts;
- thread-to-Eve-session lifecycle rules;
- event-to-message correlation;
- reactive pagination during streaming;
- failure rendering and retry behavior; and
- React query and optimistic-update helpers.

Those rules have durable invariants, require isolated tables, and should behave
consistently across applications. That is an appropriate Convex component
boundary.

By contrast, a generic session outbox, workflow runner, or work queue is not the
product boundary. Existing Convex primitives and components already cover those
needs.

## Direct Eve integration remains valid

An application that does not need the thread and message domain should not
install this component merely to invoke Eve:

```ts
"use node";

import { Client } from "eve/client";

const client = new Client({
  host: process.env.EVE_AGENT_URL,
  auth: { bearer: process.env.EVE_AGENT_TOKEN },
});

const { response } = await client.sessions.create({
  message: "Generate the weekly report.",
  outputSchema,
});

const result = await response.result();
```

Applications can use:

- scheduled functions or crons for simple dispatch;
- Workpool for concurrency limits, durable work queues, and retries;
- Workflow for application-owned multi-step durable orchestration; and
- application tables for the results they need to query.

No generic `convex-eve` control-plane component is planned for 0.1. Stateless
Convex-specific helpers around `eve/client` may be added only if they remove a
demonstrated integration problem.

## Goals

- Provide Convex-native threads and messages backed by Eve agents.
- Make user and assistant messages reactive through ordinary Convex queries.
- Preserve stable pagination while assistant output streams into a thread.
- Represent text, files, tool activity, approvals, and questions as bounded,
  renderable message parts.
- Bind each thread generation to one exact Eve root session.
- Translate Eve session events into idempotent message projections using
  `(eveSessionId, streamIndex)` ordering.
- Capture a user message transactionally before asynchronous delivery to Eve.
- Correlate optimistic messages, delivery commands, Eve turns, and projected
  responses without content-based deduplication.
- Keep application authentication and product policy in host Convex functions.
- Enforce supplied scope and subject ownership independently inside the
  component.
- Offer a familiar migration surface for storage-oriented
  `@convex-dev/agent` use cases.
- Provide a headless React API under `convex-eve/react`.
- Use existing Convex infrastructure components rather than rebuilding generic
  workflow and queue primitives.
- Ship an actual Eve performance coach example with training, nutrition, and
  recovery specialists.

## Non-goals

- Providing a generic control plane for every Eve workload.
- Requiring the component for cron, structured task, or background Eve calls.
- Running Eve inside Convex.
- Owning models, prompts, context windows, tools, skills, subagents, sandboxes,
  connections, schedules, or workflow execution.
- Reimplementing Workpool or Workflow.
- Providing full source compatibility with `@convex-dev/agent`.
- Implementing AI SDK generation methods such as `generateText`, `streamText`,
  `generateObject`, or `streamObject`.
- Accepting language models, AI SDK tools, `stopWhen`, `prepareStep`, or
  `contextOptions` in the Convex-side `Agent` constructor.
- Treating Convex messages as Eve's canonical context or workflow journal.
- Persisting hidden reasoning, bridge credentials, signatures, or unbounded
  tool payloads.
- Shipping a styled chat interface as part of the package.
- Building an agnostic chat component for arbitrary agent runtimes in 0.1.

## Vocabulary

Use Eve terminology whenever the concept comes from Eve:

- **Eve agent**: the filesystem-authored harness and capabilities.
- **Eve session**: the durable conversation or task in Eve.
- **turn**: one input and all work until the response boundary.
- **step**: one durable model/tool checkpoint within a turn.
- **action**: an Eve tool call and its progress or result.
- **input request**: a durable approval, question, or other human response.
- **stream index**: the exact ordered position in one Eve session stream.

Use component-owned terminology only for application concepts:

- **Agent**: a Convex-side client bound to one logical Eve agent key.
- **thread**: stable application conversation identity and metadata.
- **message**: application-visible user, assistant, or system content.
- **message part**: renderable text, file, tool, approval, question, or data
  fragment.
- **thread generation**: one exact Eve session binding behind a thread. Reset or
  replacement creates another generation without silently reusing an Eve ID.
- **delivery**: one persisted user message or input response waiting to be sent
  to Eve.

Never call a component document ID an `eveSessionId`. Never use an Eve event ID,
timestamp, or Convex document ID as the session stream ordering key.

## Responsibility boundary

| Concern | Owner |
| --- | --- |
| Thread catalogue, title, summary, ownership, application metadata | `convex-eve` |
| User and assistant message projections | `convex-eve` |
| UI message parts and streaming status | `convex-eve` |
| Optimistic correlation and pagination | `convex-eve` |
| Thread-to-session bindings | `convex-eve` |
| Model loop and durable turn execution | Eve |
| Instructions and dynamic agent context | Eve |
| Skills, tools, subagents, sandbox, connections | Eve |
| Canonical session event stream | Eve |
| Canonical message and part semantics | Eve |
| Canonical event-to-message reducer behavior | Eve |
| Authentication and application authorization | Host Convex functions |
| Product data and business policy | Host application |
| Queue concurrency and generic retries | Workpool when needed |
| Application-owned multi-step orchestration | Workflow when needed |

## Package surface

Version 0.1 ships one stateful component package:

```text
convex-eve
├── convex-eve
├── convex-eve/convex.config.js
├── convex-eve/react
├── convex-eve/protocol
└── convex-eve/test
```

The core import exports the server client, storage-oriented helpers, canonical
domain types, validators, and stable errors. The React entry point exports only
client helpers. The protocol entry point is for the Eve adapter and contract
tests, not ordinary application code.

`convex-eve` has no dependency on `@convex-dev/agent`.

The AI SDK may be an optional peer dependency if using its `UIMessage` type
provides meaningful ecosystem compatibility. Canonical storage validators must
remain owned and versioned by this package rather than accepting arbitrary AI
SDK objects without validation.

## Agent definition

The server abstraction deliberately resembles the familiar component pattern:

```ts
import { Agent } from "convex-eve";
import { components } from "./_generated/api";

export const fitnessAgent = new Agent(components.eve, {
  name: "fitness",
  agentKey: "fitness",
});

export const nutritionAgent = new Agent(components.eve, {
  name: "nutrition",
  agentKey: "nutrition",
});
```

`name` is application-facing attribution. `agentKey` selects an inspected and
registered Eve agent route. Deployment origin and transport credentials are
configured at installation or through typed component environment variables,
never supplied by a browser or persisted in component tables.

The constructor does not accept a model, prompt, tools, context options, or
step policy. Those belong to the Eve agent.

## Proposed server API

### Threads

```ts
const { threadId } = await fitnessAgent.createThread(ctx, {
  scopeId,
  userId,
  title: "New conversation",
  summary,
});

await fitnessAgent.getThread(ctx, { scopeId, userId, threadId });
await fitnessAgent.updateThread(ctx, { scopeId, userId, threadId, patch });
await fitnessAgent.deleteThread(ctx, { scopeId, userId, threadId });
await fitnessAgent.listThreads(ctx, {
  scopeId,
  userId,
  paginationOpts,
});
```

The exact user identifier is host-defined and opaque to the component. Host
functions derive it from authentication; browser input is never trusted as
authorization.

### Messages

The primary operation persists the user message and arranges asynchronous Eve
delivery:

```ts
const { messageId } = await fitnessAgent.sendMessage(ctx, {
  scopeId,
  userId,
  threadId,
  clientMessageId,
  message: {
    role: "user",
    parts: [{ type: "text", text: "Plan my training week." }],
  },
  clientContext,
});
```

Storage-only methods remain available for migrations, human-authored messages,
and application workflows:

```ts
await fitnessAgent.saveMessage(ctx, input);
await fitnessAgent.saveMessages(ctx, input);
await fitnessAgent.deleteMessage(ctx, input);
await fitnessAgent.deleteMessages(ctx, input);
```

Queries:

```ts
await fitnessAgent.listMessages(ctx, {
  scopeId,
  userId,
  threadId,
  paginationOpts,
});

await fitnessAgent.listUIMessages(ctx, {
  scopeId,
  userId,
  threadId,
  paginationOpts,
});
```

`sendMessage` is not an alias for AI SDK `generateText`. It starts or resumes
the exact Eve session bound to the thread and returns after durable Convex
capture, not after the Eve turn completes.

### Session and turn controls

Controls use Eve terminology and remain subordinate to a thread:

```ts
await fitnessAgent.cancelTurn(ctx, { threadId, expectedTurnId });
await fitnessAgent.respond(ctx, { threadId, inputResponses });
await fitnessAgent.compactSession(ctx, { threadId });
await fitnessAgent.clearSession(ctx, { threadId });
await fitnessAgent.resetSession(ctx, { threadId, reason });
```

Reset retires the exact Eve session. A replacement session is created only by an
explicit next-send or replacement operation and becomes a new thread generation.

### Thread-bound convenience object

An action may obtain a convenience object without changing the persistence
contract:

```ts
const thread = await fitnessAgent.continueThread(ctx, {
  scopeId,
  userId,
  threadId,
});

await thread.sendMessage({ message, clientMessageId });
await thread.respond({ inputResponses });
await thread.cancelTurn();
```

The feasibility of returning this object from mutations must follow Convex
runtime constraints. It is server-only and never serialized to clients.

## React API

React exports live under `convex-eve/react`. The import path provides the
product namespace, so member names stay close to what they do:

```tsx
import {
  optimisticallySendMessage,
  useThread,
  useThreads,
  useUIMessages,
} from "convex-eve/react";
```

`useUIMessages` accepts a host-exported query reference so authentication and
product policy remain visible in application code:

```tsx
const { results, status, loadMore } = useUIMessages(
  api.chat.listMessages,
  { threadId },
  { initialNumItems: 20 },
);
```

The component package cannot expose its functions directly to a browser and
cannot authenticate a host user. The application re-exports authorized queries
and mutations.

Do not use names such as `useEveMessages`. Durable exported domain types may use
an `Eve` prefix when they otherwise collide with common application types.

## Message and part model

The canonical message view includes:

```ts
type EveMessage = {
  id: string;
  threadId: string;
  role: "user" | "assistant" | "system";
  order: number;
  stepOrder: number;
  status: "pending" | "streaming" | "complete" | "failed";
  agentName?: string;
  parts: EveMessagePart[];
  createdAt: number;
  updatedAt: number;
};
```

Initial parts:

```ts
type EveMessagePart =
  | { type: "text"; text: string; state: "streaming" | "complete" }
  | { type: "file"; fileId: string; mediaType: string; filename?: string }
  | {
      type: "tool";
      callId: string;
      toolName: string;
      state: "input-available" | "output-available" | "failed";
      input?: unknown;
      output?: unknown;
    }
  | {
      type: "approval";
      requestId: string;
      state: "pending" | "approved" | "denied" | "stale";
      prompt: string;
      options?: readonly { id: string; label: string }[];
    }
  | {
      type: "question";
      requestId: string;
      state: "pending" | "answered" | "stale";
      prompt: string;
      options?: readonly { id: string; label: string }[];
    }
  | { type: "data"; name: string; value: unknown };
```

Tool input and output fields are policy-controlled, bounded, and redacted by
default. Reasoning is not a public message part in 0.1.

## Eve event projection

The adapter consumes Eve's public session stream through Eve's own
`defaultMessageReducer`, then materializes the resulting `EveMessage` records as
Convex documents. The table below describes database effects, not a new
independent mapping protocol:

| Eve event | Component effect |
| --- | --- |
| `session.started` | Confirm the thread generation's exact Eve session binding |
| `message.received` | Confirm the persisted user message and correlate the Eve turn |
| `message.appended` | Create or update a streaming assistant text part |
| `message.completed` | Finalize one assistant text block; do not assume it is the terminal reply |
| `actions.requested` | Create tool parts keyed by call ID |
| `action.partial` | Replace the bounded preliminary output snapshot |
| `action.result` | Finalize the corresponding tool part |
| `input.requested` | Create approval or question parts and pending input records |
| `subagent.called` | Record bounded child-session attribution for operations metadata |
| `result.completed` | Store a bounded structured data part when enabled |
| `step.completed` | Attach finish reason and usage metadata |
| `turn.completed` | Settle messages and mark the thread ready for the next delivery |
| `turn.failed` | Mark the current response failed with a safe error |
| `turn.cancelled` | Mark the turn cancelled without treating it as a failure |
| `session.waiting` | Permit deterministic dispatch of the next queued message |
| `session.failed` | Mark the generation terminal and surface recovery state |
| `session.completed` | Mark the generation terminal |

Every ingested event is addressed and ordered by `(eveSessionId, streamIndex)`.
Event IDs are useful for identity when present but are never total-order cursors.
Projection writes and cursor advancement commit together.

The component stores only a bounded coordinate ledger (`eveSessionId`,
`streamIndex`, optional event ID, and event type) by default. It does not retain
raw event payloads. Persisted message projections omit hidden reasoning, raw
attachment bytes, bridge credentials, signatures, and complete tool inputs or
outputs. Tool lifecycle, names, call IDs, approval prompts, and explicitly
user-facing authorization fields remain represented using Eve part semantics.

If synchronization is interrupted, the adapter attaches at the persisted
`nextStreamIndex` and performs a bounded catch-up. If the materialized view must
be rebuilt, Eve's `snapshot()` supplies a cursor-consistent event prefix; the
component reduces that prefix with the installed Eve reducer version and
replaces the projection transactionally.

A durable Eve step can retry and emit overlapping semantic events under new
event IDs. Projectors must preserve the completed attempt without incorrectly
deduplicating distinct content solely by turn, step, sequence, or text.

## Outbound message lifecycle

```text
Host mutation
  |
  +-- authenticate and authorize
  +-- component saves user message as pending
  +-- component records delivery keyed by clientMessageId
  +-- enqueue bounded dispatch work
        |
        v
Workpool worker
  +-- create an Eve session for an unbound thread, or
  +-- send to the exact bound Eve session
        |
        v
Eve accepts the turn
        |
        v
bounded event synchronization confirms message.received
        |
        v
component marks the user message accepted
```

The initial message and thread creation may be captured in one component
mutation. A host application may call that mutation inside the same transaction
as its own business writes.

The Eve adapter must accept a stable delivery or command identifier if retries
could otherwise duplicate session creation or turns. Workpool provides durable
queueing and retries; it does not by itself make an ambiguous external request
idempotent.

The component does not wrap an entire Eve turn in a Convex Workflow. Eve already
owns turn durability. Convex workers perform only bounded delivery and bounded
stream catch-up work.

## Streaming and reactivity

The browser never needs to connect directly to the Eve deployment. It subscribes
to host Convex queries over component message projections.

`message.appended` events update a pending assistant part. Each committed
projection write causes the host query to update. `useUIMessages` merges those
reactive pages with an optimistic user message until the persisted message is
observed.

Eve's direct `useEveAgent` hook remains the recommended lower-complexity path
for a browser chat that does not require a Convex-owned thread catalogue,
multi-device reactive history, server-originated sends, application metadata,
or database retention. `convex-eve/react` is intentionally for applications
that choose the database-backed architecture.

The component's unique value is the definition and maintenance of the thread,
message, and part state machine. Convex reactivity itself is a platform feature,
not a justification for a separate general-purpose Eve component.

## Pagination

- Messages have stable thread-local `order` and `stepOrder` coordinates.
- New streaming writes must not invalidate the identity of older pages.
- Pagination uses bounded component-safe helpers compatible with reactive page
  growth.
- `listUIMessages` returns newest or oldest pages according to an explicit
  contract and never asks callers to sort by Convex document ID.
- Tool and input parts remain attached to their message rather than appearing as
  unrelated pagination rows.
- The initial page can grow while streaming; `loadMore` must not duplicate the
  boundary message.

## Proposed component data model

### `threads`

- `scopeId`
- `ownerSubjectId`
- `agentId`
- `title`
- current generation number
- state: `ready | queued | streaming | waiting_input | failed | closed`
- timestamps

Indexes support subject listing and agent filtering without cross-scope scans.
Agent definitions, route prefixes, prompts, and capabilities do not live in the
component; the host binds a stable `agentId` to an authored Eve deployment.

### `generations`

- `threadId`
- `generation`
- `eveSessionId?`
- state: `unbound | active | waiting | failed | retired`
- `nextStreamIndex`
- sanitized `EveMessageData` reducer checkpoint
- timestamps

Exactly one generation may be current for a thread. An Eve session ID belongs
to at most one thread generation in one component instance.

### `messages`

- `threadId`
- `generationId?`
- `eveMessageId?`
- `turnId?`
- `clientMessageId?`
- `role`
- `order`
- `status`
- sanitized embedded `EveMessagePart[]`
- timestamps

The initial implementation embeds parts because Eve's reducer addresses tool,
text, authorization, and input lifecycle state within one message. Document
bounds and load tests decide whether a later version normalizes high-volume
parts without changing the public `EveMessage` shape.

### `deliveries`

- `threadId`
- `generationId`
- `messageId`
- `clientMessageId`
- state: `queued | dispatching | streaming | accepted | failed`
- bounded attempt metadata
- timestamps

### `eventCoordinates`

- `generationId`
- `eveSessionId`
- `streamIndex`
- optional Eve event ID
- event type
- received timestamp

Raw event payloads are not stored by default. The exact coordinate ledger makes
ingestion idempotent and auditable without turning tool payloads or reasoning
into a second transcript. Safe message projections may have longer retention
according to host policy.

## Authentication and isolation

- Public browser functions are defined by the host application.
- Host functions derive identity from `ctx.auth` and apply product policy.
- The component receives opaque `scopeId` and `subjectId` values.
- Every component read and write independently checks the supplied scope and
  subject against thread ownership.
- Knowing a thread ID, message ID, Eve session ID, turn ID, or request ID is
  never sufficient authorization.
- Privileged service and administrative operations use separate explicit APIs.
- The component never reads host tables or assumes one authentication provider.
- Bridge credentials and signatures are never stored in component tables.
- The Eve adapter independently verifies the authorized actor and trusted
  component installation represented by each request.

## Privacy and retention

- Hidden reasoning is not stored or exposed by default.
- Full tool inputs and outputs are not stored by default.
- File bytes are not copied into component tables.
- Text and structured parts have explicit size limits.
- Unknown event data is retained only under a bounded diagnostic policy.
- Host documentation explains that deleting Convex projections does not prove
  deletion from Eve, model providers, tools, sandboxes, or telemetry systems.
- Subject export and deletion are resumable and bounded.

## Relationship to Workpool and Workflow

Workpool is the expected infrastructure dependency for:

- bounded concurrent message dispatch;
- retry and backoff for short external calls;
- bounded event reconciliation jobs; and
- completion callbacks that update delivery state.

Workflow is not a default dependency. Add it only if a component-owned lifecycle
is genuinely multi-step and cannot be expressed safely as short work items plus
transactional state. Application workflows remain application-owned.

Neither component changes Eve's authority over durable session and turn
execution.

## Compatibility with `@convex-dev/agent`

Compatibility is a migration aid, not an implementation dependency.

### High-priority compatible concepts

- `Agent` server abstraction
- `createThread`
- `continueThread`
- thread metadata and user association
- `saveMessage` and `saveMessages`
- `listMessages` and `listUIMessages`
- message `order` and `stepOrder`
- message status and agent attribution
- pagination conventions
- `UIMessage` rendering shape
- `useUIMessages`
- optimistic send helpers
- thread and message deletion

Exact signatures should match only when the authorization and Eve lifecycle
semantics remain honest.

### Similar purpose, Eve-specific semantics

- stream deltas;
- tool-call parts;
- approval and question parts;
- usage metadata;
- failed response handling;
- session reset and replacement;
- files and attachments; and
- multi-agent attribution.

### Intentionally unsupported execution APIs

- `generateText`
- `streamText`
- `generateObject`
- `streamObject`
- model-provider configuration
- AI SDK tool registration
- `stopWhen`
- `prepareStep`
- `contextOptions`
- prompt-context search as part of model execution

The migration boundary is explicit:

```ts
// Before: Convex Agent owns execution.
await agent.streamText(ctx, { threadId }, {
  promptMessageId,
  system,
  prepareStep,
});

// After: the Convex component owns the conversation; Eve owns execution.
await agent.sendMessage(ctx, {
  threadId,
  promptMessageId,
  clientContext,
});
```

System instructions, tools, policies, skills, and specialists move into the Eve
agent project.

## Existing application migration use case

A representative adopting application has exercise, nutrition, and health
agents defined with `@convex-dev/agent`. It uses:

- three `Agent` instances;
- thread creation, metadata, listing, ownership, and deletion;
- message persistence and pagination;
- streaming assistant messages;
- scheduled follow-ups;
- failure messages; and
- tools that read and mutate application data.

Migration would proceed as follows:

1. Author the three agents or specialists in Eve.
2. Move system instructions, step policies, skills, and tools to the Eve app.
3. Expose narrowly authorized host Convex functions for Eve tools that need
   application data.
4. Replace the Convex Agent constructors with `convex-eve` `Agent` bindings.
5. Preserve or migrate thread and message data through an explicit exporter and
   importer.
6. Replace `streamText` calls with `sendMessage` delivery to Eve.
7. Replace custom stream synchronization with component projections.
8. Adopt `listUIMessages` or preserve an application-specific query adapter.

Version 0.1 does not promise automatic migration of another component's private
tables. A documented migration utility may use its public APIs.

## Performance coach example

The example app demonstrates:

- an application-facing performance coach thread;
- Eve-authored training, nutrition, and recovery specialists;
- user messages captured in Convex;
- streamed assistant text projected from Eve;
- tool calls represented as UI message parts;
- a training-plan approval that parks and resumes the Eve turn;
- child-agent attribution in an operations view;
- thread history and pagination;
- light and dark modes using default shadcn components; and
- failure and reconnection states.

The marketing and documentation site remains separate from the example app
inside the monorepo.

## Implementation milestones

### Milestone 0: validate public contracts

- Freeze vocabulary and ownership boundaries.
- Inspect current Eve client, session stream, channel, and auth APIs.
- Define the smallest event subset required for chat.
- Define compatibility targets against the current `@convex-dev/agent` API.
- Decide whether AI SDK `UIMessage` is a peer type or an adapter view.
- Prototype message projection against recorded Eve event fixtures.

### Milestone 1: thread and message component

- Implement agents, threads, messages, and message parts.
- Implement scope and subject checks.
- Implement stable ordering and component-safe pagination.
- Implement storage-only message helpers.
- Add test registration utilities.

### Milestone 2: Eve binding and delivery

- Implement the Eve channel or adapter using only public Eve APIs.
- Bind a thread generation to an exact Eve session.
- Persist user messages before delivery.
- Dispatch through Workpool with bounded retries.
- Add bridge-level message and session-create idempotency.
- Support `session.send`, input response, cancel, compact, clear, and reset.

### Milestone 3: event projection and streaming

- Ingest bounded event batches by exact stream cursor.
- Project user confirmation and assistant streaming text.
- Project actions, results, input requests, failures, and usage.
- Handle interrupted-step overlap and reconnect replay.
- Add reconciliation sweeps and explicit repair.

### Milestone 4: React API

- Implement `useUIMessages`.
- Implement thread listing helpers.
- Implement optimistic message submission.
- Validate pagination during live streaming.
- Keep hooks dependent on host-exported function references.

### Milestone 5: example and migration proof

- Connect the performance coach UI to real component messages.
- Run the native Eve coach with all specialists.
- Demonstrate an approval round trip.
- Build a small migration fixture modeled after a real
  `@convex-dev/agent` application.
- Document unsupported execution APIs and migration steps.

## Test plan

Every protocol or state-machine change requires tests.

### Component tests

- thread ownership and cross-scope denial;
- idempotent thread and message creation;
- stable `order` and `stepOrder` allocation;
- pagination with concurrent streaming writes;
- message and part status transitions;
- reset generation rules;
- subject deletion and retention;
- bounded payload enforcement; and
- privileged-operation separation.

### Protocol and projection tests

- duplicate batch ingestion;
- reconnect overlap;
- missing event IDs;
- strict `(eveSessionId, streamIndex)` ordering;
- multiple `message.completed` blocks in one turn;
- interrupted step re-emission;
- tool partial last-write-wins behavior;
- approval response and stale response;
- subagent event attribution;
- failed and cancelled turns; and
- unknown event compatibility.

### Delivery tests

- duplicate client message IDs;
- ambiguous create-session response;
- ambiguous follow-up response;
- queued messages delivered only at a valid Eve boundary;
- retry exhaustion and recovery;
- reset while delivery is queued; and
- worker concurrency limits.

### React tests

- optimistic message replacement;
- streaming text growth;
- failed optimistic send rollback;
- loading older pages without duplication;
- thread switch isolation; and
- approval part state updates.

### End-to-end tests

- create thread, send message, and receive final Eve response;
- reconnect mid-stream;
- tool call and result rendering;
- approval pause and resume;
- subagent delegation;
- reset and fresh generation; and
- package installation in a clean Convex app.

## Release criteria

Version 0.1 is ready only when:

- no dependency on `@convex-dev/agent` exists;
- a host mutation can save a user message and trigger asynchronous Eve delivery;
- duplicate delivery attempts cannot create duplicate visible user messages or
  Eve turns at the supported bridge boundary;
- assistant text streams reactively into `listUIMessages`;
- tool and input parts project without persisting forbidden payloads;
- synchronization resumes from `(eveSessionId, streamIndex)` after interruption;
- thread ownership is enforced inside the component;
- Workpool or equivalent bounded infrastructure prevents unbounded dispatch;
- the React hooks work through host-authenticated query references;
- the performance coach example completes a real multi-turn session; and
- documentation clearly directs non-chat users to `eve/client` and ordinary
  Convex primitives instead of this component.

## Success measures

- A new Convex application can add an Eve-backed chat without designing its own
  thread, message, projection, and streaming state machines.
- An application using storage-oriented `@convex-dev/agent` APIs can identify a
  bounded migration path without rewriting its entire UI model.
- Agent authors configure prompts, tools, skills, and specialists only in Eve.
- The component remains useful across different chat products without becoming
  a generic workflow framework.
- Non-chat Eve users are not forced to adopt state they do not need.

## Open questions

1. Should the package export the AI SDK `UIMessage` type directly, extend it, or
   expose an adapter while keeping `EveMessage` canonical?
2. Which exact `@convex-dev/agent` signatures can be matched without inheriting
   misleading execution semantics?
3. Should `sendMessage` be callable from a mutation through capture-and-schedule
   client code, or should the public client expose separate `saveMessage` and
   `dispatchMessage` operations?
4. What public Eve channel extension point provides bridge-level idempotency
   without depending on internals?
5. How should dynamic per-turn application context be passed to Eve without
   turning it into an alternate system prompt?
6. Should tool input and output parts be opt-in globally, per agent, or per
   tool?
7. How much child-session activity belongs in ordinary chat messages versus an
   operations-only query?
8. What is the exact reset behavior for retained Convex history and a new Eve
   session generation?
9. Can existing `@convex-dev/agent` threads be exported efficiently enough for
   a supported migration utility?
10. Is Workpool sufficient for every component-owned job, allowing Workflow to
    remain an application concern?

## Prior direction retained

The original [general control-plane PRD](convex-eve-v0.1-prd.md) remains in the
repository. It contains useful research on Eve stream semantics, bridge
security, retention, session controls, reconciliation, and failure modes.

Its product thesis—a general Convex control plane for all Eve workloads—is not
the current implementation target. The current direction narrows the stateful
component to the thread and message domain and delegates generic durability and
queueing to existing Convex primitives.
