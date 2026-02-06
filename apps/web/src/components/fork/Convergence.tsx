"use client";

import { cn } from "@/lib/utils";
import { Card, CardContent, Badge } from "@/components/ui";
import { FORK_COLORS, type ForkStyle } from "@/lib/colors";
import type { ForkResponse } from "@/lib/api";
import { CheckCircle, XCircle } from "lucide-react";

interface ConvergenceProps {
  convergence: ForkResponse["convergencePoints"];
  divergence: ForkResponse["divergencePoints"];
}

export function Convergence({ convergence, divergence }: ConvergenceProps) {
  return (
    <div className="space-y-3">
      {/* Convergence points */}
      {convergence.length > 0 && (
        <div>
          <div className="flex items-center gap-1.5 text-xs text-green-400 mb-2">
            <CheckCircle className="w-3.5 h-3.5" />
            Agreement ({convergence.length})
          </div>
          <div className="space-y-2">
            {convergence.map((point, i) => (
              <Card key={i} className="border-l-2 border-green-500">
                <CardContent className="p-2">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-medium text-[var(--foreground)]">
                      {point.topic}
                    </span>
                    <Badge
                      variant={
                        point.agreementLevel === "full"
                          ? "success"
                          : point.agreementLevel === "partial"
                          ? "warning"
                          : "secondary"
                      }
                      className="text-[9px] px-1 py-0"
                    >
                      {point.agreementLevel}
                    </Badge>
                  </div>
                  <p className="text-[11px] text-[var(--muted-foreground)]">
                    {point.summary}
                  </p>
                  <div className="flex gap-1 mt-1.5">
                    {point.styles.map((style) => (
                      <span
                        key={style}
                        className="w-2 h-2 rounded-full"
                        style={{
                          backgroundColor: FORK_COLORS[style as ForkStyle],
                        }}
                        title={style}
                      />
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Divergence points */}
      {divergence.length > 0 && (
        <div>
          <div className="flex items-center gap-1.5 text-xs text-red-400 mb-2">
            <XCircle className="w-3.5 h-3.5" />
            Disagreement ({divergence.length})
          </div>
          <div className="space-y-2">
            {divergence.map((point, i) => (
              <Card key={i} className="border-l-2 border-red-500">
                <CardContent className="p-2">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-medium text-[var(--foreground)]">
                      {point.topic}
                    </span>
                    <Badge
                      variant={
                        point.significance === "high"
                          ? "destructive"
                          : point.significance === "medium"
                          ? "warning"
                          : "secondary"
                      }
                      className="text-[9px] px-1 py-0"
                    >
                      {point.significance}
                    </Badge>
                  </div>
                  <div className="space-y-1 mt-1.5">
                    {point.positions.map((pos, j) => (
                      <div
                        key={j}
                        className="flex items-start gap-2 text-[10px]"
                      >
                        <span
                          className="w-2 h-2 rounded-full mt-0.5 flex-shrink-0"
                          style={{
                            backgroundColor: FORK_COLORS[pos.style as ForkStyle],
                          }}
                        />
                        <span className="text-[var(--foreground)]">
                          {pos.position}
                        </span>
                        <span className="text-[var(--muted-foreground)] ml-auto">
                          {Math.round(pos.confidence * 100)}%
                        </span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
