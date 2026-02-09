"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn, formatNumber } from "@/lib/utils";
import { Card, CardContent, Badge, Skeleton } from "@/components/ui";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui";
import {
  useReasoningDetail,
  type ReasoningStepType,
  type ReasoningStep,
  type PersistedDecisionPoint,
  type ReasoningEdge,
} from "@/lib/hooks/use-reasoning-detail";
import {
  Brain,
  CheckCircle,
  ChevronDown,
  ChevronRight,
  Code,
  FileText,
  FlaskConical,
  Gauge,
  GitBranch,
  Lightbulb,
  Link2,
  ListChecks,
  MessageSquare,
  Scale,
  Search,
  Shield,
  Target,
} from "lucide-react";
import {
  EDGE_COLORS,
  EDGE_LABELS,
  EDGE_ICONS,
  type EdgeType,
  getConfidenceColor,
} from "@/lib/colors";

// ============================================================
// Step Type Configuration
// ============================================================

interface StepTypeConfig {
  icon: typeof Brain;
  label: string;
  color: string;
  bgColor: string;
}

const STEP_TYPE_CONFIG: Record<ReasoningStepType, StepTypeConfig> = {
  analysis: {
    icon: Search,
    label: "Analysis",
    color: "text-blue-400",
    bgColor: "bg-blue-400/10",
  },
  hypothesis: {
    icon: FlaskConical,
    label: "Hypothesis",
    color: "text-amber-400",
    bgColor: "bg-amber-400/10",
  },
  evaluation: {
    icon: Scale,
    label: "Evaluation",
    color: "text-violet-400",
    bgColor: "bg-violet-400/10",
  },
  conclusion: {
    icon: CheckCircle,
    label: "Conclusion",
    color: "text-green-400",
    bgColor: "bg-green-400/10",
  },
  consideration: {
    icon: Lightbulb,
    label: "Consideration",
    color: "text-cyan-400",
    bgColor: "bg-cyan-400/10",
  },
};

const DEFAULT_STEP_CONFIG: StepTypeConfig = {
  icon: Brain,
  label: "Step",
  color: "text-[var(--muted-foreground)]",
  bgColor: "bg-[var(--muted)]",
};

// ============================================================
// Sub-components
// ============================================================

