import { createLogger } from "@opus-nx/shared";
import { z } from "zod";
import {
  createThinkingNode,
  createReasoningEdge,
  createDecisionPoint,
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
    logger.warn("Structured reasoning validation failed, using raw data", {
      errors: result.error.issues.slice(0, 3),
    });
    return data as Record<string, unknown>;
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
    logger.warn("Token usage validation failed, using raw data", {
      errors: result.error.issues.slice(0, 3),
    });
    return data as Record<string, unknown>;
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
  thinkingBudget?: number;
  signature?: string;
  tokenUsage?: TokenUsage;
}

export interface ThinkGraphResult {
  node: ThinkingNode;
  decisionPoints: DecisionPoint[];
  linkedToParent: boolean;
}

// ============================================================
// Decision Point Patterns
// ============================================================

/**
 * Patterns that indicate decision points in reasoning.
 * These help identify where the AI considered alternatives.
 */
const DECISION_PATTERNS = [
  // Explicit decisions
  /(?:I (?:could|should|will|might|need to) (?:either|choose|decide|go with|opt for|select))/i,
  /(?:(?:Option|Approach|Alternative|Choice|Path) [A-C1-3])/i,
  /(?:On (?:one|the other) hand)/i,
  // Comparisons
  /(?:(?:vs|versus|compared to|rather than|instead of|over|between))/i,
  // Trade-offs
  /(?:(?:trade-?off|pros? and cons?|advantages? (?:and|vs) disadvantages?))/i,
  // Conclusions
  /(?:(?:I(?:'ll| will) go with|I(?:'ve| have) decided|The best (?:approach|option|choice)|Therefore|Thus|Hence))/i,
  // Rejection markers
  /(?:(?:However|But|Although|While|rejected|ruled out|not (?:ideal|suitable|appropriate)))/i,
];

/**
 * Confidence indicators in reasoning text
 */
const CONFIDENCE_INDICATORS = {
  high: [
    /(?:certainly|definitely|clearly|undoubtedly|absolutely|confident|sure)/i,
    /(?:strong evidence|conclusive|proven|established)/i,
  ],
  medium: [
    /(?:likely|probably|reasonable|plausible|suggests)/i,
    /(?:based on|indicates|appears to|seems to)/i,
  ],
  low: [
    /(?:uncertain|unclear|might|could|possibly|perhaps)/i,
    /(?:unsure|ambiguous|questionable|tentative)/i,
  ],
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
   */
  private classifyReasoningStep(
    text: string
  ): "analysis" | "hypothesis" | "evaluation" | "conclusion" | "consideration" {
    const lowerText = text.toLowerCase();

    if (
      lowerText.includes("therefore") ||
      lowerText.includes("thus") ||
      lowerText.includes("in conclusion") ||
      lowerText.includes("i will") ||
      lowerText.includes("i'll go with")
    ) {
      return "conclusion";
    }

    if (
      lowerText.includes("if ") ||
      lowerText.includes("assuming") ||
      lowerText.includes("hypothesis") ||
      lowerText.includes("suppose")
    ) {
      return "hypothesis";
    }

    if (
      lowerText.includes("evaluating") ||
      lowerText.includes("comparing") ||
      lowerText.includes("weighing") ||
      lowerText.includes("trade-off")
    ) {
      return "evaluation";
    }

    if (
      lowerText.includes("analyzing") ||
      lowerText.includes("examining") ||
      lowerText.includes("looking at") ||
      lowerText.includes("consider")
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
   */
  private extractChosenPath(sentence: string, context: string): string | null {
    // Look for explicit choice markers with length-limited capture groups
    const choicePatterns = [
      /(?:I(?:'ll| will) (?:go with|choose|use|select)) ([^.]{1,500})/i,
      /(?:The best (?:approach|option|choice) is) ([^.]{1,500})/i,
      /(?:I(?:'ve| have) decided (?:to|on)) ([^.]{1,500})/i,
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
   */
  private extractAlternatives(
    context: string
  ): Array<{ path: string; reasonRejected: string }> {
    const alternatives: Array<{ path: string; reasonRejected: string }> = [];

    // Pattern: "X, but Y" or "X, however Y" with length-limited capture groups
    const rejectionPatterns = [
      /([^,]{1,300}),?\s*(?:but|however|although)\s+([^.]{1,300})/gi,
      /(?:rather than|instead of)\s+([^,]{1,300}),?\s+(?:because|since|as)\s+([^.]{1,300})/gi,
      /(?:ruled out|rejected)\s+([^,]{1,300})\s+(?:because|since|as|due to)\s+([^.]{1,300})/gi,
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
   */
  calculateConfidenceScore(text: string): number | null {
    if (!text) return null;

    let highCount = 0;
    let mediumCount = 0;
    let lowCount = 0;

    for (const pattern of CONFIDENCE_INDICATORS.high) {
      if (pattern.test(text)) highCount++;
    }
    for (const pattern of CONFIDENCE_INDICATORS.medium) {
      if (pattern.test(text)) mediumCount++;
    }
    for (const pattern of CONFIDENCE_INDICATORS.low) {
      if (pattern.test(text)) lowCount++;
    }

    const total = highCount + mediumCount + lowCount;
    if (total === 0) return 0.5; // Neutral confidence

    // Weighted average
    const score = (highCount * 0.9 + mediumCount * 0.6 + lowCount * 0.3) / total;
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
      structuredReasoning: toDBStructuredReasoning(parsed.structuredReasoning),
      confidenceScore: parsed.confidenceScore !== null ? parsed.confidenceScore : undefined,
      thinkingBudget: validatedOptions.thinkingBudget,
      signature,
      inputQuery: validatedOptions.inputQuery,
      tokenUsage: toDBTokenUsage(validatedOptions.tokenUsage),
    };

    const dbNode = await createThinkingNode(nodeInput);
    logger.info("Persisted thinking node", { nodeId: dbNode.id });

    // Create decision points with individual error handling
    const dbDecisionPoints: DecisionPoint[] = [];
    if (parsed.decisionPoints.length > 0) {
      for (const dp of parsed.decisionPoints) {
        try {
          const input: CreateDecisionPointInput = {
            thinkingNodeId: dbNode.id,
            stepNumber: dp.stepNumber,
            description: dp.description,
            chosenPath: dp.chosenPath,
            alternatives: dp.alternatives,
            confidence: dp.confidence ?? undefined,
            reasoningExcerpt: dp.reasoningExcerpt ?? undefined,
          };
          const createdPoint = await createDecisionPoint(input);
          dbDecisionPoints.push(this.mapDbDecisionPoint(createdPoint));
        } catch (error) {
          logger.warn("Failed to persist decision point", {
            nodeId: dbNode.id,
            stepNumber: dp.stepNumber,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }
      logger.debug("Created decision points", { count: dbDecisionPoints.length });
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
        logger.warn("Failed to create reasoning edge", {
          sourceId: validatedOptions.parentNodeId,
          targetId: dbNode.id,
          edgeType: "influences",
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return {
      node: this.mapDbThinkingNode(dbNode),
      decisionPoints: dbDecisionPoints,
      linkedToParent,
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
