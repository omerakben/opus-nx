"use client";

import { useState, useCallback } from "react";
import { InsightCard } from "./InsightCard";
import { Card, CardHeader, CardTitle, CardContent, Skeleton, Tabs, TabsList, TabsTrigger, TabsContent, Button } from "@/components/ui";
import type { Insight } from "@/lib/api";
import { runInsightsAnalysis } from "@/lib/api";
import { AlertTriangle, Lightbulb, Search, Brain, Loader2 } from "lucide-react";

interface InsightsPanelProps {
  insights: Insight[];
  isLoading: boolean;
  onEvidenceClick?: (nodeId: string) => void;
  sessionId?: string | null;
  onInsightsGenerated?: (insights: Insight[]) => void;
}

export function InsightsPanel({
  insights,
  isLoading,
  onEvidenceClick,
  sessionId,
  onInsightsGenerated,
}: InsightsPanelProps) {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);

  const biasInsights = insights.filter((i) => i.insightType === "bias_detection");
  const patternInsights = insights.filter((i) => i.insightType === "pattern");
  const hypothesisInsights = insights.filter(
    (i) => i.insightType === "improvement_hypothesis"
  );

  const handleRunAnalysis = useCallback(async () => {
    if (!sessionId || isAnalyzing) return;

    setIsAnalyzing(true);
    setAnalyzeError(null);

    try {
      const response = await runInsightsAnalysis(sessionId);

      if (response.error) {
        setAnalyzeError(response.error.message);
      } else if (response.data) {
        // API returns { insights, nodesAnalyzed, summary, errors }
        const insights = Array.isArray(response.data)
          ? response.data
          : (response.data as unknown as { insights: Insight[] }).insights ?? [];
        onInsightsGenerated?.(insights);
      }
    } catch (err) {
      setAnalyzeError(err instanceof Error ? err.message : "Analysis failed");
    } finally {
      setIsAnalyzing(false);
    }
  }, [sessionId, isAnalyzing, onInsightsGenerated]);

  if (isLoading) {
    return (
      <Card className="h-full">
        <CardHeader className="py-3 px-4 border-b border-[var(--border)]">
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <Lightbulb className="w-4 h-4" />
            Metacognitive Insights
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 space-y-3">
          <Skeleton className="h-24 w-full rounded-lg" />
          <Skeleton className="h-24 w-full rounded-lg" />
          <Skeleton className="h-24 w-full rounded-lg" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="py-3 px-4 border-b border-[var(--border)]">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <Lightbulb className="w-4 h-4 text-amber-500" />
            Metacognitive Insights
            {insights.length > 0 && (
              <span className="text-xs text-[var(--muted-foreground)] font-normal">
                ({insights.length})
              </span>
            )}
          </CardTitle>
          {sessionId && insights.length > 0 && (
            <div className="flex items-center gap-1.5">
              <Button
                onClick={handleRunAnalysis}
                variant="ghost"
                size="sm"
                className="h-6 text-xs text-amber-400 hover:text-amber-300 px-2"
                disabled={isAnalyzing}
              >
                {isAnalyzing ? (
                  <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                ) : (
                  <Brain className="w-3 h-3 mr-1" />
                )}
                Re-analyze
              </Button>
              {analyzeError && (
                <p className="text-[10px] text-red-400 max-w-[100px] truncate">{analyzeError}</p>
              )}
            </div>
          )}
        </div>
      </CardHeader>

      {/* Screen reader announcement */}
      <div role="status" aria-live="polite" className="sr-only">
        {insights.length} insight{insights.length !== 1 ? "s" : ""} found.
      </div>

      <CardContent className="flex-1 p-0 overflow-hidden">
        {/* Analyzing state */}
        {isAnalyzing ? (
          <div className="h-full flex items-center justify-center p-4">
            <div className="text-center">
              <div className="relative w-16 h-16 mx-auto mb-3">
                <div className="absolute inset-0 rounded-full border-2 border-amber-500/20 animate-ping" />
                <div className="absolute inset-2 rounded-full border-2 border-amber-500/40 animate-pulse" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <Brain className="w-7 h-7 text-amber-400 animate-pulse" />
                </div>
              </div>
              <p className="text-sm text-amber-400 animate-pulse font-medium">
                Analyzing reasoning patterns...
              </p>
              <p className="text-xs text-[var(--muted-foreground)] mt-1">
                Opus Nx is examining its own thinking for biases and patterns
              </p>
            </div>
          </div>
        ) : insights.length === 0 ? (
          <div className="h-full flex items-center justify-center p-4">
            <div className="text-center">
              <div className="relative w-14 h-14 mx-auto mb-3">
                <div className="absolute inset-0 rounded-full bg-gradient-to-br from-amber-500/10 to-violet-500/10" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <Brain className="w-7 h-7 text-[var(--muted-foreground)]" />
                </div>
              </div>
              <p className="text-sm text-[var(--muted-foreground)] font-medium">
                No insights yet
              </p>
              <p className="text-xs text-[var(--muted-foreground)] mt-1 mb-4 max-w-[200px]">
                Run self-reflection to detect biases, patterns, and improvement ideas
              </p>
              {sessionId && (
                <Button
                  onClick={handleRunAnalysis}
                  size="sm"
                  className="bg-amber-500 hover:bg-amber-600 text-white"
                >
                  <Brain className="w-4 h-4 mr-1.5" />
                  Run Self-Reflection
                </Button>
              )}
              {analyzeError && (
                <p className="text-xs text-red-400 mt-2 max-w-[200px]">{analyzeError}</p>
              )}
            </div>
          </div>
        ) : (
          <Tabs defaultValue="all" className="h-full flex flex-col min-h-0">
            <div className="mx-4 mt-3">
              <TabsList className="w-full justify-start">
                <TabsTrigger value="all" className="text-[10px] px-2">
                  All ({insights.length})
                </TabsTrigger>
                <TabsTrigger value="bias" className="text-[10px] px-1.5">
                  <AlertTriangle className="w-3 h-3 mr-0.5" />
                  Bias ({biasInsights.length})
                </TabsTrigger>
                <TabsTrigger value="pattern" className="text-[10px] px-1.5">
                  <Search className="w-3 h-3 mr-0.5" />
                  Pattern ({patternInsights.length})
                </TabsTrigger>
                <TabsTrigger value="hypothesis" className="text-[10px] px-1.5">
                  <Lightbulb className="w-3 h-3 mr-0.5" />
                  Ideas ({hypothesisInsights.length})
                </TabsTrigger>
              </TabsList>
            </div>

            <div className="flex-1 min-h-0 visible-scrollbar p-4">
              <TabsContent value="all" className="mt-0 space-y-3">
                {insights.map((insight) => (
                  <InsightCard
                    key={insight.id}
                    insight={insight}
                    onEvidenceClick={onEvidenceClick}
                  />
                ))}
              </TabsContent>

              <TabsContent value="bias" className="mt-0 space-y-3">
                {biasInsights.length === 0 ? (
                  <EmptyTabState type="bias" />
                ) : (
                  biasInsights.map((insight) => (
                    <InsightCard
                      key={insight.id}
                      insight={insight}
                      onEvidenceClick={onEvidenceClick}
                    />
                  ))
                )}
              </TabsContent>

              <TabsContent value="pattern" className="mt-0 space-y-3">
                {patternInsights.length === 0 ? (
                  <EmptyTabState type="pattern" />
                ) : (
                  patternInsights.map((insight) => (
                    <InsightCard
                      key={insight.id}
                      insight={insight}
                      onEvidenceClick={onEvidenceClick}
                    />
                  ))
                )}
              </TabsContent>

              <TabsContent value="hypothesis" className="mt-0 space-y-3">
                {hypothesisInsights.length === 0 ? (
                  <EmptyTabState type="hypothesis" />
                ) : (
                  hypothesisInsights.map((insight) => (
                    <InsightCard
                      key={insight.id}
                      insight={insight}
                      onEvidenceClick={onEvidenceClick}
                    />
                  ))
                )}
              </TabsContent>
            </div>
          </Tabs>
        )}
      </CardContent>
    </Card>
  );
}

function EmptyTabState({ type }: { type: string }) {
  const messages: Record<string, string> = {
    bias: "No bias detections found",
    pattern: "No patterns identified",
    hypothesis: "No improvement ideas yet",
  };

  return (
    <div className="text-center py-8">
      <p className="text-sm text-[var(--muted-foreground)]">
        {messages[type] || "No insights"}
      </p>
    </div>
  );
}
