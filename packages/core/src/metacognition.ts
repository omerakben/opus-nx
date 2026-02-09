import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createLogger } from "@opus-nx/shared";
import {
  getSessionReasoningContext,
  createMetacognitiveInsight,
  type SessionReasoningContext,
} from "@opus-nx/db";
import { ThinkingEngine } from "./thinking-engine.js";
import {
  RecordInsightToolInputSchema,
  type MetacognitionOptions,
  type MetacognitionResult,
  type MetacognitiveInsight,
  type CreateMetacognitiveInsightInput,
  type InsightType,
  type EvidenceItem,
} from "./types/metacognition.js";
import type { OrchestratorConfig, ToolUseBlock, ThinkingBlock } from "./types/orchestrator.js";
import type Anthropic from "@anthropic-ai/sdk";

const logger = createLogger("MetacognitionEngine");

// ============================================================
// Constants
// ============================================================

/** Maximum chars for reasoning context (roughly 20-30k tokens depending on content structure) */
const MAX_REASONING_CHARS = 100_000;

/** Maximum chars per individual node's reasoning */
const MAX_NODE_REASONING_CHARS = 5_000;

/** Focus area descriptions for building analysis prompts */
const FOCUS_AREA_DESCRIPTIONS: Record<string, string> = {
  decision_quality: "Evaluate the quality of decisions and whether alternatives were properly considered",
  reasoning_patterns: "Identify recurring structures in how reasoning is organized",
  confidence_calibration: "Assess whether stated confidence levels match the depth of reasoning",
  alternative_exploration: "Examine how thoroughly alternatives are explored before concluding",
  bias_detection: "Look for systematic biases (anchoring, confirmation, availability, etc.)",
};

/** The tool Claude uses to record insights */
const INSIGHT_EXTRACTION_TOOL = {
  name: "record_insight",
  description: "Record a metacognitive insight discovered during analysis. Call this for each distinct insight you find.",
  input_schema: {
    type: "object" as const,
    properties: {
      insight_type: {
        type: "string",
        enum: ["bias_detection", "pattern", "improvement_hypothesis"],
        description: "The category of insight",
      },
      insight: {
        type: "string",
        description: "Clear, actionable description of the insight (2-4 sentences)",
      },
      evidence: {
        type: "array",
        items: {
          type: "object",
          properties: {
            nodeId: {
              type: "string",
              description: "UUID of the thinking node (from the reasoning history)",
            },
            excerpt: {
              type: "string",
              description: "Relevant quote from the reasoning (max 500 chars)",
            },
            relevance: {
              type: "number",
              description: "How strongly this evidence supports the insight (0.0-1.0)",
            },
          },
          required: ["nodeId", "excerpt", "relevance"],
        },
        description: "Evidence supporting this insight, with references to specific nodes",
      },
      confidence: {
        type: "number",
        description: "Confidence in this insight (0.0-1.0). High if pattern appears multiple times.",
      },
    },
    required: ["insight_type", "insight", "evidence", "confidence"],
  },
};

// ============================================================
// Internal Types
// ============================================================

interface ParseInsightsResult {
  persisted: MetacognitiveInsight[];
  failed: Array<{ input: unknown; error: string }>;
  validationErrors: string[];
  invalidNodeRefs: string[];
}

// ============================================================
// Options
// ============================================================

export interface MetacognitionEngineOptions {
  /** Path to custom system prompt (defaults to configs/prompts/metacognition.md) */
  systemPromptPath?: string;
  /** Callback when an insight is extracted */
  onInsightExtracted?: (insight: MetacognitiveInsight) => void;
  /** Callback for streaming thinking output */
  onThinkingStream?: (thinking: string) => void;
  /** Callback for streaming text output */
  onTextStream?: (text: string) => void;
  /** Allow fallback to embedded prompt if file not found (default: true for default path only) */
  allowPromptFallback?: boolean;
}

// ============================================================
// MetacognitionEngine Class
// ============================================================

