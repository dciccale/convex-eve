import { readFileSync } from "node:fs";

const packageJson = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf8"),
);
const tag = process.env.npm_config_tag ?? "latest";

if (packageJson.version.includes("-") && tag === "latest") {
  console.error(
    `Refusing to publish prerelease ${packageJson.version} with the latest tag. ` +
      "Use bun run publish:next.",
  );
  process.exit(1);
}
