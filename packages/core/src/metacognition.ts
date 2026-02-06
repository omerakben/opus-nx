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
import type { OrchestratorConfig, ToolUseBlock } from "./types/orchestrator.js";

const logger = createLogger("MetacognitionEngine");

// ============================================================
// Constants
// ============================================================

/** Maximum chars for reasoning context (~25k tokens) */
const MAX_REASONING_CHARS = 100_000;

/** Maximum chars per individual node's reasoning */
const MAX_NODE_REASONING_CHARS = 5_000;

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
 * 1. Gathers recent reasoning from ThinkGraph
 * 2. Formats it for analysis within token limits
 * 3. Uses deep thinking (50k tokens) to find patterns
 * 4. Extracts structured insights via tool_use
 * 5. Persists insights for future reference
 */
export class MetacognitionEngine {
  private thinkingEngine: ThinkingEngine;
  private systemPrompt: string;
  private onInsightExtracted?: (insight: MetacognitiveInsight) => void;

  constructor(options: MetacognitionEngineOptions = {}) {
    // Configure ThinkingEngine with max budget for deep analysis
    const config: OrchestratorConfig = {
      model: "claude-opus-4-6-20260101",
      thinking: {
        type: "enabled",
        effort: "max", // 50k thinking tokens - the full power
      },
      streaming: true,
      maxTokens: 16384, // Generous output for multiple insights
    };

    this.thinkingEngine = new ThinkingEngine({
      config,
      onThinkingStream: options.onThinkingStream,
      onTextStream: options.onTextStream,
    });

    this.onInsightExtracted = options.onInsightExtracted;
    this.systemPrompt = this.loadSystemPrompt(options.systemPromptPath);

    logger.debug("MetacognitionEngine initialized", {
      thinkingBudget: "50k (max)",
      hasStreamCallbacks: !!(options.onThinkingStream || options.onTextStream),
    });
  }

