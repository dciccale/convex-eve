# Performance coach example

This Next.js app demonstrates the database-backed `convex-eve` architecture.
Convex owns the application thread list, pending sends, reactive pagination, and
sanitized `EveMessage` projection. The native agent in `../eve-agent` owns the
durable session, model loop, skills, tools, and specialist subagents.

The reviewer-facing deployment is available at
[example-kohl-phi.vercel.app](https://example-kohl-phi.vercel.app). For local or
production adoption, configure your own Convex and Eve deployments as described
below.

Deleting a conversation is coordinated end to end. The host action uses Eve's
native session controls to cancel an active turn, clear durable model-message
history, and terminally reset the session. Only after those controls succeed
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
