import {
  ArrowRight,
  Braces,
  Radio,
  ShieldCheck,
  Sparkles,
  Workflow,
} from "lucide-react";
import Link from "next/link";
import { ControlPlaneHero } from "@/components/control-plane-hero";

const features = [
  {
    icon: Workflow,
    title: "Eve runs the agent",
    description:
      "Keep filesystem-native instructions, skills, tools, subagents, sandboxes, and durable model loops.",
  },
  {
    icon: Radio,
    title: "Convex persists the chat",
    description:
      "Save pending input first, then materialize Eve messages, approvals, and stream state as reactive application data.",
  },
  {
    icon: ShieldCheck,
    title: "Your app keeps authority",
    description:
      "Authentication, tenancy, permissions, domain data, and sensitive tool policy stay in host Convex functions.",
  },
];

export default function HomePage() {
  return (
    <main className="home-shell flex flex-1 flex-col">
      <section className="hero-section">
        <div className="hero-grain" />
        <div className="hero-grid mx-auto w-full max-w-[1500px] px-6 lg:px-10">
          <div className="hero-copy flex flex-col justify-center">
            <div className="mb-7 flex items-center gap-3 text-xs font-medium tracking-[.16em] text-white/45">
              <span className="hero-status-dot" />
              OPEN SOURCE · APACHE-2.0
            </div>
            <h1 className="hero-title text-balance">convex-eve</h1>
            <p className="hero-tagline">Eve agents. Convex-native chat.</p>
            <p className="hero-description">
              Threads, reactive messages, and resumable application history for
              agents powered by Eve&apos;s complete harness.
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              <Link href="/docs" className="hero-button hero-button--primary">
                Read the documentation <ArrowRight className="size-4" />
              </Link>
              <a
                href="https://github.com/dciccale/convex-eve/tree/main/apps/example"
                className="hero-button hero-button--secondary"
              >
                View example source
              </a>
            </div>
          </div>
          <div className="hero-visual">
            <ControlPlaneHero />
          </div>
        </div>
      </section>

      <section className="home-section mx-auto w-full max-w-7xl px-6 py-24 lg:px-8">
        <div className="max-w-3xl">
          <p className="text-sm font-medium text-fd-primary">
            One conversation, two clear authorities
          </p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
            Use each platform for what it does best.
          </h2>
          <p className="mt-4 text-lg text-fd-muted-foreground">
            Eve remains the execution authority. Convex stores the
            authenticated, application-facing thread and its reactive message
            projection.
          </p>
        </div>
        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {features.map((feature) => (
            <article key={feature.title} className="rounded-xl border p-6">
              <feature.icon className="size-5" />
              <h3 className="mt-5 font-medium">{feature.title}</h3>
              <p className="mt-2 text-sm leading-6 text-fd-muted-foreground">
                {feature.description}
              </p>
            </article>
          ))}
        </div>
      </section>

      <section className="home-band border-y">
        <div className="mx-auto grid w-full max-w-7xl gap-10 px-6 py-20 lg:grid-cols-2 lg:px-8">
          <div>
            <div className="flex size-10 items-center justify-center rounded-lg border bg-fd-background">
              <Braces className="size-5" />
            </div>
            <h2 className="mt-5 text-3xl font-semibold tracking-tight">
              Eve-native authoring
            </h2>
            <p className="mt-4 max-w-xl text-fd-muted-foreground">
              Your agent stays an ordinary Eve project. The host Convex action
              calls Eve&apos;s native session API and persists its canonical
              event and message semantics.
            </p>
          </div>
          <pre className="overflow-x-auto rounded-xl border bg-fd-card p-5 text-sm leading-6">
            <code>{`apps/eve-agent/agent/
├── instructions.md
├── channels/eve.ts
├── skills/recovery-assessment/SKILL.md
├── tools/propose_training_plan.ts
└── subagents/
    ├── training/
    ├── nutrition/
    └── recovery/`}</code>
          </pre>
        </div>
      </section>

      <section className="home-section mx-auto w-full max-w-4xl px-6 py-24 text-center">
        <Sparkles className="mx-auto size-6" />
        <h2 className="mt-5 text-3xl font-semibold tracking-tight">
          Follow the component as it takes shape.
        </h2>
        <p className="mx-auto mt-4 max-w-2xl text-fd-muted-foreground">
          The repository now includes the Eve-native component schema, session
          dispatch, ordered stream projection, React hook, and performance coach
          example. Reconciliation and delivery hardening are next.
        </p>
        <Link
          href="/docs"
          className="mt-7 inline-flex items-center gap-2 text-sm font-medium underline underline-offset-4"
        >
          Start with the architecture <ArrowRight className="size-4" />
        </Link>
      </section>
    </main>
  );
}
