import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createLogger } from "@opus-nx/shared";
import { ThinkingEngine } from "./thinking-engine.js";
import {
  BRANCH_CONCLUSION_TOOL,
  COMPARISON_TOOL,
  FORK_STYLE_DESCRIPTIONS,
  ForkStyleSchema,
  ThinkForkOptionsSchema,
  DebateOptionsSchema,
  BranchSteeringActionSchema,
  type ForkStyle,
  type ForkBranchResult,
  type ThinkForkResult,
  type ThinkForkOptions,
  type ConvergencePoint,
  type DivergencePoint,
  type BranchGuidance,
  type BranchSteeringAction,
  type SteeringResult,
  type DebateOptions,
  type DebateResult,
  type DebateRoundEntry,
} from "./types/thinkfork.js";
import type { OrchestratorConfig, ToolUseBlock } from "./types/orchestrator.js";

const logger = createLogger("ThinkFork");

// Resolve prompts directory once at module load
const __dirname = dirname(fileURLToPath(import.meta.url));
const PROMPTS_DIR = join(__dirname, "..", "..", "..", "configs", "prompts", "thinkfork");

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
  /** Callback when a debate round starts */
  onDebateRoundStart?: (round: number, style: ForkStyle) => void;
  /** Callback when a debate round entry completes */
  onDebateRoundComplete?: (entry: DebateRoundEntry) => void;
}

// Tool for structured debate responses
const DEBATE_RESPONSE_TOOL = {
  name: "record_debate_response",
  description: "Record your response to the other branches' conclusions in this debate round.",
  input_schema: {
    type: "object" as const,
    properties: {
      response: {
        type: "string",
        description: "Your response to the other branches' arguments (2-4 sentences)",
      },
      confidence: {
        type: "number",
        description: "Your updated confidence level (0.0-1.0) after considering counterarguments",
      },
      position_changed: {
        type: "boolean",
        description: "Whether your position has changed from the previous round",
      },
      key_counterpoints: {
        type: "array",
        items: { type: "string" },
        description: "Key counterpoints you're making against other branches",
      },
      concessions: {
        type: "array",
        items: { type: "string" },
        description: "Points where you concede the other branches are correct or have merit",
      },
    },
    required: ["response", "confidence", "position_changed", "key_counterpoints", "concessions"],
  },
};

// ============================================================
// ThinkFork Engine
// ============================================================

/**
 * ThinkFork enables concurrent reasoning with different cognitive styles.
 *
 * This spawns multiple concurrent API calls that analyze the same problem
 * from different perspectives (not true parallelism - JavaScript is single-threaded):
 *
 * - Conservative: Minimize risk, prefer proven approaches
 * - Aggressive: Maximize opportunity, push boundaries
 * - Balanced: Find optimal tradeoffs
 * - Contrarian: Challenge assumptions, alternative views
 *
 * After concurrent analysis, it synthesizes insights about where
 * approaches converge (robust conclusions) and diverge (important tensions).
 */
export class ThinkForkEngine {
  private prompts: Map<ForkStyle, string>;
  private comparisonPrompt: string;
  private options: ThinkForkEngineOptions;
  private fallbackPromptsUsed: Set<ForkStyle> = new Set();

  constructor(options: ThinkForkEngineOptions = {}) {
    this.options = options;
    this.prompts = this.loadPrompts();
    this.comparisonPrompt = this.loadComparisonPrompt();

    logger.debug("ThinkForkEngine initialized", {
      stylesLoaded: Array.from(this.prompts.keys()),
      fallbacksUsed: Array.from(this.fallbackPromptsUsed),
    });
  }

