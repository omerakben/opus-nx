"use client";

import { useCallback, useState } from "react";
import {
  Button,
  Card,
  CardContent,
  Input,
  MarkdownContent,
} from "@/components/ui";
import { cn } from "@/lib/utils";
import {
  CheckCircle2,
  Compass,
  FileText,
  HelpCircle,
  Send,
  ChevronRight,
  UserCheck,
  MessageSquare,
  ThumbsUp,
  XCircle,
} from "lucide-react";
import type { SwarmGraphNode } from "@/lib/hooks/use-swarm";

const AGENT_COLORS: Record<string, string> = {
  deep_thinker: "#3b82f6",
  contrarian: "#ef4444",
  verifier: "#22c55e",
  synthesizer: "#f97316",
  metacognition: "#8b5cf6",
  maestro: "#06b6d4",
};

type SwarmCheckpointVerdict =
  | "verified"
  | "questionable"
  | "disagree"
  | "agree"
  | "explore"
  | "note";

interface CheckpointResponse {
  experiment_id?: string | null;
}

function formatAgentName(name: string): string {
  return name
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatVerdict(verdict: SwarmCheckpointVerdict): string {
  return verdict
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function verdictPillClasses(verdict: SwarmCheckpointVerdict): string {
  switch (verdict) {
    case "verified":
      return "bg-green-500/20 text-green-400";
    case "questionable":
      return "bg-yellow-500/20 text-yellow-400";
    case "disagree":
      return "bg-red-500/20 text-red-400";
    case "agree":
      return "bg-cyan-500/20 text-cyan-400";
    case "explore":
      return "bg-indigo-500/20 text-indigo-400";
    case "note":
      return "bg-slate-500/20 text-slate-300";
    default:
      return "bg-[var(--muted)] text-[var(--muted-foreground)]";
  }
}

interface SwarmControlsProps {
  graphNodes: SwarmGraphNode[];
  sessionId: string;
  onCheckpointSubmitted?: () => void | Promise<void>;
}

export function SwarmControls({
  graphNodes,
  sessionId,
  onCheckpointSubmitted,
}: SwarmControlsProps) {
  const [expandedNodeId, setExpandedNodeId] = useState<string | null>(null);
  const [correction, setCorrection] = useState("");
  const [alternativeSummary, setAlternativeSummary] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [verdict, setVerdict] = useState<SwarmCheckpointVerdict | null>(null);
  const [submittedNodes, setSubmittedNodes] = useState<
    Record<string, SwarmCheckpointVerdict>
  >({});
  const [nodeExperimentIds, setNodeExperimentIds] = useState<
    Record<string, string>
  >({});

  const resetEditor = useCallback(() => {
    setExpandedNodeId(null);
    setCorrection("");
    setAlternativeSummary("");
    setVerdict(null);
  }, []);

  const handleCheckpoint = useCallback(
    async (
      nodeId: string,
      nextVerdict: SwarmCheckpointVerdict,
      options?: { correction?: string; alternativeSummary?: string }
    ) => {
      setIsSubmitting(true);
      try {
        const payload: Record<string, unknown> = {
          node_id: nodeId,
          verdict: nextVerdict,
          correction: options?.correction?.trim() || null,
          alternative_summary: options?.alternativeSummary?.trim() || null,
          promoted_by: "human",
        };

        const existingExperimentId = nodeExperimentIds[nodeId];
        if (existingExperimentId) {
          payload.experiment_id = existingExperimentId;
        }

        const response = await fetch(`/api/swarm/${sessionId}/checkpoint`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          throw new Error(`Checkpoint request failed: ${response.status}`);
        }

        const data = (await response.json()) as CheckpointResponse;
        const responseExperimentId = data.experiment_id;
        if (
          typeof responseExperimentId === "string" &&
          responseExperimentId.length > 0
        ) {
          setNodeExperimentIds((prev) => ({
            ...prev,
            [nodeId]: responseExperimentId,
          }));
        }

        setSubmittedNodes((prev) => ({ ...prev, [nodeId]: nextVerdict }));
        await onCheckpointSubmitted?.();
        resetEditor();
      } catch (error) {
        console.error("[SwarmControls] Failed to submit checkpoint:", error);
      } finally {
        setIsSubmitting(false);
      }
    },
    [nodeExperimentIds, onCheckpointSubmitted, resetEditor, sessionId]
  );

  // Show reasoning nodes that can be checkpointed
  const checkpointableNodes = graphNodes.filter(
    (n) => n.agent !== "synthesizer" && n.agent !== "metacognition" && n.agent !== "maestro"
  );

  if (checkpointableNodes.length === 0) return null;

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <UserCheck className="w-3.5 h-3.5 text-amber-400" />
        <span className="text-xs font-medium text-[var(--foreground)]">
          Human-in-the-Loop Checkpoints
        </span>
        <span className="text-[10px] text-[var(--muted-foreground)]">
          ({checkpointableNodes.length} reviewable)
        </span>
      </div>

      <div className="space-y-2">
        {checkpointableNodes.map((node) => {
          const isExpanded = expandedNodeId === node.id;
          const borderColor = AGENT_COLORS[node.agent] ?? "#6b7280";
          const isDisagreeMode = isExpanded && verdict === "disagree";
          const isExploreMode = isExpanded && verdict === "explore";
          const submittedVerdict = submittedNodes[node.id];
          const experimentId = nodeExperimentIds[node.id];

          return (
            <Card
              key={node.id}
              className={cn(
                "overflow-hidden transition-all duration-200 cursor-pointer hover:bg-[var(--muted)]/30"
              )}
              style={{
                borderLeft: "3px solid transparent",
                borderImage: `linear-gradient(to bottom, ${borderColor}, ${borderColor}33) 1`,
              }}
              onClick={() => {
                setExpandedNodeId(isExpanded ? null : node.id);
                setVerdict(null);
                setCorrection("");
                setAlternativeSummary("");
              }}
            >
              <CardContent className="p-3">
                {/* Header */}
                <div className="flex items-center gap-2 mb-1.5">
                  <ChevronRight
                    className={cn(
                      "w-3 h-3 text-[var(--muted-foreground)] transition-transform duration-200 shrink-0",
                      isExpanded && "rotate-90"
                    )}
                  />
                  <span
                    className="text-xs font-medium"
                    style={{ color: borderColor }}
                  >
                    {formatAgentName(node.agent)}
                  </span>
                  {node.confidence !== undefined && (
                    <span className="text-[10px] text-[var(--muted-foreground)] ml-auto">
                      {Math.round(node.confidence * 100)}% confidence
                    </span>
                  )}
                  {submittedVerdict && (
                    <span
                      className={cn(
                        "text-[10px] px-1.5 py-0.5 rounded-full font-medium ml-auto",
                        verdictPillClasses(submittedVerdict)
                      )}
                    >
                      {formatVerdict(submittedVerdict)}
                    </span>
                  )}
                </div>

                {/* Content preview */}
                <div className="ml-[20px]">
                  <MarkdownContent
                    content={node.content}
                    size="sm"
                    className={cn(!isExpanded && "max-h-20 overflow-y-auto pr-1")}
                  />
                  {experimentId && (
                    <div className="mt-2 text-[10px] text-[var(--muted-foreground)]">
                      Experiment: <span className="font-mono">{experimentId}</span>
                    </div>
                  )}
                </div>

                {/* Expanded: action area */}
                {isExpanded && (
                  <div className="mt-3 ml-[20px]" onClick={(e) => e.stopPropagation()}>
                    {isDisagreeMode || isExploreMode ? (
                      <div className="space-y-2">
                        {isDisagreeMode && (
                          <>
                            <div className="flex items-center gap-1.5 text-[10px] text-[var(--muted-foreground)]">
                              <MessageSquare className="w-3 h-3" />
                              Provide a correction (required)
                            </div>
                            <Input
                              value={correction}
                              onChange={(e) => setCorrection(e.target.value)}
                              placeholder="Suggest correction..."
                              className="text-xs h-8"
                              onKeyDown={(e) => {
                                if (
                                  e.key === "Enter" &&
                                  correction.trim() &&
                                  !isSubmitting
                                ) {
                                  handleCheckpoint(node.id, "disagree", {
                                    correction,
                                    alternativeSummary,
                                  });
                                }
                              }}
                            />
                          </>
                        )}

                        <div className="flex items-center gap-1.5 text-[10px] text-[var(--muted-foreground)]">
                          <Compass className="w-3 h-3" />
                          {isExploreMode
                            ? "Alternative summary (required for explore)"
                            : "Alternative summary (optional)"}
                        </div>
                        <Input
                          value={alternativeSummary}
                          onChange={(e) => setAlternativeSummary(e.target.value)}
                          placeholder={
                            isExploreMode
                              ? "Describe the alternative direction..."
                              : "Optional alternative summary..."
                          }
                          className="text-xs h-8"
                          onKeyDown={(e) => {
                            if (
                              e.key === "Enter" &&
                              ((isDisagreeMode && correction.trim()) ||
                                (isExploreMode && alternativeSummary.trim())) &&
                              !isSubmitting
                            ) {
                              handleCheckpoint(
                                node.id,
                                isExploreMode ? "explore" : "disagree",
                                {
                                  correction,
                                  alternativeSummary,
                                }
                              );
                            }
                          }}
                        />

                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            className="h-8 px-3 text-xs gap-1.5"
                            disabled={
                              isSubmitting ||
                              (isDisagreeMode
                                ? !correction.trim()
                                : !alternativeSummary.trim())
                            }
                            onClick={() =>
                              handleCheckpoint(
                                node.id,
                                isExploreMode ? "explore" : "disagree",
                                {
                                  correction,
                                  alternativeSummary,
                                }
                              )
                            }
                          >
                            <Send className="w-3 h-3" />
                            Submit
                          </Button>
                          <button
                            className="text-[10px] text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
                            onClick={() => setVerdict(null)}
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 flex-wrap">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 px-3 text-[11px] gap-1.5 border-green-500/30 text-green-400 hover:bg-green-500/10 hover:text-green-300"
                          onClick={() => handleCheckpoint(node.id, "verified")}
                          disabled={isSubmitting}
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" /> Verify
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 px-3 text-[11px] gap-1.5 border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/10 hover:text-yellow-300"
                          onClick={() => handleCheckpoint(node.id, "questionable")}
                          disabled={isSubmitting}
                        >
                          <HelpCircle className="w-3.5 h-3.5" /> Question
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 px-3 text-[11px] gap-1.5 border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/10 hover:text-cyan-300"
                          onClick={() => handleCheckpoint(node.id, "agree")}
                          disabled={isSubmitting}
                        >
                          <ThumbsUp className="w-3.5 h-3.5" /> Agree
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 px-3 text-[11px] gap-1.5 border-slate-500/30 text-slate-300 hover:bg-slate-500/10 hover:text-slate-200"
                          onClick={() => handleCheckpoint(node.id, "note")}
                          disabled={isSubmitting}
                        >
                          <FileText className="w-3.5 h-3.5" /> Note
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 px-3 text-[11px] gap-1.5 border-indigo-500/30 text-indigo-400 hover:bg-indigo-500/10 hover:text-indigo-300"
                          onClick={() => setVerdict("explore")}
                          disabled={isSubmitting}
                        >
                          <Compass className="w-3.5 h-3.5" /> Explore
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 px-3 text-[11px] gap-1.5 border-red-500/30 text-red-400 hover:bg-red-500/10 hover:text-red-300"
                          onClick={() => setVerdict("disagree")}
                          disabled={isSubmitting}
                        >
                          <XCircle className="w-3.5 h-3.5" /> Disagree
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
