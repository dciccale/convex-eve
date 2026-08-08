import type { BaseLayoutProps } from "fumadocs-ui/layouts/shared";
import { appName, gitConfig } from "./shared";

export function baseOptions(): BaseLayoutProps {
  return {
    nav: {
      title: appName,
    },
    links: [
      { text: "Documentation", url: "/docs", active: "nested-url" },
      {
        text: "Example source",
        url: `https://github.com/${gitConfig.user}/${gitConfig.repo}/tree/main/apps/example`,
        external: true,
      },
    ],
    githubUrl: `https://github.com/${gitConfig.user}/${gitConfig.repo}`,
  };
}
