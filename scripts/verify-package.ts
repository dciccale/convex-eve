import { execFileSync } from "node:child_process";
import {
  cp,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  stat,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const repoRoot = resolve(import.meta.dirname, "..");
const packageDir = join(repoRoot, "packages/convex-eve");
const temporaryDir = await mkdtemp(join(tmpdir(), "convex-eve-package-"));

function requiredTarget(
  exports: Record<string, unknown>,
  key: string,
  condition: "default" | "types" = "default",
) {
  const entry = exports[key];
  if (typeof entry === "string") return entry;
  if (entry && typeof entry === "object") {
    const target = (entry as Record<string, unknown>)[condition];
    if (typeof target === "string") return target;
  }
  throw new Error(`Missing ${condition} export for ${key}`);
}

async function assertFile(packageRoot: string, target: string) {
  const path = join(packageRoot, target.replace(/^\.\//, ""));
  if (!(await stat(path).catch(() => undefined))?.isFile()) {
    throw new Error(`Published export target is missing: ${target}`);
  }
}

try {
  const output = execFileSync(
    "npm",
    [
      "pack",
      packageDir,
      "--ignore-scripts",
      "--json",
      "--pack-destination",
      temporaryDir,
    ],
    { encoding: "utf8" },
  );
  const [{ filename }] = JSON.parse(output) as Array<{ filename: string }>;
  execFileSync("tar", [
    "-xzf",
    join(temporaryDir, filename),
    "-C",
    temporaryDir,
  ]);

  const packageRoot = join(temporaryDir, "package");
  const manifest = JSON.parse(
    await readFile(join(packageRoot, "package.json"), "utf8"),
  ) as {
    exports: Record<string, unknown>;
    publishConfig?: { tag?: string };
    version: string;
  };

  if (
    !manifest.version.includes("-") ||
    manifest.publishConfig?.tag !== "next"
  ) {
    throw new Error(
      "Prereleases must use a SemVer prerelease and the npm next tag",
    );
  }

  for (const key of [".", "./react", "./convex.config.js"]) {
    await assertFile(packageRoot, requiredTarget(manifest.exports, key));
    await assertFile(
      packageRoot,
      requiredTarget(manifest.exports, key, "types"),
    );
  }
  await assertFile(
    packageRoot,
    requiredTarget(manifest.exports, "./_generated/component.js", "types"),
  );
  await assertFile(packageRoot, requiredTarget(manifest.exports, "./test"));
  await assertFile(packageRoot, "LICENSE");

  const componentTypes = await readFile(
    join(packageRoot, "dist/component/_generated/component.d.ts"),
    "utf8",
  );
  if (/\n\s+any,\n\s+Name/g.test(componentTypes)) {
    throw new Error(
      "Generated ComponentApi still contains an unvalidated any return",
    );
  }

  const consumerRoot = join(temporaryDir, "consumer");
  const consumerModules = join(consumerRoot, "node_modules");
  await mkdir(consumerModules, { recursive: true });
  await cp(packageRoot, join(consumerModules, "convex-eve"), {
    recursive: true,
  });
  for (const dependency of [
    "convex",
    "convex-helpers",
    "convex-test",
    "eve",
    "react",
    "vite",
  ]) {
    await symlink(
      join(packageDir, "node_modules", dependency),
      join(consumerModules, dependency),
    );
  }

  await writeFile(
    join(consumerRoot, "smoke.ts"),
    `import { Agent } from "convex-eve";
import { useUIMessages } from "convex-eve/react";
import eveTest from "convex-eve/test";
import eveConfig from "convex-eve/convex.config.js";
import type { ComponentApi } from "convex-eve/_generated/component.js";

const component = null as unknown as ComponentApi;
new Agent(component, { agentId: "smoke" });
void eveConfig;
void eveTest.register;
void useUIMessages;
`,
  );
  await writeFile(
    join(consumerRoot, "tsconfig.json"),
    JSON.stringify({
      compilerOptions: {
        lib: ["ES2022", "DOM"],
        module: "ESNext",
        moduleResolution: "Bundler",
        noEmit: true,
        skipLibCheck: true,
        strict: true,
        target: "ES2022",
      },
      include: ["smoke.ts"],
    }),
  );
  execFileSync(join(repoRoot, "node_modules/.bin/tsc"), ["-p", consumerRoot]);

  await writeFile(
    join(consumerRoot, "smoke.mjs"),
    `import { Agent } from "convex-eve";
import eveConfig from "convex-eve/convex.config.js";
if (typeof Agent !== "function" || !eveConfig) process.exit(1);
`,
  );
  execFileSync(process.execPath, [join(consumerRoot, "smoke.mjs")]);

  console.log(
    `Verified ${filename}: exports, license, types, and fresh-consumer imports pass.`,
  );
} finally {
  await rm(temporaryDir, { force: true, recursive: true });
}
