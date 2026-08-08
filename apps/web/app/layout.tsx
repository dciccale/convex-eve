import { RootProvider } from "fumadocs-ui/provider/next";
import "./global.css";
import type { Metadata } from "next";
import { Inter } from "next/font/google";

const inter = Inter({
  subsets: ["latin"],
});

const siteUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL
  ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  : "https://convex-eve.localhost";

export const metadata: Metadata = {
  title: {
    default: "convex-eve",
    template: "%s · convex-eve",
  },
  description:
    "A durable, realtime Convex control plane for Eve agent harnesses.",
  metadataBase: new URL(siteUrl),
  openGraph: {
    title: "convex-eve",
    description: "Eve agents. Convex control plane.",
    images: [{ url: "/og.png", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "convex-eve",
    description: "Eve agents. Convex control plane.",
    images: ["/og.png"],
  },
};

export default function Layout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={inter.className} suppressHydrationWarning>
      <body className="flex flex-col min-h-screen">
        <RootProvider>{children}</RootProvider>
      </body>
    </html>
  );
}
