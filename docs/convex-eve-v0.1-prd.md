---
date: 2026-08-06
status: HISTORICAL_DRAFT
superseded_by: convex-eve-agent-v0.1-prd.md
target_version: 0.1.0
owner_repo: convex-eve
working_package_name: "convex-eve"
license_target: Apache-2.0
eve_baseline_investigated: 0.31.0
---

# Convex Eve Component v0.1 PRD and Implementation Plan

> Historical direction: this broader general-control-plane proposal is retained
> as design research. The current product direction is documented in the
> [Eve-backed Agent component PRD](convex-eve-agent-v0.1-prd.md).

## Executive Decision

Build `convex-eve` as an independent open-source Convex component and eve
integration bridge that makes Convex the durable application control plane for
one or more eve agent harnesses.

The component must be usable without `@convex-dev/agent`. It does not wrap,
extend, or require that component. The two projects solve different problems:

- eve remains the agent execution harness. It owns model loops, skills, tools,
  subagents, sandboxes, short-term session state, context compaction, and the
  durable workflow that actually executes a turn.
- Convex becomes the application-facing control plane. It owns tenant and
  subject mappings, session catalogues, command intent, realtime projections,
  approval state, usage views, retention policy, auditability, and the bridge
  from application data and UI into eve.

Version 0.1 will ship two cooperating surfaces in one package:

1. A stateful Convex component installed through `convex.config.ts`.
2. A thin eve adapter imported by an eve app as a custom channel or extension.

The adapter is not optional for the supported 0.1 production path. It creates a
small, versioned `convex-eve` bridge protocol over eve's public APIs and protects
consumers from depending directly on unstable eve internals. An experimental
direct client for eve's stock `/eve/v1` HTTP API may exist for development, but
it is not the reliability boundary promised by 0.1.

The first release is backend-first and headless. It includes:

- logical agent registration and capability snapshots;
- idempotent session creation and continuation;
- durable command outbox and bounded dispatch;
- loss-tolerant event notification and cursor-based reconciliation;
- realtime projections of sessions, turns, messages, actions, approvals,
  questions, subagent relationships, failures, and token usage;
- human-in-the-loop response APIs;
- cancel, compact, clear, reset, and resync controls;
- opaque multi-tenant and subject scoping;
- signed bridge traffic, replay protection, audit metadata, and key rotation;
- configurable event-content and retention policy;
- server-side TypeScript clients and framework-neutral realtime query APIs;
- a fake bridge, contract test kit, and minimal example using an actual eve app.

It will not execute eve inside Convex, replace eve's workflow store, prescribe a
model provider, author an application's agents, or become another general AI
agent framework.

The application-control-plane boundary and public naming policy are accepted in
[ADR 0001](decisions/0001-application-control-plane-and-public-naming.md).

## Product Thesis

eve makes an agent legible as a directory: instructions, tools, skills,
subagents, channels, schedules, and runtime configuration. It also provides a
durable session protocol and a rich event stream. Convex excels at durable
application state, transactions, scheduled work, reactive queries, and typed
application APIs.

The useful combination is not to duplicate either system. It is to make the
boundary between them a product:

```text
Application clients
       |
       v
Host Convex functions: authentication, authorization, product policy
       |
       v
convex-eve component: intent, state, projections, approvals, audit, realtime
       |
       v
convex-eve bridge protocol: signed commands + replayable event synchronization
       |
       v
eve: agent harness, model loop, skills, tools, subagents, sandbox, workflows
```

This lets a Convex application treat an eve harness as durable compute whose
state is observable and governable through ordinary Convex data and functions.
It also lets the application remain usable when an eve deployment is slow,
temporarily unavailable, redeploying, or waiting for human input.

## Why This Should Be a Convex Component

A basic integration can call `POST /eve/v1/session` from a Convex action and
consume the NDJSON stream. A production integration needs substantially more:

- retries must not create duplicate sessions, messages, approvals, or resets;
- outbound intent must survive action failure and deployment interruption;
- stream reconnects must resume from the correct event index;
- event delivery and projection must be idempotent;
- a UI needs reactive session, message, action, and approval state;
- subagent sessions must remain connected to their parent run tree;
- unknown future event types must not break ingestion;
- tenant and actor scope must be enforced independently of eve session IDs;
- sensitive tool inputs, outputs, and reasoning need explicit storage policy;
- usage and failures need bounded, queryable projections;
- long-lived live HTTP connections must not consume unbounded Convex actions;
- deployment health and protocol compatibility need to be visible before work
  is accepted; and
- deletion, export, retention, and incident recovery need coherent semantics.

Those rules form a stateful abstraction with transactional invariants. A Convex
component provides isolated tables, typed and runtime-validated APIs, nested
transactions, scheduled reconciliation, realtime subscriptions, component HTTP
routes, and a package boundary that can be tested independently.

## Ecosystem and Contract Investigation

Investigation was performed on 2026-08-06.

### eve findings

- The current npm release inspected was `eve@0.31.0`; eve is pre-1.0 and its
  public surface may continue changing.
- An eve session has a durable `sessionId`. The stock HTTP API supports create,
  follow-up, input responses, cancel, compact, clear, reset, and NDJSON event
  streaming.
- The stream has an absolute `startIndex` cursor. Event `meta.id` values are
  stable across reconnects, but are not a total ordering key.
- Interrupted durable steps may emit overlapping semantic events with new event
  IDs. A completed durable step replay emits nothing new.
- Parent sessions expose child session IDs for delegated subagents; the child
  has its own event stream.
- Custom channels can bind an application conversation address to an eve
  session, expose HTTP routes, authenticate inbound requests, observe runtime
  events, and attach to a known session.
- Sessions can wait durably for approval or another human response.
- eve exposes an inspection endpoint describing models, tools, skills,
  subagents, channels, schedules, workflow configuration, and related
  capabilities.
- eve supports self-hosting, but the workflow world and sandbox backend remain
  eve deployment concerns.

### Convex findings

- Components have isolated schemas, functions, environment variables, and HTTP
  routes.
- Component calls participate in nested transactions with the host application.
- Components do not receive the host application's `ctx.auth`; authentication
  must remain in host wrappers and trusted identifiers must be passed explicitly.
- Component HTTP routes also lack host authentication context, so bridge routes
  must authenticate at the transport level.
- Convex actions can call external services but are not automatically retried.
- Convex actions are bounded in execution time. A component must use short,
  finite stream catch-up requests rather than holding one action open for the
  entire lifetime of an eve session.
- Queries are reactive, making normalized run and approval projections directly
  consumable by applications without an additional realtime service.

### Adjacent projects

| Project | What it provides | Decision for `convex-eve` |
| --- | --- | --- |
| eve | Agent authoring, durable execution, skills, tools, subagents, channels, sandbox, session protocol, event stream | Treat as the execution authority. Integrate only through public APIs. |
| `@convex-dev/agent` | Convex-native AI threads, messages, context search, tool calling, generation helpers | No dependency. Learn from its application ergonomics, but do not reuse its AI SDK execution lifecycle or provide a compatibility facade in 0.1. |
| `@convex-dev/workflow` | Durable Convex workflows | Optional implementation dependency for internal maintenance only if it materially simplifies guarantees. Never claim it replaces eve's workflow. |
| `@convex-dev/workpool` | Controlled parallel Convex actions | Consider for bounded dispatch and reconciliation concurrency; do not require it without evidence. |
| Convex scheduled functions | Durable capture-then-schedule pattern | Use for command dispatch, webhook-triggered sync, retry backoff, and maintenance. |
| Convex HTTP actions | Component-mounted callback endpoints | Use for signed eve-to-Convex notifications and health checks. |
| `convex-wearables` | Independent component packaging, client wrapper, lifecycle, retries, testing, and release conventions | Reuse repository and public-package discipline, not domain code. |
| planned `convex-chat` | Host-auth boundary, opaque subjects/scopes, realtime message projections, idempotency, retention | Reuse conceptual patterns while keeping AI run semantics out of human chat. |

