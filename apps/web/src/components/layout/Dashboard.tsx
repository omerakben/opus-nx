"use client";

import { useState, useCallback, useEffect } from "react";
import { ReactFlowProvider } from "@xyflow/react";

import { Header } from "./Header";
import { LeftPanel } from "./LeftPanel";
import { RightPanel } from "./RightPanel";
import { BottomPanel } from "./BottomPanel";
import { MobileNav, type MobileView } from "./MobileNav";
import { ThinkingGraph } from "@/components/graph";
import { useSession, useThinkingStream, useGraph, useIsMobile } from "@/lib/hooks";
import { getSessionInsights, type Insight } from "@/lib/api";

export function Dashboard() {
  const isMobile = useIsMobile();
  const [mobileView, setMobileView] = useState<MobileView>("graph");

  // Session management
  const {
    sessions,
    activeSession,
    isLoading: isLoadingSession,
    selectSession,
    createNewSession,
    refreshSessions,
  } = useSession();

  // Graph state
  const {
    nodes,
    edges,
    selectedNode,
    isLoading: isLoadingGraph,
    onNodesChange,
    onEdgesChange,
    selectNode,
    refreshGraph,
  } = useGraph(activeSession?.id ?? null);

  // Thinking stream
  const {
    thinking,
    tokenCount,
    isStreaming,
    error: streamError,
    phase,
    compactionCount,
    compactionSummary,
    elapsedMs,
    start: startStream,
    stop: stopStream,
    clear: clearStream,
  } = useThinkingStream();

  // Insights
  const [insights, setInsights] = useState<Insight[]>([]);
  const [isLoadingInsights, setIsLoadingInsights] = useState(false);

  // Load insights when session changes
  useEffect(() => {
    async function loadInsights() {
      if (!activeSession?.id) {
        setInsights([]);
        return;
      }

      setIsLoadingInsights(true);
      const response = await getSessionInsights(activeSession.id);
      if (response.data) {
        setInsights(response.data);
      }
      setIsLoadingInsights(false);
    }

    loadInsights();
  }, [activeSession?.id]);

  // Handle starting a new thinking stream
  const handleStartStream = useCallback(
    (query: string, effort?: string) => {
      if (activeSession?.id) {
        startStream(activeSession.id, query, effort);
        if (isMobile) {
          setMobileView("think");
        }
      }
    },
    [activeSession?.id, startStream, isMobile]
  );

  // Handle new insights from metacognitive analysis (full replacement to prevent duplicates)
  const handleInsightsGenerated = useCallback(
    (newInsights: Insight[]) => {
      setInsights(newInsights);
    },
    []
  );

  // Handle evidence click from insights (highlight node)
  const handleEvidenceClick = useCallback(
    (nodeId: string) => {
      selectNode(nodeId);
      if (isMobile) {
        setMobileView("graph");
      }
    },
    [selectNode, isMobile]
  );

  // Handle session selection on mobile
  const handleSelectSession = useCallback(
    (sessionId: string) => {
      selectSession(sessionId);
      if (isMobile) {
        setMobileView("graph");
      }
    },
    [selectSession, isMobile]
  );

  // Refresh graph when stream completes
  useEffect(() => {
    if (!isStreaming && thinking) {
      const timeout = setTimeout(() => {
        refreshGraph();
      }, 1000);
      return () => clearTimeout(timeout);
    }
  }, [isStreaming, thinking, refreshGraph]);

  // Mobile layout
  if (isMobile) {
    return (
      <div className="h-[100dvh] flex flex-col overflow-hidden bg-[var(--background)]">
        <Header isMobile />

        <div className="flex-1 overflow-hidden relative">
          {/* Graph View */}
          {mobileView === "graph" && (
            <div className="h-full overflow-hidden relative animate-fade-in">
              {isStreaming && (
                <div className="absolute top-2 left-1/2 -translate-x-1/2 z-20 px-3 py-1.5 rounded-full bg-[var(--card)]/90 border border-green-500/30 backdrop-blur-sm flex items-center gap-2 animate-pulse">
                  <div className="w-2 h-2 rounded-full bg-green-500 animate-ping" />
                  <span className="text-xs text-green-400 font-medium">
                    Thinking...
                  </span>
                </div>
              )}
              <ReactFlowProvider>
                <ThinkingGraph
                  nodes={nodes}
                  edges={edges}
                  onNodeClick={selectNode}
                  onNodesChange={onNodesChange}
                  onEdgesChange={onEdgesChange}
                  isLoading={isLoadingGraph}
                  isMobile
                />
              </ReactFlowProvider>
            </div>
          )}

          {/* Think View */}
          {mobileView === "think" && (
            <div className="h-full overflow-hidden animate-fade-in">
              <BottomPanel
                thinking={thinking}
                tokenCount={tokenCount}
                isStreaming={isStreaming}
                error={streamError}
                sessionId={activeSession?.id ?? null}
                onStart={handleStartStream}
                onStop={stopStream}
                onClear={clearStream}
                phase={phase}
                compactionCount={compactionCount}
                compactionSummary={compactionSummary}
                elapsedMs={elapsedMs}
                isMobile
              />
            </div>
          )}

          {/* Sessions View */}
          {mobileView === "sessions" && (
            <div className="h-full overflow-hidden animate-fade-in">
              <LeftPanel
                sessions={sessions}
                activeSessionId={activeSession?.id ?? null}
                isLoading={isLoadingSession}
                nodes={nodes}
                onSelectSession={handleSelectSession}
                onCreateSession={createNewSession}
                onRefresh={refreshSessions}
                isMobile
              />
            </div>
          )}

          {/* Insights View */}
          {mobileView === "insights" && (
            <div className="h-full overflow-hidden animate-fade-in">
              <RightPanel
                insights={insights}
                isLoadingInsights={isLoadingInsights}
                sessionId={activeSession?.id ?? null}
                onEvidenceClick={handleEvidenceClick}
                onInsightsGenerated={handleInsightsGenerated}
                isMobile
              />
            </div>
          )}
        </div>

        <MobileNav
          activeView={mobileView}
          onViewChange={setMobileView}
          isStreaming={isStreaming}
        />
      </div>
    );
  }

  // Desktop layout
  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <Header />

      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel: Sessions & Stats */}
        <LeftPanel
          sessions={sessions}
          activeSessionId={activeSession?.id ?? null}
          isLoading={isLoadingSession}
          nodes={nodes}
          onSelectSession={selectSession}
          onCreateSession={createNewSession}
          onRefresh={refreshSessions}
        />

        {/* Center: Graph + Stream */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Graph with streaming pulse */}
          <div className="flex-1 overflow-hidden relative">
            {/* Streaming indicator overlay */}
            {isStreaming && (
              <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 px-3 py-1.5 rounded-full bg-[var(--card)]/90 border border-green-500/30 backdrop-blur-sm flex items-center gap-2 animate-pulse">
                <div className="w-2 h-2 rounded-full bg-green-500 animate-ping" />
                <span className="text-xs text-green-400 font-medium">
                  Claude is thinking...
                </span>
                <span className="text-[10px] text-[var(--muted-foreground)]">
                  Graph updates on completion
                </span>
              </div>
            )}
            <ReactFlowProvider>
              <ThinkingGraph
                nodes={nodes}
                edges={edges}
                onNodeClick={selectNode}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                isLoading={isLoadingGraph}
              />
            </ReactFlowProvider>
          </div>

          {/* Bottom Panel: Thinking Stream */}
          <BottomPanel
            thinking={thinking}
            tokenCount={tokenCount}
            isStreaming={isStreaming}
            error={streamError}
            sessionId={activeSession?.id ?? null}
            onStart={handleStartStream}
            onStop={stopStream}
            onClear={clearStream}
            phase={phase}
            compactionCount={compactionCount}
            compactionSummary={compactionSummary}
            elapsedMs={elapsedMs}
          />
        </div>

        {/* Right Panel: Insights & Fork */}
        <RightPanel
          insights={insights}
          isLoadingInsights={isLoadingInsights}
          sessionId={activeSession?.id ?? null}
          onEvidenceClick={handleEvidenceClick}
          onInsightsGenerated={handleInsightsGenerated}
        />
      </div>
    </div>
  );
}
