# Performance coach Eve agent

This is the native Eve harness used by the example application. Eve discovers
the root coach, shared application tools, and specialist subagents from the
`agent/` filesystem. Each specialist owns a substantive, load-on-demand domain
skill; the root coach keeps only routing, synthesis, and simple factual work.

```bash
cp .env.example .env.local
bun run dev
```

The example defaults to `openai/gpt-5.6-luna` with high reasoning for the root
coach and every specialist. Luna requires paid Vercel AI Gateway credits. Set
`EVE_MODEL` to another Eve-supported gateway model if you want a different
cost, latency, or free-tier profile.

The authored `agent/channels/eve.ts` keeps Eve's native HTTP/session semantics.
It accepts Eve's local-development identity and a host-only bearer credential
shared with the example Convex deployment. Set `EVE_AGENT_TOKEN` to the same
value on both deployments; the component never receives or persists it.