No npm package named `convex-eve` was found on the
investigation date. Availability must be checked again before publication.
Because eve is a Vercel product name, repository naming, package naming,
disclaimers, and trademark usage require an explicit pre-publication review.

## Goals

- Make an eve deployment feel native to a Convex application's backend and UI.
- Preserve eve as the sole authority for agent execution and durable workflow
  continuation.
- Preserve Convex as the authority for application identity, authorization,
  business data, policy, and application-facing state.
- Capture user or system intent transactionally before external dispatch.
- Make all supported commands idempotent across retries and ambiguous network
  outcomes.
- Reconcile every eve session from an exact stream cursor without requiring a
  permanent live connection.
- Provide realtime, bounded, tenant-scoped views of messages, progress, pending
  input, failures, subagents, and usage.
- Support many logical eve agents mounted on one deployment origin.
- Support additional origins by installing multiple named component instances.
- Store unknown event types safely so a new eve event does not break ingestion.
- Make content capture explicit and privacy-minimizing by default.
- Provide a stable bridge protocol that can evolve separately from eve's
  pre-1.0 implementation details.
- Ship comprehensive contract, failure, security, and compatibility tests.
- Offer a clean migration path through semantic versions and additive schema
  evolution.

## Non-Goals for 0.1

- Running eve's Nitro server, workflow world, model loop, or sandbox inside a
  Convex action.
- Reimplementing eve skills, tools, subagents, channels, schedules, state, or
  context compaction.
- Replacing eve's durable workflow journal or treating Convex's mirror as enough
  to resume an eve session independently.
- Replacing the complete `@convex-dev/agent` execution surface or providing API
  compatibility with it. `convex-eve` does own the application-facing threads,
  messages, runs, approvals, and realtime projections required by Eve products.
- Migrating existing `@convex-dev/agent` threads automatically.
- Providing model-provider credentials, AI Gateway configuration, prompt
  templates, safety policy, or application-specific tools.
- Owning the host application's users, organizations, entitlements, consent,
  billing, rate limits, or authorization policy.
- Letting browsers call eve directly with component credentials.
- Shipping a styled chat or operations console. Headless data and example UI are
  sufficient.
- Capturing or exposing hidden model reasoning by default.
- Guaranteeing exactly-once external tool side effects. The component guarantees
  idempotent bridge commands; an application's tools must still handle their own
  side-effect idempotency.
- General-purpose agent-to-agent protocol support such as A2A.
- MCP server hosting or connector credential brokering.
- Cross-origin agent failover in 0.1.
- Arbitrary event retention or unbounded audit logs.

## Terminology

- **Host application**: the Convex app that installs the component.
- **Component instance**: one installed `convex-eve` component, bound in 0.1 to
  one trusted eve origin and bridge credential set.
- **Agent key**: a stable host-defined identifier for a logical root eve agent,
  such as `planner` or `support`.
- **Agent target**: the relative route prefix and non-secret metadata used to
  reach one agent on the configured eve origin.
- **Scope**: an opaque host security or tenancy partition.
- **Subject**: an opaque host identifier for the user, service, or actor who
  owns or initiated work.
- **Control session**: the component record representing one root eve session.
- **eve session**: the durable execution identity returned by eve.
- **External key**: a host-chosen idempotency key for a logical control session.
- **Command**: durable application intent to start, continue, answer, cancel,
  compact, clear, reset, or resynchronize an eve session.
- **Bridge**: the adapter running with eve that accepts signed component
  commands and exposes bounded event catch-up.
- **Notification**: a signed, content-minimal hint from the bridge that a session
  has new events available.
- **Reconciliation**: reading a finite event range from the last stored stream
  index and applying it idempotently.
- **Projection**: query-optimized Convex state derived from raw eve events.
- **Input request**: a pending human-in-the-loop approval or question emitted by
  eve.
- **Run tree**: the root session plus any child subagent sessions.
- **Stream index**: the exact zero-based ordering position in one eve session's
  durable event stream.
- **Protocol version**: the `convex-eve` bridge contract version, independent of
  the npm package versions of Convex, eve, or `convex-eve`.

## System of Record and Trust Model

### eve is authoritative for

- whether an eve session exists and is active;
- the durable turn and step workflow;
- model and tool execution;
- context history, compaction, clear, and reset behavior;
- skills, tools, dynamic capabilities, state, sandbox, and subagents;
- the authoritative per-session event stream and its exact event order; and
- whether an input response was accepted for a still-pending request.

### The component is authoritative for

- which host scope and subject may see or control a mapped session;
- logical agent registration and whether new work is accepted;
- external-key uniqueness;
- command intent and dispatch status;
- the last completely ingested stream index;
- normalized application-facing projections;
- application approval policy before a response is sent to eve;
- bridge audit data and synchronization health;
- component retention and redaction policy; and
- the component's own export and deletion state.

### The host application is authoritative for

- authenticating public callers;
- deriving `scopeId`, `subjectId`, and actor permissions server-side;
- authorization, tenancy, roles, entitlements, consent, and business policy;
- domain data exposed to eve tools;
- whether an actor may start or continue a particular logical agent;
- whether an actor may approve a specific action;
- usage budgets and billing enforcement outside the component's optional
  counters;
- notification delivery and user-facing UI; and
- legal basis, privacy disclosures, data processing agreements, and vendor
  review.

### Authentication boundary

The component cannot authenticate host users. Public browser or mobile clients
must call host functions that derive identity and then call the component.

```ts
export const askPlanner = mutation({
  args: {
    externalKey: v.string(),
    clientCommandId: v.string(),
    message: v.string(),
  },
  handler: async (ctx, args) => {
    const { scopeId, subjectId } = await requireCurrentAgentSubject(ctx);
    return eve.sendMessage(ctx, {
      scopeId,
      subjectId,
      agentKey: "planner",
      ...args,
    });
  },
});
```

Component queries and mutations independently require the same `scopeId` and
subject or privileged actor context needed to verify component-local ownership.
This is defense in depth, not a replacement for host authentication.

## Architecture

### Supported production topology

```text
┌──────────────────────────┐
│ Web / mobile / backend   │
└────────────┬─────────────┘
             │ host auth and policy
┌────────────▼─────────────┐
│ Host Convex functions    │
└────────────┬─────────────┘
             │ nested component calls
┌────────────▼───────────────────────────────────────────┐
│ convex-eve component                                  │
│ registry · sessions · commands · projections · audit  │
│ dispatcher · reconciler · retention · HTTP callback   │
└────────────┬───────────────────────────────▲───────────┘
             │ signed, idempotent commands   │ signed event notification
             │ bounded stream catch-up       │ no sensitive event body required
┌────────────▼───────────────────────────────┴───────────┐
│ convex-eve/eve bridge                                 │
│ public eve channel/session APIs only                  │
└────────────┬───────────────────────────────────────────┘
             │
┌────────────▼───────────────────────────────────────────┐
│ eve agent harness                                     │
│ workflow · model · skills · tools · subagents · state │
└────────────────────────────────────────────────────────┘
```

### Why the bridge is required

Calling the stock eve API directly is technically possible, but its generic
session create and message routes do not promise application command
idempotency. A network failure after eve accepts a request but before Convex
receives the response creates an ambiguous outcome.