  /**
   * Execute concurrent reasoning with multiple cognitive styles.
   *
   * Spawns N concurrent API calls (one per style), then synthesizes
   * the results to identify convergence and divergence.
   */
  async fork(
    query: string,
    options: Partial<ThinkForkOptions> = {}
  ): Promise<ThinkForkResult> {
    // Validate inputs using Zod schema
    const parseResult = ThinkForkOptionsSchema.safeParse(options);
    if (!parseResult.success) {
      const errorMessages = parseResult.error.errors.map(
        (e) => `${e.path.join(".")}: ${e.message}`
      );
      logger.error("Invalid fork options", { errors: errorMessages });
      throw new Error(`Invalid ThinkFork options: ${errorMessages.join(", ")}`);
    }

    // Validate query
    if (!query || query.trim().length === 0) {
      throw new Error("Query cannot be empty");
    }

    const {
      styles = ["conservative", "aggressive", "balanced", "contrarian"],
      effort = "high",
      analyzeConvergence = true,
      additionalContext,
      branchGuidance,
    } = parseResult.data;

    logger.info("Starting ThinkFork analysis", {
      query: query.slice(0, 100),
      styles,
      effort,
    });

    const startTime = Date.now();
    const errors: string[] = [];

    // Build guidance map for quick lookup
    const guidanceMap = new Map<ForkStyle, string>();
    if (branchGuidance) {
      for (const g of branchGuidance) {
        guidanceMap.set(g.style, g.guidance);
      }
      logger.info("Human guidance applied", {
        guidedStyles: Array.from(guidanceMap.keys()),
      });
    }

    // 1. Execute all branches concurrently (with per-branch human guidance)
    // FIX: Use Promise.allSettled instead of Promise.all for resilience.
    // This ensures partial results are returned even if some branches fail
    // due to unexpected errors (OOM, stack overflow, etc.) that escape
    // the internal try-catch in executeBranch.
    const branchPromises = styles.map((style) =>
      this.executeBranch(style, query, effort, additionalContext, guidanceMap.get(style))
    );

    const settledResults = await Promise.allSettled(branchPromises);

    // Process settled results - extract successful branches and handle rejections
    const branches: ForkBranchResult[] = [];
    for (let i = 0; i < settledResults.length; i++) {
      const result = settledResults[i];
      const style = styles[i];

      if (result.status === "fulfilled") {
        branches.push(result.value);
        // Collect errors from branches that completed but have internal errors
        if (result.value.error) {
          errors.push(`${result.value.style}: ${result.value.error}`);
        }
      } else {
        // Handle unexpected rejections (should be rare since executeBranch catches errors)
        const errorMsg = result.reason instanceof Error
          ? result.reason.message
          : String(result.reason);
        logger.error(`Branch ${style} rejected unexpectedly`, { error: errorMsg });
        errors.push(`${style}: Unexpected failure - ${errorMsg}`);

        // Create a failed branch result so we have consistent output
        branches.push(this.createFailedBranchResult(
          style,
          `Unexpected failure: ${errorMsg}`,
          0
        ));
      }
    }

    // 2. Analyze convergence/divergence if requested
    let convergencePoints: ConvergencePoint[] = [];
    let divergencePoints: DivergencePoint[] = [];
    let metaInsight = "";
    let recommendedApproach: ThinkForkResult["recommendedApproach"];

    // Only analyze if we have at least 2 successful branches
    const successfulBranches = branches.filter((b) => !b.error);
    if (analyzeConvergence && successfulBranches.length >= 2) {
      this.options.onComparisonStart?.();

      try {
        const comparison = await this.analyzeComparison(query, successfulBranches, effort);
        convergencePoints = comparison.convergencePoints;
        divergencePoints = comparison.divergencePoints;
        metaInsight = comparison.metaInsight;
        recommendedApproach = comparison.recommendedApproach;
        if (comparison.error) {
          errors.push(comparison.error);
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        logger.error("Comparison analysis failed", { error: errorMsg });
        errors.push(`Comparison analysis failed: ${errorMsg}`);
        metaInsight = this.generateBasicMetaInsight(successfulBranches);
      }
    } else {
      metaInsight = this.generateBasicMetaInsight(branches);
    }

    const totalDurationMs = Date.now() - startTime;
    const totalTokensUsed = branches.reduce((sum, b) => sum + b.outputTokensUsed, 0);

    const result: ThinkForkResult = {
      query,
      branches,
      convergencePoints,
      divergencePoints,
      metaInsight,
      recommendedApproach,
      totalTokensUsed,
      totalDurationMs,
      errors: errors.length > 0 ? errors : undefined,
      fallbackPromptsUsed: this.fallbackPromptsUsed.size > 0
        ? Array.from(this.fallbackPromptsUsed)
        : undefined,
      appliedGuidance: branchGuidance,
    };

    logger.info("ThinkFork analysis complete", {
      branchCount: branches.length,
      successfulBranches: successfulBranches.length,
      convergenceCount: convergencePoints.length,
      divergenceCount: divergencePoints.length,
      totalTokensUsed,
      totalDurationMs,
      errorCount: errors.length,
    });

    return result;
  }

  /**
   * Execute a single reasoning branch with a specific cognitive style.
   *
   * Creates a dedicated ThinkingEngine instance and executes a thinking
   * request with the style-specific system prompt. Handles errors gracefully
   * by returning a failed branch result rather than throwing.
   */
  private async executeBranch(
    style: ForkStyle,
    query: string,
    effort: "low" | "medium" | "high" | "max",
    additionalContext?: string,
    humanGuidance?: string
  ): Promise<ForkBranchResult> {
    const startTime = Date.now();

    this.options.onBranchStart?.(style);
    logger.debug(`Starting ${style} branch`, { effort, hasGuidance: !!humanGuidance });

    const systemPrompt = this.prompts.get(style);
    if (!systemPrompt) {
      const error = `No prompt found for style: ${style}`;
      logger.error(error);
      return this.createFailedBranchResult(style, error, Date.now() - startTime);
    }

    // Build user message with optional context and human guidance
    let userMessage = query;
    if (additionalContext) {
      userMessage = `${additionalContext}\n\n---\n\n${userMessage}`;
    }
    if (humanGuidance) {
      userMessage = `## Human Guidance for Your Analysis\n\nA human collaborator has provided the following direction for your ${style} perspective:\n\n> ${humanGuidance}\n\nPlease incorporate this guidance into your analysis while maintaining your ${style} reasoning style.\n\n---\n\n${userMessage}`;
    }

    try {
      const engine = new ThinkingEngine({
        config: this.createThinkingConfig(effort),
        onThinkingStream: (thinking) => {
          this.options.onThinkingStream?.(style, thinking);
        },
      });

      const result = await engine.think(
        systemPrompt,
        [{ role: "user", content: userMessage }],
        [BRANCH_CONCLUSION_TOOL]
      );

      const branchResult = this.parseBranchResult(style, result.toolUseBlocks, result.usage.outputTokens);
      branchResult.durationMs = Date.now() - startTime;

      this.options.onBranchComplete?.(branchResult);

      logger.debug(`Completed ${style} branch`, {
        confidence: branchResult.confidence,
        durationMs: branchResult.durationMs,
        hasError: !!branchResult.error,
      });

      return branchResult;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error(`Branch ${style} failed`, { error: errorMsg });

      // Provide actionable error messages
      let errorDetail = `Branch execution failed: ${errorMsg}`;
      if (errorMsg.includes("rate limit") || errorMsg.includes("429")) {
        errorDetail = "API rate limit exceeded. Please wait and retry.";
      } else if (errorMsg.includes("401") || errorMsg.includes("authentication")) {
        errorDetail = "Invalid API key. Check ANTHROPIC_API_KEY.";
      } else if (errorMsg.includes("timeout")) {
        errorDetail = "Request timed out.";
      }

      const failedResult = this.createFailedBranchResult(style, errorDetail, Date.now() - startTime);
      this.options.onBranchComplete?.(failedResult);
      return failedResult;
    }
  }

  /**
   * Create a failed branch result with zero confidence.
   */
  private createFailedBranchResult(
    style: ForkStyle,
    error: string,
    durationMs: number
  ): ForkBranchResult {
    return {
      style,
      conclusion: "",
      confidence: 0,
      keyInsights: [],
      outputTokensUsed: 0,
      durationMs,
      error,
    };
  }

  /**
   * Parse the tool output into a structured branch result.
   * Uses safe type coercion and validates the response structure.
   */
  private parseBranchResult(
    style: ForkStyle,
    toolUseBlocks: ToolUseBlock[],
    tokensUsed: number
  ): ForkBranchResult {
    const conclusionTool = toolUseBlocks.find((t) => t.name === "record_conclusion");

    if (!conclusionTool) {
      logger.error(`No conclusion tool found for ${style} branch`, {
        availableTools: toolUseBlocks.map((t) => t.name),
      });
      return {
        style,
        conclusion: "",
        confidence: 0,
        keyInsights: [],
        outputTokensUsed: tokensUsed,
        durationMs: 0,
        error: "Model did not provide structured conclusion",
      };
    }

    const input = conclusionTool.input as Record<string, unknown>;

    // Safe number parsing that handles 0 correctly
    const rawConfidence = Number(input.confidence);
    const confidence = Number.isNaN(rawConfidence)
      ? 0.5
      : Math.min(1, Math.max(0, rawConfidence));

    // Validate key_insights is an array
    const keyInsights = Array.isArray(input.key_insights)
      ? input.key_insights.filter((i): i is string => typeof i === "string")
      : [];

    if (keyInsights.length === 0) {
      logger.warn(`${style} branch returned no key insights`);
    }

    return {
      style,
      conclusion: String(input.conclusion ?? ""),
      confidence,
      keyInsights,
      risks: Array.isArray(input.risks)
        ? input.risks.filter((r): r is string => typeof r === "string")
        : undefined,
      opportunities: Array.isArray(input.opportunities)
        ? input.opportunities.filter((o): o is string => typeof o === "string")
        : undefined,
      assumptions: Array.isArray(input.assumptions)
        ? input.assumptions.filter((a): a is string => typeof a === "string")
        : undefined,
      outputTokensUsed: tokensUsed,
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
    error?: string;
  }> {
    logger.debug("Starting comparison analysis", { branchCount: branches.length });

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

    const engine = new ThinkingEngine({
      config: this.createThinkingConfig(effort),
    });

    const result = await engine.think(
      prompt,
      [{ role: "user", content: `Original query: ${query}` }],
      [COMPARISON_TOOL]
    );

    return this.parseComparisonResult(result.toolUseBlocks);
  }

  /**
   * Parse the comparison tool output with safe type coercion.
   */
  private parseComparisonResult(toolUseBlocks: ToolUseBlock[]): {
    convergencePoints: ConvergencePoint[];
    divergencePoints: DivergencePoint[];
    metaInsight: string;
    recommendedApproach?: ThinkForkResult["recommendedApproach"];
    error?: string;
  } {
    const comparisonTool = toolUseBlocks.find((t) => t.name === "record_comparison");

    if (!comparisonTool) {
      logger.error("No comparison tool found", {
        availableTools: toolUseBlocks.map((t) => t.name),
      });
      return {
        convergencePoints: [],
        divergencePoints: [],
        metaInsight: "",
        error: "Comparison analysis did not produce structured results",
      };
    }

    const input = comparisonTool.input as Record<string, unknown>;

    const convergencePoints: ConvergencePoint[] = (
      Array.isArray(input.convergence_points) ? input.convergence_points : []
    ).map((p: Record<string, unknown>) => {
      // Validate agreement_level enum
      const level = String(p.agreement_level ?? "partial");
      const validLevels = ["full", "partial", "none"] as const;
      const agreementLevel = validLevels.includes(level as typeof validLevels[number])
        ? (level as ConvergencePoint["agreementLevel"])
        : "partial";

      // Validate styles array
      const rawStyles = Array.isArray(p.styles) ? p.styles : [];
      const styles = rawStyles.filter((s): s is ForkStyle => {
        const result = ForkStyleSchema.safeParse(s);
        return result.success;
      });

      return {
        topic: String(p.topic ?? ""),
        agreementLevel,
        styles,
        summary: String(p.summary ?? ""),
      };
    });

    const divergencePoints: DivergencePoint[] = (
      Array.isArray(input.divergence_points) ? input.divergence_points : []
    ).map((p: Record<string, unknown>) => {
      // Validate significance enum
      const sig = String(p.significance ?? "medium");
      const validSigs = ["high", "medium", "low"] as const;
      const significance = validSigs.includes(sig as typeof validSigs[number])
        ? (sig as DivergencePoint["significance"])
        : "medium";

      // Parse positions with safe type coercion
      const positions = (
        Array.isArray(p.positions) ? p.positions : []
      ).map((pos: Record<string, unknown>) => {
        const styleResult = ForkStyleSchema.safeParse(pos.style);
        const rawConf = Number(pos.confidence);
        return {
          style: styleResult.success ? styleResult.data : ("balanced" as ForkStyle),
          position: String(pos.position ?? ""),
          confidence: Number.isNaN(rawConf) ? 0.5 : Math.min(1, Math.max(0, rawConf)),
        };
      });

      return {
        topic: String(p.topic ?? ""),
        positions,
        significance,
        recommendation: p.recommendation ? String(p.recommendation) : undefined,
      };
    });

    const recommended = input.recommended_approach as Record<string, unknown> | undefined;
    let recommendedApproach: ThinkForkResult["recommendedApproach"];

    if (recommended) {
      const styleResult = ForkStyleSchema.safeParse(recommended.style);
      const rawConf = Number(recommended.confidence);
      if (styleResult.success) {
        recommendedApproach = {
          style: styleResult.data,
          rationale: String(recommended.rationale ?? ""),
          confidence: Number.isNaN(rawConf) ? 0.5 : Math.min(1, Math.max(0, rawConf)),
        };
      }
    }

    return {
      convergencePoints,
      divergencePoints,
      metaInsight: String(input.meta_insight ?? ""),
      recommendedApproach,
    };
  }

  /**
   * Generate a basic meta-insight without full comparison analysis.
   * Used when analyzeConvergence is disabled or when fewer than 2 branches succeeded.
   */
  private generateBasicMetaInsight(branches: ForkBranchResult[]): string {
    // Guard against empty array (division by zero)
    if (branches.length === 0) {
      return "No branches were analyzed.";
    }

    const successfulBranches = branches.filter((b) => !b.error);
    if (successfulBranches.length === 0) {
      return "All branches failed. Please check the errors and retry.";
    }

    const avgConfidence = successfulBranches.reduce((sum, b) => sum + b.confidence, 0) / successfulBranches.length;
    const allHighConfidence = successfulBranches.every((b) => b.confidence >= 0.8);
    const allLowConfidence = successfulBranches.every((b) => b.confidence < 0.6);

    if (allHighConfidence) {
      return "All reasoning approaches reached high-confidence conclusions, suggesting a robust answer.";
    }
    if (allLowConfidence) {
      return "All approaches show low confidence, indicating significant uncertainty in this problem.";
    }
    return `Mixed confidence across approaches (avg: ${(avgConfidence * 100).toFixed(0)}%). Consider exploring the divergence.`;
  }

  // ============================================================
  // Steering Methods (Post-Analysis Human Actions)
  // ============================================================

  /**
   * Steer a fork analysis based on human feedback.
   *
   * Supports four actions:
   * - expand: Deeper analysis of a specific branch
   * - merge: Synthesize multiple branches into a unified approach
   * - challenge: Challenge a branch's conclusion with a counter-argument
   * - refork: Re-run all branches with new context
   */
  async steer(
    originalResult: ThinkForkResult,
    action: BranchSteeringAction
  ): Promise<SteeringResult> {
    const parseResult = BranchSteeringActionSchema.safeParse(action);
    if (!parseResult.success) {
      throw new Error(`Invalid steering action: ${parseResult.error.message}`);
    }

    const startTime = Date.now();
    logger.info("Executing steering action", { action: action.action });

    switch (action.action) {
      case "expand":
        return this.executeExpand(originalResult, action.style, action.direction);
      case "merge":
        return this.executeMerge(originalResult, action.styles, action.focusArea);
      case "challenge":
        return this.executeChallenge(originalResult, action.style, action.challenge);
      case "refork": {
        // Re-run with new context
        const reforkResult = await this.fork(originalResult.query, {
          additionalContext: action.newContext,
          effort: "high",
        });
        return {
          action: "refork",
          result: reforkResult.metaInsight,
          confidence: reforkResult.recommendedApproach?.confidence ?? 0.5,
          keyInsights: reforkResult.branches.flatMap((b) => b.keyInsights.slice(0, 2)),
          tokensUsed: reforkResult.totalTokensUsed,
          durationMs: Date.now() - startTime,
        };
      }
    }
  }

  /**
   * Expand a specific branch with deeper analysis.
   */
  private async executeExpand(
    originalResult: ThinkForkResult,
    style: ForkStyle,
    direction?: string
  ): Promise<SteeringResult> {
    const startTime = Date.now();
    const branch = originalResult.branches.find((b) => b.style === style);
    if (!branch) {
      throw new Error(`Branch not found: ${style}`);
    }

    const expandPrompt = `You previously analyzed a problem with a ${style} perspective and reached this conclusion:

"${branch.conclusion}"

Key insights: ${branch.keyInsights.join("; ")}

${direction ? `The human collaborator wants you to explore further: "${direction}"` : "Please provide a deeper, more detailed analysis."}

Expand on your reasoning with additional detail, evidence, and implications. Use the record_conclusion tool to capture your expanded analysis.`;

    const engine = new ThinkingEngine({
      config: this.createThinkingConfig("max"),
    });

    const result = await engine.think(
      this.prompts.get(style) ?? this.getFallbackPrompt(style),
      [{ role: "user", content: expandPrompt }],
      [BRANCH_CONCLUSION_TOOL]
    );

    const parsed = this.parseBranchResult(style, result.toolUseBlocks, result.usage.outputTokens);

    return {
      action: "expand",
      result: parsed.conclusion,
      confidence: parsed.confidence,
      keyInsights: parsed.keyInsights,
      expandedAnalysis: parsed.conclusion,
      tokensUsed: result.usage.outputTokens,
      durationMs: Date.now() - startTime,
    };
  }

  /**
   * Merge multiple branches into a unified approach.
   */
  private async executeMerge(
    originalResult: ThinkForkResult,
    styles: ForkStyle[],
    focusArea?: string
  ): Promise<SteeringResult> {
    const startTime = Date.now();
    const selectedBranches = originalResult.branches.filter((b) =>
      styles.includes(b.style as ForkStyle)
    );

    if (selectedBranches.length < 2) {
      throw new Error("Need at least 2 branches to merge");
    }

    const branchSummaries = selectedBranches
      .map((b) => `**${b.style}** (${Math.round(b.confidence * 100)}%): ${b.conclusion}\nInsights: ${b.keyInsights.join("; ")}`)
      .join("\n\n");

    const mergePrompt = `Multiple reasoning perspectives have been applied to this problem:

${branchSummaries}

${focusArea ? `Focus area for synthesis: "${focusArea}"` : ""}

Synthesize these perspectives into a unified, actionable approach that takes the best elements from each. Use the record_conclusion tool to capture the merged analysis.`;

    const engine = new ThinkingEngine({
      config: this.createThinkingConfig("high"),
    });

    const result = await engine.think(
      "You are a synthesis expert. Merge multiple reasoning perspectives into a coherent unified approach.",
      [{ role: "user", content: mergePrompt }],
      [BRANCH_CONCLUSION_TOOL]
    );

    const parsed = this.parseBranchResult("balanced", result.toolUseBlocks, result.usage.outputTokens);

    return {
      action: "merge",
      result: parsed.conclusion,
      confidence: parsed.confidence,
      keyInsights: parsed.keyInsights,
      synthesizedApproach: parsed.conclusion,
      tokensUsed: result.usage.outputTokens,
      durationMs: Date.now() - startTime,
    };
  }

  /**
   * Challenge a branch's conclusion with a counter-argument.
   */
  private async executeChallenge(
    originalResult: ThinkForkResult,
    style: ForkStyle,
    challenge: string
  ): Promise<SteeringResult> {
    const startTime = Date.now();
    const branch = originalResult.branches.find((b) => b.style === style);
    if (!branch) {
      throw new Error(`Branch not found: ${style}`);
    }

    const challengePrompt = `Your ${style} analysis concluded:

"${branch.conclusion}"

A human collaborator challenges this conclusion:

"${challenge}"

Respond to this challenge. If the challenge has merit, revise your conclusion. If not, defend your position with stronger arguments. Use the record_conclusion tool to capture your response.`;

    const engine = new ThinkingEngine({
      config: this.createThinkingConfig("high"),
    });

    const result = await engine.think(
      this.prompts.get(style) ?? this.getFallbackPrompt(style),
      [{ role: "user", content: challengePrompt }],
      [BRANCH_CONCLUSION_TOOL]
    );

    const parsed = this.parseBranchResult(style, result.toolUseBlocks, result.usage.outputTokens);

    return {
      action: "challenge",
      result: parsed.conclusion,
      confidence: parsed.confidence,
      keyInsights: parsed.keyInsights,
      challengeResponse: parsed.conclusion,
      tokensUsed: result.usage.outputTokens,
      durationMs: Date.now() - startTime,
    };
  }

  /**
   * Create a ThinkingEngine config with the specified effort level.
   * maxTokens scales with effort to balance cost and reasoning depth.
   */
  private createThinkingConfig(effort: "low" | "medium" | "high" | "max"): OrchestratorConfig {
    const EFFORT_MAX_TOKENS: Record<string, number> = {
      low: 4096,
      medium: 8192,
      high: 16384,
      max: 32768,
    };

    return {
      model: "claude-opus-4-6",
      thinking: { type: "adaptive", effort },
      streaming: true,
      maxTokens: EFFORT_MAX_TOKENS[effort] ?? 16384,
    };
  }

  /**
   * Load style-specific prompts from files.
   */
  private loadPrompts(): Map<ForkStyle, string> {
    const prompts = new Map<ForkStyle, string>();
    const styles: ForkStyle[] = ["conservative", "aggressive", "balanced", "contrarian"];

    for (const style of styles) {
      const prompt = this.loadPromptFile(`${style}.md`, () => {
        this.fallbackPromptsUsed.add(style);
        return this.getFallbackPrompt(style);
      });
      prompts.set(style, prompt);
    }

    return prompts;
  }

  /**
   * Load the comparison prompt.
   */
  private loadComparisonPrompt(): string {
    return this.loadPromptFile("comparison.md", () => this.getFallbackComparisonPrompt());
  }

  /**
   * Load a prompt file with fallback support.
   */
  private loadPromptFile(filename: string, getFallback: () => string): string {
    const promptPath = join(PROMPTS_DIR, filename);
    try {
      const prompt = readFileSync(promptPath, "utf-8");
      logger.debug(`Loaded prompt: ${filename}`);
      return prompt;
    } catch (error) {
      logger.warn(`Using fallback prompt for ${filename}`, {
        error: error instanceof Error ? error.message : String(error),
      });
      return getFallback();
    }
  }

  /**
   * Fallback prompt for a style.
   */
  private getFallbackPrompt(style: ForkStyle): string {
    const description = FORK_STYLE_DESCRIPTIONS[style];
    return `You are analyzing a problem with a ${style} reasoning approach.

Your mindset: ${description}

Analyze the problem thoroughly, then use the record_conclusion tool to capture your conclusion, confidence level, and key insights.`;
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

  // ============================================================
  // Debate Mode (Agent Teams-inspired competing hypotheses)
  // ============================================================

  /**
   * Run a multi-round debate between reasoning branches.
   *
   * Inspired by Agent Teams' competing-hypotheses pattern, this method:
   * 1. First runs a standard fork to get initial positions
   * 2. Then runs multiple debate rounds where each branch:
   *    - Sees all other branches' latest conclusions
   *    - Can challenge, concede, or refine their position
   *    - Records counterpoints and concessions
   * 3. After all rounds, synthesizes a final consensus (if one emerges)
   *
   * This is powerful for:
   * - High-stakes decisions where multiple perspectives matter
   * - Identifying hidden assumptions through adversarial probing
   * - Building confidence through stress-testing conclusions
   */
  async debate(
    query: string,
    options: Partial<DebateOptions> = {}
  ): Promise<DebateResult> {
    const parsed = DebateOptionsSchema.parse(options);
    const startTime = Date.now();
    let totalTokens = 0;

    logger.info("Starting debate mode", {
      query: query.slice(0, 100),
      rounds: parsed.rounds,
      styles: parsed.styles,
    });

    // Step 1: Run initial fork to get starting positions
    const initialFork = await this.fork(query, {
      styles: parsed.styles,
      effort: parsed.effort,
      analyzeConvergence: true,
    });
    totalTokens += initialFork.totalTokensUsed;

    // Build current positions from initial fork results
    const currentPositions = new Map<ForkStyle, {
      conclusion: string;
      confidence: number;
      keyInsights: string[];
    }>();

    for (const branch of initialFork.branches) {
      if (!branch.error) {
        currentPositions.set(branch.style, {
          conclusion: branch.conclusion,
          confidence: branch.confidence,
          keyInsights: branch.keyInsights,
        });
      }
    }

    // Step 2: Run debate rounds
    const allRoundEntries: DebateRoundEntry[] = [];

    for (let round = 1; round <= parsed.rounds; round++) {
      logger.info(`Starting debate round ${round}/${parsed.rounds}`);

      // Each branch responds to all other branches' positions
      const roundPromises = parsed.styles
        .filter((s) => currentPositions.has(s))
        .map((style) =>
          this.executeDebateRound(query, style, round, currentPositions, parsed.effort)
        );

      const roundResults = await Promise.allSettled(roundPromises);

      for (const result of roundResults) {
        if (result.status === "fulfilled" && result.value) {
          const entry = result.value;
          allRoundEntries.push(entry);
          totalTokens += entry.response.length; // approximate

          // Update position if it changed
          currentPositions.set(entry.style, {
            conclusion: entry.response,
            confidence: entry.confidence,
            keyInsights: entry.keyCounterpoints,
          });

          this.options.onDebateRoundComplete?.(entry);
        }
      }
    }

    // Step 3: Determine final positions and consensus
    const finalPositions = parsed.styles
      .filter((s) => currentPositions.has(s))
      .map((style) => {
        const pos = currentPositions.get(style)!;
        const initialBranch = initialFork.branches.find((b) => b.style === style);
        return {
          style,
          conclusion: pos.conclusion,
          confidence: pos.confidence,
          changedFromInitial: initialBranch?.conclusion !== pos.conclusion,
        };
      });

    // Check for consensus: if all branches converge above 0.7 confidence
    // and no more position changes in the last round
    const lastRoundEntries = allRoundEntries.filter((e) => e.round === parsed.rounds);
    const allStableInLastRound = lastRoundEntries.every((e) => !e.positionChanged);
    const allHighConfidence = finalPositions.every((p) => p.confidence >= 0.7);

    let consensus: string | undefined;
    let consensusConfidence: number | undefined;

    if (allStableInLastRound && allHighConfidence && finalPositions.length > 0) {
      // Branches converged — synthesize a consensus
      consensus = finalPositions.map((p) =>
        `[${p.style}] ${p.conclusion}`
      ).join("\n\n");
      consensusConfidence = finalPositions.reduce((sum, p) => sum + p.confidence, 0) / finalPositions.length;
    }

    const totalDurationMs = Date.now() - startTime;

    logger.info("Debate completed", {
      rounds: parsed.rounds,
      totalEntries: allRoundEntries.length,
      hasConsensus: !!consensus,
      consensusConfidence,
      positionsChanged: finalPositions.filter((p) => p.changedFromInitial).length,
      totalDurationMs,
    });

    return {
      query,
      initialFork,
      rounds: allRoundEntries,
      finalPositions,
      consensus,
      consensusConfidence,
      totalRounds: parsed.rounds,
      totalTokensUsed: totalTokens,
      totalDurationMs,
    };
  }

  /**
   * Execute a single debate round for one branch.
   */
  private async executeDebateRound(
    query: string,
    style: ForkStyle,
    round: number,
    currentPositions: Map<ForkStyle, { conclusion: string; confidence: number; keyInsights: string[] }>,
    effort: "low" | "medium" | "high" | "max"
  ): Promise<DebateRoundEntry> {
    this.options.onDebateRoundStart?.(round, style);

    const config = this.createThinkingConfig(effort);
    const engine = new ThinkingEngine({ config });

    // Build the debate prompt with other branches' positions
    const otherPositions = Array.from(currentPositions.entries())
      .filter(([s]) => s !== style)
      .map(([s, pos]) =>
        `### ${s.charAt(0).toUpperCase() + s.slice(1)} Branch (confidence: ${(pos.confidence * 100).toFixed(0)}%)\n${pos.conclusion}\n\nKey insights:\n${pos.keyInsights.map((i) => `- ${i}`).join("\n")}`
      )
      .join("\n\n---\n\n");

    const myPosition = currentPositions.get(style);

    const debatePrompt = `## Debate Round ${round}

You are the **${style}** perspective in a structured debate about:

> ${query}

### Your Current Position (confidence: ${((myPosition?.confidence ?? 0.5) * 100).toFixed(0)}%)
${myPosition?.conclusion ?? "No position yet."}

### Other Branches' Positions

${otherPositions}

### Your Task

As the ${style} perspective (${FORK_STYLE_DESCRIPTIONS[style]}):

1. **Evaluate** the other branches' arguments — which points are strong?
2. **Challenge** weak points in their reasoning
3. **Concede** where they make valid points you hadn't considered
4. **Refine** your own position based on this exchange
5. Use the \`record_debate_response\` tool to capture your updated position

Be intellectually honest — it's better to change your mind when warranted than to stubbornly defend a weak position.`;

    const systemPrompt = `You are engaging in a structured intellectual debate from the ${style} perspective. ${FORK_STYLE_DESCRIPTIONS[style]}. Think deeply about the arguments presented and respond with intellectual rigor and honesty.`;

    const startTime = Date.now();

    try {
      const result = await engine.think(
        systemPrompt,
        [{ role: "user", content: debatePrompt }],
        [DEBATE_RESPONSE_TOOL]
      );

      // Extract debate response from tool use
      const toolUse = result.toolUseBlocks.find((b) => b.name === "record_debate_response");
      if (toolUse) {
        const input = toolUse.input as {
          response: string;
          confidence: number;
          position_changed: boolean;
          key_counterpoints: string[];
          concessions: string[];
        };

        return {
          style,
          round,
          response: String(input.response),
          confidence: Math.min(1, Math.max(0, Number(input.confidence) || 0.5)),
          positionChanged: Boolean(input.position_changed),
          keyCounterpoints: (input.key_counterpoints || []).map(String),
          concessions: (input.concessions || []).map(String),
        };
      }

      // Fallback: extract from text
      const textResponse = result.textBlocks.map((b) => b.text).join("\n");
      return {
        style,
        round,
        response: textResponse.slice(0, 1000),
        confidence: myPosition?.confidence ?? 0.5,
        positionChanged: false,
        keyCounterpoints: [],
        concessions: [],
      };
    } catch (error) {
      logger.error(`Debate round ${round} failed for ${style}`, {
        error: error instanceof Error ? error.message : String(error),
      });
      return {
        style,
        round,
        response: `[Error in round ${round}: ${error instanceof Error ? error.message : String(error)}]`,
        confidence: myPosition?.confidence ?? 0.5,
        positionChanged: false,
        keyCounterpoints: [],
        concessions: [],
      };
    }
  }
}

/**
 * Create a new ThinkForkEngine instance.
 */
export function createThinkForkEngine(
  options?: ThinkForkEngineOptions
): ThinkForkEngine {
  return new ThinkForkEngine(options);
}
