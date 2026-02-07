import { createLogger } from "@opus-nx/shared";
import { createSession, updateSessionPlan } from "@opus-nx/db";
import { ThinkingEngine } from "./thinking-engine.js";
import { MemoryManager } from "./memory-manager.js";
import { ThinkGraph } from "./think-graph.js";
import type {
  OrchestratorConfig,
  OrchestratorSession,
  TaskPlan,
  Task,
  ContentBlock,
  ToolUseBlock,
  CompactionBlock,
  AgentsConfig,
  ThinkingBlock,
  ThinkingNode,
  EffortRoutingConfig,
  TokenBudgetConfig,
} from "./types/index.js";

const logger = createLogger("Orchestrator");

// ============================================================
// Complexity Classification
// ============================================================

type TaskComplexity = "simple" | "standard" | "complex";

/**
 * Patterns used to classify task complexity for dynamic effort routing.
 * Simple tasks get lower effort (faster, cheaper), complex tasks get max effort.
 */
const COMPLEXITY_PATTERNS = {
  simple: [
    /^(?:hi|hello|hey|thanks|thank you|ok|sure|yes|no)\b/i,
    /^(?:what (?:is|are)|who (?:is|are)|when (?:did|was|is))\b/i,
    /^(?:define|explain briefly|summarize)\b/i,
  ],
  complex: [
    /(?:debug|troubleshoot|diagnose|fix (?:the|this|my))\b/i,
    /(?:architect|design|plan|strategy|analyze in depth)\b/i,
    /(?:compare and contrast|trade-?offs?|pros? and cons?)\b/i,
    /(?:research|investigate|deep dive|comprehensive)\b/i,
    /(?:step by step|multi-?step|workflow|pipeline)\b/i,
    /(?:refactor|optimize|improve performance)\b/i,
  ],
};

// ============================================================
// Orchestrator Options
// ============================================================

export interface OrchestratorOptions {
  config: OrchestratorConfig;
  agentsConfig: AgentsConfig;
  systemPrompt: string;
  onThinkingStream?: (thinking: string) => void;
  onTextStream?: (text: string) => void;
  onCompactionStream?: (summary: string) => void;
  onTaskUpdate?: (task: Task) => void;
  onPlanUpdate?: (plan: TaskPlan) => void;
  /** Called when token budget warning threshold is reached */
  onBudgetWarning?: (usage: { used: number; max: number; percent: number }) => void;
  /** Called when token budget is exhausted */
  onBudgetExhausted?: (usage: { used: number; max: number }) => void;
}

// ============================================================
// Orchestrator Result
// ============================================================

export interface OrchestratorResult {
  response: string;
  plan?: TaskPlan;
  thinkingBlocks: ThinkingBlock[];
  knowledgeContext?: string;
  /** The persisted thinking node from ThinkGraph */
  thinkingNode?: ThinkingNode;
  /** Persistence metadata for degraded-state signaling */
  graphPersistence?: {
    degraded: boolean;
    issues: Array<{
      stage: "node" | "decision_point" | "reasoning_edge";
      message: string;
      stepNumber?: number;
    }>;
  };
  /** Whether context compaction occurred during this request */
  compacted: boolean;
  /** Compaction summary if compaction occurred */
  compactionSummary?: string;
  /** The effort level that was actually used (from dynamic routing) */
  effectiveEffort: "low" | "medium" | "high" | "max";
  /** Detected task complexity */
  taskComplexity: TaskComplexity;
  /** Token budget status */
  budgetStatus?: {
    cumulativeOutputTokens: number;
    maxSessionOutputTokens: number;
    compactionCount: number;
    maxCompactions: number;
    percentUsed: number;
  };
}

// ============================================================
// Orchestrator
// ============================================================

/**
 * Orchestrator is the central brain of Opus Nx.
 *
 * It uses Claude Opus 4.6 with extended thinking to:
 * 1. Understand user requests deeply
 * 2. Decompose complex goals into discrete tasks
 * 3. Route tasks to specialized sub-agents
 * 4. Synthesize results into coherent responses
 *
 * Opus 4.6 Enhancements:
 * - Dynamic effort routing: auto-adjusts thinking depth based on task complexity
 * - Compaction-aware graph: creates boundary nodes when context is compacted
 * - Token budget enforcement: tracks cumulative usage and enforces session limits
 */