The bridge adds:

- a stable protocol version;
- `installationId`, `agentKey`, `controlSessionId`, and `commandId` correlation;
- command deduplication;
- deterministic continuation addressing;
- signed request verification and replay prevention;
- content-minimal event notifications;
- bounded event catch-up using exact stream indexes;
- capability and version negotiation;
- explicit payload limits; and
- a compatibility layer that uses only eve public APIs internally.

### One origin per component instance

Version 0.1 binds one component instance to one trusted eve origin and one
bridge credential set through typed component environment variables. The
instance may register multiple logical agents through validated relative route
prefixes on that origin.

Applications needing unrelated origins install the component more than once:

```ts
app.use(eve, {
  name: "primaryAgents",
  httpPrefix: "/convex-eve-primary/",
  env: { /* primary origin and bridge credentials */ },
});

app.use(eve, {
  name: "backofficeAgents",
  httpPrefix: "/convex-eve-backoffice/",
  env: { /* second origin and credentials */ },
});
```

This avoids storing arbitrary origins or credential material in component
tables and prevents callers from turning the component into an SSRF primitive.

## Bridge Protocol v1

### Design requirements

- HTTPS is mandatory outside loopback development.
- The component's configured origin is never accepted from a function argument.
- Redirects on authenticated requests are rejected.
- Every request states the protocol version and installation ID.
- Every mutating command has a globally unique component `commandId` and a
  host-provided `clientCommandId` scoped to the logical session.
- The bridge stores or derives enough durable state to return the original
  outcome for a duplicate command without rerunning it.
- Request and response bodies are size-bounded and schema-validated.
- Clock skew and replay windows are explicit.
- Bridge errors use stable machine-readable codes.
- Unknown additive fields are ignored within the same protocol major version.
- Major protocol mismatches fail before work is accepted.

### Authentication

The default portable transport uses HMAC-SHA256 with independently rotatable
command and callback secrets. Each signed request includes:

- protocol version;
- installation ID;
- Unix timestamp;
- nonce;
- HTTP method;
- canonical path;
- SHA-256 body digest; and
- key ID.

The receiver rejects an invalid signature, unknown key ID, reused nonce, or a
timestamp outside the configured replay window. Both sides may accept a current
and previous key during rotation.

Vercel OIDC, generic JWT/OIDC, and custom authentication may be supported later
through transport adapters. The portable HMAC mode must work on Vercel and on a
self-hosted eve deployment.

### Command envelope

```ts
type BridgeCommandV1 = {
  protocol: "convex-eve/1";
  installationId: string;
  agentKey: string;
  commandId: string;
  controlSessionId: string;
  externalKey: string;
  expectedEveSessionId?: string;
  kind:
    | "session.start"
    | "session.message"
    | "input.respond"
    | "turn.cancel"
    | "context.compact"
    | "context.clear"
    | "session.reset";
  payload: unknown;
  actor: {
    scopeId: string;
    subjectId: string;
    principalType: "user" | "service" | "system";
    attributes?: Record<string, string>;
  };
  createdAt: string;
};
```

The actor object is an application context snapshot for eve auth and dynamic
capabilities. It is not proof of host authorization; the signed component is the
trusted issuer. Secrets, access tokens, arbitrary host records, and unbounded
attributes are forbidden.

### Command responses

The bridge returns one of:

- `accepted`: the command is durably accepted by eve;
- `duplicate`: the original accepted result for this command;
- `inactive`: the addressed session or turn is no longer active;
- `conflict`: the expected eve session does not own the continuation address;
- `rejected`: validation, policy, or protocol rejection;
- `retryable_error`: the component may retry with the same command ID; or
- `terminal_error`: retrying the same command cannot succeed.

Successful responses contain the current eve session ID and, when known, the
accepted turn or request correlation. They never contain credentials.

### Deterministic session addressing

The bridge continuation address derives from installation ID, agent key, and
control session ID rather than from user-provided text. Before starting work,
the bridge resolves the address:

- if no session owns it, `session.start` creates one;
- if a session already owns it and the same command is retried, the bridge
  returns the original result;
- if a different start command targets an existing active address, it returns a
  conflict rather than silently creating a second turn; and
- after reset, a new explicit control session or explicit replacement operation
  is required.

### Event synchronization

The component does not keep a Convex action attached to a live stream. Instead:

1. The bridge emits a signed, content-minimal notification that a mapped eve
   session has advanced.
2. The component coalesces notifications and schedules a reconciliation action.
3. The reconciler requests a finite stream range from the component's stored
   `nextStreamIndex` with `follow=false` semantics.
4. The bridge returns NDJSON events plus the observed tail index.
5. The component validates, batches, and commits events and projections.
6. The cursor advances transactionally only through the last completely applied
   contiguous stream index.
7. If more events remain, another bounded reconciliation is scheduled.

Notifications are an acceleration mechanism, not the source of truth. A
periodic sweeper reconciles active, waiting-input, recently failed, and recently
completed sessions so a lost callback cannot permanently lose state.

### Event identity and ordering

- Exact order is `(eveSessionId, streamIndex)`.
- `meta.id` is a secondary idempotency key and diagnostic correlation value.
- ULID lexical order must never be used as the stream cursor.
- Events without `meta.id` remain ingestible by stream index.
- A repeated stream index with a different payload is a protocol-integrity
  failure and dead-letters the batch.
- Interrupted eve step retries may legitimately emit semantically overlapping
  events with different IDs and indexes. Raw history preserves both.
- Projections distinguish emitted attempts from settled turn state; they do not
  deduplicate by matching content.

### Capability negotiation

Registration and periodic health checks record:

- bridge protocol versions;
- eve version;
- stream schema version when exposed;
- logical agent name and model identifier;
- authored tools, skills, channels, schedules, and subagents;
- relevant runtime limits; and
- an opaque deployment fingerprint.

The component blocks new commands when the protocol major is unsupported. It
may continue serving already-ingested data and expose an actionable degraded
status.

## Functional Scope

### Agent registry

- Register a logical `agentKey` with a relative path prefix and display metadata.
- Validate paths against traversal, schemes, fragments, credentials, and origin
  changes.
- Enable, pause, or drain new work independently per agent.
- Poll bridge health and agent inspection on demand and on a bounded schedule.
- Store the latest capability snapshot and compatibility result.
- Preserve previous deployment fingerprints for session auditability.
- Never persist outbound authentication secrets in registry tables.

### Session lifecycle

- Idempotently create a control session by `(scopeId, subjectId, agentKey,
  externalKey)`.
- Optionally support a privileged host-owned session not tied to one subject.
- Enqueue the initial message in the same transaction as control-session
  creation.
- Map exactly one active eve root session to a control session.
- Continue only the mapped active eve session.
- Expose `queued`, `starting`, `running`, `waiting`, `waiting_input`,
  `cancelling`, `resetting`, `completed`, `failed`, `expired`, `desynchronized`,
  and `deleted` control states.
- Treat projected state as eventually consistent with the eve stream and expose
  synchronization metadata alongside it.
- Allow an explicit replacement session after terminal completion or reset;
  never silently reuse a terminal eve session ID.

### Durable command outbox

- Capture commands in a mutation before scheduling dispatch.
- Deduplicate by `(controlSessionId, clientCommandId)`.
- Serialize dispatch per control session so follow-ups cannot overtake each
  other.
- Track `queued`, `dispatching`, `accepted`, `retry_wait`, `rejected`,
  `dead_letter`, and `superseded` states.
- Retry retryable failures with the same bridge command ID and bounded
  exponential backoff plus jitter.
