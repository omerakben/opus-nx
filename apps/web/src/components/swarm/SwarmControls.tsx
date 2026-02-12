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
  HelpCircle,
  XCircle,
  Send,
  ChevronRight,
  UserCheck,
  MessageSquare,
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

function formatAgentName(name: string): string {
  return name
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

interface SwarmControlsProps {
  graphNodes: SwarmGraphNode[];
  sessionId: string;
  onRerunStarted?: () => void;
}

export function SwarmControls({ graphNodes, sessionId, onRerunStarted }: SwarmControlsProps) {
  const [expandedNodeId, setExpandedNodeId] = useState<string | null>(null);
  const [correction, setCorrection] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [verdict, setVerdict] = useState<string | null>(null);
  const [submittedNodes, setSubmittedNodes] = useState<Record<string, string>>({});

  const handleCheckpoint = useCallback(async (nodeId: string, v: string, corr?: string) => {
    setIsSubmitting(true);
    try {
      await fetch(`/api/swarm/${sessionId}/checkpoint`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ node_id: nodeId, verdict: v, correction: corr || null }),
      });
      if (v === "disagree" && corr) {
        onRerunStarted?.();
      }
      setSubmittedNodes((prev) => ({ ...prev, [nodeId]: v }));
      setExpandedNodeId(null);
      setCorrection("");
      setVerdict(null);
    } finally {
      setIsSubmitting(false);
    }
  }, [sessionId, onRerunStarted]);

  // Show reasoning nodes that can be checkpointed
  const checkpointableNodes = graphNodes.filter(n =>
    n.agent !== "synthesizer" && n.agent !== "metacognition" && n.agent !== "maestro"
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
          const submittedVerdict = submittedNodes[node.id];

          return (
            <Card
              key={node.id}
              className={cn(
                "overflow-hidden transition-all duration-200",
                submittedVerdict && "opacity-60",
                !submittedVerdict && "cursor-pointer hover:bg-[var(--muted)]/30"
              )}
              style={{
                borderLeft: "3px solid transparent",
                borderImage: `linear-gradient(to bottom, ${borderColor}, ${borderColor}33) 1`,
              }}
              onClick={() => {
                if (!submittedVerdict) {
                  setExpandedNodeId(isExpanded ? null : node.id);
                  setVerdict(null);
                  setCorrection("");
                }
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
                    <span className={cn(
                      "text-[10px] px-1.5 py-0.5 rounded-full font-medium ml-auto",
                      submittedVerdict === "verified" && "bg-green-500/20 text-green-400",
                      submittedVerdict === "questionable" && "bg-yellow-500/20 text-yellow-400",
                      submittedVerdict === "disagree" && "bg-red-500/20 text-red-400",
                    )}>
                      {submittedVerdict === "verified" && "Verified"}
                      {submittedVerdict === "questionable" && "Questioned"}
                      {submittedVerdict === "disagree" && "Corrected"}
                    </span>
                  )}
                </div>

                {/* Content preview */}
                <div className="ml-[20px]">
                  <MarkdownContent
                    content={node.content}
                    size="sm"
                    className={cn(
                      !isExpanded && "max-h-20 overflow-y-auto pr-1"
                    )}
                  />
                </div>

                {/* Expanded: action area */}
                <div
                  className="overflow-hidden transition-[max-height,opacity] duration-300 ease-out ml-[20px]"
                  style={{
                    maxHeight: isExpanded && !submittedVerdict ? "200px" : "0px",
                    opacity: isExpanded && !submittedVerdict ? 1 : 0,
                  }}
                >
                  {isDisagreeMode ? (
                    <div className="mt-3 space-y-2" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center gap-1.5 text-[10px] text-[var(--muted-foreground)]">
                        <MessageSquare className="w-3 h-3" />
                        Provide a correction to improve this reasoning
                      </div>
                      <div className="flex gap-2">
                        <Input
                          value={correction}
                          onChange={(e) => setCorrection(e.target.value)}
                          placeholder="Suggest correction..."
                          className="flex-1 text-xs h-8"
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && correction.trim()) {
                              handleCheckpoint(node.id, "disagree", correction);
                            }
                          }}
                        />
                        <Button
                          size="sm"
                          className="h-8 px-3 text-xs gap-1.5"
                          disabled={!correction.trim() || isSubmitting}
                          onClick={() => handleCheckpoint(node.id, "disagree", correction)}
                        >
                          <Send className="w-3 h-3" />
                          Submit
                        </Button>
                      </div>
                      <button
                        className="text-[10px] text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
                        onClick={() => setVerdict(null)}
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <div className="mt-3 flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
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
                        className="h-7 px-3 text-[11px] gap-1.5 border-red-500/30 text-red-400 hover:bg-red-500/10 hover:text-red-300"
                        onClick={() => setVerdict("disagree")}
                        disabled={isSubmitting}
                      >
                        <XCircle className="w-3.5 h-3.5" /> Disagree
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