export class Orchestrator {
  private thinkingEngine: ThinkingEngine;
  private memoryManager: MemoryManager;
  private thinkGraph: ThinkGraph;
  private config: OrchestratorConfig;
  private agentsConfig: AgentsConfig;
  private systemPrompt: string;
  private session: OrchestratorSession | null = null;
  private lastThinkingNodeId: string | null = null;
  private onTaskUpdate?: (task: Task) => void;
  private onPlanUpdate?: (plan: TaskPlan) => void;
  private onThinkingNodeCreated?: (node: ThinkingNode) => void;
  private onBudgetWarning?: (usage: { used: number; max: number; percent: number }) => void;
  private onBudgetExhausted?: (usage: { used: number; max: number }) => void;

  constructor(options: OrchestratorOptions) {
    this.config = options.config;
    this.thinkingEngine = new ThinkingEngine({
      config: options.config,
      onThinkingStream: options.onThinkingStream,
      onTextStream: options.onTextStream,
      onCompactionStream: options.onCompactionStream,
    });
    this.memoryManager = new MemoryManager();
    this.thinkGraph = new ThinkGraph();
    this.agentsConfig = options.agentsConfig;
    this.systemPrompt = options.systemPrompt;
    this.onTaskUpdate = options.onTaskUpdate;
    this.onPlanUpdate = options.onPlanUpdate;
    this.onBudgetWarning = options.onBudgetWarning;
    this.onBudgetExhausted = options.onBudgetExhausted;
  }

  /**
   * Start a new orchestration session
   */
  async startSession(userId?: string): Promise<OrchestratorSession> {
    logger.info("Starting new orchestration session", { userId });

    // Create session in database
    const dbSession = await createSession({ userId });

    this.session = {
      id: dbSession.id,
      userId,
      messages: [],
      thinkingHistory: [],
      currentPlan: null,
      knowledgeContext: [],
      compactionCount: 0,
      cumulativeOutputTokens: 0,
      budgetWarningTriggered: false,
      createdAt: dbSession.createdAt,
      updatedAt: dbSession.updatedAt,
    };

    return this.session;
  }

