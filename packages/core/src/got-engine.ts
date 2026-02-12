/**
 * @module GoT Engine - Graph of Thoughts
 * @scope active
 * @paper Graph of Thoughts (Besta et al., 2023)
 * @description Arbitrary thought graph topology with BFS/DFS/best-first search
 */
import { createLogger } from "@opus-nx/shared";
import { ThinkingEngine } from "./thinking-engine.js";
import type {
  Thought,
  ThoughtState,
  GoTConfig,
  GoTResult,
  GraphReasoningState,
  SearchStrategy,
  Transformation,
  TransformationType,
} from "./types/got.js";
import type { OrchestratorConfig } from "./types/orchestrator.js";

const logger = createLogger("GoTEngine");

// ============================================================
// GoT Thought Generation Tool
// ============================================================

const THOUGHT_GENERATION_TOOL = {
  name: "record_thoughts",
  description: "Record generated thoughts for the current reasoning step.",
  input_schema: {
    type: "object" as const,
    properties: {
      thoughts: {
        type: "array",
        items: {
          type: "object",
          properties: {
            content: {
              type: "string",
              description: "The thought content — a coherent reasoning step",
            },
            confidence: {
              type: "number",
              description: "Confidence in this thought (0.0-1.0)",
            },
          },
          required: ["content", "confidence"],
        },
        description: "List of generated thoughts",
      },
    },
    required: ["thoughts"],
  },
};

const THOUGHT_EVALUATION_TOOL = {
  name: "evaluate_thought",
  description: "Evaluate a thought's quality and correctness.",
  input_schema: {
    type: "object" as const,
    properties: {
      score: {
        type: "number",
        description: "Quality score (0.0-1.0). 0=definitely wrong, 1=definitely correct",
      },
      reasoning: {
        type: "string",
        description: "Brief justification for the score",
      },
      should_continue: {
        type: "boolean",
        description: "Whether this thought is worth exploring further",
      },
    },
    required: ["score", "reasoning", "should_continue"],
  },
};

const AGGREGATION_TOOL = {
  name: "aggregate_thoughts",
  description: "Synthesize multiple thoughts into a unified, stronger thought.",
  input_schema: {
    type: "object" as const,
    properties: {
      synthesis: {
        type: "string",
        description: "The synthesized thought combining the best of all inputs",
      },
      confidence: {
        type: "number",
        description: "Confidence in the synthesis (0.0-1.0)",
      },
      sources_used: {
        type: "array",
        items: { type: "number" },
        description: "Indices of input thoughts that contributed to synthesis",
      },
    },
    required: ["synthesis", "confidence"],
  },
};

// ============================================================
// GoT Engine Options
// ============================================================

export interface GoTEngineOptions {
  /** Callback when a thought is generated */
  onThoughtGenerated?: (thought: Thought) => void;
  /** Callback when a thought is scored */
  onThoughtScored?: (thought: Thought) => void;
  /** Callback when thoughts are aggregated */
  onAggregation?: (inputCount: number, output: Thought) => void;
  /** Callback for streaming thinking */
  onThinkingStream?: (thinking: string) => void;
  /** Callback when a new depth level begins */
  onDepthStart?: (depth: number, maxDepth: number, frontierSize: number) => void;
  /** Callback when thought generation fails */
  onGenerationFailed?: (parentId: string, depth: number, error: string) => void;
  /** Callback when thought evaluation fails */
  onEvaluationFailed?: (thoughtId: string, error: string) => void;
  /** Callback when thought aggregation fails */
  onAggregationFailed?: (inputCount: number, error: string) => void;
  /** Callback for progress updates (partial stats snapshot) */
  onProgress?: (stats: GoTResult["stats"]) => void;
}

// ============================================================
// Graph of Thoughts Engine
// ============================================================

/**
 * GoTEngine implements the Graph of Thoughts reasoning framework.
 *
 * This goes beyond linear Chain-of-Thought and even Tree-of-Thoughts
 * by supporting arbitrary graph topologies with:
 *
 * - **Generation**: Create k diverse thoughts from a parent
 * - **Evaluation**: Score each thought's quality (self-PRM)
 * - **Aggregation**: Merge multiple thoughts into synergistic outputs
 * - **Search**: BFS, DFS, or best-first exploration
 *
 * Key advantage: GoT enables "thought recycling" where partial
 * solutions from different branches can be combined, something
 * impossible in ToT's tree structure.
 */