/**
 * MetacognitionEngine enables self-reflection on reasoning patterns.
 *
 * This is the showstopper feature of Opus Nx - using Claude Opus 4.6's
 * unique 50k thinking token budget to analyze its own reasoning patterns.
 *
 * The engine:
 * 1. Gathers recent reasoning from the database (thinking_nodes table)
 * 2. Formats it for analysis within token limits
 * 3. Uses extended thinking to find patterns
 * 4. Extracts structured insights via tool_use
 * 5. Persists insights for future reference
 */
export class MetacognitionEngine {
  private thinkingEngine: ThinkingEngine;
  private systemPrompt: string;
  private onInsightExtracted?: (insight: MetacognitiveInsight) => void;

  constructor(options: MetacognitionEngineOptions = {}) {
    // Use adaptive thinking (Claude 4.6 recommended mode)
    // maxTokens must be large enough for thinking + multiple tool calls + summary.
    // With effort: "max", Claude uses extensive thinking, so we need headroom for
    // 5-8 record_insight tool calls (~400 tokens each) plus summary text.
    const config: OrchestratorConfig = {
      model: "claude-opus-4-6",
      thinking: {
        type: "adaptive",
        effort: "max",
      },
      streaming: true,
      maxTokens: 32768,
    };

    this.thinkingEngine = new ThinkingEngine({
      config,
      onThinkingStream: options.onThinkingStream,
      onTextStream: options.onTextStream,
    });

    this.onInsightExtracted = options.onInsightExtracted;
    this.systemPrompt = this.loadSystemPrompt(
      options.systemPromptPath,
      options.allowPromptFallback ?? !options.systemPromptPath
    );

    logger.debug("MetacognitionEngine initialized", {
      hasStreamCallbacks: !!(options.onThinkingStream || options.onTextStream),
    });
  }