/** Single reasoning step with expand/collapse */
function StepItem({
  step,
  isLast,
}: {
  step: ReasoningStep;
  isLast: boolean;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const config = step.type
    ? STEP_TYPE_CONFIG[step.type]
    : DEFAULT_STEP_CONFIG;
  const StepIcon = config.icon;

  const isLongContent = step.content.length > 280;
  const displayContent =
    isLongContent && !isExpanded
      ? step.content.slice(0, 280) + "..."
      : step.content;

  return (
    <div className="relative flex gap-3">
      {/* Vertical connector line */}
      {!isLast && (
        <div className="absolute left-[13px] top-7 bottom-0 w-px bg-[var(--border)]" />
      )}

      {/* Step number badge */}
      <div
        className={cn(
          "relative z-10 flex-shrink-0 w-[26px] h-[26px] rounded-full flex items-center justify-center text-[10px] font-bold border",
          config.bgColor,
          config.color,
          "border-current/20"
        )}
      >
        {step.stepNumber}
      </div>

      {/* Step content */}
      <div className="flex-1 pb-4 min-w-0">
        {/* Type label */}
        <div className="flex items-center gap-1.5 mb-1">
          <StepIcon className={cn("w-3 h-3", config.color)} />
          <span className={cn("text-[10px] font-semibold uppercase tracking-wider", config.color)}>
            {config.label}
          </span>
        </div>

        {/* Content */}
        <p className="text-xs text-[var(--foreground)] leading-relaxed whitespace-pre-wrap">
          {displayContent}
        </p>

        {/* Expand toggle */}
        {isLongContent && (
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="mt-1 flex items-center gap-0.5 text-[10px] text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
          >
            {isExpanded ? (
              <>
                <ChevronDown className="w-3 h-3" />
                Show less
              </>
            ) : (
              <>
                <ChevronRight className="w-3 h-3" />
                Show more
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
}

/** Single decision point display */
function DecisionPointItem({
  point,
}: {
  point: PersistedDecisionPoint;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const hasAlternatives = point.alternatives.length > 0;

  return (
    <Card className="overflow-hidden border-[var(--border)]">
      <CardContent className="p-3">
        {/* Description */}
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex items-start gap-2 min-w-0">
            <GitBranch className="w-3.5 h-3.5 text-amber-400 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-[var(--foreground)] leading-relaxed">
              {point.description}
            </p>
          </div>
          {point.confidence != null && (
            <Badge
              variant="outline"
              className="text-[9px] px-1.5 py-0 flex-shrink-0"
              style={{
                borderColor: getConfidenceColor(point.confidence),
                color: getConfidenceColor(point.confidence),
              }}
            >
              {Math.round(point.confidence * 100)}%
            </Badge>
          )}
        </div>

        {/* Chosen path */}
        <div className="rounded-md bg-green-500/10 border border-green-500/20 px-2.5 py-1.5 mb-2">
          <div className="flex items-center gap-1 mb-0.5">
            <CheckCircle className="w-3 h-3 text-green-400" />
            <span className="text-[10px] font-semibold text-green-400 uppercase tracking-wider">
              Chosen Path
            </span>
          </div>
          <p className="text-[11px] text-[var(--foreground)] leading-relaxed">
            {point.chosenPath}
          </p>
        </div>

        {/* Alternatives (collapsible) */}
        {hasAlternatives && (
          <div>
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="flex items-center gap-1 text-[10px] text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors mb-1.5"
            >
              <ChevronDown
                className={cn(
                  "w-3 h-3 transition-transform duration-200",
                  !isExpanded && "-rotate-90"
                )}
              />
              {point.alternatives.length} alternative{point.alternatives.length !== 1 ? "s" : ""} considered
            </button>

            {isExpanded && (
              <div className="space-y-1.5 pl-3 border-l border-[var(--border)]">
                {point.alternatives.map((alt, i) => (
                  <div key={i} className="rounded bg-[var(--muted)] px-2 py-1.5">
                    <p className="text-[11px] text-[var(--foreground)]">
                      {alt.path}
                    </p>
                    <p className="text-[10px] text-[var(--muted-foreground)] mt-0.5 italic">
                      Rejected: {alt.reasonRejected}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Reasoning excerpt */}
        {point.reasoningExcerpt && (
          <div className="mt-2 pl-3 border-l-2 border-[var(--border)] py-1">
            <p className="text-[10px] text-[var(--muted-foreground)] italic leading-relaxed">
              {point.reasoningExcerpt}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/** Compact edge display */
function EdgeItem({ edge, direction }: { edge: ReasoningEdge; direction: "in" | "out" }) {
  const edgeType = edge.edgeType as EdgeType;
  const color = EDGE_COLORS[edgeType] ?? "#6b7280";
  const label = EDGE_LABELS[edgeType] ?? edge.edgeType;
  const icon = EDGE_ICONS[edgeType] ?? "~";

  return (
    <div className="flex items-center gap-2 py-1">
      <Badge
        variant="outline"
        className="text-[9px] px-1.5 py-0 font-mono"
        style={{ borderColor: color, color }}
      >
        {icon} {label}
      </Badge>
      <span className="text-[10px] text-[var(--muted-foreground)] truncate font-mono">
        {direction === "in" ? edge.sourceId.slice(0, 8) : edge.targetId.slice(0, 8)}
      </span>
      <span className="text-[9px] text-[var(--muted-foreground)] ml-auto">
        w:{edge.weight.toFixed(2)}
      </span>
    </div>
  );
}

/** Model output with Raw / Markdown toggle */
export function ModelOutput({ content }: { content: string }) {
  const [mode, setMode] = useState<"md" | "raw">("md");

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <MessageSquare className="w-3.5 h-3.5 text-violet-400" />
          <span className="text-[10px] font-semibold text-violet-400 uppercase tracking-wider">
            Model Output
          </span>
        </div>
        <div className="flex items-center rounded-md border border-[var(--border)] bg-[var(--muted)]/40 p-0.5">
          <button
            onClick={() => setMode("md")}
            className={cn(
              "flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium transition-colors",
              mode === "md"
                ? "bg-[var(--card)] text-violet-400 shadow-sm border border-[var(--border)]"
                : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
            )}
            title="Rendered Markdown"
          >
            <FileText className="w-3 h-3" />
            MD
          </button>
          <button
            onClick={() => setMode("raw")}
            className={cn(
              "flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium transition-colors",
              mode === "raw"
                ? "bg-[var(--card)] text-violet-400 shadow-sm border border-[var(--border)]"
                : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
            )}
            title="Raw Text"
          >
            <Code className="w-3 h-3" />
            Raw
          </button>
        </div>
      </div>

      {mode === "raw" ? (
        <div className="text-xs text-[var(--foreground)] whitespace-pre-wrap leading-relaxed pl-3 border-l-2 border-violet-500/30 font-mono">
          {content}
        </div>
      ) : (
        <div className="pl-3 border-l-2 border-violet-500/30 max-w-none [&_h1]:text-base [&_h1]:font-bold [&_h1]:text-[var(--foreground)] [&_h1]:mt-4 [&_h1]:mb-2 [&_h2]:text-sm [&_h2]:font-bold [&_h2]:text-[var(--foreground)] [&_h2]:mt-3 [&_h2]:mb-1.5 [&_h3]:text-xs [&_h3]:font-semibold [&_h3]:text-[var(--foreground)] [&_h3]:mt-2.5 [&_h3]:mb-1 [&_p]:text-xs [&_p]:leading-relaxed [&_p]:text-[var(--foreground)] [&_p]:my-1.5 [&_ul]:text-xs [&_ul]:text-[var(--foreground)] [&_ul]:my-1.5 [&_ul]:pl-4 [&_ul]:list-disc [&_ol]:text-xs [&_ol]:text-[var(--foreground)] [&_ol]:my-1.5 [&_ol]:pl-4 [&_ol]:list-decimal [&_li]:my-0.5 [&_li]:text-[var(--foreground)] [&_strong]:text-[var(--foreground)] [&_strong]:font-bold [&_em]:text-[var(--muted-foreground)] [&_em]:italic [&_code]:text-[11px] [&_code]:text-violet-300 [&_code]:bg-violet-500/10 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded [&_pre]:bg-[var(--card)] [&_pre]:border [&_pre]:border-[var(--border)] [&_pre]:rounded-md [&_pre]:p-3 [&_pre]:my-2 [&_pre]:overflow-x-auto [&_pre_code]:text-[var(--foreground)] [&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_hr]:my-3 [&_hr]:border-[var(--border)] [&_blockquote]:border-l-2 [&_blockquote]:border-violet-500/30 [&_blockquote]:pl-3 [&_blockquote]:my-2 [&_blockquote]:italic [&_blockquote_p]:text-[var(--muted-foreground)] [&_a]:text-violet-400 [&_a]:underline [&_table]:w-full [&_table]:text-xs [&_table]:my-2 [&_table]:border-collapse [&_thead]:border-b [&_thead]:border-[var(--border)] [&_th]:text-left [&_th]:text-[10px] [&_th]:font-semibold [&_th]:text-[var(--muted-foreground)] [&_th]:uppercase [&_th]:tracking-wider [&_th]:px-3 [&_th]:py-1.5 [&_th]:bg-[var(--card)] [&_td]:text-xs [&_td]:text-[var(--foreground)] [&_td]:px-3 [&_td]:py-1.5 [&_td]:border-b [&_td]:border-[var(--border)] [&_tr:hover]:bg-[var(--muted)]/30">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
        </div>
      )}
    </div>
  );
}

/** Loading skeleton */
function ReasoningDetailSkeleton() {
  return (
    <div className="space-y-4 p-4">
      {/* Header skeleton */}
      <div className="flex items-center gap-2">
        <Skeleton className="w-5 h-5 rounded-full" />
        <Skeleton className="h-4 w-40" />
      </div>

      {/* Tabs skeleton */}
      <Skeleton className="h-8 w-64" />

      {/* Steps skeleton */}
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex gap-3">
            <Skeleton className="w-[26px] h-[26px] rounded-full flex-shrink-0" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-3/4" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Empty / fallback state when no structured data */
function ReasoningFallback({
  reasoning,
  response,
}: {
  reasoning?: string;
  response?: string | null;
}) {
  if (!reasoning) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-[var(--muted-foreground)]">
        <Brain className="w-8 h-8 opacity-20 mb-2" />
        <p className="text-xs">No reasoning data available for this node</p>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center gap-1.5 text-xs text-[var(--muted-foreground)]">
        <Brain className="w-3.5 h-3.5" />
        <span className="font-medium">Raw Reasoning</span>
      </div>
      <div className="text-xs text-[var(--foreground)] whitespace-pre-wrap leading-relaxed font-mono border-l-2 border-amber-500/30 pl-3">
        {reasoning}
      </div>

      {response && (
        <div className="border-t border-[var(--border)] pt-4">
          <ModelOutput content={response} />
        </div>
      )}
    </div>
  );
}

// ============================================================
// Main Component
// ============================================================

interface ReasoningDetailProps {
  nodeId: string;
  /** Fallback raw reasoning text when structured data isn't available */
  fallbackReasoning?: string;
  /** Fallback response text */
  fallbackResponse?: string | null;
}

export function ReasoningDetail({
  nodeId,
  fallbackReasoning,
  fallbackResponse,
}: ReasoningDetailProps) {
  const { data, isLoading, error } = useReasoningDetail(nodeId);
  const [activeTab, setActiveTab] = useState("steps");

  // ---- Loading ----
  if (isLoading) {
    return <ReasoningDetailSkeleton />;
  }

  // ---- Error ----
  if (error) {
    return (
      <div className="p-4 text-xs text-red-400">
        <p className="font-medium mb-1">Failed to load reasoning detail</p>
        <p className="text-[var(--muted-foreground)]">{error}</p>
        {fallbackReasoning && (
          <div className="mt-4">
            <ReasoningFallback reasoning={fallbackReasoning} response={fallbackResponse} />
          </div>
        )}
      </div>
    );
  }

  // ---- No structured data ----
  const structured = data?.node?.structuredReasoning;
  const hasSteps = structured?.steps && structured.steps.length > 0;
  const hasDecisionPoints =
    (data?.decisionPoints && data.decisionPoints.length > 0) ||
    (structured?.decisionPoints && structured.decisionPoints.length > 0);
  const hasEdges =
    data?.related &&
    (data.related.incomingEdges.length > 0 ||
      data.related.outgoingEdges.length > 0);

  if (!data || (!hasSteps && !hasDecisionPoints)) {
    return (
      <ReasoningFallback
        reasoning={data?.node?.reasoning ?? fallbackReasoning}
        response={data?.node?.response ?? fallbackResponse}
      />
    );
  }

  const node = data.node;

  // Merge decision points: prefer persisted (from DB) over inline structured
  const decisionPoints =
    data.decisionPoints.length > 0
      ? data.decisionPoints
      : (structured?.decisionPoints ?? []).map((dp, i) => ({
          id: `inline-${i}`,
          thinkingNodeId: node.id,
          stepNumber: dp.stepNumber,
          description: dp.description,
          chosenPath: dp.chosenPath,
          alternatives: dp.alternatives,
          confidence: dp.confidence,
          reasoningExcerpt: dp.reasoningExcerpt,
          createdAt: node.createdAt,
        }));

  // Count tab items for badges
  const stepCount = structured?.steps?.length ?? 0;
  const dpCount = decisionPoints.length;
  const edgeCount =
    (data.related?.incomingEdges?.length ?? 0) +
    (data.related?.outgoingEdges?.length ?? 0);

  return (
    <div className="flex flex-col h-full">
      {/* ---- Header ---- */}
      <div className="px-4 pt-3 pb-2 border-b border-[var(--border)] bg-[var(--card)]">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <Target className="w-4 h-4 text-violet-400 flex-shrink-0" />
            <span className="text-sm font-medium text-[var(--foreground)] truncate">
              {node.inputQuery
                ? node.inputQuery.length > 60
                  ? node.inputQuery.slice(0, 60) + "..."
                  : node.inputQuery
                : `Node ${node.id.slice(0, 8)}`}
            </span>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {node.confidenceScore != null && (
              <span
                className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
                style={{
                  backgroundColor: `${getConfidenceColor(node.confidenceScore)}20`,
                  color: getConfidenceColor(node.confidenceScore),
                }}
              >
                {Math.round(node.confidenceScore * 100)}%
              </span>
            )}
            {node.tokenUsage.thinkingTokens != null && node.tokenUsage.thinkingTokens > 0 && (
              <span className="text-[10px] text-[var(--muted-foreground)] flex items-center gap-0.5">
                <Gauge className="w-3 h-3" />
                {formatNumber(node.tokenUsage.thinkingTokens)}
              </span>
            )}
          </div>
        </div>

        {/* Alternatives considered summary */}
        {structured?.alternativesConsidered != null && structured.alternativesConsidered > 0 && (
          <div className="mt-1.5 flex items-center gap-1 text-[10px] text-[var(--muted-foreground)]">
            <GitBranch className="w-3 h-3" />
            {structured.alternativesConsidered} alternative{structured.alternativesConsidered !== 1 ? "s" : ""} considered
          </div>
        )}
      </div>

      {/* ---- Tabs ---- */}
      <Tabs
        defaultValue="steps"
        value={activeTab}
        onValueChange={setActiveTab}
        className="flex flex-col flex-1 overflow-hidden"
      >
        <div className="px-4 pt-2 bg-[var(--card)] border-b border-[var(--border)]">
          <TabsList className="h-8 w-full justify-start gap-0.5 bg-transparent p-0">
            <TabsTrigger
              value="steps"
              className="h-7 px-2.5 text-[11px] rounded-md data-[state=inactive]:bg-transparent"
            >
              <ListChecks className="w-3 h-3 mr-1" />
              Steps
              {stepCount > 0 && (
                <span className="ml-1 text-[9px] text-[var(--muted-foreground)]">
                  {stepCount}
                </span>
              )}
            </TabsTrigger>
            {dpCount > 0 && (
              <TabsTrigger
                value="decisions"
                className="h-7 px-2.5 text-[11px] rounded-md data-[state=inactive]:bg-transparent"
              >
                <GitBranch className="w-3 h-3 mr-1" />
                Decisions
                <span className="ml-1 text-[9px] text-[var(--muted-foreground)]">
                  {dpCount}
                </span>
              </TabsTrigger>
            )}
            {hasEdges && (
              <TabsTrigger
                value="edges"
                className="h-7 px-2.5 text-[11px] rounded-md data-[state=inactive]:bg-transparent"
              >
                <Link2 className="w-3 h-3 mr-1" />
                Edges
                <span className="ml-1 text-[9px] text-[var(--muted-foreground)]">
                  {edgeCount}
                </span>
              </TabsTrigger>
            )}
          </TabsList>
        </div>

        {/* ---- Tab Content ---- */}
        <div className="flex-1 overflow-y-auto">
          {/* Steps Tab */}
          <TabsContent value="steps" className="mt-0 h-full">
            <div className="p-4 space-y-0">
              {hasSteps ? (
                structured!.steps.map((step, i) => (
                  <StepItem
                    key={step.stepNumber}
                    step={step}
                    isLast={i === structured!.steps.length - 1}
                  />
                ))
              ) : (
                <ReasoningFallback
                  reasoning={node.reasoning}
                  response={node.response}
                />
              )}
            </div>

            {/* Main Conclusion */}
            {structured?.mainConclusion && (
              <div className="mx-4 mb-4">
                <Card className="border-green-500/30 bg-green-500/5">
                  <CardContent className="p-3">
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <Shield className="w-3.5 h-3.5 text-green-400" />
                      <span className="text-[10px] font-semibold text-green-400 uppercase tracking-wider">
                        Main Conclusion
                      </span>
                    </div>
                    <p className="text-xs text-[var(--foreground)] leading-relaxed">
                      {structured.mainConclusion}
                    </p>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Confidence Factors */}
            {structured?.confidenceFactors &&
              structured.confidenceFactors.length > 0 && (
                <div className="mx-4 mb-4">
                  <div className="flex items-center gap-1.5 mb-2">
                    <Gauge className="w-3 h-3 text-[var(--muted-foreground)]" />
                    <span className="text-[10px] font-semibold text-[var(--muted-foreground)] uppercase tracking-wider">
                      Confidence Factors
                    </span>
                  </div>
                  <ul className="space-y-1">
                    {structured.confidenceFactors.map((factor, i) => (
                      <li
                        key={i}
                        className="text-[11px] text-[var(--foreground)] flex items-start gap-1.5"
                      >
                        <span className="text-[var(--muted-foreground)] mt-0.5 flex-shrink-0">
                          --
                        </span>
                        {factor}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

            {/* Model Response */}
            {node.response && (
              <div className="mx-4 mb-4 pt-3 border-t border-[var(--border)]">
                <ModelOutput content={node.response} />
              </div>
            )}
          </TabsContent>

          {/* Decisions Tab */}
          <TabsContent value="decisions" className="mt-0 h-full">
            <div className="p-4 space-y-3">
              {decisionPoints.length > 0 ? (
                decisionPoints.map((dp) => (
                  <DecisionPointItem key={dp.id} point={dp} />
                ))
              ) : (
                <div className="flex flex-col items-center justify-center py-8 text-[var(--muted-foreground)]">
                  <GitBranch className="w-6 h-6 opacity-20 mb-2" />
                  <p className="text-xs">No decision points recorded</p>
                </div>
              )}
            </div>
          </TabsContent>

          {/* Edges Tab */}
          <TabsContent value="edges" className="mt-0 h-full">
            <div className="p-4 space-y-4">
              {/* Incoming edges */}
              {data.related.incomingEdges.length > 0 && (
                <div>
                  <div className="flex items-center gap-1.5 mb-2">
                    <span className="text-[10px] font-semibold text-[var(--muted-foreground)] uppercase tracking-wider">
                      Incoming
                    </span>
                    <Badge
                      variant="secondary"
                      className="text-[9px] px-1 py-0 h-4"
                    >
                      {data.related.incomingEdges.length}
                    </Badge>
                  </div>
                  <div className="space-y-0.5">
                    {data.related.incomingEdges.map((edge) => (
                      <EdgeItem key={edge.id} edge={edge} direction="in" />
                    ))}
                  </div>
                </div>
              )}

              {/* Outgoing edges */}
              {data.related.outgoingEdges.length > 0 && (
                <div>
                  <div className="flex items-center gap-1.5 mb-2">
                    <span className="text-[10px] font-semibold text-[var(--muted-foreground)] uppercase tracking-wider">
                      Outgoing
                    </span>
                    <Badge
                      variant="secondary"
                      className="text-[9px] px-1 py-0 h-4"
                    >
                      {data.related.outgoingEdges.length}
                    </Badge>
                  </div>
                  <div className="space-y-0.5">
                    {data.related.outgoingEdges.map((edge) => (
                      <EdgeItem key={edge.id} edge={edge} direction="out" />
                    ))}
                  </div>
                </div>
              )}

              {/* Empty state */}
              {!hasEdges && (
                <div className="flex flex-col items-center justify-center py-8 text-[var(--muted-foreground)]">
                  <Link2 className="w-6 h-6 opacity-20 mb-2" />
                  <p className="text-xs">No related edges</p>
                </div>
              )}
            </div>
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