export class GoTEngine {
  private options: GoTEngineOptions;
  private thoughtCounter = 0;
  private generationFailureStreak = 0;
  private generationCircuitOpenUntil = 0;

  // Reusable engines created per reason() call to avoid
  // instantiating a new Anthropic client for every LLM call.
  private engine: ThinkingEngine | null = null;
  private evalEngine: ThinkingEngine | null = null;

  constructor(options: GoTEngineOptions = {}) {
    this.options = options;
    logger.debug("GoTEngine initialized");
  }

  /**
   * Run Graph of Thoughts reasoning on a problem.
   *
   * Executes the full GoT pipeline:
   * 1. Generate initial thoughts from the problem
   * 2. Evaluate each thought
   * 3. Expand/aggregate based on search strategy
   * 4. Repeat until max depth or convergence
   * 5. Return the best answer
   */
  async reason(
    problem: string,
    config: Partial<GoTConfig> = {}
  ): Promise<GoTResult> {
    const fullConfig: GoTConfig = {
      strategy: config.strategy ?? "bfs",
      maxDepth: config.maxDepth ?? 5,
      branchingFactor: config.branchingFactor ?? 3,
      pruneThreshold: config.pruneThreshold ?? 0.3,
      maxThoughts: config.maxThoughts ?? 50,
      enableAggregation: config.enableAggregation ?? true,
      effort: config.effort ?? "high",
    };

    // Reset per-call state
    this.thoughtCounter = 0;
    this.generationFailureStreak = 0;
    this.generationCircuitOpenUntil = 0;

    // Create reusable engines for this reasoning session
    this.engine = this.createEngineInstance(fullConfig.effort);
    this.evalEngine = this.createEngineInstance(
      fullConfig.effort === "max" ? "high" : fullConfig.effort
    );

    const startTime = Date.now();
    logger.info("Starting GoT reasoning", {
      strategy: fullConfig.strategy,
      maxDepth: fullConfig.maxDepth,
      branchingFactor: fullConfig.branchingFactor,
    });

    // Initialize the graph state
    const state: GraphReasoningState = {
      sessionId: crypto.randomUUID(),
      thoughts: [],
      edges: [],
      bestThoughts: [],
      totalTokens: 0,
      totalDurationMs: 0,
    };

    // Create the root thought from the problem
    const rootThought = this.createThought(problem, 0, "user_input", []);
    rootThought.state = "verified";
    rootThought.score = 1.0;
    state.thoughts.push(rootThought);

    // Execute search strategy
    let stats: GoTResult["stats"] = {
      totalThoughts: 1,
      thoughtsExplored: 0,
      thoughtsPruned: 0,
      aggregationsMade: 0,
      refinementsMade: 0,
      maxDepthReached: 0,
      totalTokens: 0,
      totalDurationMs: 0,
      generationErrors: 0,
      evaluationErrors: 0,
    };

    try {
      switch (fullConfig.strategy) {
        case "bfs":
          stats = await this.searchBFS(state, rootThought, fullConfig);
          break;
        case "dfs":
          stats = await this.searchDFS(state, rootThought, fullConfig);
          break;
        case "best_first":
          stats = await this.searchBestFirst(state, rootThought, fullConfig);
          break;
      }
    } finally {
      // Release engine references after reasoning completes
      this.engine = null;
      this.evalEngine = null;
    }

    // Find the best thought
    const verifiedThoughts = state.thoughts
      .filter((t) => t.state === "verified" && t.score !== null)
      .sort((a, b) => (b.score ?? 0) - (a.score ?? 0));

    const bestThought = verifiedThoughts[0];
    const answer = bestThought?.content ?? "Unable to reach a conclusion.";
    const confidence = bestThought?.score ?? 0;

    state.bestThoughts = verifiedThoughts.slice(0, 3).map((t) => t.id);
    state.totalTokens = stats.totalTokens;
    state.totalDurationMs = Date.now() - startTime;

    // Build reasoning summary
    const reasoningSummary = this.buildReasoningSummary(state, stats);

    logger.info("GoT reasoning complete", {
      answer: answer.slice(0, 100),
      confidence,
      totalThoughts: stats.totalThoughts,
      strategy: fullConfig.strategy,
      durationMs: state.totalDurationMs,
    });

    return {
      answer,
      confidence,
      graphState: state,
      reasoningSummary,
      stats: { ...stats, totalDurationMs: state.totalDurationMs },
    };
  }

