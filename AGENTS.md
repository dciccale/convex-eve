# Contributor instructions

- Use Bun for dependency installation and scripts.
- Keep the package independent from `@convex-dev/agent`.
- Treat eve as the execution authority and Convex as the application control plane.
- Never order eve events by event ID; use `(eveSessionId, streamIndex)`.
- Keep host authentication in host functions. Component functions must independently enforce the supplied scope and subject.
- Do not persist bridge secrets, signatures, hidden reasoning, or full tool payloads.
- Add tests for every protocol or state-machine change.
- Use Conventional Commits with lowercase subjects.
