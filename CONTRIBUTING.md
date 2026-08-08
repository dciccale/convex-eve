# Contributing

Install Bun, then run `bun install` and `bun run check`. Use a changeset for any
user-visible package change. Protocol changes must include fixtures and an
explicit compatibility decision.

Please keep pull requests focused and include tests for behavior changes.

## Publishing a prerelease

Publishing changes npm state and requires explicit maintainer approval. Verify
the complete repository and publishable tarball first:

```sh
bun run check
bun run verify:package
cd packages/convex-eve
bun run publish:next --dry-run
```

After approval, publish the alpha under the `next` dist-tag:

```sh
bun run publish:next
```

The package publish guard rejects prerelease versions sent to `latest`.
