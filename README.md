# convex-eve

[![CI](https://github.com/dciccale/convex-eve/actions/workflows/ci.yml/badge.svg)](https://github.com/dciccale/convex-eve/actions/workflows/ci.yml)
[![npm next](https://img.shields.io/npm/v/convex-eve/next?label=npm%20next)](https://www.npmjs.com/package/convex-eve/v/next)
[![License](https://img.shields.io/github/license/dciccale/convex-eve)](LICENSE)

An experimental open-source Convex Agent component backed by
[eve](https://github.com/vercel/eve) agent harnesses.

Eve remains the authority for agent execution: model loops, instructions,
skills, tools, subagents, sandboxes, and durable workflows. The component
provides Convex-native threads, messages, UI parts, pagination, approvals, and
realtime projections for application-facing agent experiences.

> [!WARNING]
> This repository is in early development. The Eve-native persistence path is
> implemented, but delivery idempotency, reconciliation, and retention controls
> still need production hardening. Install the alpha implementation with
> `convex-eve@next`; `latest` remains the `0.0.1` name-reservation placeholder.

## Repository

```text
apps/
  web/          Marketing site and Fumadocs documentation
  example/      Next.js performance coach example with Convex
  eve-agent/    Native Eve coach, skills, tools, and specialist subagents (port 2000)

packages/
  convex-eve/   Publishable Convex persistence and React package
```

The example uses a performance coach with training, nutrition, and recovery
specialists. Its user-facing conversation is paired with an operations panel
that demonstrates tool activity, delegation, approvals, queued commands, and
synchronization state.

## Local development

Requirements:

- Bun 1.3.9 or newer
- Access to a Convex project
- An AI Gateway key or another model configuration supported by Eve when
  running real agent turns

Install dependencies:

```bash
bun install
```

The existing development deployment is configured in the ignored
`apps/example/.env.local`. On another machine:

```bash
cd apps/example
bunx convex dev --configure existing
```

Individual services can also be started from the repository root:

```bash
bun run dev:web
bun run dev:example
bun run dev:convex
bun run dev:eve
```

The Convex action must reach the Eve HTTP deployment. For a complete local
exercise, use a public development URL/tunnel for `apps/eve-agent`, or deploy it
to Vercel, then configure the Convex deployment:

```bash
cd apps/example
bunx convex env set EVE_AGENT_URL https://your-eve-agent.vercel.app
bunx convex env set EVE_AGENT_TOKEN replace-with-a-long-random-value
```

Set the same `EVE_AGENT_TOKEN` on the Eve deployment. The secret remains in host
Convex functions and is never persisted in component tables.

Portless exposes the marketing/docs site at `https://convex-eve.localhost` and
the coach app at `https://convex-eve-example.localhost`, assigning their
underlying ports automatically. The native Eve harness continues to use port
`2000`. `bun run dev:example` starts only the Next.js frontend; use
`bun run dev:convex` in a second terminal when changing Convex functions, or run
`bun run --cwd apps/example dev` to start both.

## Vercel

The hosted project uses two Vercel projects. The example remains source-only so
adopters run it with their own Convex deployment and credentials:

| Project | Root directory | Build command | Configuration |
| --- | --- | --- | --- |
| Marketing and docs | `apps/web` | auto-detected (`bun run build`) | Next.js preset |
| Eve coach | `apps/eve-agent` | `bun run build` | Link with `bun run link`; Eve emits Vercel Build Output |

Do not create a public Vercel project for `apps/example`. Run it locally after
selecting a Convex development deployment and configuring that deployment with
the Eve URL and shared service credential.

The Eve project uses Vercel AI Gateway through project OIDC with the default
`openai/gpt-5.6-luna` model and high reasoning. Luna requires paid AI Gateway
credits; override `EVE_MODEL` for another Eve-supported model. Set
`EVE_AGENT_TOKEN` on both the Eve Vercel project and the Convex deployment. The
example's authored Eve channel accepts that service credential and Eve's native
local-development authentication.

## Quality checks

```bash
bun run check
```

This runs formatting-independent lint checks, TypeScript validation, tests,
package compilation, the Fumadocs build, the Next.js example build, and the Eve
agent build through Turborepo.

## Project status

Available now:

- Convex component installation under `components.eve`
- Eve-native `Agent` binding without model or tool configuration
- Authenticated application threads and paginated `EveMessage` projections
- Pending-message capture before external delivery
- Exact `(eveSessionId, streamIndex)` ingestion and coordinate deduplication
- Eve `defaultMessageReducer` semantics with bounded persistence sanitization
- `convex-eve/react` with `useUIMessages`
- Native Eve performance coach example

Next milestone:

- Add bridge-level create/send idempotency
- Use Workpool for bounded delivery and catch-up reconciliation
- Add snapshot-based projection rebuilds and retention controls
- Harden input-response delivery and session controls
- Expand component state-machine integration tests

See the [current v0.1 PRD](docs/convex-eve-agent-v0.1-prd.md) for the focused
Eve-backed Agent architecture and implementation plan. The
[original control-plane PRD](docs/convex-eve-v0.1-prd.md) is retained as design
history and protocol research.

## Independence

This project has no dependency on `@convex-dev/agent`. It is a community project
and is not an official Convex or Vercel product.

Licensed under Apache-2.0.