  /**
   * Process a user message through the orchestrator
   */
  async process(userMessage: string): Promise<OrchestratorResult> {
    if (!this.session) {
      throw new Error("Session not started. Call startSession first.");
    }

    // Check token budget before processing
    if (this.isTokenBudgetExhausted()) {
      const budgetConfig = this.config.tokenBudget!;
      this.onBudgetExhausted?.({
        used: this.session.cumulativeOutputTokens,
        max: budgetConfig.maxSessionOutputTokens,
      });
      return {
        response: `Session token budget exhausted (${this.session.cumulativeOutputTokens.toLocaleString()} / ${budgetConfig.maxSessionOutputTokens.toLocaleString()} output tokens used). Start a new session to continue.`,
        thinkingBlocks: [],
        compacted: false,
        effectiveEffort: "low",
        taskComplexity: "simple",
        budgetStatus: this.getBudgetStatus(),
      };
    }

    // Check compaction limit
    if (this.isCompactionLimitReached()) {
      const budgetConfig = this.config.tokenBudget!;
      return {
        response: `Session compaction limit reached (${this.session.compactionCount} / ${budgetConfig.maxCompactions} compactions). Start a new session for fresh context.`,
        thinkingBlocks: [],
        compacted: false,
        effectiveEffort: "low",
        taskComplexity: "simple",
        budgetStatus: this.getBudgetStatus(),
      };
    }

    // Classify task complexity for dynamic effort routing
    const taskComplexity = this.classifyComplexity(userMessage);
    const effectiveEffort = this.getEffortForComplexity(taskComplexity);

    logger.info("Processing user message", {
      sessionId: this.session.id,
      messageLength: userMessage.length,
      taskComplexity,
      effectiveEffort,
    });

    // Apply dynamic effort routing by temporarily adjusting the engine config
    const originalEffort = this.config.thinking.effort;
    this.thinkingEngine.updateConfig({
      thinking: { ...this.config.thinking, effort: effectiveEffort },
    });

    try {
      // Retrieve relevant knowledge context
      const knowledgeContext = await this.memoryManager.buildContextString(userMessage, {
        limit: 5,
        includeRelated: true,
      });

      // Build the routing prompt with agent context
      const routingPrompt = this.buildRoutingPrompt(userMessage, knowledgeContext);

      // Execute thinking with Opus 4.6
      const result = await this.thinkingEngine.think(
        this.systemPrompt,
        [{ role: "user", content: routingPrompt }],
        this.buildRoutingTools()
      );

      // Track cumulative token usage
      this.session.cumulativeOutputTokens += result.usage.outputTokens;
      this.checkBudgetWarning();

      // Store thinking blocks for session history
      const thinkingBlocks = result.thinkingBlocks.filter(
        (b): b is ThinkingBlock => b.type === "thinking"
      );
      this.session.thinkingHistory.push(...thinkingBlocks);
      // Cap thinking history to prevent unbounded memory growth
      if (this.session.thinkingHistory.length > 50) {
        this.session.thinkingHistory = this.session.thinkingHistory.slice(-50);
      }

      // Persist thinking to ThinkGraph - this is the core innovation!
      // Every reasoning session becomes a queryable graph node
      let thinkingNode: ThinkingNode | undefined;
      let graphPersistence: OrchestratorResult["graphPersistence"];
      if (result.thinkingBlocks.length > 0) {
        try {
          const graphResult = await this.thinkGraph.persistThinkingNode(
            result.thinkingBlocks,
            {
              sessionId: this.session.id,
              parentNodeId: this.lastThinkingNodeId ?? undefined,
              inputQuery: userMessage,
              tokenUsage: result.usage,
            }
          );

          thinkingNode = graphResult.node;
          this.lastThinkingNodeId = graphResult.node.id;
          this.onThinkingNodeCreated?.(graphResult.node);
          graphPersistence = {
            degraded: graphResult.degraded,
            issues: graphResult.persistenceIssues,
          };

          if (graphResult.degraded) {
            logger.warn("ThinkGraph persistence completed with degradation", {
              nodeId: graphResult.node.id,
              issues: graphResult.persistenceIssues,
            });
          }

          logger.info("Persisted thinking node to ThinkGraph", {
            nodeId: graphResult.node.id,
            decisionPoints: graphResult.decisionPoints.length,
            linkedToParent: graphResult.linkedToParent,
          });
        } catch (error) {
          graphPersistence = {
            degraded: true,
            issues: [{
              stage: "node",
              message: error instanceof Error ? error.message : String(error),
            }],
          };
          logger.error("Failed to persist thinking node (continuing without)", {
            sessionId: this.session.id,
            error: error instanceof Error ? error.message : String(error),
          });
          // Continue without thinkingNode - graceful degradation
        }
      }

      // Parse the response to extract task plan
      const plan = this.parseTaskPlan(result.content);
      if (plan) {
        this.session.currentPlan = plan;
        this.onPlanUpdate?.(plan);

        // Persist plan to database
        await updateSessionPlan(this.session.id, plan as unknown as Record<string, unknown>);
      }

      // Handle compaction events — create compaction boundary nodes
      let compactionSummary: string | undefined;
      if (result.compacted && result.compactionBlocks.length > 0) {
        compactionSummary = await this.handleCompactionEvent(result);
      }

      // Get the text response
      const textResponse = result.textBlocks.map((b) => b.text).join("\n");

      this.session.updatedAt = new Date();

      return {
        response: textResponse,
        plan: plan ?? undefined,
        thinkingBlocks,
        knowledgeContext: knowledgeContext || undefined,
        thinkingNode,
        graphPersistence,
        compacted: result.compacted,
        compactionSummary,
        effectiveEffort,
        taskComplexity,
        budgetStatus: this.getBudgetStatus(),
      };
    } finally {
      // Restore original effort level
      this.thinkingEngine.updateConfig({
        thinking: { ...this.config.thinking, effort: originalEffort },
      });
    }
  }

