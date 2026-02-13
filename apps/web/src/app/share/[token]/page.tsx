import Link from "next/link";
import { notFound } from "next/navigation";
import { Brain, Link2, Sparkles } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import { getSharedSessionSnapshot } from "@/lib/session-share";

interface SharePageProps {
  params: Promise<{ token: string }>;
}

export const dynamic = "force-dynamic";

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
}

export default async function SharedSessionPage({ params }: SharePageProps) {
  const { token } = await params;
  const shared = await getSharedSessionSnapshot(token);

  if (!shared) {
    notFound();
  }

  return (
    <main className="min-h-screen bg-[var(--background)] px-4 py-10 sm:px-6">
      <div className="mx-auto w-full max-w-3xl space-y-4">
        <Card className="border-[var(--border)] bg-[var(--card)]">
          <CardHeader className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-xs text-[var(--muted-foreground)]">
                <Link2 className="h-3.5 w-3.5" />
                Public session share
              </div>
              <div className="text-[11px] text-[var(--muted-foreground)]">
                Expires {formatDate(shared.expiresAt)}
              </div>
            </div>
            <CardTitle className="text-xl text-[var(--foreground)]">
              {shared.title}
            </CardTitle>
            <p className="text-xs text-[var(--muted-foreground)]">
              Created {formatDate(shared.createdAt)} · {shared.nodeCount} recent nodes visible
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            {shared.latestResponse ? (
              <div className="rounded-md border border-[var(--border)] bg-[var(--background)] p-3">
                <div className="mb-2 flex items-center gap-1.5 text-[11px] font-medium text-[var(--muted-foreground)]">
                  <Sparkles className="h-3.5 w-3.5 text-amber-400" />
                  Latest response
                </div>
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-[var(--foreground)]">
                  {shared.latestResponse}
                </p>
              </div>
            ) : (
              <p className="text-sm text-[var(--muted-foreground)]">
                No final response available yet for this session.
              </p>
            )}

            {shared.highlights.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-1.5 text-[11px] font-medium text-[var(--muted-foreground)]">
                  <Brain className="h-3.5 w-3.5 text-violet-400" />
                  Reasoning highlights
                </div>
                {shared.highlights.map((highlight) => (
                  <div
                    key={highlight.id}
                    className="rounded-md border border-[var(--border)] bg-[var(--background)] p-3"
                  >
                    <p className="text-sm leading-relaxed text-[var(--foreground)]">
                      {highlight.text}
                    </p>
                    <p className="mt-2 text-[11px] text-[var(--muted-foreground)]">
                      {formatDate(highlight.createdAt)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="flex items-center justify-between rounded-md border border-[var(--border)] bg-[var(--card)] px-4 py-3">
          <p className="text-sm text-[var(--muted-foreground)]">
            Want your own reasoning graph?
          </p>
          <Link
            href="/workspace"
            className="inline-flex items-center rounded-md bg-[var(--accent)] px-3 py-1.5 text-sm font-medium text-[var(--accent-foreground)] hover:opacity-90"
          >
            Open Workspace
          </Link>
        </div>
      </div>
    </main>
  );
}
