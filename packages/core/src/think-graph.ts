import { createLogger } from "@opus-nx/shared";
import { z } from "zod";
import {
  createThinkingNode,
  createReasoningEdge,
  createDecisionPoint,
  createDecisionPoints,
  getThinkingNode,
  getSessionThinkingNodes,
  getLatestThinkingNode,
  traverseReasoningGraph,
  getReasoningChain,
  searchReasoningNodes,
  getSessionReasoningContext,
  type ThinkingNode as DbThinkingNode,
  type CreateThinkingNodeInput,
  type CreateDecisionPointInput,
  type CreateReasoningEdgeInput,
} from "@opus-nx/db";
import type {
  ThinkingBlock,
  RedactedThinkingBlock,
  TokenUsage,
} from "./types/orchestrator.js";
import type {
  StructuredReasoning,
  ReasoningStep,
  EdgeType,
  ThinkingNode,
  DecisionPoint,
  ReasoningChainNode,
  GraphNodeResult,
  SessionReasoningContext,
  ReasoningSearchResult,
} from "./types/thinking.js";

const logger = createLogger("ThinkGraph");

// ============================================================
// UUID Validation
// ============================================================

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Validate UUID format to catch malformed IDs before DB operations.
 */
function isValidUUID(id: string): boolean {
  return UUID_REGEX.test(id);
}

// ============================================================
// Zod Schemas for DB Response Validation
// ============================================================

/**
 * Schema for structured reasoning that goes to DB.
 * Validates the shape before database insertion.
 */
const StructuredReasoningDBSchema = z.object({
  steps: z.array(z.object({
    stepNumber: z.number(),
    content: z.string(),
    type: z.enum(["analysis", "hypothesis", "evaluation", "conclusion", "consideration"]),
  })),
  decisionPoints: z.array(z.unknown()),
  alternativesConsidered: z.number(),
  mainConclusion: z.string().optional(),
  confidenceFactors: z.array(z.string()).optional(),
}).passthrough();

/**
 * Schema for token usage that goes to DB.
 */
const TokenUsageDBSchema = z.object({
  inputTokens: z.number().optional(),
  outputTokens: z.number().optional(),
  thinkingTokens: z.number().optional(),
}).passthrough().nullable();

/**
 * Convert structured reasoning to DB format with validation.
 */
function toDBStructuredReasoning(data: unknown): Record<string, unknown> {
  const result = StructuredReasoningDBSchema.safeParse(data);
  if (!result.success) {
    logger.warn("Structured reasoning validation failed, using sanitized defaults", {
      errors: result.error.issues.slice(0, 3),
    });
    return { steps: [], decisionPoints: [], alternativesConsidered: 0 };
  }
  return result.data as Record<string, unknown>;
}

/**
 * Convert token usage to DB format with validation.
 */
function toDBTokenUsage(data: unknown): Record<string, unknown> | undefined {
  if (data === undefined || data === null) {
    return undefined;
  }
  const result = TokenUsageDBSchema.safeParse(data);
  if (!result.success) {
    logger.warn("Token usage validation failed, using sanitized defaults", {
      errors: result.error.issues.slice(0, 3),
    });
    return { inputTokens: 0, outputTokens: 0, thinkingTokens: 0 };
  }
  return result.data as Record<string, unknown>;
}

// ============================================================
// Types
// ============================================================

export interface ParsedThinkingResult {
  reasoning: string;
  structuredReasoning: StructuredReasoning;
  decisionPoints: Array<Omit<DecisionPoint, "id" | "thinkingNodeId" | "createdAt">>;
  confidenceScore: number | null;
}

export interface PersistThinkingOptions {
  sessionId: string;
  parentNodeId?: string;
  inputQuery?: string;
  /** Model's final output/response text (the conclusion after thinking) */
  response?: string;
  thinkingBudget?: number;
  signature?: string;
  tokenUsage?: TokenUsage;
  /** Override the default node type (thinking, compaction, fork_branch, human_annotation) */
  nodeType?: ThinkingNode["nodeType"];
}

