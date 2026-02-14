import Link from "next/link";
import { display } from "./fonts";
import { HIGHLIGHTS, TECH_STACK } from "./constants";

interface PlatformScopeProps {
  demoEnabled: boolean;
}

export function PlatformScope({ demoEnabled }: PlatformScopeProps) {
  return (
    <section className="mt-16 animate-fade-in delay-300">
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-6">
        <div className="grid gap-6 md:grid-cols-[1fr_1fr_auto]">
          <div>
            <h2
              className={`${display.className} text-lg font-semibold`}
            >
              Platform Capabilities
            </h2>
            <ul className="mt-3 space-y-2.5">
              {HIGHLIGHTS.map((item) => (
                <li key={item.label} className="flex items-start gap-3">
                  <item.icon className="mt-0.5 h-4 w-4 text-[#7BA3BE]" />
                  <span className="text-sm text-[var(--muted-foreground)]">
                    {item.label}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div
            id="setup"
            className="rounded-xl border border-[#7BA3BE]/30 bg-[#7BA3BE]/10 p-4"
          >
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#7BA3BE]">
              Quick Start
            </p>
            <ol className="space-y-2 text-sm text-[var(--muted-foreground)]">
              <li>
                1. Clone the repo and run{" "}
                <code className="rounded bg-[var(--background)] px-1 py-0.5 text-xs">
                  ./scripts/docker-start.sh
                </code>
              </li>
              <li>
                2. Add your{" "}
                <code className="rounded bg-[var(--background)] px-1 py-0.5 text-xs">
                  ANTHROPIC_API_KEY
                </code>
              </li>
              <li>3. Open localhost:3000 and start reasoning.</li>
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

          <div className="flex flex-col justify-between gap-4">
            <div className="flex flex-wrap gap-2">
              {TECH_STACK.map((tech) => (
                <span
                  key={tech}
                  className="rounded-full border border-[var(--border)] bg-[var(--background)] px-2.5 py-0.5 text-[10px] text-[var(--muted-foreground)]"
                >
                  {tech}
                </span>
              ))}
            </div>
            {demoEnabled && (
              <p className="text-[11px] text-[var(--muted-foreground)]">
                Demo mode is enabled for this environment.
              </p>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
