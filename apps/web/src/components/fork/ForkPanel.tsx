"use client";

import { useState, useCallback } from "react";
import { BranchCard } from "./BranchCard";
import { Convergence } from "./Convergence";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Button,
  Input,
  Skeleton,
} from "@/components/ui";
import { runForkAnalysis, type ForkResponse } from "@/lib/api";
import { GitFork, Loader2, Send } from "lucide-react";

interface ForkPanelProps {
  sessionId: string | null;
}

export function ForkPanel({ sessionId }: ForkPanelProps) {
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<ForkResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!query.trim() || isLoading) return;

      setIsLoading(true);
      setError(null);

      const response = await runForkAnalysis({
        query: query.trim(),
        sessionId: sessionId ?? undefined,
      });

      if (response.error) {
        setError(response.error.message);
      } else if (response.data) {
        setResult(response.data);
      }

      setIsLoading(false);
    },
    [query, sessionId, isLoading]
  );

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="py-3 px-4 border-b border-[var(--border)]">
        <CardTitle className="text-base font-medium flex items-center gap-2">
          <GitFork className="w-4 h-4 text-violet-500" />
          ThinkFork Analysis
        </CardTitle>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col p-0 overflow-hidden">
        {/* Input */}
        <form onSubmit={handleSubmit} className="p-4 border-b border-[var(--border)]">
          <div className="flex gap-2">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Enter a problem for multi-perspective analysis..."
              disabled={isLoading}
              className="flex-1 text-sm"
            />
            <Button
              type="submit"
              disabled={!query.trim() || isLoading}
              size="icon"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </Button>
          </div>
        </form>

        {/* Results */}
        <div className="flex-1 overflow-y-auto p-4">
          {isLoading ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <Skeleton className="h-32 rounded-lg" />
                <Skeleton className="h-32 rounded-lg" />
                <Skeleton className="h-32 rounded-lg" />
                <Skeleton className="h-32 rounded-lg" />
              </div>
              <Skeleton className="h-24 rounded-lg" />
            </div>
          ) : error ? (
            <div className="text-center py-8">
              <p className="text-sm text-red-400">{error}</p>
            </div>
          ) : result ? (
            <div className="space-y-4">
              {/* Branch cards */}
              <div className="grid grid-cols-2 gap-3">
                {result.branches.map((branch) => (
                  <BranchCard
                    key={branch.style}
                    branch={branch}
                    isRecommended={
                      result.recommendedApproach?.style === branch.style
                    }
                  />
                ))}
              </div>

              {/* Meta insight */}
              {result.metaInsight && (
                <Card className="bg-violet-500/10 border-violet-500/30">
                  <CardContent className="p-3">
                    <div className="text-xs text-violet-400 mb-1">
                      Meta Insight
                    </div>
                    <p className="text-sm text-[var(--foreground)]">
                      {result.metaInsight}
                    </p>
                  </CardContent>
                </Card>
              )}

              {/* Recommended approach */}
              {result.recommendedApproach && (
                <Card className="bg-green-500/10 border-green-500/30">
                  <CardContent className="p-3">
                    <div className="text-xs text-green-400 mb-1">
                      Recommended Approach
                    </div>
                    <p className="text-sm text-[var(--foreground)]">
                      <span className="font-medium">
                        {result.recommendedApproach.style}
                      </span>
                      : {result.recommendedApproach.rationale}
                    </p>
                    <p className="text-xs text-[var(--muted-foreground)] mt-1">
                      Confidence: {Math.round(result.recommendedApproach.confidence * 100)}%
                    </p>
                  </CardContent>
                </Card>
              )}

              {/* Convergence/Divergence */}
              <Convergence
                convergence={result.convergencePoints}
                divergence={result.divergencePoints}
              />
            </div>
          ) : (
            <div className="h-full flex items-center justify-center">
              <div className="text-center">
                <GitFork className="w-12 h-12 text-[var(--muted-foreground)] mx-auto mb-3" />
                <h3 className="text-sm font-medium text-[var(--foreground)] mb-1">
                  Multi-Perspective Analysis
                </h3>
                <p className="text-xs text-[var(--muted-foreground)] max-w-xs">
                  Enter a complex problem to analyze it from 4 different reasoning
                  styles: Conservative, Aggressive, Balanced, and Contrarian.
                </p>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
