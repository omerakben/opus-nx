import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createLogger } from "@opus-nx/shared";
import { ThinkingEngine } from "./thinking-engine.js";
import {
  BRANCH_CONCLUSION_TOOL,
  COMPARISON_TOOL,
  FORK_STYLE_DESCRIPTIONS,
  type ForkStyle,
  type ForkBranchResult,
  type ThinkForkResult,
  type ThinkForkOptions,
  type ConvergencePoint,
  type DivergencePoint,
} from "./types/thinkfork.js";
import type { OrchestratorConfig, ToolUseBlock } from "./types/orchestrator.js";

const logger = createLogger("ThinkFork");

// ============================================================
// ThinkFork Engine Options
// ============================================================

export interface ThinkForkEngineOptions {
  /** Callback when a branch starts */
  onBranchStart?: (style: ForkStyle) => void;
  /** Callback when a branch completes */
  onBranchComplete?: (result: ForkBranchResult) => void;
  /** Callback for streaming thinking from any branch */
  onThinkingStream?: (style: ForkStyle, thinking: string) => void;
  /** Callback when comparison analysis starts */
  onComparisonStart?: () => void;
}

// ============================================================
// ThinkFork Engine
// ============================================================

/**
 * ThinkFork enables parallel reasoning with different cognitive styles.
 *
 * This is a unique capability of Opus Nx - spawning multiple thinking
 * streams that analyze the same problem from different perspectives:
 *
 * - Conservative: Minimize risk, prefer proven approaches
 * - Aggressive: Maximize opportunity, push boundaries
 * - Balanced: Find optimal tradeoffs
 * - Contrarian: Challenge assumptions, alternative views
 *
 * After parallel analysis, it synthesizes insights about where
 * approaches converge (robust conclusions) and diverge (important tensions).
 */
export class ThinkForkEngine {
  private prompts: Map<ForkStyle, string>;
  private comparisonPrompt: string;
  private options: ThinkForkEngineOptions;

  constructor(options: ThinkForkEngineOptions = {}) {
    this.options = options;
    this.prompts = this.loadPrompts();
    this.comparisonPrompt = this.loadComparisonPrompt();

    logger.debug("ThinkForkEngine initialized", {
      stylesLoaded: Array.from(this.prompts.keys()),
    });
  }

  /**
   * Execute parallel reasoning with multiple cognitive styles.
   *
   * This spawns N parallel thinking calls (one per style), then
   * synthesizes the results to identify convergence and divergence.
   */
  async fork(
    query: string,
    options: Partial<ThinkForkOptions> = {}
  ): Promise<ThinkForkResult> {
    const {
      styles = ["conservative", "aggressive", "balanced", "contrarian"],
      effort = "high",
      analyzeConvergence = true,
      additionalContext,
    } = options;

    logger.info("Starting ThinkFork analysis", {
      query: query.slice(0, 100),
      styles,
      effort,
    });

    const startTime = Date.now();

    // 1. Execute all branches in parallel
    const branchPromises = styles.map((style) =>
      this.executeBranch(style, query, effort, additionalContext)
    );

    const branches = await Promise.all(branchPromises);

    // 2. Analyze convergence/divergence if requested
    let convergencePoints: ConvergencePoint[] = [];
    let divergencePoints: DivergencePoint[] = [];
    let metaInsight = "";
    let recommendedApproach: ThinkForkResult["recommendedApproach"];

    if (analyzeConvergence && branches.length >= 2) {
      this.options.onComparisonStart?.();

      const comparison = await this.analyzeComparison(query, branches, effort);
      convergencePoints = comparison.convergencePoints;
      divergencePoints = comparison.divergencePoints;
      metaInsight = comparison.metaInsight;
      recommendedApproach = comparison.recommendedApproach;
    } else {
      metaInsight = this.generateBasicMetaInsight(branches);
    }

    const totalDurationMs = Date.now() - startTime;
    const totalTokensUsed = branches.reduce((sum, b) => sum + b.thinkingTokensUsed, 0);

    const result: ThinkForkResult = {
      query,
      branches,
      convergencePoints,
      divergencePoints,
      metaInsight,
      recommendedApproach,
      totalTokensUsed,
      totalDurationMs,
    };

    logger.info("ThinkFork analysis complete", {
      branchCount: branches.length,
      convergenceCount: convergencePoints.length,
      divergenceCount: divergencePoints.length,
      totalTokensUsed,
      totalDurationMs,
    });

    return result;
  }