export interface ThinkGraphResult {
  node: ThinkingNode;
  decisionPoints: DecisionPoint[];
  linkedToParent: boolean;
  degraded: boolean;
  persistenceIssues: Array<{
    stage: "decision_point" | "reasoning_edge";
    message: string;
    stepNumber?: number;
  }>;
}

// ============================================================
// Decision Point Patterns
// ============================================================

/**
 * Patterns that indicate decision points in reasoning.
 *
 * Opus 4.6 returns summarized thinking (not raw stream-of-consciousness),
 * so patterns must handle both verbose reasoning and concise summaries.
 * Summaries tend to use more structured language: "Decided to...",
 * "Considered X vs Y", "Selected approach A over B".
 */
const DECISION_PATTERNS = [
  // Explicit decisions (verbose & summarized forms)
  /(?:I (?:could|should|will|might|need to) (?:either|choose|decide|go with|opt for|select))/i,
  /(?:(?:Option|Approach|Alternative|Choice|Path|Strategy|Method) [A-C1-5])/i,
  /(?:On (?:one|the other) hand)/i,
  // Summarized decision language (Opus 4.6 summarized thinking)
  /(?:(?:Decided|Choosing|Selected|Opted) (?:to|for|between))/i,
  /(?:(?:Weigh(?:ing|ed)|Evaluat(?:ing|ed)|Compar(?:ing|ed)) (?:the |several |multiple )?(?:options|approaches|strategies|alternatives|trade-?offs))/i,
  /(?:(?:Key|Main|Primary|Critical) (?:decision|choice|trade-?off|consideration))/i,
  // Comparisons
  /(?:(?:vs|versus|compared to|rather than|instead of|over|between))/i,
  // Trade-offs
  /(?:(?:trade-?off|pros? and cons?|advantages? (?:and|vs) disadvantages?|benefits? (?:and|vs) (?:costs?|drawbacks?)))/i,
  // Conclusions (verbose & summarized)
  /(?:(?:I(?:'ll| will) go with|I(?:'ve| have) decided|The best (?:approach|option|choice)|Therefore|Thus|Hence))/i,
  /(?:(?:Concluded|Determined|Settled on|Final (?:decision|choice|approach)))/i,
  // Rejection markers (verbose & summarized)
  /(?:(?:However|But|Although|While|rejected|ruled out|not (?:ideal|suitable|appropriate)))/i,
  /(?:(?:Eliminated|Discarded|Dismissed|Ruled against|Rejected (?:due to|because)))/i,
];

/**
 * Confidence indicators in reasoning text.
 *
 * Opus 4.6 summarized thinking uses more direct confidence language:
 * "High confidence that...", "Strong evidence for...", "Uncertain about..."
 */
const CONFIDENCE_INDICATORS = {
  high: [
    /(?:certainly|definitely|clearly|undoubtedly|absolutely|confident|sure)/i,
    /(?:strong evidence|conclusive|proven|established|well-supported)/i,
    /(?:high confidence|very likely|overwhelmingly|robustly)/i,
  ],
  medium: [
    /(?:likely|probably|reasonable|plausible|suggests)/i,
    /(?:based on|indicates|appears to|seems to)/i,
    /(?:moderate confidence|fairly confident|reasonable certainty|on balance)/i,
  ],
  low: [
    /(?:uncertain|unclear|might|could|possibly|perhaps)/i,
    /(?:unsure|ambiguous|questionable|tentative)/i,
    /(?:low confidence|insufficient evidence|speculative|inconclusive|needs? (?:more|further) (?:analysis|investigation|data))/i,
  ],
};

// Pre-built global regex variants for performance (avoid re-creating per invocation)
// String.prototype.match() with /g always starts from index 0, so shared instances are safe.
const CONFIDENCE_GLOBAL = {
  high: CONFIDENCE_INDICATORS.high.map((p) => new RegExp(p.source, "gi")),
  medium: CONFIDENCE_INDICATORS.medium.map((p) => new RegExp(p.source, "gi")),
  low: CONFIDENCE_INDICATORS.low.map((p) => new RegExp(p.source, "gi")),
};

// ============================================================
// ThinkGraph Class
// ============================================================

