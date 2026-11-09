# Migrate to Eve 1.0.0-rc.7

This release changes the component protocol and public exports. It requires
Eve 1.0.0-rc.7, Node.js 24 or newer, and React 19 for the React entry point.

## Upgrade the deployment

1. Finish existing 0.48 work on its original Eve deployment. Keep that deployment available until its sessions finish.
2. Upgrade Eve on the agent and Convex host to `1.0.0-rc.7`. Install `convex-eve@next`.
3. Deploy the new agent before the new host. Do not run the old dispatch code against the new component protocol.
4. Regenerate Convex bindings and deploy the updated host functions.
5. Start new threads for v1 messages. Existing generations remain readable, but cannot accept v1 sends or projections.
6. Test a message, an approval answer, reconnect recovery, and thread deletion.

The bridge does not convert pre-0.69 events or old reducer snapshots. Old
approval controls are read-only. To retire or delete a bound legacy thread,
use its original deployment and bridge version before upgrading.

## Replace event ingestion

`runtime.ingestProjection` replaces `runtime.ingestEvent`. Use `projectEveStream`
in a host action. It must read the session from line zero, because Eve's
`SessionView` is opaque and is not a database checkpoint format.

```ts
import { projectEveStream } from "convex-eve";

const stream = session.stream({ startIndex: 0, follow: false });
for await (const checkpoint of projectEveStream(stream, savedNextStreamIndex)) {
	await ctx.runMutation(components.eve.runtime.ingestProjection, {
		...actor,
		threadId,
		eveSessionId: session.id,
		checkpoint: JSON.parse(JSON.stringify(checkpoint)),
	});
}
```

The helper uses Eve's canonical `conversationOf` projection. It emits one
cumulative snapshot per complete source line. Multiple facts in one line
commit together. The snapshot preserves `meta.next` coverage when a reader
skips source lines. A partial line cannot advance the saved cursor.

The component validates the actor and session binding independently. It strips
reasoning, full tool payloads, structured results, and sign-in credentials from
messages before storage. It commits messages, status, and cursor together.
A stale snapshot cannot replace newer state.

The coordinate ledger records the final `(eveSessionId, line, index)` of each
checkpoint. `nextStreamIndex` counts lines, not events. No event IDs determine
order. No raw event log, opaque view, or signed inbox handle is stored.

The current host replays full history on each action. This costs more as a
session grows. Retention and projection compaction remain future work.

## Bind native receipts

Pass the native `eveDeliveryId` to `runtime.markStreaming` before reading the
session. A message completes only when its own delivery settles. An unrelated
control or earlier delivery cannot release the pending send.

The example uses keyed HTTP sends and answers. Eve rc.7 accepts
`idempotencyKey` on HTTP but does not expose it in client send options. Its
recent-key window is limited to 1,024 entries. An ambiguous send remains
blocked until receipt evidence resolves it. Durable recovery for lost answer
receipts remains future work.

## Update API names

| Earlier API | v1 API |
| --- | --- |
| `MessageStreamEvent` | `SessionStreamEvent` |
| `InputResponse`, `requestId` | `Answer`, `interactionId` |
| `EveMessageData`, `defaultMessageReducer` | Host `conversationOf` and `projectEveStream` |
| `dynamic-tool` part | Native `tool` part |
| Input and authorization metadata | Native `interaction` part or `tool.interaction` |
| Client `host` option | `baseUrl` |
| `reset()` | `end()`, then observe its complete settlement line |

The host retains authentication and credentials. The component remains
independent from `@convex-dev/agent`.

The example follows the live session stream for control settlements. In rc.7,
`end().result()` can finish its bounded read before the end command settles.
The host keeps the thread until it observes the matching complete line.
