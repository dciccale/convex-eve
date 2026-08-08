"use client";

import { ConvexProvider, ConvexReactClient } from "convex/react";
import type { ReactNode } from "react";
import { ThemeProvider } from "@/components/theme-provider";
import { TooltipProvider } from "@/components/ui/tooltip";

const url = process.env.NEXT_PUBLIC_CONVEX_URL;
const client = url ? new ConvexReactClient(url) : null;

export function Providers({ children }: { children: ReactNode }) {
  if (!client) {
    return (
      <ThemeProvider
        attribute="class"
        defaultTheme="system"
        enableSystem
        disableTransitionOnChange
      >
        <div className="flex min-h-svh items-center justify-center p-6">
          <div className="rounded-lg border bg-card p-6 text-sm shadow-sm">
            Run <code>bun run dev:convex</code> from the repository root to
            configure Convex.
          </div>
        </div>
      </ThemeProvider>
    );
  }
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      <TooltipProvider>
        <ConvexProvider client={client}>{children}</ConvexProvider>
      </TooltipProvider>
    </ThemeProvider>
  );
}