- Record attempt count, last error code, next attempt time, and timestamps.
- Stop retrying when the session becomes terminal or an expected-session guard
  fails.
- Permit privileged replay from dead letter only through a new administrative
  command that references the original.
- Never infer success solely from an HTTP disconnect. Reconcile the bridge
  command status or retry idempotently.

### Messages and structured input

- Accept text and the structured message/file-part shapes supported by the
  documented bridge contract.
- Start text-first; files may be represented by already-authorized URLs or eve
  file parts only when the host has explicitly opted in.
- Do not become a file upload or storage component in 0.1.
- Normalize user and assistant messages for ordinary application rendering.
- Preserve interim assistant blocks separately from terminal assistant output.
- Associate messages with session, turn, step, sequence, role, and stream range.
- Support finalized structured `result.completed` output as a bounded JSON
  string plus optional host-validated projection.

### Turn and step progress

- Project turn start, completion, failure, and cancellation.
- Project step start, completion, failure, finish reason, model ID, and usage.
- Compute current progress without promising an artificial percentage.
- Expose the last settled boundary and whether more reconciliation is pending.
- Preserve failure codes and bounded diagnostic detail.

### Tool and action activity

- Project `actions.requested`, partial local-tool output, and final action result.
- Correlate by call ID, turn, and step.
- Store tool name, state, timestamps, approval requirement, and policy-controlled
  input/output snapshots.
- Treat partial outputs as last-write-wins for rendering while preserving raw
  events according to retention policy.
- Never assume an event named `action.result` means an external side effect was
  exactly-once.

### Human-in-the-loop

- Project every pending `input.requested` item with request ID, kind, prompt,
  options, allowed response mode, and tool-call correlation.
- Distinguish approval from general questions.
- Allow a host-authorized actor to enqueue one response to a still-pending
  request.
- Deduplicate responses by request ID and client command ID.
- Mark the local request `responding` only after command capture, and `resolved`
  only after eve confirms through its stream.
- Treat stale responses as rejected or stale, never as authorization for an
  earlier tool call.
- Support approve, deny, option selection, and permitted freeform input.
- Record who responded and when without exposing identity to other tenants.
- Provide a privileged policy hook in host code before the component response
  mutation is called.

### Subagents and run trees

- On `subagent.called`, create a child-session record linked to the parent
  session, turn, and call.
- Schedule reconciliation for the child eve session independently.
- Render child progress from the child's own event stream.
- Preserve root, parent, depth, declared subagent key when available, and status.
- Bound maximum mirrored depth and total child sessions per root as a safety
  policy; overflow remains visible as a truncated relationship rather than
  causing unbounded ingestion.
- Propagate cancel state as observed; do not independently invent child
  cancellation semantics.

### Session controls

- Cancel the currently observed turn with an optional expected `turnId` guard.
- Compact context without adding a synthetic user message.
- Clear model-message history while preserving the same eve session.
- Reset and terminally retire the exact mapped eve session.
- Require elevated host authorization for clear and reset by convention and in
  examples.
- Reconcile after every accepted control command until the expected boundary is
  observed.

### Realtime queries

- Get one control session and its synchronization health.
- List sessions for a subject or privileged scope with cursor pagination.
- List normalized messages with stable pagination.
- Subscribe to current turn and step status.
- Subscribe to active actions and partial outputs.
- Subscribe to pending input requests.
- Get a bounded run tree.
- List raw events only through a privileged, paginated API.
- Aggregate token usage by session, agent, subject, scope, and bounded time
  bucket without scanning raw events.

### Notifications and host integrations

The component will not invoke arbitrary host callbacks from inside its sandbox.
It exposes a monotonically ordered component event feed that host code can poll
or drain for:

- session state changes;
- terminal assistant messages;
- pending approvals/questions;
- failures and desynchronization;
- usage threshold signals; and
- deletion or retention completion.

The host owns push, email, Slack, analytics, billing, and product notifications.

### Reconciliation and repair

- Reconcile one session immediately.
- Sweep sessions selected by status and stale `lastReconciledAt`.
- Rebuild projections for one session from retained raw events.
- Rewind and refetch from a safe stream index when raw retention permits.
- Compare local cursor, remote tail, mapped session ID, and deployment
  fingerprint.
- Mark a session desynchronized on irreconcilable gaps or integrity conflicts.
- Expose a repair report before destructive projection replacement.
- Never mutate eve's workflow journal during a local projection rebuild.

## Proposed Data Model

All host identifiers crossing the component boundary are opaque strings. All
tables have explicit validators, bounded strings/objects, and indexes named for
their complete indexed field sequence.

### `agents`

- `agentKey`
- `routePrefix`
- `displayName?`
- `status: active | paused | draining | incompatible | unavailable`
- `metadataJson?` (bounded, non-secret)
- `latestCapabilitySnapshotId?`
- `lastHealthStatus?`
- `lastHealthCheckedAt?`
- `createdAt`, `updatedAt`

Indexes:

- `by_agentKey`
- `by_status_and_updatedAt`

### `agentCapabilitySnapshots`

- `agentId`
- `deploymentFingerprint?`
- `eveVersion?`
- `bridgeProtocolVersions[]`
- `selectedProtocolVersion?`
- `modelId?`
- bounded lists or hashes of tools, skills, channels, schedules, and subagents
- `compatible`
- `incompatibilityCode?`
- `capturedAt`

Large inspection payloads are stored as bounded raw JSON only when configured.

### `sessions`

- `scopeId`
- `ownerSubjectId?`
- `agentId`
- `externalKey`
- `eveSessionId?`
- `replacementOfSessionId?`
- `rootSessionId`
- `parentSessionId?`
- `parentEveSessionId?`
- `subagentCallId?`
- `depth`
- `status`
- `activeTurnId?`
- `nextStreamIndex`
- `remoteTailIndex?`
- `lastEventAt?`
- `lastReconciledAt?`
- `reconciliationState`
- `deploymentFingerprint?`
- `initiatorSnapshotJson?` (bounded and policy-controlled)
- `terminalReason?`
- `createdAt`, `updatedAt`, `terminalAt?`

Indexes:

- `by_scopeId_and_ownerSubjectId_and_agentId_and_externalKey`
- `by_scopeId_and_ownerSubjectId_and_updatedAt`
- `by_agentId_and_status_and_lastReconciledAt`
- `by_eveSessionId`
- `by_rootSessionId_and_depth_and_createdAt`
- `by_parentSessionId_and_createdAt`

### `commands`

- `sessionId`
- `scopeId`
- `subjectId`
- `clientCommandId`
- `bridgeCommandId`
- `kind`
- `payloadJson` (bounded and redacted according to kind)
- `expectedEveSessionId?`
- `expectedTurnId?`
- `expectedInputRequestId?`
- `state`
- `attemptCount`
- `nextAttemptAt?`
- `lastErrorCode?`
- `lastErrorMessage?` (bounded)
- `acceptedEveSessionId?`
- `createdAt`, `dispatchedAt?`, `acceptedAt?`, `updatedAt`

Indexes:

- `by_sessionId_and_clientCommandId`
- `by_state_and_nextAttemptAt`
- `by_sessionId_and_createdAt`
- `by_bridgeCommandId`

### `events`

- `sessionId`
- `eveSessionId`
- `streamIndex`
- `eventId?`
- `type`
- `emittedAt?`
- `turnId?`
- `stepIndex?`
- `sequence?`
- `rawJson?` according to capture policy
- `rawSha256`
- `rawBytes`
- `truncated`
- `ingestedAt`
- `retentionClass`

Indexes:

