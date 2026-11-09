# convex-eve

## 0.1.0-alpha.3

### Breaking changes

- Require Eve 1.0.0-rc.7 and Node.js 24. The optional React entry point requires React 19.
- Replace event-count ingestion with cumulative, complete-line v27 projection checkpoints.
- Replace legacy event and input-response exports with `SessionStreamEvent`, `Answer`, and `Interaction`.
- Keep existing Eve 0.48 generations read-only. New sends require a new thread.

### Changes

- Rebuild native Eve message semantics in the host with `projectEveStream` and `conversationOf`.
- Bind pending messages to native delivery receipts and settle only the matching delivery.
- Persist sanitized messages and checkpoint coordinates without raw events, reasoning, full tool payloads, signed inbox handles, or sign-in credentials.
- Update the coach example for native tool and interaction parts, keyed HTTP sends and answers, and `end()` session retirement.
- Wait for complete control settlement lines before deleting a conversation. This avoids an rc.7 bounded end-reader race.
- Add protocol, storage-isolation, replay, legacy-record, and live HTTP tests. Run the deterministic Eve smoke test in CI.
- Include bounded reconciliation from the previous unreleased changeset.

## 0.1.0-alpha.2

### Patch Changes

- Serialize delivery claims per Eve session generation.
- Add an `unknown` delivery state that blocks unsafe retries after an ambiguous external result.
- Require Eve 0.48 for create-once session support.
