import { CheckCircle2 } from "lucide-react";
import { display, serif } from "./fonts";
import { MISSION_PILLARS } from "./constants";

export function MissionAlignment() {
  return (
    <section className="border-t border-[var(--border)] bg-[var(--background)]">
      <div className="mx-auto max-w-6xl px-6 py-16 sm:py-20">
        <div className="mb-10 text-center">
          <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-emerald-400">
            Aligned with Anthropic&apos;s Mission
          </p>
          <h2
            className={`${display.className} text-2xl font-semibold sm:text-3xl`}
          >
            Reliable. Interpretable. Steerable.
          </h2>
          <p
            className={`${serif.className} mx-auto mt-3 max-w-2xl text-base leading-relaxed text-[var(--muted-foreground)]`}
          >
            Every feature in Opus Nx maps to a core principle of safe AI.
            We don&apos;t just use AI — we make its reasoning transparent,
            verifiable, and controllable.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {MISSION_PILLARS.map((pillar) => (
            <article
              key={pillar.pillar}
              className={`mission-card animate-fade-in rounded-xl border ${pillar.borderColor} bg-[var(--card)] p-6 transition-transform duration-200 hover:-translate-y-1`}
            >
              <div
                className={`mb-4 inline-flex items-center justify-center rounded-lg ${pillar.bgColor} p-2.5`}
              >
                <pillar.icon className={`h-5 w-5 ${pillar.color}`} />
              </div>

              <h3 className={`${display.className} text-lg font-semibold`}>
                <span className={pillar.color}>{pillar.pillar}</span>
              </h3>

              <p
                className={`${serif.className} mt-1 text-sm font-medium text-[var(--foreground)]`}
              >
                {pillar.tagline}
              </p>

              <p className="mt-3 text-xs leading-relaxed text-[var(--muted-foreground)]">
                {pillar.description}
              </p>

              <ul className="mt-4 space-y-2">
                {pillar.features.map((feature) => (
                  <li
                    key={feature}
                    className="flex items-start gap-2 text-xs text-[var(--muted-foreground)]"
                  >
                    <CheckCircle2
                      className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${pillar.color}`}
                    />
                    {feature}
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