/**
 * ThinkGraph transforms raw extended thinking into persistent, queryable graph nodes.
 *
 * This is the core innovation of Opus Nx - making AI reasoning a first-class,
 * navigable data structure. Every thinking session becomes a node that can be:
 * - Queried for decision archaeology
 * - Linked to related reasoning
 * - Analyzed for patterns (metacognition)
 * - Visualized as a reasoning tree
 */
export class ThinkGraph {
  constructor() {
    logger.debug("ThinkGraph initialized");
  }

  // ============================================================
  // Parsing Methods
  // ============================================================

  /**
   * Parse raw thinking blocks into structured reasoning.
   *
   * Extracts:
   * - Decision points with alternatives
   * - Confidence indicators
   * - Reasoning steps
   * - Main conclusions
   */
  parseThinkingToNode(
    thinkingBlocks: (ThinkingBlock | RedactedThinkingBlock)[]
  ): ParsedThinkingResult {
    // Combine all thinking text
    const reasoning = thinkingBlocks
      .filter((block): block is ThinkingBlock => block.type === "thinking")
      .map((block) => block.thinking)
      .join("\n\n");

    if (!reasoning) {
      return {
        reasoning: "",
        structuredReasoning: {
          steps: [],
          decisionPoints: [],
          alternativesConsidered: 0,
          confidenceFactors: [],
        },
        decisionPoints: [],
        confidenceScore: null,
      };
    }

    // Extract structured reasoning
    const structuredReasoning = this.extractStructuredReasoning(reasoning);

    // Extract decision points
    const decisionPoints = this.extractDecisionPoints(reasoning);

    // Calculate overall confidence
    const confidenceScore = this.calculateConfidenceScore(reasoning);

    logger.debug("Parsed thinking block", {
      reasoningLength: reasoning.length,
      stepsCount: structuredReasoning.steps.length,
      decisionPointsCount: decisionPoints.length,
      confidenceScore,
    });

    return {
      reasoning,
      structuredReasoning,
      decisionPoints,
      confidenceScore,
    };
  }

  /**
   * Extract structured reasoning steps from raw text.
   */
  private extractStructuredReasoning(reasoning: string): StructuredReasoning {
    const steps: ReasoningStep[] = [];
    const paragraphs = reasoning.split(/\n\n+/);

    paragraphs.forEach((paragraph, index) => {
      if (paragraph.trim().length < 20) return; // Skip very short paragraphs

      const stepType = this.classifyReasoningStep(paragraph);
      steps.push({
        stepNumber: index + 1,
        content: paragraph.trim(),
        type: stepType,
      });
    });

    // Find main conclusion (usually last substantive paragraph)
    const conclusionStep = [...steps].reverse().find(
      (step: ReasoningStep) => step.type === "conclusion" || step.type === "evaluation"
    );
    const mainConclusion = conclusionStep?.content;

    // Extract confidence factors
    const confidenceFactors = this.extractConfidenceFactors(reasoning);

    return {
      steps,
      decisionPoints: [], // Will be populated separately
      mainConclusion,
      confidenceFactors,
      alternativesConsidered: this.countAlternatives(reasoning),
    };
  }

