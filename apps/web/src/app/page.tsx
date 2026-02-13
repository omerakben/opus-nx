import Link from "next/link";
import {
  ArrowRight,
  FlaskConical,
  GitBranch,
  Github,
  Layers3,
  Lightbulb,
  Network,
  Sparkles,
  Users,
} from "lucide-react";
import { Bricolage_Grotesque, Newsreader } from "next/font/google";

const display = Bricolage_Grotesque({
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
});

const serif = Newsreader({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

const FEATURES = [
  {
    icon: Network,
    title: "Persistent Reasoning Graphs",
    description:
      "Every thinking session becomes a queryable graph with explicit edges for influence, support, contradiction, and refinement.",
    color: "text-[#C4654A]",
  },
  {
    icon: GitBranch,
    title: "ThinkFork Analysis",
    description:
      "Fork hard problems into competing reasoning styles, steer branches in flight, and inspect convergence over time.",
    color: "text-[#7BA3BE]",
  },
  {
    icon: Lightbulb,
    title: "Metacognitive Insights",
    description:
      "Generate structured audits of bias, patterns, and improvement hypotheses from the model's own reasoning traces.",
    color: "text-emerald-400",
  },
];

const HIGHLIGHTS = [
  { icon: Users, label: "6-agent swarm orchestration" },
  { icon: Layers3, label: "Persistent session memory and artifacts" },
  { icon: FlaskConical, label: "Research-first evaluation loops" },
];

export default function HomePage() {
  const demoEnabled = process.env.DEMO_MODE === "true";

  return (
    <main className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <div className="absolute inset-0 -z-10 pointer-events-none">
        <div className="h-[440px] bg-[radial-gradient(circle_at_20%_20%,rgba(196,101,74,0.20),transparent_45%),radial-gradient(circle_at_78%_26%,rgba(123,163,190,0.18),transparent_42%),linear-gradient(to_bottom,rgba(255,255,255,0.01),transparent)]" />
      </div>

      <section className="mx-auto max-w-6xl px-6 pb-16 pt-10 sm:pt-16">
        <nav className="mb-10 flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex items-center gap-3 rounded-full border border-[var(--border)] bg-[var(--card)] px-3 py-2">
            <img src="/opus_nx_icon.svg" alt="Opus Nx" width={28} height={28} />
            <span className={`text-sm font-semibold tracking-wide ${display.className}`}>
              OPUS NX
            </span>
            <span className="rounded-full bg-[#C4654A]/15 px-2 py-0.5 text-[10px] font-medium text-[#C4654A]">
              Research Platform
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/login"
              className="rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-xs hover:border-[#7BA3BE]/40"
            >
              Access Workspace
            </Link>
            <a
              href="https://github.com/omerakben/opus-nx"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-xs hover:border-[#C4654A]/40"
            >
              <Github className="h-3.5 w-3.5" />
              GitHub
            </a>
          </div>
        </nav>

        <div className="grid gap-8 lg:grid-cols-[1.15fr_0.85fr]">
          <div>
            <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-[#C4654A]/30 bg-[#C4654A]/10 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-[#C4654A]">
              <Sparkles className="h-3.5 w-3.5" />
              Open-Source Research Direction
            </p>

            <h1 className={`${display.className} animate-fade-in-up text-4xl font-semibold leading-tight sm:text-5xl lg:text-6xl`}>
              AI reasoning you can <span className="text-[#C4654A]">see</span>,{" "}
              <span className="text-[#7BA3BE]">challenge</span>, and{" "}
              <span className="text-emerald-400">audit</span>.
            </h1>

            <p
              className={`${serif.className} animate-fade-in-up delay-100 mt-6 max-w-2xl text-lg leading-relaxed text-[var(--muted-foreground)]`}
            >
              Opus Nx is now focused on reproducible reasoning research and community-built extensions.
              Keep your own credentials, run locally, and contribute directly to a system designed for
              persistent reasoning artifacts.
            </p>

            <div className="mt-8 flex flex-wrap gap-3 animate-fade-in-up delay-200">
              <a
                href="#setup"
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#C4654A] to-[#D2765D] px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-[#C4654A]/25 transition hover:opacity-95"
              >
                Run Locally With Your Keys
                <ArrowRight className="h-4 w-4" />
              </a>
              <Link
                href="/workspace"
                className="rounded-xl border border-[var(--border)] bg-[var(--card)] px-5 py-3 text-sm font-medium hover:border-[#7BA3BE]/40"
              >
                Open Workspace
              </Link>
            </div>

            <div className="mt-10 grid grid-cols-1 gap-3 sm:grid-cols-3">
              {FEATURES.map((feature) => (
                <article
                  key={feature.title}
                  className="animate-fade-in delay-300 rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 transition-transform duration-200 hover:-translate-y-0.5 hover:border-[var(--foreground)]/10"
                >
                  <feature.icon className={`mb-2 h-5 w-5 ${feature.color}`} />
                  <h3 className="text-sm font-semibold">{feature.title}</h3>
                  <p className="mt-1 text-xs leading-relaxed text-[var(--muted-foreground)]">
                    {feature.description}
                  </p>
                </article>
              ))}
            </div>
          </div>

          <aside className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5">
            <h2 className={`${display.className} text-xl font-semibold`}>Current Platform Scope</h2>
            <ul className="mt-4 space-y-3">
              {HIGHLIGHTS.map((item) => (
                <li key={item.label} className="flex items-start gap-3">
                  <item.icon className="mt-0.5 h-4 w-4 text-[#7BA3BE]" />
                  <span className="text-sm text-[var(--muted-foreground)]">{item.label}</span>
                </li>
              ))}
            </ul>

            <div id="setup" className="mt-6 rounded-xl border border-[#7BA3BE]/30 bg-[#7BA3BE]/10 p-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#7BA3BE]">
                Easy BYO Setup
              </p>
              <ol className="space-y-2 text-sm text-[var(--muted-foreground)]">
                <li>1. `pnpm setup` to generate local env templates.</li>
                <li>2. Add your own Anthropic and Supabase credentials.</li>
                <li>3. Run `pnpm setup:verify` and then `pnpm dev`.</li>
              </ol>
              <div className="mt-4 flex flex-wrap gap-2">
                <Link
                  href="/login"
                  className="rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-xs hover:border-[#C4654A]/30"
                >
                  Enter Access Code
                </Link>
                <a
                  href="https://github.com/omerakben/opus-nx#quick-start"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-xs hover:border-[#7BA3BE]/30"
                >
                  Setup Docs
                </a>
              </div>
            </div>

            <div className="mt-4 rounded-xl border border-[var(--border)] bg-[var(--background)] p-4 text-xs text-[var(--muted-foreground)]">
              Demo mode is optional and disabled by default. Enable `DEMO_MODE=true` only if you want
              the seeded showcase flow.
              {demoEnabled ? " Demo mode is currently enabled for this environment." : ""}
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {["Next.js 16", "Python 3.12", "Supabase", "Claude Opus 4.6", "TypeScript"].map((tech) => (
                <span key={tech} className="rounded-full border border-[var(--border)] bg-[var(--background)] px-2.5 py-0.5 text-[10px] text-[var(--muted-foreground)]">
                  {tech}
                </span>
              ))}
            </div>
          </aside>
        </div>

        <div className="mt-16 animate-fade-in delay-400">
          <div className="mb-6 text-center">
            <p className="inline-flex items-center gap-2 rounded-full border border-[#7BA3BE]/30 bg-[#7BA3BE]/10 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-[#7BA3BE]">
              Research Foundation
            </p>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {[
              {
                title: "Tree of Thoughts",
                authors: "Yao et al., 2023",
                module: "ThinkFork",
                url: "https://arxiv.org/abs/2305.10601",
                description: "BFS/DFS search over reasoning trees with state evaluation",
              },
              {
                title: "Let's Verify Step by Step",
                authors: "Lightman et al., 2023",
                module: "PRM Verifier",
                url: "https://arxiv.org/abs/2305.20050",
                description: "Process supervision — verify each reasoning step independently",
              },
              {
                title: "Graph of Thoughts",
                authors: "Besta et al., 2023",
                module: "GoT Engine",
                url: "https://arxiv.org/abs/2308.09687",
                description: "Arbitrary thought graph topology with aggregation and refinement",
              },
              {
                title: "MemGPT",
                authors: "Packer et al., 2023",
                module: "Memory Hierarchy",
                url: "https://arxiv.org/abs/2310.08560",
                description: "3-tier memory hierarchy with paging and auto-eviction",
              },
            ].map((paper) => (
              <a
                key={paper.title}
                href={paper.url}
                target="_blank"
                rel="noopener noreferrer"
                className="group rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 transition-colors hover:border-[#7BA3BE]/40"
              >
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-sm font-semibold">{paper.title}</h3>
                  <span className="shrink-0 rounded-full bg-[#7BA3BE]/15 px-2 py-0.5 text-[10px] font-medium text-[#7BA3BE]">
                    {paper.module}
                  </span>
                </div>
                <p className="mt-1 text-[11px] text-[var(--muted-foreground)]">{paper.authors}</p>
                <p className="mt-2 text-xs leading-relaxed text-[var(--muted-foreground)]">
                  {paper.description}
                </p>
              </a>
            ))}
          </div>
        </div>
      </section>

      <footer className="border-t border-[var(--border)] py-8 px-6">
        <div className="mx-auto max-w-6xl flex flex-col items-center gap-3 text-center">
          <p className={`${serif.className} text-sm text-[var(--muted-foreground)]`}>
            Built by{" "}
            <a
              href="https://omerakben.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#C4654A] hover:underline"
            >
              Ozzy
            </a>
            {" + "}
            <a
              href="https://tuel.ai"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#7BA3BE] hover:underline"
            >
              TUEL AI
            </a>
            {" + "}
            <a
              href="https://www.anthropic.com/news/claude-opus-4-6"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#D4A574] hover:underline"
            >
              Claude
            </a>
          </p>
          <p className="text-xs text-[var(--muted-foreground)]">
            Research Platform &middot; MIT License
          </p>
        </div>
      </footer>
    </main>
  );
}