  // ============================================================
  // Search Strategies
  // ============================================================

  /**
   * Breadth-First Search: explore level by level, keep top-k per level.
   * (Algorithm 1 from ToT paper, extended with GoT aggregation)
   *
   * At each depth level:
   * 1. Generate k children for each frontier thought
   * 2. Evaluate all children
   * 3. Keep top branchingFactor thoughts
   * 4. Optionally aggregate similar thoughts (GoT extension)
   */
  private async searchBFS(
    state: GraphReasoningState,
    root: Thought,
    config: GoTConfig
  ): Promise<GoTResult["stats"]> {
    let frontier: Thought[] = [root];
    const stats: GoTResult["stats"] = {
      totalThoughts: 1,
      thoughtsExplored: 0,
      thoughtsPruned: 0,
      aggregationsMade: 0,
      refinementsMade: 0,
      maxDepthReached: 0,
      totalTokens: 0,
      totalDurationMs: 0,
      generationErrors: 0,
      evaluationErrors: 0,
    };

    for (let depth = 1; depth <= config.maxDepth; depth++) {
      if (state.thoughts.length >= config.maxThoughts) break;
      if (frontier.length === 0) break;

      logger.debug(`BFS depth ${depth}`, { frontierSize: frontier.length });
      stats.maxDepthReached = depth;
      this.options.onDepthStart?.(depth, config.maxDepth, frontier.length);

      const nextFrontier: Thought[] = [];

      // Generate children for each frontier thought
      for (const parent of frontier) {
        if (state.thoughts.length >= config.maxThoughts) break;

        const children = await this.generateThoughts(
          parent,
          config.branchingFactor,
          depth,
          state,
          stats
        );

        // Evaluate children
        for (const child of children) {
          const score = await this.evaluateThought(child, parent);
          child.score = score;
          child.state = score >= config.pruneThreshold ? "verified" : "rejected";

          if (child.state === "verified") {
            nextFrontier.push(child);
            stats.thoughtsExplored++;
          } else {
            stats.thoughtsPruned++;
          }
          stats.totalThoughts++;
        }
      }

      // Keep only top-k thoughts in the frontier
      nextFrontier.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
      const topK = nextFrontier.slice(0, config.branchingFactor * 2);
      const pruned = nextFrontier.slice(config.branchingFactor * 2);
      stats.thoughtsPruned += pruned.length;

      // GoT extension: aggregate compatible thoughts
      if (config.enableAggregation && topK.length >= 2) {
        const aggregated = await this.tryAggregation(topK, depth, state);
        if (aggregated) {
          topK.push(aggregated);
          stats.aggregationsMade++;
        }
      }

      frontier = topK;
      this.options.onProgress?.({ ...stats });
    }

    return stats;
  }

  /**
   * Depth-First Search: explore deepest branch first, backtrack on failure.
   * (Algorithm 2 from ToT paper)
   *
   * Uses a recursive approach:
   * 1. Generate children for current thought
   * 2. Evaluate and sort by score
   * 3. Recurse into the best child only (true DFS with backtracking)
   * 4. Backtrack if score drops below threshold
   */
  private async searchDFS(
    state: GraphReasoningState,
    root: Thought,
    config: GoTConfig
  ): Promise<GoTResult["stats"]> {
    const stats: GoTResult["stats"] = {
      totalThoughts: 1,
      thoughtsExplored: 0,
      thoughtsPruned: 0,
      aggregationsMade: 0,
      refinementsMade: 0,
      maxDepthReached: 0,
      totalTokens: 0,
      totalDurationMs: 0,
      generationErrors: 0,
      evaluationErrors: 0,
    };

    await this.dfsRecurse(root, 1, state, config, stats);
    return stats;
  }

