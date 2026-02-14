import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";
import { display, serif } from "./fonts";
import { FEATURES } from "./constants";

export function HeroSection() {
  return (
    <div>
      <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-[#C4654A]/30 bg-[#C4654A]/10 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-[#C4654A]">
        <Sparkles className="h-3.5 w-3.5" />
        Open-Source Research Platform
      </p>

      <h1
        className={`${display.className} animate-fade-in-up text-4xl font-semibold leading-tight sm:text-5xl lg:text-6xl`}
      >
        AI reasoning you can <span className="text-[#C4654A]">see</span>,{" "}
        <span className="text-[#7BA3BE]">challenge</span>, and{" "}
        <span className="text-emerald-400">audit</span>.
      </h1>

      <p
        className={`${serif.className} animate-fade-in-up delay-100 mt-6 max-w-3xl text-lg leading-relaxed text-[var(--muted-foreground)]`}
      >
        Opus Nx transforms Claude&apos;s extended thinking into persistent
        reasoning graphs you can navigate, verify, and steer. Built on
        Anthropic&apos;s mission to create reliable, interpretable, and
        steerable AI systems.
      </p>

      <div className="mt-8 flex flex-wrap gap-3 animate-fade-in-up delay-200">
        <a
          href="https://github.com/omerakben/opus-nx#quick-start"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#C4654A] to-[#D2765D] px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-[#C4654A]/25 transition hover:opacity-95"
        >
          Get Started
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
            <h2 className="text-sm font-semibold">{feature.title}</h2>
            <p className="mt-1 text-xs leading-relaxed text-[var(--muted-foreground)]">
              {feature.description}
            </p>
          </article>
        ))}
      </div>
    </div>
  );
}
