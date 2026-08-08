# convex-eve

Experimental Convex persistence and reactive UI projections for
[Eve](https://github.com/vercel/eve) agents.

Eve remains responsible for agent execution, while this component provides
application-owned threads, pending-message delivery, ordered event ingestion,
sanitized message projections, and React pagination helpers.

> This package is an early alpha. Its API and data model may change before the
> first stable release. Install the implementation through the npm `next` tag;
> `latest` still points to the `0.0.1` name-reservation placeholder.

## Installation

```bash
npm install convex-eve@next convex eve
```

`convex` 1.43 or newer and `eve` 0.31 or newer are peer dependencies. Install
React 18 or 19 when using the optional `convex-eve/react` entry point.

## Mount the component

```ts
import eve from "convex-eve/convex.config.js";
import { defineApp } from "convex/server";

const app = defineApp();
app.use(eve, { name: "eve" });

export default app;
```

Run `npx convex dev` after mounting the component so Convex generates the
installed component API.

## Create the host binding

Create the binding in your app's Convex code and pass it the installed
component reference:

```ts
import { Agent } from "convex-eve";
import { components } from "./_generated/api.js";

export const coach = new Agent(components.eve, { agentId: "coach" });
```

Host functions authenticate callers before passing trusted `scopeId` and
`subjectId` values into methods such as `createThread`, `saveMessage`,
`getThread`, `listThreads`, and `listUIMessages`.

Authenticate and authorize callers in host Convex functions before passing a
trusted `scopeId` and `subjectId` to the component. Keep Eve service credentials
in host actions; never pass them to component functions.

See the [repository README](https://github.com/dciccale/convex-eve#readme) and
[documentation](https://github.com/dciccale/convex-eve/tree/main/apps/web/content/docs)
for the current setup and security model.

## Testing

Register the component in `convex-test` through the published helper:

```ts
import eveTest from "convex-eve/test";
import { convexTest } from "convex-test";

const t = convexTest();
eveTest.register(t);
```

Licensed under Apache-2.0.
