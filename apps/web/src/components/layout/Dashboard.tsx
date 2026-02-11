"use client";

import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { ReactFlowProvider } from "@xyflow/react";

import { Header } from "./Header";
import { LeftPanel } from "./LeftPanel";
import { RightPanel } from "./RightPanel";
import { BottomPanel } from "./BottomPanel";
import { MobileNav, type MobileView } from "./MobileNav";
import { ThinkingGraph } from "@/components/graph";
import { DemoTour } from "@/components/tour/DemoTour";
import { useSession, useThinkingStream, useGraph, useLiveGraph, useIsMobile, useTour, useSidebar, useRightSidebar } from "@/lib/hooks";
import { getSessionInsights, type Insight } from "@/lib/api";
import { appEvents } from "@/lib/events";
import type { SelectedNodeData } from "@/components/thinking";

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
    archiveSession,
    deleteSessionWithUndo,
  } = useSession();

  // Sidebar state
  const { isCollapsed: isSidebarCollapsed, toggle: toggleSidebar } = useSidebar();
  const { isCollapsed: isRightCollapsed, toggle: toggleRightSidebar } = useRightSidebar();

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
    streamingNodes,
    response: streamResponse,
    nodeId: streamNodeId,
    degraded: streamDegraded,
    warnings: streamWarnings,
    start: startStream,
    stop: stopStream,
    clear: clearStream,
  } = useThinkingStream();

  // Live graph: merge persisted nodes with streaming provisional nodes
  const { nodes: liveNodes, edges: liveEdges } = useLiveGraph({
    persistedNodes: nodes,
    persistedEdges: edges,
    isStreaming,
    streamingNodes,
    phase,
    tokenCount,
  });

  // Demo tour
  const {
    isActive: isTourActive,
    currentStep,
    currentIndex,
    totalSteps,
    startTour,
    restartTour,
    nextStep,
    previousStep,
    skipTour,
  } = useTour();

  // Insights
  const [insights, setInsights] = useState<Insight[]>([]);
  const [isLoadingInsights, setIsLoadingInsights] = useState(false);

  // Load insights when session changes
  const loadInsights = useCallback(async () => {
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
  }, [activeSession?.id]);

  useEffect(() => {
    loadInsights();
  }, [loadInsights]);

  // Reload insights when swarm completes (insights bridged to metacognitive_insights table)
  useEffect(() => {
    const unsub = appEvents.on("swarm:complete", (payload) => {
      if (payload.sessionId === activeSession?.id) {
        // Small delay to let the bridging POST settle
        setTimeout(() => loadInsights(), 500);
      }
    });
    return unsub;
  }, [activeSession?.id, loadInsights]);

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

  // Derive selected node data for the BottomPanel historical reasoning view
  const selectedNodeData: SelectedNodeData | null = useMemo(() => {
    if (!selectedNode) return null;
    const d = selectedNode.data;
    return {
      id: d.id,
      reasoning: d.reasoning,
      response: d.response,
      confidence: d.confidence,
      tokenUsage: d.tokenUsage,
      inputQuery: d.inputQuery,
      createdAt: d.createdAt,
      nodeType: d.nodeType,
    };
  }, [selectedNode]);

  // Clear node selection (dismiss historical view)
  const clearNodeSelection = useCallback(() => {
    selectNode(null);
  }, [selectNode]);

  // Handle session selection — clear stale state from previous session
  const handleSelectSession = useCallback(
    (sessionId: string) => {
      const previousId = activeSession?.id ?? null;
      selectSession(sessionId);
      selectNode(null); // Clear node selection (prevents stale right panel)
      setInsights([]); // Clear insights until reloaded for new session

      // Emit event so ForkPanel and others can reset
      appEvents.emit("session:changed", { sessionId, previousSessionId: previousId });

      if (isMobile) {
        setMobileView("graph");
      }
    },
    [selectSession, selectNode, activeSession?.id, isMobile]
  );

  // Seed demo data and refresh
  const handleSeedDemo = useCallback(async () => {
    try {
      const res = await fetch("/api/seed", { method: "POST" });
      if (res.ok) {
        await refreshSessions();
        await refreshGraph();
        appEvents.emit("data:stale", { scope: "all" });
      }
    } catch (error) {
      console.error("Demo seed failed:", error);
    }
  }, [refreshSessions, refreshGraph]);

  // Refresh ALL data when stream completes (graph, sessions, insights)
  const prevIsStreamingRef = useRef(isStreaming);
  useEffect(() => {
    const justFinished = prevIsStreamingRef.current && !isStreaming;
    prevIsStreamingRef.current = isStreaming;

    if (justFinished && activeSession?.id) {
      const sessionId = activeSession.id;
      const timeout = setTimeout(async () => {
        // Refresh graph, sessions, and insights together
        await Promise.all([
          refreshGraph(),
          refreshSessions(),
        ]);

        // Reload insights for the current session
        const insightResponse = await getSessionInsights(sessionId);
        if (insightResponse.data) {
          setInsights(insightResponse.data);
        }

        // Notify other components (ForkPanel, etc.) that thinking completed
        appEvents.emit("thinking:complete", { sessionId, nodeId: streamNodeId ?? undefined });
        appEvents.emit("data:stale", { scope: "all", sessionId });
      }, 800);
      return () => clearTimeout(timeout);
    }
  }, [isStreaming, activeSession?.id, refreshGraph, refreshSessions, streamNodeId]);

  // Auto-start tour when graph has nodes loaded (e.g., after demo seed)
  const hasNodes = nodes.length > 0;
  useEffect(() => {
    if (hasNodes && !isLoadingGraph && !isStreaming) {
      // Small delay to let the graph render before tour starts
      const timeout = setTimeout(() => startTour(), 800);
      return () => clearTimeout(timeout);
    }
  }, [hasNodes, isLoadingGraph, isStreaming, startTour]);

  // Mobile layout
  if (isMobile) {
    return (
      <div className="h-[100dvh] flex flex-col overflow-hidden bg-[var(--background)]">
        <Header isMobile onReplayTour={restartTour} />

        <div className="flex-1 overflow-hidden relative">
          {/* Graph View */}
          {mobileView === "graph" && (
            <div className="h-full overflow-hidden relative animate-fade-in">
              {isStreaming && (
                <div className="absolute top-2 left-1/2 -translate-x-1/2 z-20 px-3 py-1.5 rounded-full bg-[var(--card)]/90 border border-violet-500/30 backdrop-blur-sm flex items-center gap-2 animate-breathing">
                  <div className="w-2 h-2 rounded-full bg-violet-500 animate-pulse" />
                  <span className="text-xs text-violet-400 font-medium">
                    Thinking...
                  </span>
                </div>
              )}
              <ReactFlowProvider>
                <ThinkingGraph
                  nodes={liveNodes}
                  edges={liveEdges}
                  onNodeClick={selectNode}
                  onNodesChange={onNodesChange}
                  onEdgesChange={onEdgesChange}
                  isLoading={isLoadingGraph}
                  isMobile
                  onSeedDemo={handleSeedDemo}
                  onBranchCreated={refreshGraph}
                  selectedNodeId={selectedNode?.id}
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
                selectedNodeData={selectedNodeData}
                onClearSelection={clearNodeSelection}
                response={streamResponse}
                streamNodeId={streamNodeId}
                degraded={streamDegraded}
                warnings={streamWarnings}
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
                onArchiveSession={archiveSession}
                onDeleteSession={deleteSessionWithUndo}
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
      <Header onReplayTour={restartTour} />

      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel: Sessions & Stats */}
        <LeftPanel
          sessions={sessions}
          activeSessionId={activeSession?.id ?? null}
          isLoading={isLoadingSession}
          nodes={nodes}
          onSelectSession={handleSelectSession}
          onCreateSession={createNewSession}
          onRefresh={refreshSessions}
          onArchiveSession={archiveSession}
          onDeleteSession={deleteSessionWithUndo}
          isCollapsed={isSidebarCollapsed}
          onToggleCollapse={toggleSidebar}
        />

        {/* Center: Graph + Stream */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Graph with streaming pulse */}
          <div className="flex-1 overflow-hidden relative" data-tour="reasoning-graph">
            {/* Streaming indicator overlay */}
            {isStreaming && (
              <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 px-3 py-1.5 rounded-full bg-[var(--card)]/90 border border-amber-500/30 backdrop-blur-sm flex items-center gap-2 animate-breathing">
                <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                <span className="text-xs text-amber-400 font-medium">
                  Opus is thinking...
                </span>
                <span className="text-[10px] text-[var(--muted-foreground)] opacity-70">
                  Graph updates on completion
                </span>
              </div>
            )}
            <ReactFlowProvider>
              <ThinkingGraph
                nodes={liveNodes}
                edges={liveEdges}
                onNodeClick={selectNode}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                isLoading={isLoadingGraph}
                onSeedDemo={handleSeedDemo}
                onBranchCreated={refreshGraph}
                selectedNodeId={selectedNode?.id}
              />
            </ReactFlowProvider>
          </div>

          {/* Bottom Panel: Thinking Stream + Historical Node Reasoning */}
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
            selectedNodeData={selectedNodeData}
            onClearSelection={clearNodeSelection}
            response={streamResponse}
            streamNodeId={streamNodeId}
            degraded={streamDegraded}
            warnings={streamWarnings}
          />
        </div>

        {/* Right Panel: Insights & Fork */}
        <RightPanel
          insights={insights}
          isLoadingInsights={isLoadingInsights}
          sessionId={activeSession?.id ?? null}
          onEvidenceClick={handleEvidenceClick}
          onInsightsGenerated={handleInsightsGenerated}
          isCollapsed={isRightCollapsed}
          onToggleCollapse={toggleRightSidebar}
          insightCount={insights.length}
        />
      </div>

      {/* Demo Tour Overlay */}
      <DemoTour
        isActive={isTourActive}
        currentStep={currentStep}
        currentIndex={currentIndex}
        totalSteps={totalSteps}
        onNext={nextStep}
        onPrevious={previousStep}
        onSkip={skipTour}
      />
    </div>
  );
}
