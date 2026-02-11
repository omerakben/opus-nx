"use client";

import { InsightsPanel } from "@/components/insights";
import { ForkPanel } from "@/components/fork";
import { SwarmView } from "@/components/swarm";
import { MemoryPanel } from "@/components/memory";
import { Tabs, TabsList, TabsTrigger, TabsContent, Button, Tooltip } from "@/components/ui";
import type { Insight } from "@/lib/api";
import { GitFork, Lightbulb, Network, Database, PanelRightOpen, PanelRightClose } from "lucide-react";

interface RightPanelProps {
  insights: Insight[];
  isLoadingInsights: boolean;
  sessionId: string | null;
  onEvidenceClick?: (nodeId: string) => void;
  onInsightsGenerated?: (insights: Insight[]) => void;
  isMobile?: boolean;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  insightCount?: number;
}

export function RightPanel({
  insights,
  isLoadingInsights,
  sessionId,
  onEvidenceClick,
  onInsightsGenerated,
  isMobile,
  isCollapsed,
  onToggleCollapse,
  insightCount = 0,
}: RightPanelProps) {
  // Mobile: full panel, no collapse — includes Swarm since center tabs don't exist on mobile
  if (isMobile) {
    return (
      <div className="h-full bg-[var(--background)] flex flex-col overflow-hidden">
        <Tabs defaultValue="insights" className="flex-1 flex flex-col min-h-0">
          <TabsList className="mx-4 mt-3 justify-start overflow-x-auto">
            <TabsTrigger value="insights" className="text-xs">
              <Lightbulb className="w-3 h-3 mr-1" />
              Insights
            </TabsTrigger>
            <TabsTrigger value="fork" className="text-xs">
              <GitFork className="w-3 h-3 mr-1" />
              ThinkFork
            </TabsTrigger>
            <TabsTrigger value="swarm" className="text-xs">
              <Network className="w-3 h-3 mr-1" />
              Swarm
            </TabsTrigger>
            <TabsTrigger value="memory" className="text-xs">
              <Database className="w-3 h-3 mr-1" />
              Memory
            </TabsTrigger>
          </TabsList>

          <div className="flex-1 min-h-0 overflow-hidden">
            <TabsContent value="insights" className="h-full m-0 mt-2">
              <InsightsPanel
                insights={insights}
                isLoading={isLoadingInsights}
                onEvidenceClick={onEvidenceClick}
                sessionId={sessionId}
                onInsightsGenerated={onInsightsGenerated}
              />
            </TabsContent>

            <TabsContent value="fork" className="h-full m-0 mt-2">
              <ForkPanel sessionId={sessionId} />
            </TabsContent>

            <TabsContent value="swarm" forceMount className="h-full m-0 mt-2">
              <SwarmView sessionId={sessionId} />
            </TabsContent>

            <TabsContent value="memory" className="h-full m-0 mt-2">
              <div className="h-full overflow-y-auto">
                <MemoryPanel sessionId={sessionId} />
              </div>
            </TabsContent>
          </div>
        </Tabs>
      </div>
    );
  }

  // Desktop: collapsed rail
  if (isCollapsed) {
    return (
      <aside
        className="w-14 border-l border-[var(--border)] bg-[var(--card)] flex flex-col h-full overflow-hidden transition-[width] duration-200 ease-out"
        role="complementary"
        aria-label="Analysis panel"
      >
        {/* Expand button */}
        <div className="p-2 flex justify-center border-b border-[var(--border)]">
          <Button
            variant="ghost"
            size="icon"
            onClick={onToggleCollapse}
            className="h-7 w-7"
            aria-expanded={false}
            aria-controls="right-panel-content"
            aria-label="Expand analysis panel"
          >
            <PanelRightOpen className="w-4 h-4" />
          </Button>
        </div>

        {/* Quick stats */}
        <div className="flex flex-col items-center gap-3 pt-3">
          {/* Insight count */}
          <Tooltip content={`${insightCount} insight${insightCount !== 1 ? "s" : ""}`} side="left">
            <div className="relative flex items-center justify-center w-8 h-8 rounded-md hover:bg-[var(--muted)] transition-colors">
              <Lightbulb className="w-4 h-4 text-amber-500" />
              {insightCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[16px] h-4 flex items-center justify-center rounded-full bg-amber-500 text-[9px] font-bold text-white px-1">
                  {insightCount > 99 ? "99+" : insightCount}
                </span>
              )}
            </div>
          </Tooltip>

          {/* Fork status */}
          <Tooltip content="Divergent Path Analysis" side="left">
            <div className="flex items-center justify-center w-8 h-8 rounded-md hover:bg-[var(--muted)] transition-colors">
              <GitFork className="w-4 h-4 text-violet-400" />
            </div>
          </Tooltip>

          {/* Memory status */}
          <Tooltip content="Memory Hierarchy" side="left">
            <div className="flex items-center justify-center w-8 h-8 rounded-md hover:bg-[var(--muted)] transition-colors">
              <Database className="w-4 h-4 text-cyan-400" />
            </div>
          </Tooltip>
        </div>

        {/* Screen reader status */}
        <div role="status" aria-live="polite" className="sr-only">
          Analysis panel collapsed. {insightCount} insight{insightCount !== 1 ? "s" : ""}.
        </div>
      </aside>
    );
  }

  // Desktop: expanded panel — Swarm moved to center tabs; Memory added here
  return (
    <aside
      id="right-panel-content"
      className="w-[28rem] border-l border-[var(--border)] bg-[var(--card)] flex flex-col h-full overflow-hidden transition-[width] duration-200 ease-out"
      role="complementary"
      aria-label="Analysis panel"
    >
      <Tabs defaultValue="insights" className="flex-1 flex flex-col min-h-0">
        <div className="flex items-center gap-2 px-3 mt-3">
          {/* Collapse button */}
          {onToggleCollapse && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onToggleCollapse}
              className="h-7 w-7 shrink-0"
              aria-expanded={true}
              aria-controls="right-panel-content"
              aria-label="Collapse analysis panel"
            >
              <PanelRightClose className="w-4 h-4" />
            </Button>
          )}

          {/* Tabs — fill remaining space */}
          <TabsList className="flex-1">
            <TabsTrigger value="insights" className="text-xs flex-1" data-tour="insights-tab">
              <Lightbulb className="w-3 h-3 mr-1" />
              Insights
            </TabsTrigger>
            <TabsTrigger value="fork" className="text-xs flex-1" data-tour="fork-tab">
              <GitFork className="w-3 h-3 mr-1" />
              Fork
            </TabsTrigger>
            <TabsTrigger value="memory" className="text-xs flex-1" data-tour="memory-tab">
              <Database className="w-3 h-3 mr-1" />
              Memory
            </TabsTrigger>
          </TabsList>
        </div>

        <div className="flex-1 min-h-0 overflow-hidden">
          <TabsContent value="insights" className="h-full m-0 mt-2">
            <InsightsPanel
              insights={insights}
              isLoading={isLoadingInsights}
              onEvidenceClick={onEvidenceClick}
              sessionId={sessionId}
              onInsightsGenerated={onInsightsGenerated}
            />
          </TabsContent>

          <TabsContent value="fork" className="h-full m-0 mt-2">
            <ForkPanel sessionId={sessionId} />
          </TabsContent>

          <TabsContent value="memory" className="h-full m-0 mt-2">
            <div className="h-full overflow-y-auto">
              <MemoryPanel sessionId={sessionId} />
            </div>
          </TabsContent>
        </div>
      </Tabs>
    </aside>
  );
}