  private async dfsRecurse(
    current: Thought,
    depth: number,
    state: GraphReasoningState,
    config: GoTConfig,
    stats: GoTResult["stats"]
  ): Promise<void> {
    if (depth > config.maxDepth) return;
    if (state.thoughts.length >= config.maxThoughts) return;

    stats.maxDepthReached = Math.max(stats.maxDepthReached, depth);

    // Generate children
    const children = await this.generateThoughts(
      current,
      config.branchingFactor,
      depth,
      state,
      stats
    );

    // Evaluate and sort
    for (const child of children) {
      const score = await this.evaluateThought(child, current);
      child.score = score;
      child.state = score >= config.pruneThreshold ? "verified" : "rejected";
      stats.totalThoughts++;
    }

    const viable = children
      .filter((c) => c.state === "verified")
      .sort((a, b) => (b.score ?? 0) - (a.score ?? 0));

    const pruned = children.filter((c) => c.state === "rejected");
    stats.thoughtsPruned += pruned.length;

    // True DFS: recurse into the best child only, backtrack if it dead-ends
    if (viable.length > 0) {
      stats.thoughtsExplored++;
      await this.dfsRecurse(viable[0], depth + 1, state, config, stats);
    }

    // Progress at backtrack points
    this.options.onProgress?.({ ...stats });
  }

  /**
   * Best-First Search: always expand the highest-scored thought.
   * Maintains a sorted open set with O(log n) insertion via binary search.
   */
  private async searchBestFirst(
    state: GraphReasoningState,
    root: Thought,
    config: GoTConfig
  ): Promise<GoTResult["stats"]> {
    // Open set maintained in sorted order (highest score first)
    const openSet: Thought[] = [root];
    const stats: GoTResult["stats"] = {
      totalThoughts: 1,
      thoughtsExplored: 0,
      thoughtsPruned: 0,
      aggregationsMade: 0,
      refinementsMade: 0,
      maxDepthReached: 0,
      totalTokens: 0,
      totalDurationMs: 0,
      generationErrors: 0,
      evaluationErrors: 0,
    };

    while (openSet.length > 0 && state.thoughts.length < config.maxThoughts) {
      // Pop the best thought (already sorted, take first)
      const best = openSet.shift()!;

      if (best.depth >= config.maxDepth) continue;

      stats.thoughtsExplored++;
      stats.maxDepthReached = Math.max(stats.maxDepthReached, best.depth);

      // Generate children
      const children = await this.generateThoughts(
        best,
        config.branchingFactor,
        best.depth + 1,
        state,
        stats
      );

      // Evaluate and insert viable children in sorted position
      for (const child of children) {
        const score = await this.evaluateThought(child, best);
        child.score = score;
        child.state = score >= config.pruneThreshold ? "verified" : "rejected";
        stats.totalThoughts++;

        if (child.state === "verified") {
          this.sortedInsert(openSet, child);
        } else {
          stats.thoughtsPruned++;
        }
      }

      // GoT: try aggregation when we have multiple high-score thoughts
      if (config.enableAggregation && openSet.length >= 3) {
        const topThoughts = openSet.slice(0, 3);
        const aggregated = await this.tryAggregation(
          topThoughts,
          best.depth + 1,
          state
        );
        if (aggregated) {
          this.sortedInsert(openSet, aggregated);
          stats.aggregationsMade++;
        }
      }

      // Progress after each expansion
      this.options.onProgress?.({ ...stats });
    }

    return stats;
  }

  /**
   * Insert a thought into a descending-sorted array using binary search.
   * O(log n) search + O(n) shift, but avoids re-sorting the entire array.
   */
  private sortedInsert(arr: Thought[], thought: Thought): void {
    const score = thought.score ?? 0;
    let lo = 0;
    let hi = arr.length;
    while (lo < hi) {
      const mid = (lo + hi) >>> 1;
      if ((arr[mid].score ?? 0) > score) {
        lo = mid + 1;
      } else {
        hi = mid;
      }
    }
    arr.splice(lo, 0, thought);
  }

  private isTransientGenerationError(message: string): boolean {
    const lowered = message.toLowerCase();
    return (
      lowered.includes("connection error") ||
      lowered.includes("econn") ||
      lowered.includes("etimedout") ||
      lowered.includes("timeout") ||
      lowered.includes("rate limit") ||
      lowered.includes("429") ||
      lowered.includes("temporarily unavailable")
    );
  }

  private isGenerationCircuitOpen(): boolean {
    return Date.now() < this.generationCircuitOpenUntil;
  }