  /**
   * Perform metacognitive analysis on reasoning history.
   *
   * This is the main entry point. It gathers reasoning context,
   * uses 50k thinking tokens to deeply analyze patterns, and
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

    // 1. Gather reasoning context
    const { context, error: gatherError } = await this.gatherReasoningContext(sessionId, nodeLimit);

    if (gatherError) {
      errors.push(gatherError);
    }

    if (context.length === 0) {
      logger.warn("No reasoning nodes found for analysis");
      return {
        insights: [],
        nodesAnalyzed: 0,
        summary: "No reasoning history available for analysis.",
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

    // 3. Build analysis prompt
    const analysisPrompt = this.buildAnalysisPrompt(formattedContext, focusAreas);

    // 4. Execute deep thinking analysis with 50k token budget
    const startTime = Date.now();
    const result = await this.thinkingEngine.think(
      this.systemPrompt,
      [{ role: "user", content: analysisPrompt }],
      [INSIGHT_EXTRACTION_TOOL]
    );
    const analysisTime = Date.now() - startTime;

    logger.info("Thinking analysis completed", {
      durationMs: analysisTime,
      toolCalls: result.toolUseBlocks.length,
      thinkingBlocks: result.thinkingBlocks.length,
    });

    // 5. Parse and persist insights
    const insights = await this.parseAndPersistInsights(
      result.toolUseBlocks,
      sessionId ?? null,
      nodeIds
    );

    // 6. Extract summary from text response
    const summary = result.textBlocks.map((b) => b.text).join("\n").slice(0, 2000) || undefined;

    const analysisResult: MetacognitionResult = {
      insights,
      nodesAnalyzed: context.length,
      analysisTokensUsed: result.usage.outputTokens,
      thinkingTokensUsed: result.usage.inputTokens, // Approximate
      summary,
      errors: errors.length > 0 ? errors : undefined,
    };

    logger.info("Metacognitive analysis complete", {
      insightsGenerated: insights.length,
      nodesAnalyzed: context.length,
      biasDetections: insights.filter((i) => i.insightType === "bias_detection").length,
      patterns: insights.filter((i) => i.insightType === "pattern").length,
      improvements: insights.filter((i) => i.insightType === "improvement_hypothesis").length,
    });

    return analysisResult;
  }

  /**
   * Gather reasoning context from database.
   * Returns context and any errors encountered.
   */
  private async gatherReasoningContext(
    sessionId: string | undefined,
    limit: number
  ): Promise<{ context: SessionReasoningContext[]; error?: string }> {
    if (!sessionId) {
      logger.warn("No sessionId provided, analysis requires a session");
      return { context: [], error: "No sessionId provided" };
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
    // Truncate long reasoning to stay within limits
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
   * Build the analysis prompt with focus area instructions.
   */
  private buildAnalysisPrompt(formattedContext: string, focusAreas: string[]): string {
    const focusInstructions = focusAreas
      .map((area) => {
        switch (area) {
          case "decision_quality":
            return "- **Decision Quality**: Evaluate the quality of decisions and whether alternatives were properly considered";
          case "reasoning_patterns":
            return "- **Reasoning Patterns**: Identify recurring structures in how reasoning is organized";
          case "confidence_calibration":
            return "- **Confidence Calibration**: Assess whether stated confidence levels match the depth of reasoning";
          case "alternative_exploration":
            return "- **Alternative Exploration**: Examine how thoroughly alternatives are explored before concluding";
          case "bias_detection":
            return "- **Bias Detection**: Look for systematic biases (anchoring, confirmation, availability, etc.)";
          default:
            return "";
        }
      })
      .filter(Boolean)
      .join("\n");

    // Replace placeholder in system prompt
    const promptWithContext = this.systemPrompt.replace("{REASONING_CONTEXT}", formattedContext);

    return `## Focus Areas for This Analysis

${focusInstructions}

${promptWithContext}

## Your Task

Analyze the reasoning history above. For each insight you discover:
1. Use the \`record_insight\` tool to capture it with proper evidence
2. Aim for 3-7 high-quality insights (quality over quantity)
3. Focus on patterns that appear across multiple reasoning sessions
4. Be specific - cite node IDs and quote relevant excerpts

After recording all insights, provide a brief summary of your overall observations about the reasoning patterns.`;
  }

  /**
   * Parse tool_use blocks and persist insights to database.
   */
  private async parseAndPersistInsights(
    toolUseBlocks: ToolUseBlock[],
    sessionId: string | null,
    nodeIdsAnalyzed: string[]
  ): Promise<MetacognitiveInsight[]> {
    const insights: MetacognitiveInsight[] = [];

    for (const toolUse of toolUseBlocks) {
      if (toolUse.name !== "record_insight") {
        logger.debug("Skipping non-insight tool call", { name: toolUse.name });
        continue;
      }

      try {
        // Validate tool input with Zod schema
        const parseResult = RecordInsightToolInputSchema.safeParse(toolUse.input);
        if (!parseResult.success) {
          logger.warn("Invalid tool input schema", {
            errors: parseResult.error.errors.map((e) => e.message),
          });
          continue;
        }
        const input = parseResult.data;

        // Build evidence array with validation
        const evidence: EvidenceItem[] = (input.evidence || [])
          .filter((e) => {
            // Only include evidence referencing nodes we actually analyzed
            const isValid = nodeIdsAnalyzed.includes(e.nodeId);
            if (!isValid) {
              logger.debug("Filtering evidence with unknown nodeId", { nodeId: e.nodeId });
            }
            return isValid;
          })
          .map((e) => ({
            nodeId: e.nodeId,
            excerpt: String(e.excerpt).slice(0, 500),
            relevance: Math.min(1, Math.max(0, Number(e.relevance) || 0.5)),
          }));

        const createInput: CreateMetacognitiveInsightInput = {
          sessionId,
          thinkingNodesAnalyzed: nodeIdsAnalyzed,
          insightType: input.insight_type as InsightType,
          insight: String(input.insight),
          evidence,
          confidence: Math.min(1, Math.max(0, Number(input.confidence) || 0.5)),
        };

        const persisted = await createMetacognitiveInsight(createInput);
        insights.push(persisted);

        // Notify callback if provided
        this.onInsightExtracted?.(persisted);

        logger.debug("Persisted insight", {
          id: persisted.id,
          type: persisted.insightType,
          confidence: persisted.confidence,
          evidenceCount: persisted.evidence.length,
        });
      } catch (error) {
        logger.error("Failed to persist insight", {
          error: error instanceof Error ? error.message : String(error),
          toolInput: JSON.stringify(toolUse.input).slice(0, 200),
        });
        // Continue processing other insights
      }
    }

    return insights;
  }

  /**
   * Load system prompt from file.
   */
  private loadSystemPrompt(customPath?: string): string {
    try {
      // Determine the prompt path
      let promptPath: string;

      if (customPath) {
        promptPath = customPath;
      } else {
        // Navigate from packages/core/src to configs/prompts
        const __dirname = dirname(fileURLToPath(import.meta.url));
        promptPath = join(__dirname, "..", "..", "..", "configs", "prompts", "metacognition.md");
      }

      const prompt = readFileSync(promptPath, "utf-8");
      logger.debug("Loaded system prompt", { path: promptPath, length: prompt.length });
      return prompt;
    } catch (error) {
      logger.warn("Could not load system prompt from file, using embedded fallback", {
        error: error instanceof Error ? error.message : String(error),
      });

      // Fallback embedded prompt
      return `You are performing metacognitive analysis - examining reasoning patterns to identify biases, recurring patterns, and opportunities for improvement.

For each insight, use the record_insight tool with:
- insight_type: "bias_detection", "pattern", or "improvement_hypothesis"
- insight: Clear description of what you found
- evidence: Array of {nodeId, excerpt, relevance} references
- confidence: 0.0-1.0 based on evidence strength

Focus on patterns that appear multiple times. Be specific and cite node IDs.

{REASONING_CONTEXT}`;
    }
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