  /**
   * Execute a single reasoning branch with a specific cognitive style.
   */
  private async executeBranch(
    style: ForkStyle,
    query: string,
    effort: "low" | "medium" | "high" | "max",
    additionalContext?: string
  ): Promise<ForkBranchResult> {
    const startTime = Date.now();

    this.options.onBranchStart?.(style);

    logger.debug(`Starting ${style} branch`, { effort });

    // Get the style-specific system prompt
    const systemPrompt = this.prompts.get(style);
    if (!systemPrompt) {
      throw new Error(`No prompt found for style: ${style}`);
    }

    // Build the user message
    const userMessage = additionalContext
      ? `${additionalContext}\n\n---\n\n${query}`
      : query;

    // Replace placeholder in system prompt
    const prompt = systemPrompt.replace("{QUERY}", "");

    // Create a ThinkingEngine for this branch
    const config: OrchestratorConfig = {
      model: "claude-opus-4-6-20260101",
      thinking: { type: "enabled", effort },
      streaming: true,
      maxTokens: 8192,
    };

    const engine = new ThinkingEngine({
      config,
      onThinkingStream: (thinking) => {
        this.options.onThinkingStream?.(style, thinking);
      },
    });

    // Execute the thinking request
    const result = await engine.think(
      prompt,
      [{ role: "user", content: userMessage }],
      [BRANCH_CONCLUSION_TOOL]
    );

    // Parse the tool output
    const branchResult = this.parseBranchResult(style, result.toolUseBlocks, result.usage.outputTokens);
    branchResult.durationMs = Date.now() - startTime;

    this.options.onBranchComplete?.(branchResult);

    logger.debug(`Completed ${style} branch`, {
      confidence: branchResult.confidence,
      durationMs: branchResult.durationMs,
    });

    return branchResult;
  }

  /**
   * Parse the tool output into a structured branch result.
   */
  private parseBranchResult(
    style: ForkStyle,
    toolUseBlocks: ToolUseBlock[],
    tokensUsed: number
  ): ForkBranchResult {
    // Find the record_conclusion tool call
    const conclusionTool = toolUseBlocks.find((t) => t.name === "record_conclusion");

    if (!conclusionTool) {
      logger.warn(`No conclusion tool found for ${style} branch`);
      return {
        style,
        conclusion: "Analysis completed but no structured conclusion was provided.",
        confidence: 0.5,
        keyInsights: [],
        thinkingTokensUsed: tokensUsed,
        durationMs: 0,
      };
    }

    const input = conclusionTool.input as Record<string, unknown>;

    return {
      style,
      conclusion: String(input.conclusion || ""),
      confidence: Math.min(1, Math.max(0, Number(input.confidence) || 0.5)),
      keyInsights: (input.key_insights as string[]) || [],
      risks: (input.risks as string[]) || undefined,
      opportunities: (input.opportunities as string[]) || undefined,
      assumptions: (input.assumptions as string[]) || undefined,
      thinkingTokensUsed: tokensUsed,
      durationMs: 0,
    };
  }

  /**
   * Analyze convergence and divergence between branches.
   */
  private async analyzeComparison(
    query: string,
    branches: ForkBranchResult[],
    effort: "low" | "medium" | "high" | "max"
  ): Promise<{
    convergencePoints: ConvergencePoint[];
    divergencePoints: DivergencePoint[];
    metaInsight: string;
    recommendedApproach?: ThinkForkResult["recommendedApproach"];
  }> {
    logger.debug("Starting comparison analysis");

    // Format branch results for the comparison prompt
    const branchSummaries = branches
      .map((b) => {
        return `## ${b.style.toUpperCase()} (Confidence: ${(b.confidence * 100).toFixed(0)}%)

**Conclusion**: ${b.conclusion}

**Key Insights**:
${b.keyInsights.map((i) => `- ${i}`).join("\n")}

${b.risks?.length ? `**Risks Identified**:\n${b.risks.map((r) => `- ${r}`).join("\n")}` : ""}

${b.opportunities?.length ? `**Opportunities**:\n${b.opportunities.map((o) => `- ${o}`).join("\n")}` : ""}

${b.assumptions?.length ? `**Assumptions**:\n${b.assumptions.map((a) => `- ${a}`).join("\n")}` : ""}
`;
      })
      .join("\n---\n\n");

    const prompt = this.comparisonPrompt.replace("{BRANCH_RESULTS}", branchSummaries);

    // Use a separate thinking engine for comparison
    const config: OrchestratorConfig = {
      model: "claude-opus-4-6-20260101",
      thinking: { type: "enabled", effort },
      streaming: true,
      maxTokens: 8192,
    };

    const engine = new ThinkingEngine({ config });

    const result = await engine.think(
      prompt,
      [{ role: "user", content: `Original query: ${query}` }],
      [COMPARISON_TOOL]
    );

    // Parse the comparison result
    return this.parseComparisonResult(result.toolUseBlocks);
  }

