"use client";

import { InsightsPanel } from "@/components/insights";
import { ForkPanel } from "@/components/fork";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui";
import type { Insight } from "@/lib/api";
import { GitFork, Lightbulb } from "lucide-react";

interface RightPanelProps {
  insights: Insight[];
  isLoadingInsights: boolean;
  sessionId: string | null;
  onEvidenceClick?: (nodeId: string) => void;
  isMobile?: boolean;
}

export function RightPanel({
  insights,
  isLoadingInsights,
  sessionId,
  onEvidenceClick,
  isMobile,
}: RightPanelProps) {
  if (isMobile) {
    return (
      <div className="h-full bg-[var(--background)] flex flex-col overflow-hidden">
        <Tabs defaultValue="insights" className="flex-1 flex flex-col">
          <TabsList className="mx-4 mt-3 justify-start">
            <TabsTrigger value="insights" className="text-xs">
              <Lightbulb className="w-3 h-3 mr-1" />
              Insights
            </TabsTrigger>
            <TabsTrigger value="fork" className="text-xs">
              <GitFork className="w-3 h-3 mr-1" />
              ThinkFork
            </TabsTrigger>
          </TabsList>

          <div className="flex-1 overflow-hidden">
            <TabsContent value="insights" className="h-full m-0 mt-2">
              <InsightsPanel
                insights={insights}
                isLoading={isLoadingInsights}
                onEvidenceClick={onEvidenceClick}
              />
            </TabsContent>

            <TabsContent value="fork" className="h-full m-0 mt-2">
              <ForkPanel sessionId={sessionId} />
            </TabsContent>
          </div>
        </Tabs>
      </div>
    );
  }

  return (
    <div className="w-80 border-l border-[var(--border)] bg-[var(--card)] flex flex-col h-full overflow-hidden">
      <Tabs defaultValue="insights" className="flex-1 flex flex-col">
        <TabsList className="mx-4 mt-3 justify-start">
          <TabsTrigger value="insights" className="text-xs">
            <Lightbulb className="w-3 h-3 mr-1" />
            Insights
          </TabsTrigger>
          <TabsTrigger value="fork" className="text-xs">
            <GitFork className="w-3 h-3 mr-1" />
            ThinkFork
          </TabsTrigger>
        </TabsList>

        <div className="flex-1 overflow-hidden">
          <TabsContent value="insights" className="h-full m-0 mt-2">
            <InsightsPanel
              insights={insights}
              isLoading={isLoadingInsights}
              onEvidenceClick={onEvidenceClick}
            />
          </TabsContent>

          <TabsContent value="fork" className="h-full m-0 mt-2">
            <ForkPanel sessionId={sessionId} />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
