"use client";

import { useState } from "react";
import {
  Brain,
  GitBranch,
  Lightbulb,
  Network,
  Sparkles,
  Zap,
} from "lucide-react";
import { useRouter } from "next/navigation";

const FEATURES = [
  {
    icon: Network,
    title: "Persistent Reasoning Graphs",
    description:
      "Every thinking session becomes a queryable graph node with edges showing how ideas influence, support, or contradict each other.",
  },
  {
    icon: GitBranch,
    title: "ThinkFork Analysis",
    description:
      "Fork any question into 4 reasoning perspectives — analytical, creative, critical, and practical — then steer the synthesis.",
  },
  {
    icon: Lightbulb,
    title: "Metacognitive Insights",
    description:
      "Claude analyzes its own reasoning for biases, patterns, and improvement hypotheses — AI that reflects on how it thinks.",
  },
];

export default function LoginPage() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      if (res.ok) {
        router.push("/");
        router.refresh();
      } else {
        const data = await res.json();
        setError(data.error?.message || "Invalid access code");
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleLaunchDemo() {
    setDemoLoading(true);
    setError("");

    try {
      const res = await fetch("/api/demo", { method: "POST" });
      if (res.ok) {
        router.push("/");
        router.refresh();
      } else {
        const data = await res.json();
        setError(data.error?.message || "Failed to launch demo");
      }
    } catch {
      setError("Failed to launch demo. Please try again.");
    } finally {
      setDemoLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[var(--background)] px-4 py-12">
      {/* Hero Section */}
      <div className="w-full max-w-2xl text-center mb-10">
        <div className="flex justify-center mb-5">
          <div className="relative">
            <div className="p-4 rounded-2xl bg-gradient-to-br from-blue-500 to-violet-500 shadow-lg shadow-blue-500/20">
              <Brain className="w-10 h-10 text-white" />
            </div>
            <div className="absolute -top-1 -right-1 p-1 rounded-full bg-emerald-500 shadow-sm">
              <Zap className="w-3 h-3 text-white" />
            </div>
          </div>
        </div>

        <h1 className="text-3xl sm:text-4xl font-bold text-[var(--foreground)] tracking-tight mb-3">
          Opus Nx
        </h1>

        <p className="text-lg sm:text-xl text-[var(--muted-foreground)] leading-relaxed max-w-xl mx-auto mb-2">
          The first AI where reasoning is{" "}
          <span className="text-blue-400 font-medium">persistent</span>,{" "}
          <span className="text-violet-400 font-medium">navigable</span>, and{" "}
          <span className="text-emerald-400 font-medium">evolving</span>.
        </p>

        <p className="text-sm text-[var(--muted)] mb-8">
          Extended thinking becomes a first-class data structure — every reasoning
          session creates graph nodes that can be traversed, searched, and analyzed
          for metacognition.
        </p>

        {/* Feature Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-8">
          {FEATURES.map((feature) => (
            <div
              key={feature.title}
              className="p-4 rounded-xl border border-[var(--border)] bg-[var(--card)] text-left hover:border-[var(--muted)] transition-colors"
            >
              <feature.icon className="w-5 h-5 text-blue-400 mb-2" />
              <h3 className="text-sm font-semibold text-[var(--foreground)] mb-1">
                {feature.title}
              </h3>
              <p className="text-xs text-[var(--muted-foreground)] leading-relaxed">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Auth Section */}
      <div className="w-full max-w-sm">
        {/* Demo Button */}
        <button
          onClick={handleLaunchDemo}
          disabled={demoLoading}
          className="w-full mb-4 py-3 rounded-xl bg-gradient-to-r from-blue-500 via-violet-500 to-blue-500 bg-[length:200%_auto] text-white font-semibold hover:bg-right transition-[background-position] duration-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-violet-500/20"
        >
          {demoLoading ? (
            <>
              <Sparkles className="w-4 h-4 animate-spin" />
              Setting up demo...
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4" />
              Launch Demo
            </>
          )}
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="flex-1 h-px bg-[var(--border)]" />
          <span className="text-xs text-[var(--muted)]">or enter access code</span>
          <div className="flex-1 h-px bg-[var(--border)]" />
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Access code"
            autoFocus
            required
            className="w-full px-4 py-2.5 rounded-lg border border-[var(--border)] bg-[var(--card)] text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent"
          />

          {error && (
            <p className="text-sm text-red-500 text-center">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading || !password}
            className="w-full py-2.5 rounded-lg border border-[var(--border)] bg-[var(--card)] text-[var(--foreground)] font-medium hover:bg-[var(--muted)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Verifying..." : "Continue"}
          </button>
        </form>

        {/* Badges */}
        <div className="flex flex-wrap items-center justify-center gap-2 mt-6">
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs bg-blue-500/10 text-blue-400 border border-blue-500/20">
            <Zap className="w-3 h-3" />
            Claude Opus 4.6
          </span>
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs bg-violet-500/10 text-violet-400 border border-violet-500/20">
            Cerebral Valley Hackathon 2026
          </span>
        </div>
      </div>
    </div>
  );
}
