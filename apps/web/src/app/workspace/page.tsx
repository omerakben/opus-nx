import Link from "next/link";
import { AlertTriangle, Wrench } from "lucide-react";
import { Dashboard } from "@/components/layout";
import { getWorkspaceEnvStatus } from "@/lib/server-env";

export const dynamic = "force-dynamic";

export default function WorkspacePage() {
  const isDemoMode = process.env.DEMO_MODE === "true";
  const envStatus = getWorkspaceEnvStatus();

  if (!envStatus.ok) {
    return (
      <main className="min-h-screen bg-[var(--background)] px-6 py-16 text-[var(--foreground)]">
        <div className="mx-auto max-w-2xl rounded-2xl border border-[var(--border)] bg-[var(--card)] p-6">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[#C4654A]/30 bg-[#C4654A]/10 px-3 py-1 text-xs text-[#C4654A]">
            <AlertTriangle className="h-4 w-4" />
            Workspace Configuration Required
          </div>

          <h1 className="text-2xl font-semibold">Complete setup to use the workspace</h1>
          <p className="mt-3 text-sm text-[var(--muted-foreground)]">
            Public pages are available, but the reasoning workspace needs provider credentials and
            storage settings.
          </p>

          <div className="mt-5 rounded-xl border border-[var(--border)] bg-[var(--background)] p-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
              Missing or invalid environment values
            </p>
            <ul className="space-y-1 text-sm text-[var(--muted-foreground)]">
              {envStatus.issues.map((issue) => (
                <li key={issue}>- {issue}</li>
              ))}
            </ul>
          </div>

          <div className="mt-6 rounded-xl border border-[#7BA3BE]/30 bg-[#7BA3BE]/10 p-4">
            <p className="mb-2 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-[#7BA3BE]">
              <Wrench className="h-3.5 w-3.5" />
              Quick setup
            </p>
            <ol className="space-y-1 text-sm text-[var(--muted-foreground)]">
              <li>1. Run `pnpm setup` from the repository root.</li>
              <li>2. Fill `.env` and `agents/.env` with your own credentials.</li>
              <li>3. Run `pnpm setup:verify` to confirm connectivity.</li>
            </ol>
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/"
              className="rounded-lg border border-[var(--border)] bg-[var(--background)] px-4 py-2 text-sm hover:border-[#7BA3BE]/40"
            >
              Back to Home
            </Link>
            <a
              href="https://github.com/omerakben/opus-nx#quick-start"
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg border border-[var(--border)] bg-[var(--background)] px-4 py-2 text-sm hover:border-[#C4654A]/40"
            >
              Open Setup Guide
            </a>
          </div>
        </div>
      </main>
    );
  }

  return <Dashboard isDemoMode={isDemoMode} />;
}
