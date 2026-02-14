import { ArrowRight, Github } from "lucide-react";
import { display, serif } from "./fonts";

export function OpenSourceCTA() {
  return (
    <section className="border-t border-[var(--border)]">
      <div className="mx-auto max-w-6xl px-6 py-16 sm:py-20">
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-8 text-center sm:p-12">
          <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-[var(--foreground)]/15 bg-[var(--foreground)]/5 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-[var(--foreground)]">
            <Github className="h-3.5 w-3.5" />
            Open Source
          </p>

          <h2
            className={`${display.className} text-2xl font-semibold sm:text-3xl`}
          >
            Built in public. Contribute to the
            <br className="hidden sm:block" /> future of AI reasoning.
          </h2>

          <p
            className={`${serif.className} mx-auto mt-4 max-w-xl text-base leading-relaxed text-[var(--muted-foreground)]`}
          >
            Opus Nx is MIT-licensed and community-driven. Run it locally with
            your own keys, extend the reasoning engines, or contribute to the
            agent swarm.
          </p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <a
              href="https://github.com/omerakben/opus-nx"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#C4654A] to-[#D2765D] px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-[#C4654A]/25 transition hover:opacity-95"
            >
              <Github className="h-4 w-4" />
              View on GitHub
            </a>
            <a
              href="https://github.com/omerakben/opus-nx/blob/main/CONTRIBUTING.md"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--background)] px-5 py-3 text-sm font-medium hover:border-[#7BA3BE]/40"
            >
              Contributing Guide
              <ArrowRight className="h-4 w-4" />
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