  /**
   * Parse the comparison tool output.
   */
  private parseComparisonResult(toolUseBlocks: ToolUseBlock[]): {
    convergencePoints: ConvergencePoint[];
    divergencePoints: DivergencePoint[];
    metaInsight: string;
    recommendedApproach?: ThinkForkResult["recommendedApproach"];
  } {
    const comparisonTool = toolUseBlocks.find((t) => t.name === "record_comparison");

    if (!comparisonTool) {
      logger.warn("No comparison tool found");
      return {
        convergencePoints: [],
        divergencePoints: [],
        metaInsight: "Comparison analysis did not produce structured results.",
      };
    }

    const input = comparisonTool.input as Record<string, unknown>;

    const convergencePoints: ConvergencePoint[] = (
      (input.convergence_points as Array<Record<string, unknown>>) || []
    ).map((p) => ({
      topic: String(p.topic || ""),
      agreementLevel: (p.agreement_level as ConvergencePoint["agreementLevel"]) || "partial",
      styles: (p.styles as ForkStyle[]) || [],
      summary: String(p.summary || ""),
    }));

    const divergencePoints: DivergencePoint[] = (
      (input.divergence_points as Array<Record<string, unknown>>) || []
    ).map((p) => ({
      topic: String(p.topic || ""),
      positions: ((p.positions as Array<Record<string, unknown>>) || []).map((pos) => ({
        style: pos.style as ForkStyle,
        position: String(pos.position || ""),
        confidence: Number(pos.confidence) || 0.5,
      })),
      significance: (p.significance as DivergencePoint["significance"]) || "medium",
      recommendation: p.recommendation ? String(p.recommendation) : undefined,
    }));

    const recommended = input.recommended_approach as Record<string, unknown> | undefined;

    return {
      convergencePoints,
      divergencePoints,
      metaInsight: String(input.meta_insight || ""),
      recommendedApproach: recommended
        ? {
            style: recommended.style as ForkStyle,
            rationale: String(recommended.rationale || ""),
            confidence: Number(recommended.confidence) || 0.5,
          }
        : undefined,
    };
  }

  /**
   * Generate a basic meta-insight without full comparison analysis.
   */
  private generateBasicMetaInsight(branches: ForkBranchResult[]): string {
    const avgConfidence = branches.reduce((sum, b) => sum + b.confidence, 0) / branches.length;
    const highConfidence = branches.filter((b) => b.confidence >= 0.8);
    const lowConfidence = branches.filter((b) => b.confidence < 0.6);

    if (highConfidence.length === branches.length) {
      return "All reasoning approaches reached high-confidence conclusions, suggesting a robust answer.";
    } else if (lowConfidence.length === branches.length) {
      return "All approaches show low confidence, indicating significant uncertainty in this problem.";
    } else {
      return `Mixed confidence across approaches (avg: ${(avgConfidence * 100).toFixed(0)}%). Consider exploring the divergence.`;
    }
  }

  /**
   * Load style-specific prompts from files.
   */
  private loadPrompts(): Map<ForkStyle, string> {
    const prompts = new Map<ForkStyle, string>();
    const __dirname = dirname(fileURLToPath(import.meta.url));
    const promptsDir = join(__dirname, "..", "..", "..", "configs", "prompts", "thinkfork");

    const styles: ForkStyle[] = ["conservative", "aggressive", "balanced", "contrarian"];

    for (const style of styles) {
      try {
        const promptPath = join(promptsDir, `${style}.md`);
        const prompt = readFileSync(promptPath, "utf-8");
        prompts.set(style, prompt);
        logger.debug(`Loaded prompt for ${style}`);
      } catch (error) {
        // Use fallback prompt if file not found
        prompts.set(style, this.getFallbackPrompt(style));
        logger.warn(`Using fallback prompt for ${style}`, {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return prompts;
  }

  /**
   * Load the comparison prompt.
   */
  private loadComparisonPrompt(): string {
    const __dirname = dirname(fileURLToPath(import.meta.url));
    const promptPath = join(__dirname, "..", "..", "..", "configs", "prompts", "thinkfork", "comparison.md");

    try {
      return readFileSync(promptPath, "utf-8");
    } catch (error) {
      logger.warn("Using fallback comparison prompt", {
        error: error instanceof Error ? error.message : String(error),
      });
      return this.getFallbackComparisonPrompt();
    }
  }

  /**
   * Fallback prompt for a style.
   */
  private getFallbackPrompt(style: ForkStyle): string {
    const description = FORK_STYLE_DESCRIPTIONS[style];
    return `You are analyzing a problem with a ${style} reasoning approach.

Your mindset: ${description}

Analyze the problem thoroughly, then use the record_conclusion tool to capture your conclusion, confidence level, and key insights.

{QUERY}`;
  }

  /**
   * Fallback comparison prompt.
   */
  private getFallbackComparisonPrompt(): string {
    return `You are analyzing conclusions from multiple reasoning approaches.

Compare the different perspectives and use the record_comparison tool to capture:
1. Points where approaches converge (agree)
2. Points where approaches diverge (disagree)
3. A meta-insight about what the comparison reveals
4. Optionally, which approach seems most suitable

{BRANCH_RESULTS}`;
  }
}

// ============================================================
// Factory Function
// ============================================================

/**
 * Create a new ThinkForkEngine instance.
 */
export function createThinkForkEngine(
  options?: ThinkForkEngineOptions
): ThinkForkEngine {
  return new ThinkForkEngine(options);
}