- `by_sessionId_and_streamIndex`
- `by_eveSessionId_and_eventId` where event ID is present
- `by_sessionId_and_type_and_streamIndex`
- `by_retentionClass_and_ingestedAt`

`rawJson` has a strict default maximum. Oversized events store type, normalized
fields, size, digest, and `truncated: true`; ingestion must not fail silently.

### `turns`

- `sessionId`
- `turnId`
- `sequence`
- `state`
- `startedStreamIndex`
- `settledStreamIndex?`
- `startedAt?`, `settledAt?`
- `failureCode?`, `failureMessage?`
- aggregate token usage
- `updatedAt`

Indexes:

- `by_sessionId_and_sequence`
- `by_sessionId_and_turnId`
- `by_state_and_updatedAt`

### `steps`

- `sessionId`
- `turnId`
- `stepIndex`
- `state`
- `modelId?`
- `finishReason?`
- token usage fields
- `startedStreamIndex?`, `settledStreamIndex?`
- `failureCode?`, `failureMessage?`
- `updatedAt`

Because an interrupted step can retry without a public attempt ID, raw events
remain the audit source. The projection records the latest observed state and
does not erase earlier failure events.

### `messages`

- `sessionId`
- `turnId?`
- `stepIndex?`
- `sequence?`
- `role`
- `blockKind: received | assistant_interim | assistant_final | result`
- `text?`
- `partsJson?` according to policy
- `finishReason?`
- `sourceEventId?`
- `firstStreamIndex`, `lastStreamIndex`
- `state`
- `createdAt`, `updatedAt`

Indexes:

- `by_sessionId_and_firstStreamIndex`
- `by_sessionId_and_turnId_and_sequence`

### `actions`

- `sessionId`
- `turnId`
- `stepIndex`
- `callId`
- `toolName`
- `state`
- `inputJson?`, `partialOutputJson?`, `outputJson?` according to policy
- `requiresInput`
- `startedStreamIndex`, `settledStreamIndex?`
- `createdAt`, `updatedAt`

Indexes:

- `by_sessionId_and_callId`
- `by_sessionId_and_state_and_updatedAt`
- `by_turnId_and_stepIndex`

### `inputRequests`

- `sessionId`
- `turnId`
- `requestId`
- `kind: approval | question | unknown`
- `state: pending | responding | approved | denied | answered | stale | cancelled`
- `prompt`
- bounded options and response policy
- `actionCallId?`
- `responseCommandId?`
- `respondedBySubjectId?`
- `requestedAt`, `respondedAt?`, `resolvedAt?`

Indexes:

- `by_sessionId_and_requestId`
- `by_scopeId_and_state_and_requestedAt` if scope is denormalized
- `by_sessionId_and_state_and_requestedAt`

### `usageBuckets`

- `scopeId`
- `subjectId?`
- `agentId`
- `bucketStart`
- input, output, reasoning, and cache-read tokens where exposed
- step count, tool count, turn count
- `updatedAt`

Usage aggregation is informational in 0.1. Host applications enforce billing
and hard quotas.

### `componentEvents`

- monotonic component-local sequence
- `scopeId`
- `subjectId?`
- `sessionId?`
- stable event kind
- bounded payload
- `createdAt`
- retention/consumption metadata as needed

This is the post-commit host integration feed, not a copy of every raw eve
event.

### `nonces` and `bridgeAudit`

Short-lived nonce records enforce callback replay protection. Bounded bridge
audit records capture request direction, key ID, command or notification ID,
status, byte counts, and error code without storing secrets or full sensitive
payloads.

## Content Capture and Retention Policy

### Default policy

- Store normalized user and assistant text needed by the application.
- Store event envelope metadata and digests.
- Store bounded raw lifecycle events needed to rebuild projections.
- Do not store reasoning text.
- Do not store full tool inputs or outputs unless explicitly enabled.
- Do not store authorization challenges, credentials, headers, or signed URLs
  beyond a safe summary.
- Store partial action outputs only when enabled and cap them aggressively.
- Redact configured JSON keys recursively before persistence.
- Default raw-event retention must be finite; normalized message retention is a
  separate policy.

### Configurable capture classes

- `metadata_only`
- `messages`
- `messages_and_actions_redacted`
- `full_debug` with explicit production warning

Reasoning capture is a separate opt-in even under `full_debug` and must never be
returned by ordinary actor-scoped queries.

### Deletion

- Delete or anonymize one subject's component-owned mappings through a resumable,
  bounded lifecycle operation.
- Delete one control session's projections and raw events after terminal reset
  or an explicit host decision.
- Resetting eve and deleting the Convex mirror are separate operations.
- Component deletion cannot prove deletion from model providers, tools, eve's
  workflow world, sandbox snapshots, telemetry exporters, or other external
  systems. Documentation must state those boundaries.
- Export returns component-owned data with event capture limitations made clear.

## Proposed Public Server API

The package exports a client class around the generated component reference,
following established Convex component conventions:

```ts
import { ConvexEve } from "convex-eve";
import { components } from "./_generated/api";

export const eve = new ConvexEve(components.eve);
```

### Agent administration

- `registerAgent(ctx, input)`
- `updateAgent(ctx, input)`
- `setAgentStatus(ctx, input)`
- `getAgent(ctx, input)`
- `listAgents(ctx, input)`
- `refreshAgentCapabilities(ctx, input)`
- `checkAgentHealth(ctx, input)`

### Actor-scoped thread operations

- `createThread(ctx, input)`
- `getOrCreateThread(ctx, input)`
- `sendMessage(ctx, input)`
- `respondToInput(ctx, input)`
- `cancelTurn(ctx, input)`
- `getThread(ctx, input)`
- `listThreads(ctx, input)`
- `listMessages(ctx, input)`
- `getCurrentProgress(ctx, input)`
- `listActions(ctx, input)`
- `listPendingInputs(ctx, input)`
- `getRunTree(ctx, input)`
- `getUsage(ctx, input)`

Every actor-scoped method takes `scopeId` and `subjectId`; ownership is checked
inside the component.

### Privileged host operations

- `createServiceSession(ctx, input)`
- `listScopeSessions(ctx, input)`
- `compactSession(ctx, input)`
- `clearSession(ctx, input)`
- `resetSession(ctx, input)`
- `reconcileSession(ctx, input)`
- `inspectSynchronization(ctx, input)`
- `previewProjectionRebuild(ctx, input)`
- `rebuildProjections(ctx, input)`
- `requeueDeadLetter(ctx, input)`
- `exportSession(ctx, input)`
- `beginDeleteSession(ctx, input)`
- `beginDeleteSubject(ctx, input)`
- `listRawEvents(ctx, input)`
- `listBridgeAudit(ctx, input)`

The names and documentation must make privileged bypass semantics obvious.
The component cannot determine whether the host caller is actually privileged.

### Headless client helpers

Version 0.1 may provide framework-neutral utilities for:

- folding normalized message pages;
- rendering current run state;
- grouping tool calls and input requests;
- reconnect-safe optimistic command IDs; and
- mapping stable error codes to application states.

### React API

React helpers are exported from `convex-eve/react`. The import path supplies the
integration namespace, so exported members use concise domain names rather than
repeating `Eve`:

```ts
import {
  usePendingInputs,
  useSendMessage,
  useThread,
  useThreads,
  useThreadStatus,
  useUIMessages,
} from "convex-eve/react";
```

`useUIMessages` follows the familiar query-reference shape while remaining
independent from `@convex-dev/agent`:

```ts
const { results, status, loadMore } = useUIMessages(
  api.chat.listMessages,
  { threadId },
  { initialNumItems: 20 },
);
```

