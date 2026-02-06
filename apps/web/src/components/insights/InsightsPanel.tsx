"use client";

import { InsightCard } from "./InsightCard";
import { Card, CardHeader, CardTitle, CardContent, Skeleton, Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui";
import type { Insight } from "@/lib/api";
import { AlertTriangle, Lightbulb, Search } from "lucide-react";

interface InsightsPanelProps {
  insights: Insight[];
  isLoading: boolean;
  onEvidenceClick?: (nodeId: string) => void;
}

export function InsightsPanel({
  insights,
  isLoading,
  onEvidenceClick,
}: InsightsPanelProps) {
  const biasInsights = insights.filter((i) => i.insightType === "bias_detection");
  const patternInsights = insights.filter((i) => i.insightType === "pattern");
  const hypothesisInsights = insights.filter(
    (i) => i.insightType === "improvement_hypothesis"
  );

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
        <CardTitle className="text-base font-medium flex items-center gap-2">
          <Lightbulb className="w-4 h-4 text-amber-500" />
          Metacognitive Insights
          {insights.length > 0 && (
            <span className="text-xs text-[var(--muted-foreground)] font-normal">
              ({insights.length})
            </span>
          )}
        </CardTitle>
      </CardHeader>

      <CardContent className="flex-1 p-0 overflow-hidden">
        {insights.length === 0 ? (
          <div className="h-full flex items-center justify-center p-4">
            <div className="text-center">
              <Lightbulb className="w-8 h-8 text-[var(--muted-foreground)] mx-auto mb-2" />
              <p className="text-sm text-[var(--muted-foreground)]">
                No insights yet
              </p>
              <p className="text-xs text-[var(--muted-foreground)] mt-1">
                Insights are generated from reasoning analysis
              </p>
            </div>
          </div>
        ) : (
          <Tabs defaultValue="all" className="h-full flex flex-col">
            <TabsList className="mx-4 mt-3 justify-start">
              <TabsTrigger value="all" className="text-xs">
                All ({insights.length})
              </TabsTrigger>
              <TabsTrigger value="bias" className="text-xs">
                <AlertTriangle className="w-3 h-3 mr-1" />
                Bias ({biasInsights.length})
              </TabsTrigger>
              <TabsTrigger value="pattern" className="text-xs">
                <Search className="w-3 h-3 mr-1" />
                Pattern ({patternInsights.length})
              </TabsTrigger>
              <TabsTrigger value="hypothesis" className="text-xs">
                <Lightbulb className="w-3 h-3 mr-1" />
                Ideas ({hypothesisInsights.length})
              </TabsTrigger>
            </TabsList>

            <div className="flex-1 overflow-y-auto p-4">
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