  /**
   * Classify a reasoning step by its type.
   *
   * Handles both verbose reasoning and Opus 4.6 summarized thinking,
   * which uses more direct language like "Concluded:", "Analysis:", etc.
   */
  private classifyReasoningStep(
    text: string
  ): "analysis" | "hypothesis" | "evaluation" | "conclusion" | "consideration" {
    const lowerText = text.toLowerCase();

    // Conclusion indicators (verbose + summarized)
    if (
      lowerText.includes("therefore") ||
      lowerText.includes("thus") ||
      lowerText.includes("in conclusion") ||
      lowerText.includes("i will") ||
      lowerText.includes("i'll go with") ||
      lowerText.includes("concluded") ||
      lowerText.includes("final decision") ||
      lowerText.includes("settled on") ||
      lowerText.includes("determined that") ||
      lowerText.startsWith("conclusion:")
    ) {
      return "conclusion";
    }

    // Hypothesis indicators (verbose + summarized)
    if (
      lowerText.includes("if ") ||
      lowerText.includes("assuming") ||
      lowerText.includes("hypothesis") ||
      lowerText.includes("suppose") ||
      lowerText.includes("hypothesized") ||
      lowerText.includes("might work if") ||
      lowerText.startsWith("hypothesis:")
    ) {
      return "hypothesis";
    }

    // Evaluation indicators (verbose + summarized)
    if (
      lowerText.includes("evaluating") ||
      lowerText.includes("comparing") ||
      lowerText.includes("weighing") ||
      lowerText.includes("trade-off") ||
      lowerText.includes("assessed") ||
      lowerText.includes("pros and cons") ||
      lowerText.includes("evaluated") ||
      lowerText.startsWith("evaluation:")
    ) {
      return "evaluation";
    }

    // Analysis indicators (verbose + summarized)
    if (
      lowerText.includes("analyzing") ||
      lowerText.includes("examining") ||
      lowerText.includes("looking at") ||
      lowerText.includes("consider") ||
      lowerText.includes("investigated") ||
      lowerText.includes("explored") ||
      lowerText.includes("breaking down") ||
      lowerText.startsWith("analysis:")
    ) {
      return "analysis";
    }

    return "consideration";
  }

  /**
   * Extract decision points where alternatives were considered.
   */
  extractDecisionPoints(
    reasoning: string
  ): Array<Omit<DecisionPoint, "id" | "thinkingNodeId" | "createdAt">> {
    const decisionPoints: Array<Omit<DecisionPoint, "id" | "thinkingNodeId" | "createdAt">> = [];
    const sentences = reasoning.split(/[.!?]+/);
    let stepNumber = 0;

    for (let i = 0; i < sentences.length; i++) {
      const sentence = sentences[i].trim();
      if (!sentence) continue;

      // Check if this sentence indicates a decision
      const isDecision = DECISION_PATTERNS.some((pattern) =>
        pattern.test(sentence)
      );

      if (isDecision) {
        stepNumber++;

        // Try to extract the chosen path
        const chosenPath = this.extractChosenPath(sentence, sentences.slice(i, i + 3).join(" "));

        // Try to extract alternatives from surrounding context
        const context = sentences.slice(Math.max(0, i - 2), i + 3).join(" ");
        const alternatives = this.extractAlternatives(context);

        // Estimate confidence for this decision
        const confidence = this.calculateConfidenceScore(sentence);

        decisionPoints.push({
          stepNumber,
          description: sentence.substring(0, 200),
          chosenPath: chosenPath || sentence.substring(0, 100),
          alternatives,
          confidence: confidence !== null ? confidence : undefined,
          reasoningExcerpt: context.substring(0, 500),
        });
      }
    }

    return decisionPoints;
  }