Hooks are thin wrappers over host-exported Convex queries and mutations. The
package cannot generate authenticated public host functions or let a browser
bypass host authorization.

Canonical persisted types are package-owned `Thread`, `Message`, and
`MessagePart` types. These are application-domain projections and must not carry
an `Eve` or `Convex` prefix merely because of their implementation source. The
core package does not persist or depend on the AI SDK `UIMessage` contract. A
rendering `UIMessage` view may be exported by the React entry point, while
optional AI SDK conversion belongs under a separate entry point such as
`convex-eve/ai`.

Prefixes are reserved for source- or protocol-specific semantics, such as
`EveSessionEvent` or `BridgeCommandV1`. Consumers can alias generic domain types
at import sites when their application already defines a type with the same
name.

Avoid redundant names such as `useEveMessages`, `useEveThread`, or
`useEveSendMessage`.

## Error Model

Public methods throw or return stable errors with:

- `code`
- safe `message`
- `retryable`
- optional bounded `details`

Initial codes include:

- `agent_not_found`
- `agent_paused`
- `agent_incompatible`
- `bridge_unavailable`
- `bridge_auth_failed`
- `protocol_mismatch`
- `session_not_found`
- `session_access_denied`
- `session_not_active`
- `session_desynchronized`
- `command_conflict`
- `command_rejected`
- `input_not_pending`
- `input_response_not_allowed`
- `payload_too_large`
- `event_integrity_failed`
- `reconciliation_retryable`
- `retention_in_progress`
- `rate_limited` when optional component limits are later introduced

Provider or transport error bodies must not leak directly to ordinary clients.

## Core Invariants

1. A component instance never sends credentials to an origin other than its
   configured eve origin.
2. `(scopeId, subjectId, agentId, externalKey)` identifies at most one current
   actor-owned control session.
3. A control session maps to at most one active eve root session.
4. A bridge command ID executes at most once at the bridge boundary.
5. A client command ID creates at most one component command per control
   session.
6. Commands for one session are accepted by the dispatcher in creation order.
7. A session cursor advances only across a contiguous, fully committed event
   batch.
8. `(eveSessionId, streamIndex)` is unique and immutable.
9. An event ID, when present, cannot map to conflicting payloads in the same eve
   session.
10. Unknown event types do not stop cursor advancement when their envelope and
    size are valid.
11. An input request can have at most one accepted component response command.
12. Component approval state becomes resolved only from eve stream evidence.
13. Reset never silently creates a replacement eve session.
14. Child sessions cannot be read outside the root control session's scope.
15. No unbounded array or event history is stored in one document.
16. Secrets, auth headers, signatures, and nonces are never included in normal
    query results.
17. Reasoning content is absent unless separately and explicitly enabled.

## Security and Abuse Boundaries

### Transport security

- Require TLS except for explicit loopback development mode.
- Reject redirects for authenticated bridge calls.
- Validate content type before parsing.
- Enforce request, response, event, batch, and decompressed-size limits.
- Set finite connection and response deadlines.
- Verify callback signature against raw bytes before JSON parsing.
- Use constant-time signature comparison.
- Maintain replay nonces only for the configured time window and prune them.
- Document current/previous key rotation without downtime.

### Application security

- Host wrappers derive actor identity; clients never choose a trusted subject ID.
- Component ownership checks protect all actor reads and writes.
- Approval APIs require a pending request belonging to the same mapped session.
- Agent route prefixes are administrator-controlled, relative, and validated.
- Raw event and audit APIs are privileged surfaces.
- Logs contain IDs and error codes, not full prompts, tool data, or signatures.
- Bridge actor attributes use allowlisted string keys, per-value limits, and a
  total byte limit.

### Agent and tool security

The component cannot make an unsafe agent safe. Agent authors remain responsible
for prompt injection defenses, tool authorization, sandbox policy, outbound
network access, model behavior, and side-effect idempotency. Component approval
gates improve governance but do not validate the semantic correctness of a tool
call.

## Reliability Model

### Delivery semantics

- Host-to-component command capture: transactional and idempotent.
- Component-to-bridge dispatch: at least once with bridge-level deduplication.
- Bridge-to-Convex notifications: at least once and lossy-tolerant.
- Event synchronization: replayable from exact stream cursor.
- Projection updates: transactional per bounded batch and rebuildable from
  retained raw events.
- Host consumption of component events: at least once with sequence cursor.

### Bounded work

- No action follows a live eve stream indefinitely.
- Each reconciliation has limits for events, bytes, wall time, projection writes,
  and child discovery.
- Each mutation uses bounded reads and writes.
- Large backlogs schedule continuation work rather than looping indefinitely.
- Active-session sweeps use indexed pagination and leases.
- Dispatch and reconciliation have separate concurrency limits so event backlog
  cannot prevent cancellation or approval commands.

### Leases and retries

- Dispatch and reconciliation jobs acquire short leases with fencing tokens.
- Expired leases are recoverable.
- Backoff is bounded and jittered.
- Terminal protocol, authorization, validation, and integrity errors dead-letter
  instead of retrying forever.
- Health recovery wakes eligible retry-wait commands.

### Degraded operation

When eve is unavailable or incompatible:

- existing Convex queries remain available;
- new intent may be rejected or queued according to agent policy;
- the UI can show last synchronized state and staleness;
- pending approvals remain visible but cannot falsely appear delivered;
- command and reconciliation queues remain bounded; and
- administrators can pause or drain the agent.

## Versioning and Compatibility

### Three independent version axes

- `convex-eve` package semantic version;
- bridge protocol major/minor version; and
- supported eve version/capability range.

The bridge protocol, not the eve npm package's internal types, is the persisted
wire boundary.

### Forward compatibility

- Unknown event types are retained as envelope-plus-raw JSON and ignored by old
  projectors.
- Additive event fields do not fail ingestion.
- Capability detection is preferred over version-string branching where
  practical.
- Raw event schema is string-based and bounded so new JSON shapes do not require
  an immediate Convex schema migration.
- Projectors are versioned and rebuildable.

### Compatibility testing

CI runs bridge contract tests against:

- the minimum supported eve version;
- the lockfile version;
- the latest compatible eve release; and
- recorded fixtures for unknown future-style events.

Because eve is pre-1.0, minor eve releases may require a `convex-eve` patch or
minor release. The README must publish a compatibility matrix.

## Installation and Developer Experience

### Convex side

```ts
// convex/convex.config.ts
import { defineApp } from "convex/server";
import { v } from "convex/values";
import eve from "convex-eve/convex.config.js";

const app = defineApp({
  env: {
    EVE_BASE_URL: v.string(),
    CONVEX_EVE_COMMAND_SECRET: v.string(),
    CONVEX_EVE_CALLBACK_SECRET: v.string(),
    CONVEX_EVE_INSTALLATION_ID: v.string(),
  },
});

app.use(eve, {
  httpPrefix: "/convex-eve/",
  env: {
    EVE_BASE_URL: app.env.EVE_BASE_URL,
    COMMAND_SECRET: app.env.CONVEX_EVE_COMMAND_SECRET,
    CALLBACK_SECRET: app.env.CONVEX_EVE_CALLBACK_SECRET,
    INSTALLATION_ID: app.env.CONVEX_EVE_INSTALLATION_ID,
  },
});

export default app;
```

Exact environment names may change during implementation, but secrets must use
typed component environment bindings rather than table storage.

### eve side

```ts
// agent/channels/convex.ts
import { convexControlPlaneChannel } from "convex-eve/eve";

export default convexControlPlaneChannel({
  installationId: process.env.CONVEX_EVE_INSTALLATION_ID!,
  controlPlaneUrl: process.env.CONVEX_EVE_CONTROL_PLANE_URL!,
  commandSecret: process.env.CONVEX_EVE_COMMAND_SECRET!,
  callbackSecret: process.env.CONVEX_EVE_CALLBACK_SECRET!,
});
```

