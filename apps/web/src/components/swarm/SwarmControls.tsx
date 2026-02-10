"use client";

import { useCallback, useState } from "react";
import { Button, Card, CardContent, Input } from "@/components/ui";
import { CheckCircle2, HelpCircle, XCircle, Send } from "lucide-react";
import type { SwarmGraphNode } from "@/lib/hooks/use-swarm";

interface SwarmControlsProps {
  graphNodes: SwarmGraphNode[];
  sessionId: string;
  onRerunStarted?: () => void;
}

export function SwarmControls({ graphNodes, sessionId, onRerunStarted }: SwarmControlsProps) {
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [correction, setCorrection] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [verdict, setVerdict] = useState<string | null>(null);

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
      setSelectedNode(null);
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
      <div className="text-[11px] font-medium text-[var(--muted-foreground)] mb-2">
        Human-in-the-Loop Checkpoints
      </div>
      <div className="space-y-2">
        {checkpointableNodes.slice(0, 5).map((node) => (
          <Card key={node.id} className="bg-[var(--card)]">
            <CardContent className="p-2.5">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[var(--muted)] text-[var(--muted-foreground)]">
                  {node.agent.replace(/_/g, " ")}
                </span>
              </div>
              <p className="text-[11px] text-[var(--foreground)] line-clamp-2 mb-2">
                {node.content}
              </p>

              {selectedNode === node.id && verdict === "disagree" ? (
                <div className="flex gap-1.5">
                  <Input
                    value={correction}
                    onChange={(e) => setCorrection(e.target.value)}
                    placeholder="Suggest correction..."
                    className="flex-1 text-xs h-7"
                  />
                  <Button
                    size="sm"
                    className="h-7 px-2 text-xs"
                    disabled={!correction.trim() || isSubmitting}
                    onClick={() => handleCheckpoint(node.id, "disagree", correction)}
                  >
                    <Send className="w-3 h-3" />
                  </Button>
                </div>
              ) : (
                <div className="flex gap-1.5">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-[10px] gap-1 text-green-400 hover:text-green-300"
                    onClick={() => handleCheckpoint(node.id, "verified")}
                    disabled={isSubmitting}
                  >
                    <CheckCircle2 className="w-3 h-3" /> Verify
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-[10px] gap-1 text-yellow-400 hover:text-yellow-300"
                    onClick={() => handleCheckpoint(node.id, "questionable")}
                    disabled={isSubmitting}
                  >
                    <HelpCircle className="w-3 h-3" /> Question
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-[10px] gap-1 text-red-400 hover:text-red-300"
                    onClick={() => {
                      setSelectedNode(node.id);
                      setVerdict("disagree");
                    }}
                    disabled={isSubmitting}
                  >
                    <XCircle className="w-3 h-3" /> Disagree
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