  // ============================================================
  // Dynamic Effort Routing
  // ============================================================

  /**
   * Classify the complexity of a user message.
   *
   * Uses pattern matching to determine if a task is simple, standard, or complex.
   * This enables the orchestrator to auto-adjust thinking effort.
   */
  private classifyComplexity(message: string): TaskComplexity {
    // Check for complex patterns first (takes priority)
    for (const pattern of COMPLEXITY_PATTERNS.complex) {
      if (pattern.test(message)) {
        return "complex";
      }
    }

    // Check for simple patterns
    for (const pattern of COMPLEXITY_PATTERNS.simple) {
      if (pattern.test(message)) {
        return "simple";
      }
    }

    // Default: standard complexity
    // Also consider message length as a heuristic
    if (message.length < 50) {
      return "simple";
    }
    if (message.length > 500) {
      return "complex";
    }

    return "standard";
  }

  /**
   * Get the appropriate effort level for a given complexity.
   * Uses effortRouting config if available, otherwise falls back to defaults.
   */
  private getEffortForComplexity(complexity: TaskComplexity): "low" | "medium" | "high" | "max" {
    const routing = this.config.effortRouting;

    if (!routing?.enabled) {
      // No dynamic routing — use the configured default effort
      return this.config.thinking.effort;
    }

    switch (complexity) {
      case "simple":
        return routing.simpleEffort;
      case "standard":
        return routing.standardEffort;
      case "complex":
        return routing.complexEffort;
    }
  }

  // ============================================================
  // Compaction Boundary Nodes
  // ============================================================

