"use client";

import { useCallback, useState } from "react";
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  NeuralSubmitButton,
} from "@/components/ui";
import { useSwarm } from "@/lib/hooks/use-swarm";

import { getConfidenceColor } from "@/lib/colors";
import {
  AlertCircle,
  Brain,
  Loader2,
  Network,
  Sparkles,
  Zap,
} from "lucide-react";
import { AgentCard } from "./AgentCard";
import { SwarmTimeline } from "./SwarmTimeline";

interface SwarmViewProps {
  sessionId: string | null;
}

const EXAMPLE_QUERIES = [
  "Analyze the trade-offs of microservices vs monolith",
  "Evaluate our authentication strategy",
  "Review the data pipeline architecture",
];

export function SwarmView({ sessionId }: SwarmViewProps) {
  const authSecret = process.env.NEXT_PUBLIC_AUTH_SECRET ?? "";
  const { state, start, stop } = useSwarm(authSecret);
  const [query, setQuery] = useState("");

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (!query.trim() || !sessionId || state.phase === "running" || state.phase === "synthesis") {
        return;
      }
      start(query.trim(), sessionId);
    },
    [query, sessionId, state.phase, start]
  );

  const handleExampleClick = useCallback((example: string) => {
    setQuery(example);
  }, []);

  const handleDismissError = useCallback(() => {
    // Reset to idle by stopping and clearing
    stop();
  }, [stop]);

  const agents = Object.values(state.agents);
  const isRunning = state.phase === "running" || state.phase === "synthesis";

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="py-3 px-4 border-b border-[var(--border)]">
        <CardTitle className="text-base font-medium flex items-center gap-2">
          <Network className="w-4 h-4 text-cyan-400" />
          Agent Swarm
          {isRunning && (
            <Loader2 className="w-3 h-3 text-cyan-400 animate-spin ml-auto" />
          )}
          {state.phase === "complete" && (
            <span className="text-[11px] font-normal text-green-400 ml-auto">
              Complete
            </span>
          )}
        </CardTitle>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col p-0 overflow-hidden">
        {/* Input form */}
        <form
          onSubmit={handleSubmit}
          className="p-4 border-b border-[var(--border)]"
        >
          <div className="flex gap-2">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={
                !sessionId
                  ? "Select a session first..."
                  : "Enter a query for swarm analysis..."
              }
              disabled={!sessionId || isRunning}
              className="flex-1 text-xs"
            />
            <NeuralSubmitButton
              disabled={!query.trim() || !sessionId || isRunning}
              isLoading={isRunning}
            />
          </div>
        </form>

        {/* Main content area */}
        <div className="flex-1 overflow-y-auto p-4">
          {/* Error state */}
          {state.phase === "error" && state.error && (
            <div className="text-center py-8">
              <div className="flex items-center justify-center gap-2 mb-2">
                <AlertCircle className="w-5 h-5 text-red-400" />
                <p className="text-sm text-red-400">{state.error}</p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="text-xs"
                onClick={handleDismissError}
              >
                Dismiss
              </Button>
            </div>
          )}

          {/* Running state: agent grid + timeline */}
          {isRunning && (
            <div className="space-y-4">
              {/* Phase indicator */}
              <div className="text-center py-2">
                <div className="relative w-12 h-12 mx-auto mb-2">
                  <div className="absolute inset-0 rounded-full border-2 border-cyan-500/20 animate-ping" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Network className="w-5 h-5 text-cyan-400 animate-pulse" />
                  </div>
                </div>
                <p className="text-xs text-cyan-400">
                  {state.phase === "synthesis"
                    ? "Synthesizing results..."
                    : `${agents.filter((a) => a.status === "completed").length}/${agents.length} agents complete`}
                </p>
              </div>

              {/* Agent grid */}
              {agents.length > 0 && (
                <div className="grid grid-cols-2 gap-2">
                  {agents.map((agent) => (
                    <AgentCard key={agent.name} agent={agent} />
                  ))}
                </div>
              )}

              {/* Timeline */}
              {state.events.length > 0 && (
                <div>
                  <div className="text-[11px] font-medium text-[var(--muted-foreground)] mb-2">
                    Event Timeline
                  </div>
                  <SwarmTimeline events={state.events} />
                </div>
              )}

              {/* Stop button */}
              <div className="flex justify-center">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs gap-1 text-[var(--muted-foreground)]"
                  onClick={stop}
                >
                  Stop swarm
                </Button>
              </div>
            </div>
          )}

          {/* Complete state: synthesis + agents + timeline */}
          {state.phase === "complete" && (
            <div className="space-y-4">
              {/* Synthesis card */}
              {state.synthesis && (
                <Card className="bg-green-500/10 border-green-500/30 overflow-hidden">
                  <div className="h-1 bg-gradient-to-r from-green-500 via-emerald-400 to-green-500" />
                  <CardContent className="p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <Sparkles className="w-4 h-4 text-green-400" />
                      <span className="text-xs font-medium text-green-400">
                        Synthesis
                      </span>
                      {state.synthesisConfidence !== null && (
                        <span
                          className="text-[11px] font-semibold ml-auto"
                          style={{
                            color: getConfidenceColor(state.synthesisConfidence),
                          }}
                        >
                          {Math.round(state.synthesisConfidence * 100)}%
                          confidence
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-[var(--foreground)] leading-relaxed whitespace-pre-line">
                      {state.synthesis}
                    </p>
                  </CardContent>
                </Card>
              )}

              {/* Agent results grid */}
              {agents.length > 0 && (
                <div>
                  <div className="text-[11px] font-medium text-[var(--muted-foreground)] mb-2">
                    Agent Results
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {agents.map((agent) => (
                      <AgentCard key={agent.name} agent={agent} />
                    ))}
                  </div>
                </div>
              )}

              {/* Metacognition insights */}
              {state.insights.length > 0 && (
                <div>
                  <div className="text-[11px] font-medium text-[var(--muted-foreground)] mb-2 flex items-center gap-1.5">
                    <Brain className="w-3 h-3 text-violet-400" />
                    Metacognition Insights
                  </div>
                  <div className="space-y-2">
                    {state.insights.map((insight, idx) => (
                      <Card
                        key={idx}
                        className="bg-violet-500/10 border-violet-500/30"
                      >
                        <CardContent className="p-2.5">
                          <div className="flex items-center gap-1.5 mb-1">
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-violet-500/20 text-violet-400 font-medium">
                              {insight.type.replace(/_/g, " ")}
                            </span>
                          </div>
                          <p className="text-[11px] text-[var(--foreground)] leading-relaxed">
                            {insight.description}
                          </p>
                          {insight.agents.length > 0 && (
                            <div className="flex gap-1 mt-1.5">
                              {insight.agents.map((agent) => (
                                <span
                                  key={agent}
                                  className="text-[9px] px-1.5 py-0.5 rounded-full bg-[var(--muted)] text-[var(--muted-foreground)]"
                                >
                                  {agent.replace(/_/g, " ")}
                                </span>
                              ))}
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}

              {/* Timeline */}
              {state.events.length > 0 && (
                <div>
                  <div className="text-[11px] font-medium text-[var(--muted-foreground)] mb-2">
                    Event Timeline
                  </div>
                  <SwarmTimeline events={state.events} />
                </div>
              )}
            </div>
          )}

          {/* Idle state: empty state */}
          {state.phase === "idle" && (
            <div className="h-full flex items-center justify-center">
              <div className="text-center">
                <div className="relative w-16 h-16 mx-auto mb-4">
                  <div className="absolute inset-0 rounded-full border-2 border-dashed border-cyan-500/30" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Network className="w-8 h-8 text-[var(--muted-foreground)]" />
                  </div>
                </div>
                <h3 className="text-sm font-medium text-[var(--foreground)] mb-1">
                  Multi-Agent Swarm Analysis
                </h3>
                <p className="text-xs text-[var(--muted-foreground)] max-w-xs">
                  Deploy a swarm of specialized AI agents to analyze a problem
                  from multiple perspectives with verification and synthesis.
                </p>

                {/* Example queries */}
                <div className="mt-4 flex flex-wrap gap-2 justify-center">
                  {EXAMPLE_QUERIES.map((example) => (
                    <button
                      key={example}
                      onClick={() => handleExampleClick(example)}
                      className="text-[11px] px-2.5 py-1 rounded-full border border-[var(--border)] text-[var(--muted-foreground)] hover:border-cyan-500/30 hover:text-cyan-400 transition-colors focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:ring-offset-1 outline-none"
                    >
                      {example}
                    </button>
                  ))}
                </div>

                {/* Agent legend */}
                <div className="mt-3 flex items-center justify-center gap-3 text-[11px] text-[var(--muted-foreground)]">
                  <span className="flex items-center gap-1">
                    <Brain className="w-3 h-3 text-blue-400" />
                    Deep Thinker
                  </span>
                  <span className="flex items-center gap-1">
                    <Zap className="w-3 h-3 text-red-400" />
                    Contrarian
                  </span>
                  <span className="flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-orange-400" />
                    Synthesizer
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
