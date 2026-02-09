"use client";

import { useState, useCallback, useMemo } from "react";
import { InsightCard } from "./InsightCard";
import { Card, CardHeader, CardTitle, CardContent, Skeleton, Tabs, TabsList, TabsTrigger, TabsContent, Button } from "@/components/ui";
import type { Insight } from "@/lib/api";
import { runInsightsAnalysis } from "@/lib/api";
import { AlertTriangle, Lightbulb, Search, Brain, Loader2, CheckCircle, BarChart3, Settings2 } from "lucide-react";

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
  const [searchQuery, setSearchQuery] = useState("");
  const [minConfidence, setMinConfidence] = useState(0);
  const [showFocusAreas, setShowFocusAreas] = useState(false);
  const [selectedFocusAreas, setSelectedFocusAreas] = useState<string[]>([
    "reasoning_patterns", "bias_detection", "confidence_calibration", "alternative_exploration",
  ]);
  const [analysisMetadata, setAnalysisMetadata] = useState<{
    nodesAnalyzed: number;
    summary: string | null;
    hallucinationCount: number;
    errors: string[];
    insightCount: number;
  } | null>(null);

  // Apply search and confidence filters
  const filteredInsights = useMemo(() => {
    let result = insights;

    if (minConfidence > 0) {
      result = result.filter((i) => i.confidence >= minConfidence / 100);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (i) =>
          i.insight.toLowerCase().includes(q) ||
          i.insightType.toLowerCase().includes(q) ||
          i.evidence.some((e) => e.excerpt.toLowerCase().includes(q))
      );
    }

    return result;
  }, [insights, searchQuery, minConfidence]);

  const biasInsights = filteredInsights.filter((i) => i.insightType === "bias_detection");
  const patternInsights = filteredInsights.filter((i) => i.insightType === "pattern");
  const hypothesisInsights = filteredInsights.filter(
    (i) => i.insightType === "improvement_hypothesis"
  );

  const handleRunAnalysis = useCallback(async () => {
    if (!sessionId || isAnalyzing) return;

    setIsAnalyzing(true);
    setAnalyzeError(null);

    try {
      const response = await runInsightsAnalysis(sessionId, {
        focusAreas: selectedFocusAreas,
      });

      if (response.error) {
        setAnalyzeError(response.error.message);
      } else if (response.data) {
        const result = response.data;
        onInsightsGenerated?.(result.insights);
        setAnalysisMetadata({
          nodesAnalyzed: result.nodesAnalyzed,
          summary: result.summary,
          hallucinationCount: result.hallucinationCount,
          errors: result.errors,
          insightCount: result.insights.length,
        });
      }
    } catch (err) {
      setAnalyzeError(err instanceof Error ? err.message : "Analysis failed");
    } finally {
      setIsAnalyzing(false);
    }
  }, [sessionId, isAnalyzing, onInsightsGenerated, selectedFocusAreas]);

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
                onClick={() => setShowFocusAreas((v) => !v)}
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0 text-[var(--muted-foreground)] hover:text-amber-400"
                title="Analysis settings"
              >
                <Settings2 className="w-3 h-3" />
              </Button>
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
        {filteredInsights.length} insight{filteredInsights.length !== 1 ? "s" : ""} found.
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
          /* Enhanced empty state */
          <div className="h-full flex items-center justify-center p-4">
            <div className="text-center max-w-[260px]">
              <div className="relative w-14 h-14 mx-auto mb-3">
                <div className="absolute inset-0 rounded-full bg-gradient-to-br from-amber-500/10 to-violet-500/10" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <Brain className="w-7 h-7 text-[var(--muted-foreground)]" />
                </div>
              </div>
              <p className="text-sm text-[var(--muted-foreground)] font-medium">
                No insights yet
              </p>
              <p className="text-xs text-[var(--muted-foreground)] mt-1 mb-3">
                Self-reflection examines reasoning nodes to surface:
              </p>
              <div className="space-y-1.5 text-left mb-4">
                <div className="flex items-center gap-2 text-[11px] text-[var(--muted-foreground)]">
                  <AlertTriangle className="w-3 h-3 text-amber-400 shrink-0" />
                  <span><strong className="text-[var(--foreground)]">Biases</strong> -- confirmation bias, anchoring, recency effects</span>
                </div>
                <div className="flex items-center gap-2 text-[11px] text-[var(--muted-foreground)]">
                  <Search className="w-3 h-3 text-cyan-400 shrink-0" />
                  <span><strong className="text-[var(--foreground)]">Patterns</strong> -- recurring reasoning strategies and shortcuts</span>
                </div>
                <div className="flex items-center gap-2 text-[11px] text-[var(--muted-foreground)]">
                  <Lightbulb className="w-3 h-3 text-emerald-400 shrink-0" />
                  <span><strong className="text-[var(--foreground)]">Ideas</strong> -- hypotheses for improving reasoning quality</span>
                </div>
              </div>
              <p className="text-[10px] text-[var(--muted-foreground)] mb-3 italic">
                First analysis typically takes ~30 seconds
              </p>

              {/* Focus areas toggle for empty state */}
              {sessionId && (
                <>
                  <div className="flex items-center justify-center gap-1.5 mb-2">
                    <Button
                      onClick={handleRunAnalysis}
                      size="sm"
                      className="bg-amber-500 hover:bg-amber-600 text-white"
                    >
                      <Brain className="w-4 h-4 mr-1.5" />
                      Run Self-Reflection
                    </Button>
                    <Button
                      onClick={() => setShowFocusAreas((v) => !v)}
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 text-[var(--muted-foreground)] hover:text-amber-400"
                      title="Analysis settings"
                    >
                      <Settings2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                  <FocusAreasPanel
                    show={showFocusAreas}
                    selectedFocusAreas={selectedFocusAreas}
                    setSelectedFocusAreas={setSelectedFocusAreas}
                  />
                </>
              )}
              {analyzeError && (
                <p className="text-xs text-red-400 mt-2 max-w-[200px] mx-auto">{analyzeError}</p>
              )}
            </div>
          </div>
        ) : (
          <Tabs defaultValue="all" className="h-full flex flex-col min-h-0">
            {/* Statistics banner */}
            {insights.length > 0 && (
              <div className="mx-4 mt-3 flex items-center gap-3 text-[10px] text-[var(--muted-foreground)]">
                <span className="flex items-center gap-1">
                  <BarChart3 className="w-3 h-3" />
                  {insights.length} total
                </span>
                <span className="text-amber-400">
                  {insights.filter((i) => i.insightType === "bias_detection").length} biases
                </span>
                <span className="text-cyan-400">
                  {insights.filter((i) => i.insightType === "pattern").length} patterns
                </span>
                <span className="text-emerald-400">
                  {insights.filter((i) => i.insightType === "improvement_hypothesis").length} ideas
                </span>
                <span className="ml-auto">
                  avg {Math.round(insights.reduce((s, i) => s + i.confidence, 0) / insights.length * 100)}%
                </span>
              </div>
            )}

            {/* Search input */}
            <div className="mx-4 mt-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--muted-foreground)]" />
                <input
                  type="text"
                  placeholder="Search insights..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full h-8 pl-8 pr-3 text-xs bg-[var(--muted)] border border-[var(--border)] rounded-md focus:ring-1 focus:ring-amber-500/50 focus:border-amber-500/50 outline-none text-[var(--foreground)] placeholder:text-[var(--muted-foreground)]"
                />
              </div>
            </div>

            {/* Confidence filter */}
            <div className="mx-4 mt-2 flex items-center gap-2">
              <span className="text-[10px] text-[var(--muted-foreground)] whitespace-nowrap">Min confidence:</span>
              <input
                type="range"
                min={0}
                max={100}
                value={minConfidence}
                onChange={(e) => setMinConfidence(parseInt(e.target.value))}
                className="flex-1 h-1 accent-amber-500"
              />
              <span className="text-[10px] font-medium text-amber-400 w-8 text-right">{minConfidence}%</span>
            </div>

            {/* Focus areas panel */}
            <FocusAreasPanel
              show={showFocusAreas}
              selectedFocusAreas={selectedFocusAreas}
              setSelectedFocusAreas={setSelectedFocusAreas}
            />

            {/* Analysis metadata banner */}
            {analysisMetadata && (
              <div className="mx-4 mt-3 p-2.5 rounded-lg bg-amber-500/5 border border-amber-500/20">
                <div className="flex items-center gap-2 mb-1.5">
                  <CheckCircle className="w-3.5 h-3.5 text-amber-400" />
                  <span className="text-xs font-medium text-amber-400">Analysis Complete</span>
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px] text-[var(--muted-foreground)]">
                  <span>Nodes analyzed: <strong className="text-[var(--foreground)]">{analysisMetadata.nodesAnalyzed}</strong></span>
                  <span>Insights found: <strong className="text-[var(--foreground)]">{analysisMetadata.insightCount}</strong></span>
                  {analysisMetadata.hallucinationCount > 0 && (
                    <span className="text-amber-400 col-span-2">{analysisMetadata.hallucinationCount} hallucinated refs filtered</span>
                  )}
                </div>
                {analysisMetadata.summary && (
                  <p className="text-[11px] text-[var(--muted-foreground)] mt-1.5 italic border-t border-amber-500/10 pt-1.5">
                    {analysisMetadata.summary}
                  </p>
                )}
              </div>
            )}

            {/* Tabs */}
            <div className="mx-4 mt-3">
              <TabsList className="w-full justify-start">
                <TabsTrigger value="all" className="text-[10px] px-2">
                  All ({filteredInsights.length})
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
                {filteredInsights.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-sm text-[var(--muted-foreground)]">No matching insights</p>
                  </div>
                ) : (
                  filteredInsights.map((insight) => (
                    <InsightCard
                      key={insight.id}
                      insight={insight}
                      onEvidenceClick={onEvidenceClick}
                    />
                  ))
                )}
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