  /**
   * Handle a compaction event by creating a boundary node in the ThinkGraph.
   *
   * Compaction boundary nodes are special graph nodes that mark where context
   * was summarized. They enable:
   * - Visualizing where memory consolidation occurred
   * - Linking pre-compaction reasoning chains to post-compaction chains
   * - Tracking how many compactions the session has undergone
   * - Creating "supersedes" edges from the last thinking node
   */
  private async handleCompactionEvent(
    result: { compactionBlocks: CompactionBlock[]; usage: { inputTokens: number; outputTokens: number } }
  ): Promise<string | undefined> {
    if (!this.session) return undefined;

    const compactionSummary = result.compactionBlocks.map((b) => b.content).join("\n");
    this.session.compactionCount++;
    this.session.lastCompactionSummary = compactionSummary;

    // Create a compaction boundary node in the graph
    try {
      const preCompactionNodeId = this.lastThinkingNodeId;

      const compactionGraphResult = await this.thinkGraph.persistThinkingNode(
        [{
          type: "thinking" as const,
          thinking: `[COMPACTION BOUNDARY #${this.session.compactionCount}]\n\nContext compacted at ${new Date().toISOString()}.\nPre-compaction reasoning chain has been summarized.\n\n## Compaction Summary\n\n${compactionSummary}\n\n## Session State\n- Compaction count: ${this.session.compactionCount}\n- Cumulative output tokens: ${this.session.cumulativeOutputTokens.toLocaleString()}\n- Thinking nodes before compaction: ${this.session.thinkingHistory.length}`,
          signature: "compaction-boundary",
        }],
        {
          sessionId: this.session.id,
          parentNodeId: preCompactionNodeId ?? undefined,
          inputQuery: `[Compaction Boundary #${this.session.compactionCount}] Memory consolidation at ${new Date().toISOString()}`,
          tokenUsage: result.usage,
          nodeType: "compaction",
        }
      );

      const boundaryNodeId = compactionGraphResult.node.id;
      this.lastThinkingNodeId = boundaryNodeId;

      // Create a "supersedes" edge from the pre-compaction node to the boundary
      // This marks that the boundary node represents consolidated reasoning
      if (preCompactionNodeId) {
        try {
          await this.thinkGraph.linkNodes(
            preCompactionNodeId,
            boundaryNodeId,
            "supersedes",
            1.0,
            {
              compactionNumber: this.session.compactionCount,
              reason: "Context compacted — pre-compaction reasoning summarized into boundary node",
            }
          );
        } catch (error) {
          logger.warn("Failed to create supersedes edge for compaction boundary", {
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

      logger.info("Compaction boundary node created", {
        nodeId: boundaryNodeId,
        compactionNumber: this.session.compactionCount,
        summaryLength: compactionSummary.length,
        preCompactionNodeId,
      });
    } catch (error) {
      logger.warn("Failed to persist compaction boundary node", {
        error: error instanceof Error ? error.message : String(error),
      });
    }

    return compactionSummary;
  }

  // ============================================================
  // Token Budget Enforcement
  // ============================================================

  /**
   * Check if the session token budget has been exhausted.
   */
  private isTokenBudgetExhausted(): boolean {
    if (!this.config.tokenBudget?.enabled || !this.session) return false;
    return this.session.cumulativeOutputTokens >= this.config.tokenBudget.maxSessionOutputTokens;
  }

  /**
   * Check if the compaction limit has been reached.
   */
  private isCompactionLimitReached(): boolean {
    if (!this.config.tokenBudget?.enabled || !this.session) return false;
    return this.session.compactionCount >= this.config.tokenBudget.maxCompactions;
  }

  /**
   * Check if budget warning threshold has been reached and fire callback.
   */
  private checkBudgetWarning(): void {
    if (!this.config.tokenBudget?.enabled || !this.session) return;
    if (this.session.budgetWarningTriggered) return;

    const budget = this.config.tokenBudget;
    const percentUsed = (this.session.cumulativeOutputTokens / budget.maxSessionOutputTokens) * 100;

    if (percentUsed >= budget.warnAtPercent) {
      this.session.budgetWarningTriggered = true;
      this.onBudgetWarning?.({
        used: this.session.cumulativeOutputTokens,
        max: budget.maxSessionOutputTokens,
        percent: Math.round(percentUsed),
      });

      logger.warn("Token budget warning threshold reached", {
        sessionId: this.session.id,
        percentUsed: Math.round(percentUsed),
        used: this.session.cumulativeOutputTokens,
        max: budget.maxSessionOutputTokens,
      });
    }
  }

  /**
   * Get current budget status for the session.
   */
  private getBudgetStatus(): OrchestratorResult["budgetStatus"] {
    if (!this.config.tokenBudget?.enabled || !this.session) return undefined;
    const budget = this.config.tokenBudget;
    return {
      cumulativeOutputTokens: this.session.cumulativeOutputTokens,
      maxSessionOutputTokens: budget.maxSessionOutputTokens,
      compactionCount: this.session.compactionCount,
      maxCompactions: budget.maxCompactions,
      percentUsed: Math.round((this.session.cumulativeOutputTokens / budget.maxSessionOutputTokens) * 100),
    };
  }

  // ============================================================
  // Routing Logic
  // ============================================================

  /**
   * Build the routing prompt with agent and knowledge context
   */
  private buildRoutingPrompt(userMessage: string, knowledgeContext: string): string {
    const agentList = Object.entries(this.agentsConfig.agents)
      .map(([name, config]) => `- **${name}**: ${config.description} (${config.model})`)
      .join("\n");

    let prompt = `## User Request

${userMessage}

## Available Agents

${agentList}

## Instructions

Analyze this request and determine the best approach:

1. **Simple Request**: If the request is straightforward and doesn't require multiple agents, respond directly.

2. **Complex Request**: If the request requires multiple steps or specialized knowledge:
   - Use the \`create_task_plan\` tool to decompose into tasks
   - Assign each task to the most appropriate agent
   - Consider dependencies between tasks

3. **Single Agent**: If the request is complex but only needs one specialist:
   - Use the \`route_to_agent\` tool to delegate to that agent

Think carefully about the optimal approach. Consider:
- What knowledge is needed?
- What actions need to be taken?
- What order should tasks be executed?
- Which agents are best suited for each part?`;

    if (knowledgeContext) {
      prompt = `${knowledgeContext}\n\n${prompt}`;
    }

    return prompt;
  }

  /**
   * Build the tools available for task routing
   */
  private buildRoutingTools() {
    return [
      {
        name: "create_task_plan",
        description: "Create a plan with tasks assigned to specialized agents. Use this for complex requests that require multiple steps or agents.",
        input_schema: {
          type: "object" as const,
          properties: {
            goal: {
              type: "string",
              description: "The overall goal this plan achieves"
            },
            tasks: {
              type: "array",
              description: "List of tasks to execute",
              items: {
                type: "object",
                properties: {
                  description: {
                    type: "string",
                    description: "Clear description of what this task should accomplish"
                  },
                  assignedAgent: {
                    type: "string",
                    enum: ["research", "code", "knowledge", "planning", "communication"],
                    description: "The agent best suited for this task"
                  },
                  dependencies: {
                    type: "array",
                    items: { type: "string" },
                    description: "IDs of tasks that must complete before this one",
                  },
                },
                required: ["description", "assignedAgent"],
              },
            },
          },
          required: ["goal", "tasks"],
        },
      },
      {
        name: "route_to_agent",
        description: "Route the request to a single specialized agent. Use this when only one specialist is needed.",
        input_schema: {
          type: "object" as const,
          properties: {
            agent: {
              type: "string",
              enum: ["research", "code", "knowledge", "planning", "communication"],
              description: "The agent to route to"
            },
            context: {
              type: "string",
              description: "Additional context for the agent"
            },
          },
          required: ["agent", "context"],
        },
      },
    ];
  }

  /**
   * Parse tool use blocks to extract task plan
   */
  private parseTaskPlan(content: ContentBlock[]): TaskPlan | null {
    for (const block of content) {
      if (block.type === "tool_use" && block.name === "create_task_plan") {
        const input = block.input as {
          goal: string;
          tasks: Array<{
            description: string;
            assignedAgent: string;
            dependencies?: string[];
          }>
        };

        const plan: TaskPlan = {
          id: crypto.randomUUID(),
          goal: input.goal,
          tasks: input.tasks.map((t, i) => ({
            id: `task-${i + 1}`,
            description: t.description,
            assignedAgent: t.assignedAgent as Task["assignedAgent"],
            status: "pending" as const,
            dependencies: t.dependencies ?? [],
          })),
          createdAt: new Date(),
          status: "planning",
        };

        logger.info("Created task plan", {
          planId: plan.id,
          goal: plan.goal,
          taskCount: plan.tasks.length,
        });

        return plan;
      }
    }
    return null;
  }

  // ============================================================
  // Public Accessors
  // ============================================================

  /**
   * Get the current session
   */
  getSession(): OrchestratorSession | null {
    return this.session;
  }

  /**
   * Update streaming callbacks
   */
  setCallbacks(callbacks: {
    onThinkingStream?: (thinking: string) => void;
    onTextStream?: (text: string) => void;
    onCompactionStream?: (summary: string) => void;
    onTaskUpdate?: (task: Task) => void;
    onPlanUpdate?: (plan: TaskPlan) => void;
    onThinkingNodeCreated?: (node: ThinkingNode) => void;
    onBudgetWarning?: (usage: { used: number; max: number; percent: number }) => void;
    onBudgetExhausted?: (usage: { used: number; max: number }) => void;
  }): void {
    this.thinkingEngine.setCallbacks({
      onThinkingStream: callbacks.onThinkingStream,
      onTextStream: callbacks.onTextStream,
      onCompactionStream: callbacks.onCompactionStream,
    });
    this.onTaskUpdate = callbacks.onTaskUpdate;
    this.onPlanUpdate = callbacks.onPlanUpdate;
    this.onThinkingNodeCreated = callbacks.onThinkingNodeCreated;
    this.onBudgetWarning = callbacks.onBudgetWarning;
    this.onBudgetExhausted = callbacks.onBudgetExhausted;
  }

  /**
   * Get the ThinkGraph instance for direct graph operations.
   *
   * Use this for:
   * - Querying past reasoning
   * - Traversing the reasoning graph
   * - Searching reasoning nodes
   */
  getThinkGraph(): ThinkGraph {
    return this.thinkGraph;
  }

  /**
   * Get the ID of the last thinking node created.
   * Useful for linking new reasoning to existing chains.
   */
  getLastThinkingNodeId(): string | null {
    return this.lastThinkingNodeId;
  }
}
