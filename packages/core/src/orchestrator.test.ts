import { describe, it, expect, vi, beforeEach } from "vitest";
import { Orchestrator, type OrchestratorOptions, type OrchestratorResult } from "./orchestrator.js";
import type {
  OrchestratorConfig,
  AgentsConfig,
  ThinkingBlock,
  TextBlock,
  ToolUseBlock,
  CompactionBlock,
  ThinkingResult,
} from "./types/index.js";

// ============================================================
// Mock External Dependencies
// ============================================================

// Mock @opus-nx/shared
vi.mock("@opus-nx/shared", () => ({
  createLogger: () => ({
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

// Mock @opus-nx/db
const mockCreateSession = vi.fn();
const mockUpdateSessionPlan = vi.fn();

vi.mock("@opus-nx/db", () => ({
  createSession: (...args: unknown[]) => mockCreateSession(...args),
  updateSessionPlan: (...args: unknown[]) => mockUpdateSessionPlan(...args),
}));

// Mock ThinkingEngine
const mockThink = vi.fn();
const mockUpdateConfig = vi.fn();
const mockSetCallbacks = vi.fn();

vi.mock("./thinking-engine.js", () => {
  return {
    ThinkingEngine: class MockThinkingEngine {
      think = mockThink;
      updateConfig = mockUpdateConfig;
      setCallbacks = mockSetCallbacks;
      constructor() {}
    },
  };
});

// Mock MemoryManager
const mockBuildContextString = vi.fn();

vi.mock("./memory-manager.js", () => {
  return {
    MemoryManager: class MockMemoryManager {
      buildContextString = mockBuildContextString;
      constructor() {}
    },
  };
});

// Mock ThinkGraph
const mockPersistThinkingNode = vi.fn();
const mockLinkNodes = vi.fn();

vi.mock("./think-graph.js", () => {
  return {
    ThinkGraph: class MockThinkGraph {
      persistThinkingNode = mockPersistThinkingNode;
      linkNodes = mockLinkNodes;
      constructor() {}
    },
  };
});

// ============================================================
// Test Helpers
// ============================================================

function createBaseConfig(overrides: Partial<OrchestratorConfig> = {}): OrchestratorConfig {
  return {
    model: "claude-opus-4-6",
    maxTokens: 16384,
    thinking: { type: "adaptive", effort: "high" },
    streaming: true,
    ...overrides,
  };
}

function createAgentsConfig(): AgentsConfig {
  return {
    agents: {
      research: {
        name: "research",
        model: "claude-opus-4-6",
        maxTokens: 8192,
        tools: ["web_search"],
        systemPromptPath: "prompts/research.md",
        temperature: 0.7,
        description: "Research agent for web searches",
      },
      code: {
        name: "code",
        model: "claude-opus-4-6",
        maxTokens: 8192,
        tools: ["code_generation"],
        systemPromptPath: "prompts/code.md",
        temperature: 0.7,
        description: "Code generation agent",
      },
    },
  };
}

function createOrchestratorOptions(overrides: Partial<OrchestratorOptions> = {}): OrchestratorOptions {
  return {
    config: createBaseConfig(),
    agentsConfig: createAgentsConfig(),
    systemPrompt: "You are an AI orchestrator.",
    ...overrides,
  };
}

function createMockThinkingResult(overrides: Partial<ThinkingResult> = {}): ThinkingResult {
  return {
    content: [
      { type: "thinking", thinking: "I need to analyze this request...", signature: "sig-123" },
      { type: "text", text: "Here is my response." },
    ],
    thinkingBlocks: [
      { type: "thinking", thinking: "I need to analyze this request...", signature: "sig-123" },
    ],
    textBlocks: [{ type: "text", text: "Here is my response." }],
    toolUseBlocks: [],
    compactionBlocks: [],
    usage: { inputTokens: 100, outputTokens: 200 },
    compacted: false,
    stopReason: "end_turn",
    ...overrides,
  };
}

function createMockGraphResult(nodeId = "node-uuid-123") {
  return {
    node: {
      id: nodeId,
      sessionId: "session-uuid-123",
      reasoning: "I need to analyze this request...",
      structuredReasoning: { steps: [], decisionPoints: [], alternativesConsidered: 0 },
      confidenceScore: 0.75,
      nodeType: "thinking" as const,
      createdAt: new Date(),
    },
    decisionPoints: [],
    linkedToParent: false,
    degraded: false,
    persistenceIssues: [],
  };
}

// ============================================================
// Expose Private Methods for Testing
// ============================================================

class TestableOrchestrator extends Orchestrator {
  public testClassifyComplexity(message: string): "simple" | "standard" | "complex" {
    return (this as any).classifyComplexity(message);
  }

  public testGetEffortForComplexity(complexity: "simple" | "standard" | "complex"): "low" | "medium" | "high" | "max" {
    return (this as any).getEffortForComplexity(complexity);
  }

  public testIsTokenBudgetExhausted(): boolean {
    return (this as any).isTokenBudgetExhausted();
  }

  public testIsCompactionLimitReached(): boolean {
    return (this as any).isCompactionLimitReached();
  }

  public testCheckBudgetWarning(): void {
    (this as any).checkBudgetWarning();
  }

  public testGetBudgetStatus(): OrchestratorResult["budgetStatus"] {
    return (this as any).getBudgetStatus();
  }

  public testBuildRoutingPrompt(message: string, knowledgeContext: string): string {
    return (this as any).buildRoutingPrompt(message, knowledgeContext);
  }

  public testBuildRoutingTools(): unknown[] {
    return (this as any).buildRoutingTools();
  }

  public testParseTaskPlan(content: Array<ThinkingBlock | TextBlock | ToolUseBlock | CompactionBlock>) {
    return (this as any).parseTaskPlan(content);
  }

  public testHandleCompactionEvent(result: {
    compactionBlocks: CompactionBlock[];
    usage: { inputTokens: number; outputTokens: number };
  }): Promise<string | undefined> {
    return (this as any).handleCompactionEvent(result);
  }

  // Expose session for direct manipulation in tests
  public setSession(session: any): void {
    (this as any).session = session;
  }

  public getInternalSession(): any {
    return (this as any).session;
  }

  public setLastThinkingNodeId(id: string | null): void {
    (this as any).lastThinkingNodeId = id;
  }
}

// ============================================================
// Tests
// ============================================================

describe("Orchestrator", () => {
  let orchestrator: TestableOrchestrator;

  beforeEach(() => {
    vi.clearAllMocks();

    // Default mock returns
    mockCreateSession.mockResolvedValue({
      id: "session-uuid-123",
      createdAt: new Date("2026-02-09T00:00:00Z"),
      updatedAt: new Date("2026-02-09T00:00:00Z"),
    });
    mockUpdateSessionPlan.mockResolvedValue(undefined);
    mockBuildContextString.mockResolvedValue("");
    mockThink.mockResolvedValue(createMockThinkingResult());
    mockPersistThinkingNode.mockResolvedValue(createMockGraphResult());
    mockLinkNodes.mockResolvedValue(undefined);

    orchestrator = new TestableOrchestrator(createOrchestratorOptions());
  });

  // ============================================================
  // Constructor Tests
  // ============================================================

  describe("constructor", () => {
    it("creates an instance with valid options", () => {
      const orch = new Orchestrator(createOrchestratorOptions());
      expect(orch).toBeInstanceOf(Orchestrator);
    });

    it("starts with no session", () => {
      expect(orchestrator.getSession()).toBeNull();
    });

    it("starts with no last thinking node ID", () => {
      expect(orchestrator.getLastThinkingNodeId()).toBeNull();
    });

    it("stores callbacks from options", () => {
      const onBudgetWarning = vi.fn();
      const onBudgetExhausted = vi.fn();
      const onTaskUpdate = vi.fn();
      const onPlanUpdate = vi.fn();

      const orch = new TestableOrchestrator(
        createOrchestratorOptions({
          onBudgetWarning,
          onBudgetExhausted,
          onTaskUpdate,
          onPlanUpdate,
        })
      );

      // Verify it was constructed without error
      expect(orch).toBeInstanceOf(Orchestrator);
    });
  });

  // ============================================================
  // startSession Tests
  // ============================================================

  describe("startSession()", () => {
    it("creates a new session with DB call", async () => {
      const session = await orchestrator.startSession("user-1");

      expect(mockCreateSession).toHaveBeenCalledWith({ userId: "user-1" });
      expect(session.id).toBe("session-uuid-123");
      expect(session.userId).toBe("user-1");
      expect(session.messages).toEqual([]);
      expect(session.thinkingHistory).toEqual([]);
      expect(session.currentPlan).toBeNull();
      expect(session.knowledgeContext).toEqual([]);
      expect(session.compactionCount).toBe(0);
      expect(session.cumulativeOutputTokens).toBe(0);
      expect(session.budgetWarningTriggered).toBe(false);
    });

    it("creates a session without userId", async () => {
      const session = await orchestrator.startSession();

      expect(mockCreateSession).toHaveBeenCalledWith({ userId: undefined });
      expect(session.userId).toBeUndefined();
    });

    it("stores the session internally", async () => {
      await orchestrator.startSession("user-1");

      const session = orchestrator.getSession();
      expect(session).not.toBeNull();
      expect(session!.id).toBe("session-uuid-123");
    });
  });

  // ============================================================
  // classifyComplexity Tests
  // ============================================================

  describe("classifyComplexity()", () => {
    describe("simple patterns", () => {
      it("classifies greetings as simple", () => {
        expect(orchestrator.testClassifyComplexity("hi there")).toBe("simple");
        expect(orchestrator.testClassifyComplexity("hello")).toBe("simple");
        expect(orchestrator.testClassifyComplexity("hey")).toBe("simple");
        expect(orchestrator.testClassifyComplexity("thanks")).toBe("simple");
        expect(orchestrator.testClassifyComplexity("thank you")).toBe("simple");
        expect(orchestrator.testClassifyComplexity("ok")).toBe("simple");
        expect(orchestrator.testClassifyComplexity("sure")).toBe("simple");
        expect(orchestrator.testClassifyComplexity("yes")).toBe("simple");
        expect(orchestrator.testClassifyComplexity("no")).toBe("simple");
      });

      it("classifies factual questions as simple", () => {
        expect(orchestrator.testClassifyComplexity("what is TypeScript?")).toBe("simple");
        expect(orchestrator.testClassifyComplexity("who is the creator of Linux?")).toBe("simple");
        expect(orchestrator.testClassifyComplexity("when did Python 3 release?")).toBe("simple");
        expect(orchestrator.testClassifyComplexity("what are React hooks?")).toBe("simple");
      });

      it("classifies brief instructions as simple", () => {
        expect(orchestrator.testClassifyComplexity("define recursion")).toBe("simple");
        expect(orchestrator.testClassifyComplexity("explain briefly what a closure is")).toBe("simple");
        expect(orchestrator.testClassifyComplexity("summarize REST APIs")).toBe("simple");
      });
    });

    describe("complex patterns", () => {
      it("classifies debugging requests as complex", () => {
        expect(orchestrator.testClassifyComplexity("debug this memory leak in my application")).toBe("complex");
        expect(orchestrator.testClassifyComplexity("troubleshoot the API connection failure")).toBe("complex");
        expect(orchestrator.testClassifyComplexity("diagnose the performance issue")).toBe("complex");
        expect(orchestrator.testClassifyComplexity("fix the race condition in my code")).toBe("complex");
      });

      it("classifies architectural requests as complex", () => {
        expect(orchestrator.testClassifyComplexity("architect a microservices system for e-commerce")).toBe("complex");
        expect(orchestrator.testClassifyComplexity("design a scalable data pipeline")).toBe("complex");
        expect(orchestrator.testClassifyComplexity("plan the migration from monolith")).toBe("complex");
        expect(orchestrator.testClassifyComplexity("strategy for handling high traffic")).toBe("complex");
        expect(orchestrator.testClassifyComplexity("analyze in depth the codebase structure")).toBe("complex");
      });

      it("classifies comparison requests as complex", () => {
        expect(orchestrator.testClassifyComplexity("compare and contrast React vs Vue")).toBe("complex");
        expect(orchestrator.testClassifyComplexity("what are the trade-offs of microservices")).toBe("complex");
        expect(orchestrator.testClassifyComplexity("pros and cons of GraphQL")).toBe("complex");
        expect(orchestrator.testClassifyComplexity("what are the tradeoffs between SQL and NoSQL")).toBe("complex");
      });

      it("classifies research requests as complex", () => {
        expect(orchestrator.testClassifyComplexity("research the latest trends in AI")).toBe("complex");
        expect(orchestrator.testClassifyComplexity("investigate the root cause of the outage")).toBe("complex");
        expect(orchestrator.testClassifyComplexity("deep dive into transformer architecture")).toBe("complex");
        expect(orchestrator.testClassifyComplexity("comprehensive analysis of our tech stack")).toBe("complex");
      });

      it("classifies multi-step requests as complex", () => {
        expect(orchestrator.testClassifyComplexity("step by step guide to setting up CI/CD")).toBe("complex");
        expect(orchestrator.testClassifyComplexity("create a multi-step deployment pipeline")).toBe("complex");
        expect(orchestrator.testClassifyComplexity("build a workflow for code review")).toBe("complex");
        expect(orchestrator.testClassifyComplexity("design a pipeline for data processing")).toBe("complex");
      });

      it("classifies optimization requests as complex", () => {
        expect(orchestrator.testClassifyComplexity("refactor the authentication module")).toBe("complex");
        expect(orchestrator.testClassifyComplexity("optimize the database queries")).toBe("complex");
        expect(orchestrator.testClassifyComplexity("improve performance of the search feature")).toBe("complex");
      });
    });

    describe("standard classification", () => {
      it("defaults to standard for moderate-length unmatched messages", () => {
        // Message between 50 and 500 characters, no special patterns
        const message = "I need help creating a new React component that handles form input validation with proper error states";
        expect(orchestrator.testClassifyComplexity(message)).toBe("standard");
      });
    });

    describe("length-based heuristics", () => {
      it("classifies short unmatched messages as simple", () => {
        // Under 50 characters, no patterns match
        expect(orchestrator.testClassifyComplexity("show me the config file")).toBe("simple");
      });

      it("classifies very long unmatched messages as complex", () => {
        // Over 500 characters, no patterns match
        const longMessage = "I have a ".padEnd(501, "x");
        expect(orchestrator.testClassifyComplexity(longMessage)).toBe("complex");
      });
    });

    describe("priority: complex takes precedence over simple", () => {
      it("classifies as complex when both patterns match", () => {
        // "what is" is a simple pattern, but "trade-offs" is complex
        expect(orchestrator.testClassifyComplexity("what are the trade-offs of using microservices")).toBe("complex");
      });

      it("classifies debugging of simple topics as complex", () => {
        // "debug" triggers complex even if message is short
        expect(orchestrator.testClassifyComplexity("debug this issue")).toBe("complex");
      });
    });
  });

  // ============================================================
  // getEffortForComplexity Tests
  // ============================================================

  describe("getEffortForComplexity()", () => {
    it("returns configured default effort when routing is disabled", () => {
      const orch = new TestableOrchestrator(
        createOrchestratorOptions({
          config: createBaseConfig({ thinking: { type: "adaptive", effort: "high" } }),
        })
      );

      expect(orch.testGetEffortForComplexity("simple")).toBe("high");
      expect(orch.testGetEffortForComplexity("standard")).toBe("high");
      expect(orch.testGetEffortForComplexity("complex")).toBe("high");
    });

    it("uses effortRouting config when enabled", () => {
      const orch = new TestableOrchestrator(
        createOrchestratorOptions({
          config: createBaseConfig({
            effortRouting: {
              enabled: true,
              simpleEffort: "low",
              standardEffort: "medium",
              complexEffort: "max",
            },
          }),
        })
      );

      expect(orch.testGetEffortForComplexity("simple")).toBe("low");
      expect(orch.testGetEffortForComplexity("standard")).toBe("medium");
      expect(orch.testGetEffortForComplexity("complex")).toBe("max");
    });

    it("returns default effort when effortRouting is present but disabled", () => {
      const orch = new TestableOrchestrator(
        createOrchestratorOptions({
          config: createBaseConfig({
            thinking: { type: "adaptive", effort: "medium" },
            effortRouting: {
              enabled: false,
              simpleEffort: "low",
              standardEffort: "high",
              complexEffort: "max",
            },
          }),
        })
      );

      expect(orch.testGetEffortForComplexity("simple")).toBe("medium");
      expect(orch.testGetEffortForComplexity("complex")).toBe("medium");
    });
  });

  // ============================================================
  // Token Budget Enforcement Tests
  // ============================================================

  describe("token budget enforcement", () => {
    let budgetOrchestrator: TestableOrchestrator;

    beforeEach(() => {
      budgetOrchestrator = new TestableOrchestrator(
        createOrchestratorOptions({
          config: createBaseConfig({
            tokenBudget: {
              enabled: true,
              maxSessionOutputTokens: 1000,
              maxCompactions: 3,
              warnAtPercent: 80,
            },
          }),
        })
      );
    });

    describe("isTokenBudgetExhausted()", () => {
      it("returns false when no session exists", () => {
        expect(budgetOrchestrator.testIsTokenBudgetExhausted()).toBe(false);
      });

      it("returns false when budget is not enabled", () => {
        const orch = new TestableOrchestrator(createOrchestratorOptions());
        orch.setSession({
          id: "s1",
          cumulativeOutputTokens: 999999,
          compactionCount: 0,
          budgetWarningTriggered: false,
        });
        expect(orch.testIsTokenBudgetExhausted()).toBe(false);
      });

      it("returns false when under budget", () => {
        budgetOrchestrator.setSession({
          id: "s1",
          cumulativeOutputTokens: 500,
          compactionCount: 0,
          budgetWarningTriggered: false,
        });
        expect(budgetOrchestrator.testIsTokenBudgetExhausted()).toBe(false);
      });

      it("returns true when at budget limit", () => {
        budgetOrchestrator.setSession({
          id: "s1",
          cumulativeOutputTokens: 1000,
          compactionCount: 0,
          budgetWarningTriggered: false,
        });
        expect(budgetOrchestrator.testIsTokenBudgetExhausted()).toBe(true);
      });

      it("returns true when over budget", () => {
        budgetOrchestrator.setSession({
          id: "s1",
          cumulativeOutputTokens: 1500,
          compactionCount: 0,
          budgetWarningTriggered: false,
        });
        expect(budgetOrchestrator.testIsTokenBudgetExhausted()).toBe(true);
      });
    });

    describe("isCompactionLimitReached()", () => {
      it("returns false when no session exists", () => {
        expect(budgetOrchestrator.testIsCompactionLimitReached()).toBe(false);
      });

      it("returns false when under compaction limit", () => {
        budgetOrchestrator.setSession({
          id: "s1",
          cumulativeOutputTokens: 0,
          compactionCount: 2,
          budgetWarningTriggered: false,
        });
        expect(budgetOrchestrator.testIsCompactionLimitReached()).toBe(false);
      });

      it("returns true when at compaction limit", () => {
        budgetOrchestrator.setSession({
          id: "s1",
          cumulativeOutputTokens: 0,
          compactionCount: 3,
          budgetWarningTriggered: false,
        });
        expect(budgetOrchestrator.testIsCompactionLimitReached()).toBe(true);
      });
    });

    describe("checkBudgetWarning()", () => {
      it("does nothing when budget is not enabled", () => {
        const onBudgetWarning = vi.fn();
        const orch = new TestableOrchestrator(
          createOrchestratorOptions({ onBudgetWarning })
        );
        orch.setSession({
          id: "s1",
          cumulativeOutputTokens: 99999,
          compactionCount: 0,
          budgetWarningTriggered: false,
        });
        orch.testCheckBudgetWarning();
        expect(onBudgetWarning).not.toHaveBeenCalled();
      });

      it("fires warning callback at threshold", () => {
        const onBudgetWarning = vi.fn();
        const orch = new TestableOrchestrator(
          createOrchestratorOptions({
            config: createBaseConfig({
              tokenBudget: {
                enabled: true,
                maxSessionOutputTokens: 1000,
                maxCompactions: 3,
                warnAtPercent: 80,
              },
            }),
            onBudgetWarning,
          })
        );
        orch.setSession({
          id: "s1",
          cumulativeOutputTokens: 850,
          compactionCount: 0,
          budgetWarningTriggered: false,
        });

        orch.testCheckBudgetWarning();

        expect(onBudgetWarning).toHaveBeenCalledWith({
          used: 850,
          max: 1000,
          percent: 85,
        });
      });

      it("sets budgetWarningTriggered to prevent duplicate warnings", () => {
        const onBudgetWarning = vi.fn();
        const orch = new TestableOrchestrator(
          createOrchestratorOptions({
            config: createBaseConfig({
              tokenBudget: {
                enabled: true,
                maxSessionOutputTokens: 1000,
                maxCompactions: 3,
                warnAtPercent: 80,
              },
            }),
            onBudgetWarning,
          })
        );
        orch.setSession({
          id: "s1",
          cumulativeOutputTokens: 900,
          compactionCount: 0,
          budgetWarningTriggered: false,
        });

        orch.testCheckBudgetWarning();
        expect(onBudgetWarning).toHaveBeenCalledTimes(1);

        // Second call should NOT trigger again
        orch.testCheckBudgetWarning();
        expect(onBudgetWarning).toHaveBeenCalledTimes(1);
      });

      it("does not fire warning when below threshold", () => {
        const onBudgetWarning = vi.fn();
        const orch = new TestableOrchestrator(
          createOrchestratorOptions({
            config: createBaseConfig({
              tokenBudget: {
                enabled: true,
                maxSessionOutputTokens: 1000,
                maxCompactions: 3,
                warnAtPercent: 80,
              },
            }),
            onBudgetWarning,
          })
        );
        orch.setSession({
          id: "s1",
          cumulativeOutputTokens: 700,
          compactionCount: 0,
          budgetWarningTriggered: false,
        });

        orch.testCheckBudgetWarning();
        expect(onBudgetWarning).not.toHaveBeenCalled();
      });
    });

    describe("getBudgetStatus()", () => {
      it("returns undefined when budget is disabled", () => {
        const orch = new TestableOrchestrator(createOrchestratorOptions());
        orch.setSession({
          id: "s1",
          cumulativeOutputTokens: 500,
          compactionCount: 1,
          budgetWarningTriggered: false,
        });
        expect(orch.testGetBudgetStatus()).toBeUndefined();
      });

      it("returns undefined when no session exists", () => {
        expect(budgetOrchestrator.testGetBudgetStatus()).toBeUndefined();
      });

      it("returns correct budget status", () => {
        budgetOrchestrator.setSession({
          id: "s1",
          cumulativeOutputTokens: 500,
          compactionCount: 1,
          budgetWarningTriggered: false,
        });

        const status = budgetOrchestrator.testGetBudgetStatus();
        expect(status).toEqual({
          cumulativeOutputTokens: 500,
          maxSessionOutputTokens: 1000,
          compactionCount: 1,
          maxCompactions: 3,
          percentUsed: 50,
        });
      });
    });
  });

  // ============================================================
  // buildRoutingPrompt Tests
  // ============================================================

  describe("buildRoutingPrompt()", () => {
    it("includes user message and agent list", () => {
      const prompt = orchestrator.testBuildRoutingPrompt("build a website", "");

      expect(prompt).toContain("build a website");
      expect(prompt).toContain("research");
      expect(prompt).toContain("code");
      expect(prompt).toContain("Research agent for web searches");
      expect(prompt).toContain("Code generation agent");
    });

    it("prepends knowledge context when provided", () => {
      const context = "## Retrieved Knowledge\n\n### React Hooks (95% match)\nHooks are...";
      const prompt = orchestrator.testBuildRoutingPrompt("explain hooks", context);

      // Knowledge context should appear before the user message
      const contextIdx = prompt.indexOf("Retrieved Knowledge");
      const messageIdx = prompt.indexOf("explain hooks");
      expect(contextIdx).toBeGreaterThan(-1);
      expect(messageIdx).toBeGreaterThan(contextIdx);
    });

    it("does not include knowledge context when empty", () => {
      const prompt = orchestrator.testBuildRoutingPrompt("hello", "");

      expect(prompt).not.toContain("Retrieved Knowledge");
    });

    it("includes routing instructions", () => {
      const prompt = orchestrator.testBuildRoutingPrompt("hello", "");

      expect(prompt).toContain("create_task_plan");
      expect(prompt).toContain("route_to_agent");
      expect(prompt).toContain("Simple Request");
      expect(prompt).toContain("Complex Request");
    });
  });

  // ============================================================
  // buildRoutingTools Tests
  // ============================================================

  describe("buildRoutingTools()", () => {
    it("returns two tools", () => {
      const tools = orchestrator.testBuildRoutingTools();
      expect(tools).toHaveLength(2);
    });

    it("includes create_task_plan tool", () => {
      const tools = orchestrator.testBuildRoutingTools() as Array<{ name: string; input_schema: any }>;
      const planTool = tools.find((t) => t.name === "create_task_plan");

      expect(planTool).toBeDefined();
      expect(planTool!.input_schema.required).toContain("goal");
      expect(planTool!.input_schema.required).toContain("tasks");
    });

    it("includes route_to_agent tool", () => {
      const tools = orchestrator.testBuildRoutingTools() as Array<{ name: string; input_schema: any }>;
      const routeTool = tools.find((t) => t.name === "route_to_agent");

      expect(routeTool).toBeDefined();
      expect(routeTool!.input_schema.required).toContain("agent");
      expect(routeTool!.input_schema.required).toContain("context");
    });

    it("route_to_agent enumerates valid agent names", () => {
      const tools = orchestrator.testBuildRoutingTools() as Array<{ name: string; input_schema: any }>;
      const routeTool = tools.find((t) => t.name === "route_to_agent")!;

      const agentEnum = routeTool.input_schema.properties.agent.enum;
      expect(agentEnum).toEqual(["research", "code", "knowledge", "planning", "communication"]);
    });
  });

  // ============================================================
  // parseTaskPlan Tests
  // ============================================================

  describe("parseTaskPlan()", () => {
    it("returns null when no tool_use blocks exist", () => {
      const content: TextBlock[] = [{ type: "text", text: "Just a text response" }];
      expect(orchestrator.testParseTaskPlan(content)).toBeNull();
    });

    it("returns null when tool_use is not create_task_plan", () => {
      const content: ToolUseBlock[] = [
        {
          type: "tool_use",
          id: "tool-1",
          name: "route_to_agent",
          input: { agent: "research", context: "search for X" },
        },
      ];
      expect(orchestrator.testParseTaskPlan(content)).toBeNull();
    });

    it("parses a valid task plan", () => {
      const content: ToolUseBlock[] = [
        {
          type: "tool_use",
          id: "tool-1",
          name: "create_task_plan",
          input: {
            goal: "Build a REST API",
            tasks: [
              { description: "Research best practices", assignedAgent: "research" },
              { description: "Generate code", assignedAgent: "code", dependencies: ["task-1"] },
            ],
          },
        },
      ];

      const plan = orchestrator.testParseTaskPlan(content);

      expect(plan).not.toBeNull();
      expect(plan!.goal).toBe("Build a REST API");
      expect(plan!.tasks).toHaveLength(2);
      expect(plan!.tasks[0].id).toBe("task-1");
      expect(plan!.tasks[0].description).toBe("Research best practices");
      expect(plan!.tasks[0].assignedAgent).toBe("research");
      expect(plan!.tasks[0].status).toBe("pending");
      expect(plan!.tasks[0].dependencies).toEqual([]);
      expect(plan!.tasks[1].id).toBe("task-2");
      expect(plan!.tasks[1].dependencies).toEqual(["task-1"]);
      expect(plan!.status).toBe("planning");
      expect(plan!.id).toBeDefined();
      expect(plan!.createdAt).toBeInstanceOf(Date);
    });

    it("handles tasks without dependencies", () => {
      const content: ToolUseBlock[] = [
        {
          type: "tool_use",
          id: "tool-1",
          name: "create_task_plan",
          input: {
            goal: "Simple goal",
            tasks: [{ description: "Do a thing", assignedAgent: "knowledge" }],
          },
        },
      ];

      const plan = orchestrator.testParseTaskPlan(content);
      expect(plan!.tasks[0].dependencies).toEqual([]);
    });

    it("ignores non-plan tool_use blocks and finds the plan", () => {
      const content: Array<TextBlock | ToolUseBlock> = [
        { type: "text", text: "Analyzing..." },
        { type: "tool_use", id: "tool-1", name: "route_to_agent", input: { agent: "research", context: "x" } },
        {
          type: "tool_use",
          id: "tool-2",
          name: "create_task_plan",
          input: { goal: "Correct plan", tasks: [{ description: "Task A", assignedAgent: "code" }] },
        },
      ];

      const plan = orchestrator.testParseTaskPlan(content);
      expect(plan).not.toBeNull();
      expect(plan!.goal).toBe("Correct plan");
    });
  });

  // ============================================================
  // process() Tests
  // ============================================================

  describe("process()", () => {
    it("throws when no session is started", async () => {
      await expect(orchestrator.process("hello")).rejects.toThrow(
        "Session not started. Call startSession first."
      );
    });

    it("returns budget exhausted message when token budget is used up", async () => {
      const onBudgetExhausted = vi.fn();
      const orch = new TestableOrchestrator(
        createOrchestratorOptions({
          config: createBaseConfig({
            tokenBudget: {
              enabled: true,
              maxSessionOutputTokens: 100,
              maxCompactions: 5,
              warnAtPercent: 80,
            },
          }),
          onBudgetExhausted,
        })
      );
      orch.setSession({
        id: "s1",
        userId: "u1",
        messages: [],
        thinkingHistory: [],
        currentPlan: null,
        knowledgeContext: [],
        compactionCount: 0,
        cumulativeOutputTokens: 150,
        budgetWarningTriggered: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await orch.process("hello");

      expect(result.response).toContain("token budget exhausted");
      expect(result.effectiveEffort).toBe("low");
      expect(result.taskComplexity).toBe("simple");
      expect(result.thinkingBlocks).toEqual([]);
      expect(result.compacted).toBe(false);
      expect(onBudgetExhausted).toHaveBeenCalledWith({ used: 150, max: 100 });
    });

    it("returns compaction limit message when compaction limit is reached", async () => {
      const orch = new TestableOrchestrator(
        createOrchestratorOptions({
          config: createBaseConfig({
            tokenBudget: {
              enabled: true,
              maxSessionOutputTokens: 999999,
              maxCompactions: 2,
              warnAtPercent: 80,
            },
          }),
        })
      );
      orch.setSession({
        id: "s1",
        userId: "u1",
        messages: [],
        thinkingHistory: [],
        currentPlan: null,
        knowledgeContext: [],
        compactionCount: 2,
        cumulativeOutputTokens: 0,
        budgetWarningTriggered: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await orch.process("hello");

      expect(result.response).toContain("compaction limit reached");
    });

    it("processes a simple query end-to-end", async () => {
      await orchestrator.startSession("user-1");

      const result = await orchestrator.process("hello");

      expect(mockBuildContextString).toHaveBeenCalledWith("hello", {
        limit: 5,
        includeRelated: true,
      });
      expect(mockThink).toHaveBeenCalled();
      expect(mockPersistThinkingNode).toHaveBeenCalled();
      expect(result.response).toBe("Here is my response.");
      expect(result.compacted).toBe(false);
      expect(result.thinkingBlocks).toHaveLength(1);
      expect(result.thinkingNode).toBeDefined();
    });

    it("applies dynamic effort routing during processing", async () => {
      const orch = new TestableOrchestrator(
        createOrchestratorOptions({
          config: createBaseConfig({
            thinking: { type: "adaptive", effort: "high" },
            effortRouting: {
              enabled: true,
              simpleEffort: "low",
              standardEffort: "medium",
              complexEffort: "max",
            },
          }),
        })
      );
      await orch.startSession();

      await orch.process("hello");

      // Should have been called with low effort for simple message
      expect(mockUpdateConfig).toHaveBeenCalledWith(
        expect.objectContaining({
          thinking: expect.objectContaining({ effort: "low" }),
        })
      );

      // Should restore original effort afterward
      const lastCall = mockUpdateConfig.mock.calls[mockUpdateConfig.mock.calls.length - 1][0];
      expect(lastCall.thinking.effort).toBe("high");
    });

    it("restores original effort even when think() throws", async () => {
      mockThink.mockRejectedValueOnce(new Error("API failure"));

      const orch = new TestableOrchestrator(
        createOrchestratorOptions({
          config: createBaseConfig({
            thinking: { type: "adaptive", effort: "high" },
            effortRouting: {
              enabled: true,
              simpleEffort: "low",
              standardEffort: "medium",
              complexEffort: "max",
            },
          }),
        })
      );
      await orch.startSession();

      await expect(orch.process("hello")).rejects.toThrow("API failure");

      // Should still restore effort in finally block
      const lastCall = mockUpdateConfig.mock.calls[mockUpdateConfig.mock.calls.length - 1][0];
      expect(lastCall.thinking.effort).toBe("high");
    });

    it("tracks cumulative output tokens", async () => {
      mockThink.mockResolvedValue(
        createMockThinkingResult({
          usage: { inputTokens: 50, outputTokens: 300 },
        })
      );

      await orchestrator.startSession();
      await orchestrator.process("first query");

      expect(orchestrator.getSession()!.cumulativeOutputTokens).toBe(300);

      mockThink.mockResolvedValue(
        createMockThinkingResult({
          usage: { inputTokens: 50, outputTokens: 200 },
        })
      );

      await orchestrator.process("second query");

      expect(orchestrator.getSession()!.cumulativeOutputTokens).toBe(500);
    });

    it("stores thinking blocks in session history", async () => {
      await orchestrator.startSession();
      await orchestrator.process("test query");

      const session = orchestrator.getSession()!;
      expect(session.thinkingHistory).toHaveLength(1);
      expect(session.thinkingHistory[0].thinking).toBe("I need to analyze this request...");
    });

    it("caps thinking history at 50 entries", async () => {
      await orchestrator.startSession();

      // Pre-fill with 49 entries
      const session = orchestrator.getInternalSession();
      for (let i = 0; i < 49; i++) {
        session.thinkingHistory.push({
          type: "thinking" as const,
          thinking: `Entry ${i}`,
          signature: `sig-${i}`,
        });
      }

      // Process adds 1 more entry, making it 50 total
      await orchestrator.process("query");

      expect(session.thinkingHistory.length).toBe(50);

      // Process again: should now be capped at 50 (sliced from end)
      await orchestrator.process("another query");

      expect(session.thinkingHistory.length).toBe(50);
      // The oldest entries should have been dropped
      expect(session.thinkingHistory[session.thinkingHistory.length - 1].thinking).toBe(
        "I need to analyze this request..."
      );
    });

    it("persists thinking nodes to ThinkGraph", async () => {
      await orchestrator.startSession();
      await orchestrator.process("test query");

      expect(mockPersistThinkingNode).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ type: "thinking" }),
        ]),
        expect.objectContaining({
          sessionId: "session-uuid-123",
          inputQuery: "test query",
        })
      );
    });

    it("links to parent thinking node on subsequent calls", async () => {
      await orchestrator.startSession();

      // First call sets lastThinkingNodeId
      await orchestrator.process("first query");
      expect(orchestrator.getLastThinkingNodeId()).toBe("node-uuid-123");

      // Second call should pass parent node ID
      const secondNodeId = "node-uuid-456";
      mockPersistThinkingNode.mockResolvedValue(createMockGraphResult(secondNodeId));

      await orchestrator.process("second query");

      const secondCallArgs = mockPersistThinkingNode.mock.calls[1];
      expect(secondCallArgs[1].parentNodeId).toBe("node-uuid-123");
      expect(orchestrator.getLastThinkingNodeId()).toBe("node-uuid-456");
    });

    it("handles ThinkGraph persistence failure gracefully", async () => {
      mockPersistThinkingNode.mockRejectedValueOnce(new Error("DB connection failed"));

      await orchestrator.startSession();
      const result = await orchestrator.process("query");

      // Should still return a valid response
      expect(result.response).toBe("Here is my response.");
      expect(result.thinkingNode).toBeUndefined();
      expect(result.graphPersistence).toEqual({
        degraded: true,
        issues: [{ stage: "node", message: "DB connection failed" }],
      });
    });

    it("propagates degraded graph persistence status", async () => {
      mockPersistThinkingNode.mockResolvedValueOnce({
        ...createMockGraphResult(),
        degraded: true,
        persistenceIssues: [
          { stage: "decision_point", message: "FK constraint violated" },
        ],
      });

      await orchestrator.startSession();
      const result = await orchestrator.process("query");

      expect(result.graphPersistence).toEqual({
        degraded: true,
        issues: [{ stage: "decision_point", message: "FK constraint violated" }],
      });
    });

    it("skips ThinkGraph persistence when no thinking blocks exist", async () => {
      mockThink.mockResolvedValue(
        createMockThinkingResult({
          thinkingBlocks: [],
          content: [{ type: "text", text: "Direct response." }],
          textBlocks: [{ type: "text", text: "Direct response." }],
        })
      );

      await orchestrator.startSession();
      const result = await orchestrator.process("hello");

      expect(mockPersistThinkingNode).not.toHaveBeenCalled();
      expect(result.thinkingNode).toBeUndefined();
      expect(result.graphPersistence).toBeUndefined();
    });

    it("calls onPlanUpdate and persists plan to DB when task plan is returned", async () => {
      const onPlanUpdate = vi.fn();
      const orch = new TestableOrchestrator(
        createOrchestratorOptions({ onPlanUpdate })
      );
      await orch.startSession();

      mockThink.mockResolvedValue(
        createMockThinkingResult({
          content: [
            { type: "thinking", thinking: "Planning...", signature: "sig" },
            { type: "text", text: "Here is the plan." },
            {
              type: "tool_use",
              id: "tool-1",
              name: "create_task_plan",
              input: {
                goal: "Build feature",
                tasks: [
                  { description: "Research", assignedAgent: "research" },
                  { description: "Implement", assignedAgent: "code" },
                ],
              },
            },
          ],
        })
      );

      const result = await orch.process("build a feature");

      expect(result.plan).toBeDefined();
      expect(result.plan!.goal).toBe("Build feature");
      expect(onPlanUpdate).toHaveBeenCalledWith(expect.objectContaining({ goal: "Build feature" }));
      expect(mockUpdateSessionPlan).toHaveBeenCalledWith(
        "session-uuid-123",
        expect.objectContaining({ goal: "Build feature" })
      );
    });

    it("returns correct effectiveEffort and taskComplexity", async () => {
      const orch = new TestableOrchestrator(
        createOrchestratorOptions({
          config: createBaseConfig({
            effortRouting: {
              enabled: true,
              simpleEffort: "low",
              standardEffort: "medium",
              complexEffort: "max",
            },
          }),
        })
      );
      await orch.startSession();

      const result = await orch.process("debug this memory leak in my app");

      expect(result.taskComplexity).toBe("complex");
      expect(result.effectiveEffort).toBe("max");
    });

    it("updates session updatedAt timestamp", async () => {
      await orchestrator.startSession();
      const beforeProcess = new Date();

      await orchestrator.process("query");

      const session = orchestrator.getSession()!;
      expect(session.updatedAt.getTime()).toBeGreaterThanOrEqual(beforeProcess.getTime());
    });
  });

  // ============================================================
  // Compaction Handling Tests
  // ============================================================

  describe("handleCompactionEvent()", () => {
    beforeEach(async () => {
      await orchestrator.startSession();
    });

    it("returns undefined when no session exists", async () => {
      const orch = new TestableOrchestrator(createOrchestratorOptions());
      const result = await orch.testHandleCompactionEvent({
        compactionBlocks: [{ type: "compaction", content: "summary" }],
        usage: { inputTokens: 100, outputTokens: 200 },
      });
      expect(result).toBeUndefined();
    });

    it("increments compaction count", async () => {
      await orchestrator.testHandleCompactionEvent({
        compactionBlocks: [{ type: "compaction", content: "Session summarized" }],
        usage: { inputTokens: 100, outputTokens: 200 },
      });

      expect(orchestrator.getSession()!.compactionCount).toBe(1);
    });

    it("stores the compaction summary", async () => {
      await orchestrator.testHandleCompactionEvent({
        compactionBlocks: [{ type: "compaction", content: "First part" }, { type: "compaction", content: "Second part" }],
        usage: { inputTokens: 100, outputTokens: 200 },
      });

      expect(orchestrator.getSession()!.lastCompactionSummary).toBe("First part\nSecond part");
    });

    it("creates a compaction boundary node in ThinkGraph", async () => {
      await orchestrator.testHandleCompactionEvent({
        compactionBlocks: [{ type: "compaction", content: "Context was compacted" }],
        usage: { inputTokens: 100, outputTokens: 200 },
      });

      expect(mockPersistThinkingNode).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            type: "thinking",
            thinking: expect.stringContaining("COMPACTION BOUNDARY"),
          }),
        ]),
        expect.objectContaining({
          sessionId: "session-uuid-123",
          nodeType: "compaction",
        })
      );
    });

    it("creates supersedes edge when there is a pre-compaction node", async () => {
      orchestrator.setLastThinkingNodeId("pre-compaction-node-id");

      mockPersistThinkingNode.mockResolvedValueOnce(createMockGraphResult("compaction-boundary-id"));

      await orchestrator.testHandleCompactionEvent({
        compactionBlocks: [{ type: "compaction", content: "Summarized" }],
        usage: { inputTokens: 100, outputTokens: 200 },
      });

      expect(mockLinkNodes).toHaveBeenCalledWith(
        "pre-compaction-node-id",
        "compaction-boundary-id",
        "supersedes",
        1.0,
        expect.objectContaining({
          compactionNumber: 1,
          reason: expect.stringContaining("compacted"),
        })
      );
    });

    it("does not create supersedes edge when there is no pre-compaction node", async () => {
      // lastThinkingNodeId is null by default
      await orchestrator.testHandleCompactionEvent({
        compactionBlocks: [{ type: "compaction", content: "Summarized" }],
        usage: { inputTokens: 100, outputTokens: 200 },
      });

      expect(mockLinkNodes).not.toHaveBeenCalled();
    });

    it("updates lastThinkingNodeId to the boundary node", async () => {
      mockPersistThinkingNode.mockResolvedValueOnce(createMockGraphResult("boundary-node-id"));

      await orchestrator.testHandleCompactionEvent({
        compactionBlocks: [{ type: "compaction", content: "Summary" }],
        usage: { inputTokens: 100, outputTokens: 200 },
      });

      expect(orchestrator.getLastThinkingNodeId()).toBe("boundary-node-id");
    });

    it("handles compaction persistence failure gracefully", async () => {
      mockPersistThinkingNode.mockRejectedValueOnce(new Error("DB down"));

      const summary = await orchestrator.testHandleCompactionEvent({
        compactionBlocks: [{ type: "compaction", content: "Summary" }],
        usage: { inputTokens: 100, outputTokens: 200 },
      });

      // Should still return the summary
      expect(summary).toBe("Summary");
      expect(orchestrator.getSession()!.compactionCount).toBe(1);
    });

    it("handles linkNodes failure gracefully", async () => {
      orchestrator.setLastThinkingNodeId("existing-node");
      mockPersistThinkingNode.mockResolvedValueOnce(createMockGraphResult("new-boundary"));
      mockLinkNodes.mockRejectedValueOnce(new Error("Edge creation failed"));

      const summary = await orchestrator.testHandleCompactionEvent({
        compactionBlocks: [{ type: "compaction", content: "Summary" }],
        usage: { inputTokens: 100, outputTokens: 200 },
      });

      // Should still return summary despite link failure
      expect(summary).toBe("Summary");
    });

    it("integrates compaction with process()", async () => {
      mockThink.mockResolvedValue(
        createMockThinkingResult({
          compacted: true,
          compactionBlocks: [{ type: "compaction", content: "Context was compacted." }],
        })
      );

      // Two calls to persistThinkingNode: one for the thinking, one for compaction boundary
      mockPersistThinkingNode
        .mockResolvedValueOnce(createMockGraphResult("thinking-node-id"))
        .mockResolvedValueOnce(createMockGraphResult("compaction-node-id"));

      const result = await orchestrator.process("long conversation continues");

      expect(result.compacted).toBe(true);
      expect(result.compactionSummary).toBe("Context was compacted.");
      expect(orchestrator.getSession()!.compactionCount).toBe(1);
    });
  });

  // ============================================================
  // setCallbacks Tests
  // ============================================================

  describe("setCallbacks()", () => {
    it("forwards streaming callbacks to ThinkingEngine", () => {
      const onThinkingStream = vi.fn();
      const onTextStream = vi.fn();
      const onCompactionStream = vi.fn();

      orchestrator.setCallbacks({
        onThinkingStream,
        onTextStream,
        onCompactionStream,
      });

      expect(mockSetCallbacks).toHaveBeenCalledWith({
        onThinkingStream,
        onTextStream,
        onCompactionStream,
      });
    });

    it("stores task and plan callbacks", async () => {
      const onTaskUpdate = vi.fn();
      const onPlanUpdate = vi.fn();

      orchestrator.setCallbacks({ onTaskUpdate, onPlanUpdate });

      // Verify plan callback is triggered on process with plan
      await orchestrator.startSession();
      mockThink.mockResolvedValue(
        createMockThinkingResult({
          content: [
            { type: "thinking", thinking: "Planning...", signature: "sig" },
            { type: "text", text: "Plan created." },
            {
              type: "tool_use",
              id: "tool-1",
              name: "create_task_plan",
              input: {
                goal: "Test goal",
                tasks: [{ description: "Task 1", assignedAgent: "code" }],
              },
            },
          ],
        })
      );

      await orchestrator.process("create plan");
      expect(onPlanUpdate).toHaveBeenCalled();
    });
  });

  // ============================================================
  // Public Accessors Tests
  // ============================================================

  describe("public accessors", () => {
    it("getSession() returns null before startSession", () => {
      expect(orchestrator.getSession()).toBeNull();
    });

    it("getSession() returns session after startSession", async () => {
      await orchestrator.startSession("user-1");
      const session = orchestrator.getSession();
      expect(session).not.toBeNull();
      expect(session!.id).toBe("session-uuid-123");
    });

    it("getThinkGraph() returns the ThinkGraph instance", () => {
      const graph = orchestrator.getThinkGraph();
      expect(graph).toBeDefined();
      expect(graph.persistThinkingNode).toBeDefined();
    });

    it("getLastThinkingNodeId() returns null initially", () => {
      expect(orchestrator.getLastThinkingNodeId()).toBeNull();
    });

    it("getLastThinkingNodeId() returns the last node ID after processing", async () => {
      await orchestrator.startSession();
      await orchestrator.process("test");
      expect(orchestrator.getLastThinkingNodeId()).toBe("node-uuid-123");
    });
  });

  // ============================================================
  // Integration-style Tests (process flow)
  // ============================================================

  describe("end-to-end process flow", () => {
    it("handles a full session lifecycle", async () => {
      // Start session
      const session = await orchestrator.startSession("user-1");
      expect(session.id).toBe("session-uuid-123");

      // First query
      const result1 = await orchestrator.process("hello");
      expect(result1.response).toBe("Here is my response.");
      expect(result1.taskComplexity).toBe("simple");

      // Second query (complex)
      mockThink.mockResolvedValue(
        createMockThinkingResult({
          content: [
            { type: "thinking", thinking: "Deep analysis required...", signature: "sig-2" },
            { type: "text", text: "After careful analysis..." },
          ],
          thinkingBlocks: [
            { type: "thinking", thinking: "Deep analysis required...", signature: "sig-2" },
          ],
          textBlocks: [{ type: "text", text: "After careful analysis..." }],
          usage: { inputTokens: 500, outputTokens: 1000 },
        })
      );
      mockPersistThinkingNode.mockResolvedValue(createMockGraphResult("node-uuid-456"));

      const result2 = await orchestrator.process("debug the memory leak in the connection pool");
      expect(result2.taskComplexity).toBe("complex");
      expect(result2.response).toBe("After careful analysis...");

      // Verify session state accumulated
      const finalSession = orchestrator.getSession()!;
      expect(finalSession.thinkingHistory).toHaveLength(2);
      expect(finalSession.cumulativeOutputTokens).toBe(1200); // 200 + 1000
    });

    it("handles budget warning followed by exhaustion", async () => {
      const onBudgetWarning = vi.fn();
      const onBudgetExhausted = vi.fn();

      const orch = new TestableOrchestrator(
        createOrchestratorOptions({
          config: createBaseConfig({
            tokenBudget: {
              enabled: true,
              maxSessionOutputTokens: 500,
              maxCompactions: 10,
              warnAtPercent: 80,
            },
          }),
          onBudgetWarning,
          onBudgetExhausted,
        })
      );

      await orch.startSession();

      // First query: 300 tokens (60% of budget)
      mockThink.mockResolvedValue(
        createMockThinkingResult({ usage: { inputTokens: 50, outputTokens: 300 } })
      );
      await orch.process("first query");
      expect(onBudgetWarning).not.toHaveBeenCalled();

      // Second query: 200 tokens (now 100% of budget, warning at 80%)
      mockThink.mockResolvedValue(
        createMockThinkingResult({ usage: { inputTokens: 50, outputTokens: 200 } })
      );
      await orch.process("second query");
      expect(onBudgetWarning).toHaveBeenCalledOnce();
      expect(onBudgetWarning).toHaveBeenCalledWith({
        used: 500,
        max: 500,
        percent: 100,
      });

      // Third query: budget exhausted, should not call think()
      mockThink.mockClear();
      const result3 = await orch.process("third query");
      expect(result3.response).toContain("token budget exhausted");
      expect(mockThink).not.toHaveBeenCalled();
      expect(onBudgetExhausted).toHaveBeenCalledWith({ used: 500, max: 500 });
    });
  });
});