The adapter must use public `eve/channels`, session, auth, and event APIs. Any
required access to an eve internal module is a release blocker unless eve first
exposes a supported public API.

### Local development

- A fake in-memory bridge supports deterministic component tests.
- `convex-eve dev-check` or an equivalent script validates both endpoints,
  protocol versions, signatures, callback reachability, and agent registration.
- A minimal example includes a Convex app, one eve agent with a tool and skill,
  and a small React operations view.
- Localhost may use explicit development secrets; no insecure silent production
  fallback is allowed.

## Observability

### Component metrics

- commands queued, accepted, retried, rejected, and dead-lettered;
- dispatch latency;
- notification count and signature failures;
- reconciliation lag in events and time;
- remote tail minus local cursor;
- events and bytes ingested;
- projection failures and rebuilds;
- active, waiting-input, failed, terminal, and desynchronized sessions;
- approval response latency;
- usage totals where exposed; and
- agent health and compatibility state.

### Correlation IDs

Every log or audit record uses bounded identifiers:

- installation ID;
- agent key;
- control session ID;
- eve session ID;
- command ID;
- event ID and stream index;
- turn ID;
- input request ID; and
- subagent parent/root IDs.

Sensitive payloads are not logged by default.

### Relationship to eve observability

Vercel Agent Runs and authored OpenTelemetry remain eve execution observability.
The component provides application control-plane observability. Documentation
must explain how to correlate the two without duplicating full prompts or tool
payloads into every telemetry provider.

## Implementation Plan

### Phase 0: repository and contract scaffolding

- Create independent Apache-2.0 repository and package metadata.
- Add `AGENTS.md`, `CONTRIBUTING.md`, security policy, code of conduct, release
  process, and upgrading guide.
- Confirm package and repository naming and trademark disclaimer.
- Pin minimum Convex and eve compatibility targets.
- Define protocol v1 schemas, size limits, error codes, signing canonicalization,
  and golden fixtures before implementing transport.
- Set up TypeScript, Biome, Vitest, Convex test environment, package exports,
  npm dry-run checks, and changesets or equivalent release notes.

Exit criteria:

- protocol fixtures can be validated independently in component and eve test
  suites;
- package exports compile without generated files leaking into public types; and
- CI rejects a protocol fixture that changes without an explicit version decision.

### Phase 1: component schema and local control plane

- Implement schema, validators, stable IDs, error model, and public client class.
- Implement agent registry, component configuration, session creation, ownership,
  external-key uniqueness, command capture, and actor-scoped queries.
- Implement component event feed.
- Add fake dispatcher so lifecycle tests do not need a model or eve process.

Exit criteria:

- concurrent idempotent session and command tests pass;
- unauthorized cross-scope reads/writes fail; and
- no external HTTP call is required for deterministic component tests.

### Phase 2: secure eve bridge and command dispatch

- Implement signing, replay protection, key IDs, rotation, strict origin policy,
  redirect rejection, timeouts, and payload bounds.
- Implement eve custom channel adapter and command endpoints.
- Implement deterministic continuation mapping and bridge command deduplication.
- Implement component dispatcher, leases, retry states, and dead letters.
- Implement health and capability negotiation.

Exit criteria:

- an ambiguous network failure cannot duplicate a start or message;
- duplicate reset cannot retire a replacement session;
- invalid, replayed, expired, oversized, redirected, or wrong-installation
  requests are rejected; and
- no eve internal import is used.

### Phase 3: event synchronization and projections

- Implement content-minimal signed notification route.
- Implement bounded finite stream catch-up and periodic sweep.
- Implement raw event storage, exact cursor advancement, integrity checks,
  unknown-event handling, retention classes, and truncation behavior.
- Implement session, turn, step, message, action, usage, and failure projectors.
- Implement terminal state convergence and deployment fingerprint tracking.

Exit criteria:

- lost and duplicate notifications converge to the same local state;
- disconnects at every event boundary resume without loss;
- unknown event types do not block later known events;
- interrupted-step retry fixtures remain auditable; and
- projections rebuild deterministically from retained events.

### Phase 4: HITL, subagents, and controls

- Implement input-request projection and actor response APIs.
- Implement approval and question response correlation.
- Implement cancel, compact, clear, reset, and post-command reconciliation.
- Implement child-session discovery, bounded recursive synchronization, and run
  tree queries.
- Add host authorization examples for sensitive controls.

Exit criteria:

- stale approvals never authorize an old call;
- a duplicate response produces one bridge command;
- parent and child streams remain independently cursor-correct; and
- cancel/reset races converge without controlling an unintended new turn or
  session.

### Phase 5: lifecycle, operations, and release hardening

- Implement usage buckets, raw-event privileged query, export, retention,
  deletion, sweeps, repair preview, and projection rebuild.
- Add operational metrics, audit views, compatibility matrix, troubleshooting,
  and incident runbooks.
- Build minimal example and deploy a real eve integration test environment.
- Benchmark active-session scale, event throughput, callback bursts, large tool
  outputs, and subagent fan-out.
- Run package dry run and external-consumer install test.

Exit criteria:

- acceptance criteria pass against the minimum and current supported eve
  versions;
- deletion and retention jobs are resumable and bounded;
- documentation names every external data-retention boundary; and
- an external sample app can install the npm tarball without repository-local
  imports.

## Test Plan

### Component tests

- external-key and client-command idempotency under concurrency;
- ownership and scope isolation on every actor API;
- command ordering and lease fencing;
- retry/backoff and dead-letter classification;
- cursor advancement only after full batch commit;
- duplicate notification and duplicate event ingestion;
- conflicting stream-index payload detection;
- unknown event type and additive field handling;
- oversized event truncation and digest behavior;
- projector state machines for success, failure, cancel, retry, and compaction;
- input response races and stale requests;
- subagent depth and count limits;
- usage aggregation without double counting;
- retention, export, deletion, and rebuild boundaries.

### Bridge tests

- canonical signature golden vectors shared with component tests;
- wrong key, old key, rotated key, invalid signature, timestamp skew, and nonce
  replay;
- origin, redirect, content-type, timeout, compressed-size, and body-size policy;
- command deduplication before and after simulated process restart;
- deterministic continuation mapping;
- inactive, terminal, reset, compact, clear, cancel, and expected-ID conflicts;
- callback loss and recovery through pull reconciliation;
- protocol negotiation and stable errors;
- public eve API compatibility with no internal imports.

### End-to-end tests

- start a real eve session from a host mutation and render its final message from
  a reactive Convex query;
- reconnect after dropped notification and dropped catch-up response;
- approve and deny a real HITL tool call;
- answer a real `ask_question` request;
- run a declared subagent and render the parent/child tree;
- cancel during model output and during subagent work;
- compact, clear, and reset then verify boundaries;
- redeploy eve during a waiting session and continue it;
- rotate bridge keys without losing active sessions;
- upgrade one supported eve version and reconcile sessions created before the
  upgrade.

### Property and fault tests

- any repetition of the same command ID yields one semantic execution;
- any prefix of committed stream events can be followed by reconnect and converge
  to the full projection;
- notification deletion, duplication, and reordering do not change final state;
- action termination between external acceptance and local persistence converges
  through bridge status or idempotent retry;
- no valid event sequence can move a terminal session back to active without an
  explicit replacement mapping.

### Performance investigation

Measure rather than promise:

