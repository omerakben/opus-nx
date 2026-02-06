import { createLogger } from "@opus-nx/shared";
import { createSession, updateSessionPlan } from "@opus-nx/db";
import { ThinkingEngine } from "./thinking-engine.js";
import { MemoryManager } from "./memory-manager.js";
import { ThinkGraph, type ThinkGraphResult } from "./think-graph.js";
import type {
  OrchestratorConfig,
  OrchestratorSession,
  TaskPlan,
  Task,
  ContentBlock,
  ToolUseBlock,
  AgentsConfig,
  ThinkingBlock,
  ThinkingNode,
} from "./types/index.js";

const logger = createLogger("Orchestrator");

// ============================================================
// Orchestrator Options
// ============================================================

export interface OrchestratorOptions {
  config: OrchestratorConfig;
  agentsConfig: AgentsConfig;
  systemPrompt: string;
  onThinkingStream?: (thinking: string) => void;
  onTextStream?: (text: string) => void;
  onTaskUpdate?: (task: Task) => void;
  onPlanUpdate?: (plan: TaskPlan) => void;
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
 */
export class Orchestrator {
  private thinkingEngine: ThinkingEngine;
  private memoryManager: MemoryManager;
  private thinkGraph: ThinkGraph;
  private agentsConfig: AgentsConfig;
  private systemPrompt: string;
  private session: OrchestratorSession | null = null;
  private lastThinkingNodeId: string | null = null;
  private onTaskUpdate?: (task: Task) => void;
  private onPlanUpdate?: (plan: TaskPlan) => void;
  private onThinkingNodeCreated?: (node: ThinkingNode) => void;

  constructor(options: OrchestratorOptions) {
    this.thinkingEngine = new ThinkingEngine({
      config: options.config,
      onThinkingStream: options.onThinkingStream,
      onTextStream: options.onTextStream,
    });
    this.memoryManager = new MemoryManager();
    this.thinkGraph = new ThinkGraph();
    this.agentsConfig = options.agentsConfig;
    this.systemPrompt = options.systemPrompt;
    this.onTaskUpdate = options.onTaskUpdate;
    this.onPlanUpdate = options.onPlanUpdate;
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

    logger.info("Processing user message", {
      sessionId: this.session.id,
      messageLength: userMessage.length,
    });

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

    // Store thinking blocks for session history
    const thinkingBlocks = result.thinkingBlocks.filter(
      (b): b is ThinkingBlock => b.type === "thinking"
    );
    this.session.thinkingHistory.push(...thinkingBlocks);

    // Persist thinking to ThinkGraph - this is the core innovation!
    // Every reasoning session becomes a queryable graph node
    let thinkingNode: ThinkingNode | undefined;
    if (result.thinkingBlocks.length > 0) {
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

      logger.info("Persisted thinking node to ThinkGraph", {
        nodeId: graphResult.node.id,
        decisionPoints: graphResult.decisionPoints.length,
        linkedToParent: graphResult.linkedToParent,
      });
    }

    // Parse the response to extract task plan
    const plan = this.parseTaskPlan(result.content);
    if (plan) {
      this.session.currentPlan = plan;
      this.onPlanUpdate?.(plan);

      // Persist plan to database
      await updateSessionPlan(this.session.id, plan as unknown as Record<string, unknown>);
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
    };
  }

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
    onTaskUpdate?: (task: Task) => void;
    onPlanUpdate?: (plan: TaskPlan) => void;
    onThinkingNodeCreated?: (node: ThinkingNode) => void;
  }): void {
    this.thinkingEngine.setCallbacks({
      onThinkingStream: callbacks.onThinkingStream,
      onTextStream: callbacks.onTextStream,
    });
    this.onTaskUpdate = callbacks.onTaskUpdate;
    this.onPlanUpdate = callbacks.onPlanUpdate;
    this.onThinkingNodeCreated = callbacks.onThinkingNodeCreated;
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