  /**
   * Perform metacognitive analysis on reasoning history.
   *
   * This is the main entry point. It gathers reasoning context,
   * uses extended thinking to deeply analyze patterns, and
   * returns structured insights with evidence.
   */
  async analyze(options: Partial<MetacognitionOptions> = {}): Promise<MetacognitionResult> {
    const {
      sessionId,
      nodeLimit = 15,
      analysisScope = "session",
      focusAreas = ["reasoning_patterns", "bias_detection"],
    } = options;

    logger.info("Starting metacognitive analysis", {
      sessionId,
      nodeLimit,
      analysisScope,
      focusAreas,
    });

    const errors: string[] = [];

    // 1. Gather reasoning context from database
    const { context, error: gatherError } = await this.gatherReasoningContext(sessionId, nodeLimit);

    if (gatherError) {
      errors.push(gatherError);
    }

    if (context.length === 0) {
      // Distinguish between "no data" vs "failed to fetch"
      const summary = gatherError
        ? `Failed to retrieve reasoning history: ${gatherError}. Check database connectivity.`
        : "No reasoning history available. Run the orchestrator first to generate reasoning nodes.";

      logger.warn(gatherError ? "Failed to gather reasoning context" : "No reasoning nodes found", {
        sessionId,
        hadError: !!gatherError,
      });

      return {
        insights: [],
        nodesAnalyzed: 0,
        summary,
        errors: errors.length > 0 ? errors : undefined,
      };
    }

    // 2. Format context for analysis
    const formattedContext = this.formatReasoningContext(context);
    const nodeIds = context.map((c) => c.nodeId);

    logger.debug("Formatted reasoning context", {
      nodesIncluded: context.length,
      contextLength: formattedContext.length,
    });

    // 3. Build system prompt with reasoning context, and user prompt with focus instructions
    const systemPromptWithContext = this.systemPrompt.replace("{REASONING_CONTEXT}", formattedContext);
    const userPrompt = this.buildAnalysisPrompt(focusAreas);

    // 4. Execute extended thinking analysis with error handling
    const startTime = Date.now();
    let result;
    try {
      result = await this.thinkingEngine.think(
        systemPromptWithContext,
        [{ role: "user", content: userPrompt }],
        [INSIGHT_EXTRACTION_TOOL]
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error("Thinking engine analysis failed", {
        sessionId,
        nodesIncluded: context.length,
        error: errorMessage,
      });

      // Provide actionable error messages based on error type
      let userMessage = `Analysis failed: ${errorMessage}`;
      if (errorMessage.includes("rate limit") || errorMessage.includes("429")) {
        userMessage = "Analysis failed: API rate limit exceeded. Please wait and retry.";
      } else if (errorMessage.includes("401") || errorMessage.includes("authentication")) {
        userMessage = "Analysis failed: Invalid API key. Check ANTHROPIC_API_KEY.";
      } else if (errorMessage.includes("timeout") || errorMessage.includes("ETIMEDOUT")) {
        userMessage = "Analysis failed: Request timed out. Try reducing nodeLimit.";
      }

      errors.push(userMessage);

      return {
        insights: [],
        nodesAnalyzed: context.length,
        summary: undefined,
        errors,
      };
    }
    const analysisTime = Date.now() - startTime;

    logger.info("Thinking analysis completed", {
      durationMs: analysisTime,
      toolCalls: result.toolUseBlocks.length,
      thinkingBlocks: result.thinkingBlocks.length,
      stopReason: result.stopReason,
    });

    // Detect truncation
    if (result.stopReason === "max_tokens") {
      errors.push("Analysis was truncated due to token limit — some insights may be missing");
      logger.warn("Analysis truncated at max_tokens", {
        toolCallsBeforeTruncation: result.toolUseBlocks.length,
      });
    }

    // 5. Parse and persist insights from first pass
    const parseResult = await this.parseAndPersistInsights(
      result.toolUseBlocks,
      sessionId ?? null,
      nodeIds
    );

    // 6. Follow-up loop: request missing insight types iteratively
    // Claude produces 1 tool call per turn (stopReason: "tool_use"), so we loop
    // until all 3 required types are covered or we hit max iterations.
    const MAX_FOLLOW_UP_ITERATIONS = 3;
    const typeLabels: Record<string, string> = {
      bias_detection: "Bias Detection (systematic biases like anchoring, confirmation, availability, overconfidence)",
      pattern: "Pattern Recognition (recurring reasoning structures, decision frameworks, information gathering sequences)",
      improvement_hypothesis: "Improvement Hypotheses (concrete, testable suggestions for better reasoning)",
    };
    const allTypes: InsightType[] = ["bias_detection", "pattern", "improvement_hypothesis"];

    // Build conversation history for multi-turn — starts with the first exchange
    let conversationMessages: Anthropic.MessageParam[] = [
      { role: "user", content: userPrompt },
    ];

    // Add the first assistant response to conversation
    const firstAssistantContent = result.content.map((block) => {
      if (block.type === "tool_use") {
        return block as unknown as Anthropic.ContentBlockParam;
      }
      if (block.type === "text") {
        return { type: "text" as const, text: block.text };
      }
      if (block.type === "thinking") {
        return { type: "thinking" as const, thinking: block.thinking, signature: (block as ThinkingBlock).signature };
      }
      return { type: "text" as const, text: "" };
    }).filter((b) => b.type === "text" || b.type === "tool_use" || b.type === "thinking");

    conversationMessages.push({ role: "assistant", content: firstAssistantContent });

    // Add tool results for the first pass
    const firstToolResults: Anthropic.ToolResultBlockParam[] = result.toolUseBlocks.map((tb) => ({
      type: "tool_result" as const,
      tool_use_id: tb.id,
      content: "Insight recorded successfully.",
    }));

    let lastToolResults = firstToolResults;
    let lastResult = result;
    let followUpCount = 0;

    for (let iteration = 0; iteration < MAX_FOLLOW_UP_ITERATIONS; iteration++) {
      const producedTypes = new Set(parseResult.persisted.map((i) => i.insightType));
      const missingTypes = allTypes.filter((t) => !producedTypes.has(t));

      if (missingTypes.length === 0) {
        logger.info("All insight types covered", { iteration, totalInsights: parseResult.persisted.length });
        break;
      }

      if (lastResult.stopReason === "max_tokens") {
        logger.warn("Stopping follow-up loop — previous turn hit max_tokens");
        break;
      }

      logger.info("Requesting follow-up for missing insight types", {
        iteration: iteration + 1,
        missingTypes,
        producedSoFar: [...producedTypes],
      });

      const followUpPrompt = `You generated ${parseResult.persisted.length} insight(s) of type: ${[...producedTypes].join(", ")}.

You are MISSING these required types: ${missingTypes.map((t) => `**${typeLabels[t]}**`).join(", ")}.

Generate exactly 1 insight for the type **${typeLabels[missingTypes[0]]}** using the \`record_insight\` tool. Even if evidence is moderate (confidence 0.4-0.7), report a finding rather than skip the category.

DO NOT repeat insights you already generated.`;

      try {
        // Append tool results + follow-up prompt as user turn
        conversationMessages.push({
          role: "user",
          content: lastToolResults.length > 0
            ? [...lastToolResults, { type: "text" as const, text: followUpPrompt }]
            : followUpPrompt,
        });

        const followUpResult = await this.thinkingEngine.think(
          systemPromptWithContext,
          conversationMessages,
          [INSIGHT_EXTRACTION_TOOL]
        );

        logger.info("Follow-up analysis completed", {
          iteration: iteration + 1,
          toolCalls: followUpResult.toolUseBlocks.length,
          stopReason: followUpResult.stopReason,
        });

        // Parse and persist follow-up insights
        const followUpParse = await this.parseAndPersistInsights(
          followUpResult.toolUseBlocks,
          sessionId ?? null,
          nodeIds
        );

        // Merge results
        parseResult.persisted.push(...followUpParse.persisted);
        parseResult.failed.push(...followUpParse.failed);
        parseResult.validationErrors.push(...followUpParse.validationErrors);
        parseResult.invalidNodeRefs.push(...followUpParse.invalidNodeRefs);

        // Append follow-up summary text
        const followUpSummary = followUpResult.textBlocks.map((b) => b.text).join("\n");
        if (followUpSummary) {
          result.textBlocks.push({ type: "text", text: followUpSummary });
        }

        // Build assistant content for next iteration
        const followUpAssistantContent = followUpResult.content.map((block) => {
          if (block.type === "tool_use") {
            return block as unknown as Anthropic.ContentBlockParam;
          }
          if (block.type === "text") {
            return { type: "text" as const, text: block.text };
          }
          if (block.type === "thinking") {
            return { type: "thinking" as const, thinking: block.thinking, signature: (block as ThinkingBlock).signature };
          }
          return { type: "text" as const, text: "" };
        }).filter((b) => b.type === "text" || b.type === "tool_use" || b.type === "thinking");

        conversationMessages.push({ role: "assistant", content: followUpAssistantContent });

        // Prepare tool results for next iteration
        lastToolResults = followUpResult.toolUseBlocks.map((tb) => ({
          type: "tool_result" as const,
          tool_use_id: tb.id,
          content: "Insight recorded successfully.",
        }));
        lastResult = followUpResult;
        followUpCount++;
      } catch (followUpError) {
        const msg = followUpError instanceof Error ? followUpError.message : String(followUpError);
        logger.warn("Follow-up iteration failed, returning partial results", { iteration: iteration + 1, error: msg });
        errors.push(`Follow-up iteration ${iteration + 1} failed: ${msg}`);
        break;
      }
    }

    // Track all types of failures
    if (parseResult.failed.length > 0) {
      errors.push(`${parseResult.failed.length} insight(s) failed to persist to database`);
    }
    if (parseResult.validationErrors.length > 0) {
      errors.push(`${parseResult.validationErrors.length} insight(s) had invalid schema`);
    }
    if (parseResult.invalidNodeRefs.length > 0) {
      logger.warn("Evidence referenced unknown node IDs (possible hallucination)", {
        invalidNodeIds: parseResult.invalidNodeRefs,
      });
    }

    // 7. Extract summary from text response
    const summary = result.textBlocks.map((b) => b.text).join("\n").slice(0, 2000) || undefined;

    const analysisResult: MetacognitionResult = {
      insights: parseResult.persisted,
      nodesAnalyzed: context.length,
      analysisTokensUsed: result.usage.outputTokens,
      summary,
      errors: errors.length > 0 ? errors : undefined,
      invalidNodeRefs: parseResult.invalidNodeRefs.length > 0 ? parseResult.invalidNodeRefs : undefined,
      hallucinationCount: parseResult.invalidNodeRefs.length > 0 ? parseResult.invalidNodeRefs.length : undefined,
    };

    logger.info("Metacognitive analysis complete", {
      insightsGenerated: parseResult.persisted.length,
      insightsFailed: parseResult.failed.length,
      nodesAnalyzed: context.length,
      biasDetections: parseResult.persisted.filter((i) => i.insightType === "bias_detection").length,
      patterns: parseResult.persisted.filter((i) => i.insightType === "pattern").length,
      improvements: parseResult.persisted.filter((i) => i.insightType === "improvement_hypothesis").length,
      followUpIterations: followUpCount,
    });

    return analysisResult;
  }

  /**
   * Gather reasoning context from database.
   * Returns context and any errors encountered (not silently swallowed).
   */
  private async gatherReasoningContext(
    sessionId: string | undefined,
    limit: number
  ): Promise<{ context: SessionReasoningContext[]; error?: string }> {
    if (!sessionId) {
      logger.warn("No sessionId provided, analysis requires a session");
      return { context: [], error: "No sessionId provided - analysis requires a session ID" };
    }

    try {
      const context = await getSessionReasoningContext(sessionId, limit);
      return { context };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error("Failed to gather reasoning context", {
        sessionId,
        error: errorMessage,
      });
      return { context: [], error: `Database error: ${errorMessage}` };
    }
  }

  /**
   * Format reasoning context for prompt injection.
   * Handles truncation to stay within token limits.
   */
  private formatReasoningContext(context: SessionReasoningContext[]): string {
    let formatted = "";
    let totalChars = 0;

    for (const node of context) {
      const nodeEntry = this.formatSingleNode(node);

      if (totalChars + nodeEntry.length > MAX_REASONING_CHARS) {
        logger.debug("Truncating reasoning context due to length", {
          nodesIncluded: context.indexOf(node),
          totalNodes: context.length,
          charsUsed: totalChars,
        });
        break;
      }

      formatted += nodeEntry;
      totalChars += nodeEntry.length;
    }

    return formatted;
  }

  /**
   * Format a single reasoning node for the prompt.
   */
  private formatSingleNode(node: SessionReasoningContext): string {
    let reasoning = node.reasoning;
    if (reasoning.length > MAX_NODE_REASONING_CHARS) {
      reasoning = reasoning.slice(0, MAX_NODE_REASONING_CHARS) + "\n\n[...truncated...]";
    }

    const confidenceStr =
      node.confidenceScore !== null
        ? `${(node.confidenceScore * 100).toFixed(0)}%`
        : "Not stated";

    return `
### Node: ${node.nodeId}

**Query**: ${node.inputQuery ?? "N/A"}
**Confidence**: ${confidenceStr}
**Decisions Made**: ${node.decisionCount}
**Timestamp**: ${node.createdAt.toISOString()}

**Reasoning**:
\`\`\`
${reasoning}
\`\`\`

---

`;
  }

  /**
   * Build the user-facing analysis prompt with focus areas and diversity requirements.
   * The system prompt (with reasoning context) is passed separately to think().
   */
  private buildAnalysisPrompt(focusAreas: string[]): string {
    const focusInstructions = focusAreas
      .filter((area) => area in FOCUS_AREA_DESCRIPTIONS)
      .map((area) => {
        const title = area.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
        return `- **${title}**: ${FOCUS_AREA_DESCRIPTIONS[area]}`;
      })
      .join("\n");

    return `## Focus Areas for This Analysis

${focusInstructions}

## Your Task

Analyze the reasoning history provided in the system prompt. You MUST generate insights across ALL THREE categories:

1. **bias_detection** — At least 1 insight identifying systematic biases (anchoring, confirmation, availability, overconfidence, premature closure, sunk cost, or other biases)
2. **pattern** — At least 1 insight identifying recurring reasoning structures (decision frameworks, information gathering sequences, how alternatives are explored, reasoning depth patterns)
3. **improvement_hypothesis** — At least 1 insight proposing concrete, testable hypotheses for improving reasoning quality

### Requirements

- Aim for **5-8 total insights** distributed across all three types
- Each insight MUST include evidence with exact node IDs and quoted excerpts
- If a category genuinely has no findings, explain why in your summary — but try hard to find at least one per category
- Focus areas above should guide WHERE you look, but all three insight types should be produced regardless
- Be specific: cite node IDs, quote relevant reasoning, and explain the significance

### Mapping Focus Areas to Insight Types

- **Bias Detection** focus → Generate \`bias_detection\` insights
- **Reasoning Patterns** / **Confidence Calibration** → Generate \`pattern\` insights about how reasoning is structured
- **Alternative Exploration** / **Decision Quality** → Generate \`improvement_hypothesis\` insights about what could be done better

After recording all insights with the \`record_insight\` tool, provide a brief summary of your overall observations.`;
  }

  /**
   * Parse tool_use blocks and persist insights to database.
   * Tracks all types of failures for full visibility.
   */
  private async parseAndPersistInsights(
    toolUseBlocks: ToolUseBlock[],
    sessionId: string | null,
    nodeIdsAnalyzed: string[]
  ): Promise<ParseInsightsResult> {
    const persisted: MetacognitiveInsight[] = [];
    const failed: Array<{ input: unknown; error: string }> = [];
    const validationErrors: string[] = [];
    const invalidNodeRefs: string[] = [];

    // Use Set for O(1) lookups (per project conventions)
    const validNodeIds = new Set(nodeIdsAnalyzed);

    for (const toolUse of toolUseBlocks) {
      if (toolUse.name !== "record_insight") {
        logger.debug("Skipping non-insight tool call", { name: toolUse.name });
        continue;
      }

      // Validate tool input with Zod schema
      const parseResult = RecordInsightToolInputSchema.safeParse(toolUse.input);
      if (!parseResult.success) {
        const errorDetails = parseResult.error.errors
          .map((e) => `${e.path.join(".")}: ${e.message}`)
          .join("; ");
        logger.warn("Invalid tool input schema", {
          errors: parseResult.error.errors,
          rawInput: JSON.stringify(toolUse.input).slice(0, 500),
        });
        validationErrors.push(errorDetails);
        failed.push({
          input: toolUse.input,
          error: `Schema validation failed: ${errorDetails}`,
        });
        continue;
      }
      const input = parseResult.data;

      // Build evidence array with validation and tracking
      const validEvidence: EvidenceItem[] = [];
      for (const e of input.evidence || []) {
        if (!validNodeIds.has(e.nodeId)) {
          invalidNodeRefs.push(e.nodeId);
          continue;
        }
        validEvidence.push({
          nodeId: e.nodeId,
          excerpt: String(e.excerpt).slice(0, 500),
          relevance: Math.min(1, Math.max(0, Number(e.relevance) || 0.5)),
        });
      }

      try {
        const createInput: CreateMetacognitiveInsightInput = {
          sessionId,
          thinkingNodesAnalyzed: nodeIdsAnalyzed,
          insightType: input.insight_type as InsightType,
          insight: String(input.insight),
          evidence: validEvidence,
          confidence: Math.min(1, Math.max(0, Number(input.confidence) || 0.5)),
        };

        const insight = await createMetacognitiveInsight(createInput);
        persisted.push(insight);
        this.onInsightExtracted?.(insight);

        logger.debug("Persisted insight", {
          id: insight.id,
          type: insight.insightType,
          confidence: insight.confidence,
          evidenceCount: insight.evidence.length,
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error("Failed to persist insight", {
          error: errorMessage,
          toolInput: JSON.stringify(toolUse.input).slice(0, 200),
        });
        failed.push({
          input: toolUse.input,
          error: `Database persistence failed: ${errorMessage}`,
        });
      }
    }

    if (failed.length > 0) {
      logger.warn(`${failed.length} insight(s) failed to process`, {
        persistedCount: persisted.length,
        failedCount: failed.length,
        validationErrorCount: validationErrors.length,
      });
    }

    return { persisted, failed, validationErrors, invalidNodeRefs };
  }

  /**
   * Load system prompt from file with explicit error handling.
   * Fallback is only used for missing default file, not for custom paths or other errors.
   */
  private loadSystemPrompt(customPath?: string, allowFallback = true): string {
    const __dirname = dirname(fileURLToPath(import.meta.url));
    const promptPath = customPath ?? join(__dirname, "..", "..", "..", "configs", "prompts", "metacognition.md");

    try {
      const prompt = readFileSync(promptPath, "utf-8");
      if (prompt.trim().length === 0) {
        throw new Error(`System prompt file is empty: ${promptPath}`);
      }
      logger.debug("Loaded system prompt", { path: promptPath, length: prompt.length });
      return prompt;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const isFileNotFound = error instanceof Error &&
        (error as NodeJS.ErrnoException).code === "ENOENT";

      // Only allow fallback for missing default file (not custom paths, not other errors)
      if (allowFallback && isFileNotFound && !customPath) {
        logger.warn("Default system prompt not found, using embedded fallback", {
          path: promptPath,
          error: errorMessage,
        });
        return this.getEmbeddedPrompt();
      }

      // For custom paths or non-ENOENT errors, throw to surface the problem
      logger.error("Failed to load system prompt", {
        path: promptPath,
        error: errorMessage,
        isCustomPath: !!customPath,
      });
      throw new Error(`Failed to load system prompt from ${promptPath}: ${errorMessage}`);
    }
  }

  /**
   * Embedded fallback prompt for when default file is missing.
   */
  private getEmbeddedPrompt(): string {
    return `You are performing metacognitive analysis - examining reasoning patterns to identify biases, recurring patterns, and opportunities for improvement.

For each insight, use the record_insight tool with:
- insight_type: "bias_detection", "pattern", or "improvement_hypothesis"
- insight: Clear description of what you found
- evidence: Array of {nodeId, excerpt, relevance} references
- confidence: 0.0-1.0 based on evidence strength

IMPORTANT: You MUST generate insights across ALL THREE types (bias_detection, pattern, improvement_hypothesis). Generate at least one of each type. Focus on patterns that appear multiple times. Be specific and cite node IDs.

{REASONING_CONTEXT}`;
  }

  /**
   * Update streaming callbacks.
   */
  setCallbacks(callbacks: {
    onThinkingStream?: (thinking: string) => void;
    onTextStream?: (text: string) => void;
    onInsightExtracted?: (insight: MetacognitiveInsight) => void;
  }): void {
    this.thinkingEngine.setCallbacks({
      onThinkingStream: callbacks.onThinkingStream,
      onTextStream: callbacks.onTextStream,
    });
    this.onInsightExtracted = callbacks.onInsightExtracted;
  }
}

// ============================================================
// Factory Function
// ============================================================

/**
 * Create a new MetacognitionEngine instance.
 */
export function createMetacognitionEngine(
  options?: MetacognitionEngineOptions
): MetacognitionEngine {
  return new MetacognitionEngine(options);
}
