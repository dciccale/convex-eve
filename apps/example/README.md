# Performance coach example

This Next.js app demonstrates the database-backed `convex-eve` architecture.
Convex owns the application thread list, pending sends, reactive pagination, and
sanitized `EveMessage` projection. The native agent in `../eve-agent` owns the
durable session, model loop, skills, tools, and specialist subagents.

Deleting a conversation is coordinated end to end. The host action uses Eve's
native session controls to cancel an active turn, clear durable model-message
history, and terminally end the session. Only after those controls succeed
does it cascade-delete the app-facing thread, messages, deliveries, generations,
and event coordinates from the Convex component.

## Configure

Start Convex once to create or select a deployment:

```bash
bun run convex:dev
```

Deploy the Eve agent or expose its development server through a URL reachable
by Convex, then set the host-only bridge configuration:

```bash
bunx convex env set EVE_AGENT_URL https://your-eve-agent.vercel.app
bunx convex env set EVE_AGENT_TOKEN replace-with-a-long-random-value
```

Set the same token in the Eve deployment. Copy the generated public Convex URL
to `.env.local` as `NEXT_PUBLIC_CONVEX_URL`, then run:

```bash
bun run dev:next
```

The app is available at `https://convex-eve-example.localhost`. Portless assigns
the underlying port automatically. The marketing and documentation app uses
`https://convex-eve.localhost`.

## Eve v1 protocol

The host and agent both use Eve 1.0.0-rc.7. The bridge stores the native delivery
ID before reading its stream. It accepts that message only when the matching
receipt settles. It rebuilds Eve's view from line zero and stores sanitized
snapshots at complete v27 lines. The saved cursor counts lines, not events.

The rc.7 HTTP API supports `idempotencyKey`, but its client send options do not.
The host uses the documented HTTP field for keyed messages and answers.
A session retains only its last 1,024 keys. Ambiguous sends stay blocked;
the bridge does not assume that a key permits unlimited automatic retries.
Answer retries still require durable worker recovery before production use.

Conversations made with Eve 0.48 remain readable. Their composer is disabled.
Start a new conversation to use v1. Retire old sessions through their original
deployment before upgrading. The new bridge rejects deletion of a bound legacy
thread because it cannot prove that the original session was retired.