function FocusAreasPanel({
  show,
  selectedFocusAreas,
  setSelectedFocusAreas,
}: {
  show: boolean;
  selectedFocusAreas: string[];
  setSelectedFocusAreas: React.Dispatch<React.SetStateAction<string[]>>;
}) {
  if (!show) return null;

  const areas = [
    { id: "reasoning_patterns", label: "Reasoning Patterns" },
    { id: "bias_detection", label: "Bias Detection" },
    { id: "confidence_calibration", label: "Confidence Calibration" },
    { id: "alternative_exploration", label: "Alternative Exploration" },
    { id: "decision_quality", label: "Decision Quality" },
  ];

  return (
    <div className="mx-4 mt-2 p-2.5 rounded-lg bg-[var(--muted)] border border-[var(--border)]">
      <p className="text-[10px] text-[var(--muted-foreground)] mb-2">Analysis focus areas:</p>
      {areas.map((area) => (
        <label key={area.id} className="flex items-center gap-2 py-0.5 text-[11px] text-[var(--foreground)] cursor-pointer">
          <input
            type="checkbox"
            checked={selectedFocusAreas.includes(area.id)}
            onChange={(e) => {
              setSelectedFocusAreas((prev) =>
                e.target.checked ? [...prev, area.id] : prev.filter((a) => a !== area.id)
              );
            }}
            className="rounded accent-amber-500"
          />
          {area.label}
        </label>
      ))}
    </div>
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