- sessions per component instance;
- notification burst throughput;
- events and bytes ingested per second;
- median and tail projection latency;
- dispatch and approval response latency;
- database rows and bytes per typical turn;
- cost of raw capture modes;
- child-session fan-out behavior;
- reconciliation sweep cost at 1k, 10k, and 100k mapped sessions; and
- query invalidation behavior for high-frequency text deltas.

If token-level deltas create excessive write amplification, 0.1 may coalesce
adjacent `message.appended` events for normalized rendering while preserving the
authoritative cursor and policy-selected raw events. The behavior must be
documented and tested.

## Acceptance Criteria for 0.1.0

- The package installs as a normal Convex component and exports an eve adapter.
- It has no dependency on `@convex-dev/agent`.
- One component instance supports multiple logical agents on one configured eve
  origin.
- Multiple named component instances support separate origins.
- Public host wrappers can create, continue, inspect, and control mapped sessions.
- Command capture is transactional and all bridge commands are idempotent.
- No live Convex action must remain connected for a full eve session.
- Lost callbacks are recovered through indexed reconciliation.
- Session event order is based on stream index, not event ULID order.
- Realtime queries expose normalized messages, progress, actions, pending input,
  failures, subagents, and usage.
- Approval and question responses are scoped, deduplicated, and confirmed by eve
  stream evidence.
- Unknown additive event types do not stop synchronization.
- Default storage excludes reasoning and full tool payloads.
- Raw and normalized data have documented retention and bounded deletion paths.
- Authentication, signature, replay, SSRF, redirect, and payload-limit tests pass.
- Compatibility tests pass against the declared minimum and current eve versions.
- The bridge imports only documented public eve entrypoints.
- A complete example runs Convex as control plane and eve as harness.
- README, API reference, architecture, security, privacy boundaries, upgrading,
  troubleshooting, and operational runbooks are published.
- `npm pack --dry-run`, lint, type checking, tests, build, and external tarball
  consumption pass in CI.

## Risks and Tradeoffs

### eve is pre-1.0

The public API can change quickly. The bridge protocol, compatibility matrix,
capability detection, recorded fixtures, and version test matrix reduce but do
not eliminate maintenance burden.

### Two durable systems

Both eve and Convex persist state. This is intentional, but only eve can resume
execution. Documentation and code must consistently distinguish authoritative
workflow state from the Convex projection.

### Exactly-once expectations

The integration can make bridge commands idempotent, not arbitrary tool side
effects. Agent tools must use their own idempotency keys and transactional
boundaries.

### Realtime write amplification

Persisting every text or reasoning delta can be expensive. Default policy should
coalesce UI text updates and omit reasoning while preserving cursor correctness.

### Component authentication limitations

The component cannot access host `ctx.auth`. Every public integration needs host
wrappers, and component HTTP callbacks need independent transport authentication.

### Command deduplication durability in eve

The bridge must prove that its deduplication survives process replacement and
workflow retries using supported eve state or workflow semantics. If public eve
APIs cannot support this guarantee, command handling must be redesigned or the
missing upstream capability requested before claiming production readiness.

### Data duplication and privacy

Mirroring prompts, messages, tools, and events expands the data footprint.
Privacy-minimizing defaults and explicit capture modes are product requirements,
not documentation afterthoughts.

### Vendor-specific naming

`convex-eve` communicates purpose but may imply an official relationship. The
project needs a clear community-maintained disclaimer and naming review before
publication.

### Self-hosted differences

Vercel-hosted and self-hosted eve deployments can use different workflow worlds,
sandbox backends, auth, and routing. The bridge test suite must remain portable
and avoid assuming Vercel-only infrastructure.

## Explicit Decisions Before Coding

The following are product decisions, not unresolved architecture questions:

1. The component is standalone and does not depend on `@convex-dev/agent`.
2. eve executes agents; Convex controls and projects them.
3. A production-supported companion bridge is required in 0.1.
4. The bridge uses only public eve APIs.
5. One component instance binds to one trusted origin; multiple origins use
   multiple component instances.
6. The event stream is pulled in finite cursor-based batches; callbacks only
   accelerate reconciliation.
7. Stream index is authoritative ordering.
8. Commands use a durable outbox and bridge-level idempotency.
9. Host authentication and policy remain outside the component.
10. Reasoning and full tool payload capture are off by default.
11. Convex projections are rebuildable mirrors, not an alternative eve workflow
    journal.

## Open Questions Requiring Validation

1. Which documented eve state or channel primitive can provide restart-safe
   command deduplication without relying on internals?
2. Does eve need a small upstream public API for querying a command/continuation
   outcome safely after an ambiguous response?
3. Should bridge notifications be emitted by a channel event handler, a general
   hook, or a packaged eve extension to ensure child-session coverage?
4. What is the smallest supported event set that can rebuild all promised
   projections across the minimum eve version?
5. What default raw-event retention balances repairability and storage cost?
6. Should normalized assistant delta coalescing target a time window, byte
   threshold, or only finalized blocks in 0.1?
7. Are file message parts in 0.1 valuable enough to justify their security and
   lifetime semantics, or should the first release be strictly text and
   structured results?
8. Should informational usage buckets ship in 0.1 or move to 0.2 after core
   synchronization is proven?
9. Is `convex-eve` the final public name, and what disclaimer is required?
10. Which minimum Convex version should be selected once typed component env and
    component HTTP route behavior are covered by the test matrix?

None of these questions changes the core system boundary. Questions 1 through 3
must be resolved with a spike before implementation proceeds beyond Phase 1.

## Recommended Technical Spike

Before full implementation, build a disposable vertical slice that proves:

1. a host mutation transactionally creates a control session and command;
2. a component-scheduled action sends a signed command to an eve custom channel;
3. retrying after dropping the first HTTP response does not create a second eve
   turn;
4. the eve bridge notifies the component without sending message content;
5. the component reads a finite stream from index zero, writes projections, and
   advances its cursor;
6. dropping and duplicating notifications still converges;
7. a real approval response resumes the same eve session; and
8. a subagent child session is discovered and synchronized.

The spike should be deleted or rewritten after decisions are captured. It must
not silently become production code without the protocol, security, and failure
tests described above.

## Sources

### eve primary sources

- [eve repository](https://github.com/vercel/eve)
- [Introducing eve](https://vercel.com/blog/introducing-eve)
- [eve product overview](https://vercel.com/eve)
- [How to add skills to an eve agent](https://vercel.com/kb/guide/how-to-add-eve-skills)
- The complete documentation bundled with `eve@0.31.0`, especially sessions and
  streaming, custom channels, the default eve channel, execution and durability,
  auth, state, skills, subagents, HITL, instrumentation, and self-hosting.

### Convex primary sources

- [Authoring Convex Components](https://docs.convex.dev/components/authoring)
- [Using Convex Components](https://docs.convex.dev/components/using)
- [Understanding Convex Components](https://docs.convex.dev/components/understanding)
- [Convex Actions](https://docs.convex.dev/functions/actions)
- [Convex HTTP Actions](https://docs.convex.dev/functions/http-actions)
- [Convex limits](https://docs.convex.dev/production/state/limits)

### Local architectural references

- `../convex-wearables/README.md`
- `../convex-wearables/CONTRIBUTING.md`
- `../convex-wearables/package.json`
- `../convex-chat/docs/convex-chat-v0.1-prd.md`

## Final Product Statement

`convex-eve` is the durable control plane for eve-powered applications built on
Convex. It does not make Convex pretend to be eve and does not make eve pretend
to be the application's database. It gives each system a precise role and turns
their boundary into a secure, observable, idempotent, realtime component that
any Convex application can install.
