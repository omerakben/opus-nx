"use client";

import { useState, useCallback, useEffect } from "react";
import { ReactFlowProvider } from "@xyflow/react";

import { Header } from "./Header";
import { LeftPanel } from "./LeftPanel";
import { RightPanel } from "./RightPanel";
import { BottomPanel } from "./BottomPanel";
import { ThinkingGraph } from "@/components/graph";
import { useSession, useThinkingStream, useGraph } from "@/lib/hooks";
import { getSessionInsights, type Insight } from "@/lib/api";

export function Dashboard() {
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
    (query: string) => {
      if (activeSession?.id) {
        startStream(activeSession.id, query);
      }
    },
    [activeSession?.id, startStream]
  );

  // Handle evidence click from insights (highlight node)
  const handleEvidenceClick = useCallback(
    (nodeId: string) => {
      selectNode(nodeId);
    },
    [selectNode]
  );

  // Refresh graph when stream completes
  useEffect(() => {
    if (!isStreaming && thinking) {
      // Delay to allow DB writes to complete
      const timeout = setTimeout(() => {
        refreshGraph();
      }, 1000);
      return () => clearTimeout(timeout);
    }
  }, [isStreaming, thinking, refreshGraph]);

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
          {/* Graph */}
          <div className="flex-1 overflow-hidden">
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
          />
        </div>

        {/* Right Panel: Insights & Fork */}
        <RightPanel
          insights={insights}
          isLoadingInsights={isLoadingInsights}
          sessionId={activeSession?.id ?? null}
          onEvidenceClick={handleEvidenceClick}
        />
      </div>
    </div>
  );
}