  /**
   * Extract the chosen path from a decision statement.
   * Note: Patterns use length limits {1,500} to prevent ReDoS attacks.
   *
   * Handles both verbose reasoning and Opus 4.6 summarized thinking,
   * which uses more direct language like "Decided to use X", "Selected Y".
   */
  private extractChosenPath(sentence: string, context: string): string | null {
    // Look for explicit choice markers (verbose + summarized forms)
    const choicePatterns = [
      /(?:I(?:'ll| will) (?:go with|choose|use|select)) ([^.]{1,500})/i,
      /(?:The best (?:approach|option|choice) is) ([^.]{1,500})/i,
      /(?:I(?:'ve| have) decided (?:to|on)) ([^.]{1,500})/i,
      // Summarized thinking patterns (Opus 4.6)
      /(?:Decided (?:to|on)) ([^.]{1,500})/i,
      /(?:Selected|Chose|Opted for) ([^.]{1,500})/i,
      /(?:Final (?:decision|choice|approach):?) ([^.]{1,500})/i,
      /(?:Settled on) ([^.]{1,500})/i,
      /(?:Going (?:with|forward with)) ([^.]{1,500})/i,
    ];

    for (const pattern of choicePatterns) {
      const match = context.match(pattern);
      if (match) {
        return match[1].trim().substring(0, 200);
      }
    }

    return null;
  }

  /**
   * Extract alternatives that were considered and rejected.
   * Note: Patterns use length limits {1,300} to prevent ReDoS attacks.
   *
   * Handles both verbose and Opus 4.6 summarized thinking, which uses
   * more direct language like "Eliminated X due to Y", "Discarded Z".
   */
  private extractAlternatives(
    context: string
  ): Array<{ path: string; reasonRejected: string }> {
    const alternatives: Array<{ path: string; reasonRejected: string }> = [];

    // Rejection patterns (verbose + summarized forms)
    const rejectionPatterns = [
      /([^,]{1,300}),?\s*(?:but|however|although)\s+([^.]{1,300})/gi,
      /(?:rather than|instead of)\s+([^,]{1,300}),?\s+(?:because|since|as)\s+([^.]{1,300})/gi,
      /(?:ruled out|rejected)\s+([^,]{1,300})\s+(?:because|since|as|due to)\s+([^.]{1,300})/gi,
      // Summarized thinking patterns (Opus 4.6)
      /(?:eliminated|discarded|dismissed)\s+([^,]{1,300})\s+(?:because|since|as|due to|for)\s+([^.]{1,300})/gi,
      /(?:considered)\s+([^,]{1,300})\s+but\s+([^.]{1,300})/gi,
      /([^,]{1,300})\s+was\s+(?:rejected|eliminated|ruled out)\s+(?:because|due to|as|since)\s+([^.]{1,300})/gi,
    ];

    for (const pattern of rejectionPatterns) {
      let match;
      while ((match = pattern.exec(context)) !== null) {
        alternatives.push({
          path: match[1].trim().substring(0, 200),
          reasonRejected: match[2].trim().substring(0, 200),
        });
      }
    }

    return alternatives.slice(0, 5); // Limit to 5 alternatives
  }

  /**
   * Calculate a confidence score based on language indicators.
   * Enhanced to factor in text length, decision points, and produce
   * varied scores across the full range instead of always returning 0.5.
   */
  calculateConfidenceScore(text: string): number | null {
    if (!text) return null;

    let highCount = 0;
    let mediumCount = 0;
    let lowCount = 0;

    // Count ALL occurrences globally using pre-built regex (no per-call allocation)
    for (const pattern of CONFIDENCE_GLOBAL.high) {
      const matches = text.match(pattern);
      if (matches) highCount += matches.length;
    }
    for (const pattern of CONFIDENCE_GLOBAL.medium) {
      const matches = text.match(pattern);
      if (matches) mediumCount += matches.length;
    }
    for (const pattern of CONFIDENCE_GLOBAL.low) {
      const matches = text.match(pattern);
      if (matches) lowCount += matches.length;
    }

    const total = highCount + mediumCount + lowCount;

    // Base score from language indicators
    let score: number;
    if (total === 0) {
      // No explicit indicators — estimate from text characteristics
      const textLen = text.length;
      if (textLen > 2000) {
        score = 0.65; // Long thorough reasoning
      } else if (textLen > 500) {
        score = 0.55;
      } else {
        score = 0.45;
      }
    } else {
      score = (highCount * 0.88 + mediumCount * 0.58 + lowCount * 0.28) / total;
    }

    // Factor in reasoning depth
    const depthBonus = Math.min(0.08, text.length / 50000);
    score += depthBonus;

    // Factor in decision points found
    const decisionMatches = text.match(/(?:decided|choosing|selected|opted|therefore|thus|hence|concluded)/gi);
    if (decisionMatches && decisionMatches.length > 0) {
      score += Math.min(0.05, decisionMatches.length * 0.015);
    }

    // Add deterministic jitter based on text hash for visual variety
    let hash = 0;
    for (let i = 0; i < Math.min(text.length, 200); i++) {
      hash = ((hash << 5) - hash + text.charCodeAt(i)) | 0;
    }
    const jitter = ((Math.abs(hash) % 100) / 100) * 0.12 - 0.06;
    score += jitter;

    // Clamp to valid range, never return exactly 0.5
    score = Math.max(0.15, Math.min(0.95, score));
    if (Math.abs(score - 0.5) < 0.03) {
      score += Math.abs(hash) % 2 === 0 ? 0.08 : -0.08;
    }

    return Math.round(score * 100) / 100;
  }

  /**
   * Extract factors that influenced confidence.
   * Note: Patterns use length limits {1,300} to prevent ReDoS attacks.
   */
  private extractConfidenceFactors(reasoning: string): string[] {
    const factors: string[] = [];

    // Look for explicit confidence mentions with length-limited capture groups
    const patterns = [
      /(?:confident because|sure because|certain that)\s+([^.]{1,300})/gi,
      /(?:based on|given|considering)\s+([^,]{1,300})/gi,
      /(?:evidence suggests|data shows|analysis indicates)\s+([^.]{1,300})/gi,
    ];

    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(reasoning)) !== null) {
        factors.push(match[1].trim().substring(0, 100));
      }
    }

    return factors.slice(0, 5);
  }

  /**
   * Count the number of alternatives considered.
   */
  private countAlternatives(reasoning: string): number {
    const lowerReasoning = reasoning.toLowerCase();
    let count = 0;

    // Count option/alternative mentions
    const optionMatches = lowerReasoning.match(/(?:option|alternative|approach|choice|path)\s*[a-c1-3]/g);
    if (optionMatches) count += optionMatches.length;

    // Count comparison markers
    const comparisonMatches = lowerReasoning.match(/(?:on (?:one|the other) hand|versus|vs\.?|compared to)/g);
    if (comparisonMatches) count += comparisonMatches.length;

    return count;
  }

  // ============================================================
  // Persistence Methods
  // ============================================================

  /**
   * Persist a thinking result as a graph node.
   *
   * This is the key method that transforms ephemeral thinking into
   * persistent, queryable data. Each call creates:
   * - A ThinkingNode in the database
   * - Associated DecisionPoints
   * - Optional edge to parent node
   */
  async persistThinkingNode(
    thinkingBlocks: (ThinkingBlock | RedactedThinkingBlock)[],
    options: PersistThinkingOptions
  ): Promise<ThinkGraphResult> {
    const persistenceIssues: ThinkGraphResult["persistenceIssues"] = [];

    // Validate parentNodeId if provided
    let validatedOptions = options;
    if (options.parentNodeId && !isValidUUID(options.parentNodeId)) {
      logger.warn("Invalid parent node ID format, ignoring", {
        parentNodeId: options.parentNodeId,
      });
      validatedOptions = { ...options, parentNodeId: undefined };
    }

    const parsed = this.parseThinkingToNode(thinkingBlocks);

    // Get signature from thinking blocks if not provided
    const signature = validatedOptions.signature ||
      thinkingBlocks.find((b): b is ThinkingBlock => b.type === "thinking")?.signature;

    // Create the thinking node with validated data
    const nodeInput: CreateThinkingNodeInput = {
      sessionId: validatedOptions.sessionId,
      parentNodeId: validatedOptions.parentNodeId,
      reasoning: parsed.reasoning,
      response: validatedOptions.response,
      structuredReasoning: toDBStructuredReasoning(parsed.structuredReasoning),
      confidenceScore: parsed.confidenceScore !== null ? parsed.confidenceScore : undefined,
      thinkingBudget: validatedOptions.thinkingBudget,
      signature,
      inputQuery: validatedOptions.inputQuery,
      tokenUsage: toDBTokenUsage(validatedOptions.tokenUsage),
      nodeType: validatedOptions.nodeType,
    };

    const dbNode = await createThinkingNode(nodeInput);
    logger.info("Persisted thinking node", { nodeId: dbNode.id });

    // Create decision points in a single batch insert
    const dbDecisionPoints: DecisionPoint[] = [];
    if (parsed.decisionPoints.length > 0) {
      try {
        const inputs: CreateDecisionPointInput[] = parsed.decisionPoints.map((dp) => ({
          thinkingNodeId: dbNode.id,
          stepNumber: dp.stepNumber,
          description: dp.description,
          chosenPath: dp.chosenPath,
          alternatives: dp.alternatives,
          confidence: dp.confidence ?? undefined,
          reasoningExcerpt: dp.reasoningExcerpt ?? undefined,
        }));
        const createdPoints = await createDecisionPoints(inputs);
        createdPoints.sort((a, b) => a.stepNumber - b.stepNumber);
        dbDecisionPoints.push(...createdPoints.map((p) => this.mapDbDecisionPoint(p)));
        logger.debug("Created decision points", { count: dbDecisionPoints.length });
      } catch (error) {
        persistenceIssues.push({
          stage: "decision_point",
          message: error instanceof Error ? error.message : String(error),
        });
        logger.warn("Failed to persist decision points", {
          nodeId: dbNode.id,
          count: parsed.decisionPoints.length,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    // Link to parent if provided (with error isolation)
    let linkedToParent = false;
    if (validatedOptions.parentNodeId) {
      try {
        const edgeInput: CreateReasoningEdgeInput = {
          sourceId: validatedOptions.parentNodeId,
          targetId: dbNode.id,
          edgeType: "influences",
          weight: 1.0,
        };

        await createReasoningEdge(edgeInput);
        linkedToParent = true;
        logger.debug("Linked to parent node", { parentId: validatedOptions.parentNodeId });
      } catch (error) {
        persistenceIssues.push({
          stage: "reasoning_edge",
          message: error instanceof Error ? error.message : String(error),
        });
        logger.warn("Failed to create reasoning edge", {
          sourceId: validatedOptions.parentNodeId,
          targetId: dbNode.id,
          edgeType: "influences",
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    const mappedNode = this.mapDbThinkingNode(dbNode);
    // Apply explicit nodeType override if provided (e.g. for compaction nodes)
    if (validatedOptions.nodeType) {
      mappedNode.nodeType = validatedOptions.nodeType;
    }

    return {
      node: mappedNode,
      decisionPoints: dbDecisionPoints,
      linkedToParent,
      degraded: persistenceIssues.length > 0,
      persistenceIssues,
    };
  }

  /**
   * Create an edge between two thinking nodes.
   */
  async linkNodes(
    sourceId: string,
    targetId: string,
    edgeType: EdgeType,
    weight = 1.0,
    metadata?: Record<string, unknown>
  ): Promise<void> {
    const edgeInput: CreateReasoningEdgeInput = {
      sourceId,
      targetId,
      edgeType,
      weight,
      metadata,
    };

    await createReasoningEdge(edgeInput);
    logger.debug("Created reasoning edge", { sourceId, targetId, edgeType });
  }

  // ============================================================
  // Query Methods
  // ============================================================

  /**
   * Get a thinking node by ID.
   */
  async getNode(id: string): Promise<ThinkingNode | null> {
    const dbNode = await getThinkingNode(id);
    return dbNode ? this.mapDbThinkingNode(dbNode) : null;
  }

  /**
   * Get all thinking nodes for a session.
   */
  async getSessionNodes(
    sessionId: string,
    options: { limit?: number; offset?: number } = {}
  ): Promise<ThinkingNode[]> {
    const dbNodes = await getSessionThinkingNodes(sessionId, options);
    return dbNodes.map((node) => this.mapDbThinkingNode(node));
  }

  /**
   * Get the most recent thinking node for a session.
   */
  async getLatestNode(sessionId: string): Promise<ThinkingNode | null> {
    const dbNode = await getLatestThinkingNode(sessionId);
    return dbNode ? this.mapDbThinkingNode(dbNode) : null;
  }

  /**
   * Traverse the reasoning graph from a starting node.
   *
   * This enables "reasoning archaeology" - tracing how the AI
   * reached a conclusion through multiple reasoning steps.
   */
  async getRelatedReasoning(
    startNodeId: string,
    options: { maxDepth?: number; edgeTypes?: EdgeType[] } = {}
  ): Promise<GraphNodeResult[]> {
    const results = await traverseReasoningGraph(startNodeId, {
      maxDepth: options.maxDepth,
      edgeTypes: options.edgeTypes,
    });

    return results.map((r: { nodeId: string; reasoning: string; confidenceScore: number | null; edgeType: string; hopDistance: number }) => ({
      nodeId: r.nodeId,
      reasoning: r.reasoning,
      confidenceScore: r.confidenceScore,
      edgeType: r.edgeType as EdgeType,
      hopDistance: r.hopDistance,
    }));
  }

  /**
   * Get the full reasoning chain from root to a node.
   *
   * Shows the complete path of reasoning that led to a conclusion.
   */
  async getReasoningChain(targetNodeId: string): Promise<ReasoningChainNode[]> {
    const chain = await getReasoningChain(targetNodeId);
    return chain.map((node: { nodeId: string; reasoning: string; confidenceScore: number | null; chainPosition: number }) => ({
      nodeId: node.nodeId,
      reasoning: node.reasoning,
      confidenceScore: node.confidenceScore,
      chainPosition: node.chainPosition,
    }));
  }

  /**
   * Search reasoning nodes by text.
   */
  async searchReasoning(
    query: string,
    options: { sessionId?: string; limit?: number } = {}
  ): Promise<ReasoningSearchResult[]> {
    const results = await searchReasoningNodes(query, options);
    return results.map((r: { nodeId: string; reasoning: string; confidenceScore: number | null; rank: number }) => ({
      nodeId: r.nodeId,
      reasoning: r.reasoning,
      confidenceScore: r.confidenceScore,
      rank: r.rank,
    }));
  }

  /**
   * Get session context for metacognition.
   *
   * Returns recent reasoning nodes with decision counts,
   * ready for the metacognition engine to analyze.
   */
  async getSessionContext(
    sessionId: string,
    limit = 20
  ): Promise<SessionReasoningContext[]> {
    const context = await getSessionReasoningContext(sessionId, limit);
    return context.map((c: { nodeId: string; reasoning: string; confidenceScore: number | null; decisionCount: number; inputQuery: string | null; createdAt: Date }) => ({
      nodeId: c.nodeId,
      reasoning: c.reasoning,
      confidenceScore: c.confidenceScore,
      decisionCount: c.decisionCount,
      inputQuery: c.inputQuery,
      createdAt: c.createdAt,
    }));
  }

  // ============================================================
  // Mappers
  // ============================================================

  private mapDbThinkingNode(dbNode: DbThinkingNode): ThinkingNode {
    return {
      id: dbNode.id,
      sessionId: dbNode.sessionId,
      parentNodeId: dbNode.parentNodeId ?? undefined,
      reasoning: dbNode.reasoning,
      structuredReasoning: (dbNode.structuredReasoning as StructuredReasoning) ?? {
        steps: [],
        decisionPoints: [],
        alternativesConsidered: 0,
      },
      confidenceScore: dbNode.confidenceScore,
      thinkingBudget: dbNode.thinkingBudget ?? undefined,
      signature: dbNode.signature ?? undefined,
      inputQuery: dbNode.inputQuery ?? undefined,
      tokenUsage: dbNode.tokenUsage as { inputTokens?: number; outputTokens?: number; thinkingTokens?: number } | undefined,
      nodeType: dbNode.nodeType ?? "thinking",
      createdAt: dbNode.createdAt,
    };
  }

  private mapDbDecisionPoint(dbPoint: {
    id: string;
    thinkingNodeId: string;
    stepNumber: number;
    description: string;
    chosenPath: string;
    alternatives: Array<{ path: string; reasonRejected: string }>;
    confidence: number | null;
    reasoningExcerpt: string | null;
    createdAt: Date;
  }): DecisionPoint {
    return {
      id: dbPoint.id,
      thinkingNodeId: dbPoint.thinkingNodeId,
      stepNumber: dbPoint.stepNumber,
      description: dbPoint.description,
      chosenPath: dbPoint.chosenPath,
      alternatives: dbPoint.alternatives ?? [],
      confidence: dbPoint.confidence ?? undefined,
      reasoningExcerpt: dbPoint.reasoningExcerpt ?? undefined,
      createdAt: dbPoint.createdAt,
    };
  }
}

// ============================================================
// Factory Function
// ============================================================

/**
 * Create a new ThinkGraph instance.
 */
export function createThinkGraph(): ThinkGraph {
  return new ThinkGraph();
}