  private markGenerationFailure(errorMessage: string): void {
    this.generationFailureStreak += 1;
    if (this.generationFailureStreak >= 3) {
      this.generationCircuitOpenUntil = Date.now() + 30_000;
      logger.warn("GoT generation circuit opened", {
        failureStreak: this.generationFailureStreak,
        cooldownMs: 30_000,
        error: errorMessage,
      });
    }
  }

  private resetGenerationFailureState(): void {
    this.generationFailureStreak = 0;
    this.generationCircuitOpenUntil = 0;
  }

  private async sleep(ms: number): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, ms));
  }

  // ============================================================
  // Core Operations
  // ============================================================

  /**
   * Generate k new thoughts from a parent thought.
   */
  private async generateThoughts(
    parent: Thought,
    k: number,
    depth: number,
    state: GraphReasoningState,
    stats: GoTResult["stats"]
  ): Promise<Thought[]> {
    const engine = this.engine!;

    // Build context using indexed lookup for O(d) ancestor chain
    const thoughtIndex = this.buildThoughtIndex(state);
    const chain = this.getAncestorChain(parent, thoughtIndex);
    const chainContext = chain
      .map((t, i) => `Step ${i + 1}: ${t.content}`)
      .join("\n\n");

    const prompt = `You are exploring solutions to a problem through a graph of thoughts.

## Problem Context
${chain[0]?.content ?? parent.content}

## Reasoning Chain So Far
${chainContext || "(Starting from scratch)"}

## Current Thought (depth ${depth - 1})
${parent.content}

## Task
Generate ${k} distinct next-step thoughts that continue the reasoning. Each thought should:
1. Build on the current reasoning chain
2. Be a coherent, self-contained reasoning step
3. Explore different angles or approaches
4. Be specific enough to evaluate

Use the record_thoughts tool to submit your thoughts.`;

    if (this.isGenerationCircuitOpen()) {
      const cooldownMs = Math.max(0, this.generationCircuitOpenUntil - Date.now());
      const circuitMessage = `Generation circuit is open; retry after ${cooldownMs}ms.`;
      logger.warn("Skipping thought generation while circuit is open", {
        cooldownMs,
      });
      stats.generationErrors++;
      this.options.onGenerationFailed?.(parent.id, depth, circuitMessage);
      return [];
    }

    try {
      const maxAttempts = 3;
      const retryBackoffMs = [700, 1500];
      let result:
        | Awaited<ReturnType<ThinkingEngine["think"]>>
        | null = null;
      let lastErrorMessage = "";

      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
          result = await engine.think(
            "You are a systematic problem solver using Graph of Thoughts reasoning. Generate diverse, high-quality thoughts.",
            [{ role: "user", content: prompt }],
            [THOUGHT_GENERATION_TOOL]
          );
          this.resetGenerationFailureState();
          break;
        } catch (error) {
          lastErrorMessage = error instanceof Error ? error.message : String(error);
          const shouldRetry =
            attempt < maxAttempts &&
            this.isTransientGenerationError(lastErrorMessage);
          if (!shouldRetry) {
            throw error;
          }

          const backoffMs =
            retryBackoffMs[Math.min(attempt - 1, retryBackoffMs.length - 1)];
          logger.warn("Retrying GoT thought generation after transient failure", {
            attempt,
            maxAttempts,
            backoffMs,
            error: lastErrorMessage,
          });
          await this.sleep(backoffMs);
        }
      }

      if (!result) {
        throw new Error(lastErrorMessage || "Thought generation failed");
      }

      const toolUse = result.toolUseBlocks.find((b) => b.name === "record_thoughts");
      if (!toolUse) {
        // Fallback: create single thought from text response.
        const textContent = result.textBlocks.map((b) => b.text).join("\n");
        if (textContent.trim()) {
          const thought = this.createThought(textContent, depth, "generation", [parent.id]);
          state.thoughts.push(thought);
          state.edges.push({
            sourceId: parent.id,
            targetId: thought.id,
            type: "influences",
            weight: 1.0,
          });
          parent.childIds.push(thought.id);
          this.options.onThoughtGenerated?.(thought);
          return [thought];
        }
        return [];
      }

      const input = toolUse.input as {
        thoughts: Array<{ content: string; confidence: number }>;
      };

      const thoughts: Thought[] = [];
      for (const raw of (input.thoughts || []).slice(0, k)) {
        const thought = this.createThought(
          String(raw.content),
          depth,
          "generation",
          [parent.id]
        );
        thought.score = Math.min(1, Math.max(0, Number(raw.confidence) || 0.5));

        state.thoughts.push(thought);
        state.edges.push({
          sourceId: parent.id,
          targetId: thought.id,
          type: "influences",
          weight: 1.0,
        });
        parent.childIds.push(thought.id);

        thoughts.push(thought);
        this.options.onThoughtGenerated?.(thought);
      }

      return thoughts;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error("Thought generation failed", { error: errorMsg });
      stats.generationErrors++;
      this.markGenerationFailure(errorMsg);

      // Create a visible "failed" node so the error appears in the graph
      const failedThought = this.createThought(
        `[Generation failed] ${errorMsg}`,
        depth,
        "generation",
        [parent.id]
      );
      failedThought.state = "rejected";
      failedThought.score = 0;
      failedThought.metadata.tags = ["generation_error"];

      state.thoughts.push(failedThought);
      state.edges.push({
        sourceId: parent.id,
        targetId: failedThought.id,
        type: "influences",
        weight: 0.2,
      });
      parent.childIds.push(failedThought.id);

      this.options.onGenerationFailed?.(parent.id, depth, errorMsg);
      return [];
    }
  }

  /**
   * Evaluate a thought's quality using self-evaluation.
   * Returns a score from 0 to 1.
   *
   * On failure, returns 0.0 (below the default pruneThreshold of 0.3)
   * so failed evaluations don't let thoughts pass through silently.
   */
  private async evaluateThought(
    thought: Thought,
    parent: Thought,
  ): Promise<number> {
    const engine = this.evalEngine!;

    const prompt = `Evaluate this reasoning step for correctness, relevance, and quality.

## Previous Step
${parent.content}

## Step to Evaluate
${thought.content}

## Evaluation Criteria
1. **Logical correctness**: Is the reasoning sound?
2. **Relevance**: Does it advance toward solving the problem?
3. **Novelty**: Does it add new information vs just restating?
4. **Specificity**: Is it concrete enough to act on?

Use the evaluate_thought tool to record your evaluation.`;

    try {
      const result = await engine.think(
        "You are a critical evaluator of reasoning quality. Be honest and precise.",
        [{ role: "user", content: prompt }],
        [THOUGHT_EVALUATION_TOOL]
      );

      const toolUse = result.toolUseBlocks.find((b) => b.name === "evaluate_thought");
      if (toolUse) {
        const input = toolUse.input as {
          score: number;
          reasoning: string;
          should_continue: boolean;
        };
        const score = Math.min(1, Math.max(0, Number(input.score) || 0));
        thought.metadata.tags = thought.metadata.tags ?? [];
        if (!input.should_continue) {
          thought.metadata.tags.push("dead_end");
        }
        this.options.onThoughtScored?.(thought);
        return score;
      }

      // No tool use in response — treat as failed evaluation
      return 0.0;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.warn("Thought evaluation failed, scoring at 0.0 (below prune threshold)", {
        error: errorMsg,
      });
      thought.metadata.tags = thought.metadata.tags ?? [];
      thought.metadata.tags.push("evaluation_error");
      this.options.onEvaluationFailed?.(thought.id, errorMsg);
      return 0.0;
    }
  }

  /**
   * Try to aggregate multiple thoughts into a stronger synthesis.
   * This is the key GoT innovation — combining insights from
   * different branches into a unified thought.
   */
  private async tryAggregation(
    thoughts: Thought[],
    depth: number,
    state: GraphReasoningState
  ): Promise<Thought | null> {
    if (thoughts.length < 2) return null;

    const engine = this.engine!;
    const thoughtList = thoughts
      .map((t, i) => `Thought ${i + 1} (score: ${(t.score ?? 0).toFixed(2)}): ${t.content}`)
      .join("\n\n");

    const prompt = `You have multiple reasoning thoughts from different exploration paths. Synthesize them into a single, stronger thought.

## Thoughts to Aggregate

${thoughtList}

## Task
Combine the strongest elements from these thoughts into a unified reasoning step that is better than any individual thought. Use the aggregate_thoughts tool.`;

    try {
      const result = await engine.think(
        "You are a synthesis expert. Combine diverse reasoning into stronger unified insights.",
        [{ role: "user", content: prompt }],
        [AGGREGATION_TOOL]
      );

      const toolUse = result.toolUseBlocks.find((b) => b.name === "aggregate_thoughts");
      if (toolUse) {
        const input = toolUse.input as {
          synthesis: string;
          confidence: number;
          sources_used?: number[];
        };

        const aggregated = this.createThought(
          String(input.synthesis),
          depth,
          "aggregation",
          thoughts.map((t) => t.id)
        );
        aggregated.score = Math.min(1, Math.max(0, Number(input.confidence) || 0.5));
        aggregated.state = "verified";

        state.thoughts.push(aggregated);

        // Create edges from all source thoughts
        for (const source of thoughts) {
          state.edges.push({
            sourceId: source.id,
            targetId: aggregated.id,
            type: "supports",
            weight: 1.0,
          });
          source.childIds.push(aggregated.id);
          source.state = "aggregated";
        }

        this.options.onAggregation?.(thoughts.length, aggregated);
        return aggregated;
      }

      return null;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.warn("Aggregation failed", { error: errorMsg });
      this.options.onAggregationFailed?.(thoughts.length, errorMsg);
      return null;
    }
  }

  // ============================================================
  // Helpers
  // ============================================================

  private createThought(
    content: string,
    depth: number,
    origin: Thought["origin"],
    parentIds: string[]
  ): Thought {
    this.thoughtCounter++;
    const now = new Date();
    return {
      id: crypto.randomUUID(),
      content,
      state: "generated" as ThoughtState,
      score: null,
      depth,
      origin,
      parentIds,
      childIds: [],
      metadata: {
        stepNumber: this.thoughtCounter,
      },
      createdAt: now,
      updatedAt: now,
    };
  }

  private createEngineInstance(effort: GoTConfig["effort"]): ThinkingEngine {
    const config: OrchestratorConfig = {
      model: "claude-opus-4-6",
      thinking: { type: "adaptive", effort },
      streaming: false,
      maxTokens: 8192,
    };
    return new ThinkingEngine({
      config,
      onThinkingStream: this.options.onThinkingStream,
    });
  }

  /**
   * Build an index from thought ID to Thought for O(1) lookups.
   */
  private buildThoughtIndex(state: GraphReasoningState): Map<string, Thought> {
    const index = new Map<string, Thought>();
    for (const t of state.thoughts) {
      index.set(t.id, t);
    }
    return index;
  }

  /**
   * Get the chain of ancestors from root to the given thought.
   * Uses an indexed Map for O(d) lookup instead of O(n*d).
   */
  private getAncestorChain(thought: Thought, index: Map<string, Thought>): Thought[] {
    const chain: Thought[] = [];
    let current: Thought | undefined = thought;

    while (current) {
      chain.unshift(current);
      if (current.parentIds.length === 0) break;
      // Follow the first parent (primary chain)
      current = index.get(current.parentIds[0]);
    }

    return chain;
  }

  /**
   * Build a human-readable summary of the reasoning process.
   */
  private buildReasoningSummary(
    state: GraphReasoningState,
    stats: GoTResult["stats"]
  ): string {
    const verified = state.thoughts.filter((t) => t.state === "verified");
    const rejected = state.thoughts.filter((t) => t.state === "rejected");
    const aggregated = state.thoughts.filter((t) => t.origin === "aggregation");

    return `## GoT Reasoning Summary

**Strategy**: Explored ${stats.totalThoughts} thoughts across ${stats.maxDepthReached} depth levels.

**Results**:
- ${verified.length} thoughts verified (passed evaluation)
- ${rejected.length} thoughts pruned (below threshold)
- ${aggregated.length} aggregation(s) performed (merging insights)

**Top Thoughts** (by score):
${verified
  .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
  .slice(0, 3)
  .map((t, i) => `${i + 1}. [Score: ${(t.score ?? 0).toFixed(2)}] ${t.content.slice(0, 150)}...`)
  .join("\n")}

**Token Usage**: ${stats.totalTokens.toLocaleString()} tokens`;
  }
}

// ============================================================
// Factory
// ============================================================

export function createGoTEngine(options?: GoTEngineOptions): GoTEngine {
  return new GoTEngine(options);
}
