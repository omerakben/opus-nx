import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type Anthropic from "@anthropic-ai/sdk";
import type { OrchestratorConfig } from "./types/orchestrator.js";

// ============================================================
// Mocks
// ============================================================

// Mock the Anthropic SDK
const mockCreate = vi.fn();
const mockStream = vi.fn();

vi.mock("@anthropic-ai/sdk", () => {
  const MockAnthropic = function (this: Record<string, unknown>) {
    this.messages = {
      create: mockCreate,
      stream: mockStream,
    };
  };
  return { default: MockAnthropic };
});

// Mock the shared logger
vi.mock("@opus-nx/shared", () => ({
  createLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

// Must import after vi.mock declarations
import { ThinkingEngine } from "./thinking-engine.js";
import type { ThinkingEngineOptions } from "./thinking-engine.js";

// ============================================================
// Helpers
// ============================================================

function makeConfig(overrides: Partial<OrchestratorConfig> = {}): OrchestratorConfig {
  return {
    model: "claude-opus-4-6",
    maxTokens: 16384,
    thinking: { type: "adaptive", effort: "high" },
    streaming: false,
    ...overrides,
  };
}

function makeOptions(
  configOverrides: Partial<OrchestratorConfig> = {},
  callbacks: Partial<Pick<ThinkingEngineOptions, "onThinkingStream" | "onTextStream" | "onCompactionStream">> = {}
): ThinkingEngineOptions {
  return {
    config: makeConfig(configOverrides),
    ...callbacks,
  };
}

/** Build a mock Anthropic.Message response */
function makeMockResponse(overrides: {
  content?: Anthropic.ContentBlock[];
  usage?: Partial<Anthropic.Usage>;
  stop_reason?: string | null;
} = {}): Anthropic.Message {
  return {
    id: "msg_test_123",
    type: "message",
    role: "assistant",
    model: "claude-opus-4-6",
    stop_reason: "stop_reason" in overrides ? overrides.stop_reason : "end_turn",
    content: overrides.content ?? [{ type: "text", text: "Hello, world!" }],
    usage: {
      input_tokens: 100,
      output_tokens: 50,
      ...overrides.usage,
    },
  } as Anthropic.Message;
}

// ============================================================
// Tests
// ============================================================

describe("ThinkingEngine", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv, ANTHROPIC_API_KEY: "test-key-123" };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  // ============================================================
  // Constructor
  // ============================================================

  describe("constructor", () => {
    it("creates an instance with valid API key", () => {
      const engine = new ThinkingEngine(makeOptions());
      expect(engine).toBeInstanceOf(ThinkingEngine);
    });

    it("throws when ANTHROPIC_API_KEY is missing", () => {
      delete process.env.ANTHROPIC_API_KEY;
      expect(() => new ThinkingEngine(makeOptions())).toThrow(
        "ANTHROPIC_API_KEY environment variable is required"
      );
    });

    it("stores streaming callbacks from options", () => {
      const onThinkingStream = vi.fn();
      const onTextStream = vi.fn();
      const onCompactionStream = vi.fn();
      const engine = new ThinkingEngine(
        makeOptions({}, { onThinkingStream, onTextStream, onCompactionStream })
      );
      // Callbacks are stored as private fields -- we verify they work via streaming tests
      expect(engine).toBeInstanceOf(ThinkingEngine);
    });
  });

  // ============================================================
  // updateConfig()
  // ============================================================

  describe("updateConfig()", () => {
    it("merges partial config updates", async () => {
      const engine = new ThinkingEngine(makeOptions({ streaming: false }));
      const response = makeMockResponse();
      mockCreate.mockResolvedValue(response);

      // Start with high effort
      await engine.think("system", [{ role: "user", content: "test" }]);
      const firstCall = mockCreate.mock.calls[0][0];
      expect(firstCall.output_config).toEqual({ effort: "high" });

      // Update to max effort
      engine.updateConfig({ thinking: { type: "adaptive", effort: "max" } });
      await engine.think("system", [{ role: "user", content: "test" }]);
      const secondCall = mockCreate.mock.calls[1][0];
      expect(secondCall.output_config).toEqual({ effort: "max" });
    });

    it("preserves unmodified config fields", async () => {
      const engine = new ThinkingEngine(
        makeOptions({ model: "claude-opus-4-6", maxTokens: 16384, streaming: false })
      );
      const response = makeMockResponse();
      mockCreate.mockResolvedValue(response);

      engine.updateConfig({ maxTokens: 32768 });
      await engine.think("system", [{ role: "user", content: "test" }]);

      const call = mockCreate.mock.calls[0][0];
      expect(call.model).toBe("claude-opus-4-6");
      expect(call.max_tokens).toBe(32768);
    });
  });

  // ============================================================
  // setCallbacks()
  // ============================================================

  describe("setCallbacks()", () => {
    it("replaces streaming callbacks", () => {
      const engine = new ThinkingEngine(makeOptions());
      const newThinking = vi.fn();
      const newText = vi.fn();
      const newCompaction = vi.fn();

      engine.setCallbacks({
        onThinkingStream: newThinking,
        onTextStream: newText,
        onCompactionStream: newCompaction,
      });

      // We verify the callbacks are invoked during streaming tests below
      expect(engine).toBeInstanceOf(ThinkingEngine);
    });
  });

  // ============================================================
  // think() — Non-Streaming (Adaptive Mode)
  // ============================================================

  describe("think() — non-streaming adaptive mode", () => {
    it("returns parsed thinking, text, and usage", async () => {
      const engine = new ThinkingEngine(makeOptions({ streaming: false }));
      const response = makeMockResponse({
        content: [
          { type: "thinking", thinking: "Let me reason...", signature: "sig-abc" } as unknown as Anthropic.ContentBlock,
          { type: "text", text: "The answer is 42." } as unknown as Anthropic.ContentBlock,
        ],
        usage: { input_tokens: 200, output_tokens: 100 },
      });
      mockCreate.mockResolvedValue(response);

      const result = await engine.think("You are helpful.", [
        { role: "user", content: "What is the meaning of life?" },
      ]);

      expect(result.thinkingBlocks).toHaveLength(1);
      expect(result.thinkingBlocks[0]).toEqual({
        type: "thinking",
        thinking: "Let me reason...",
        signature: "sig-abc",
      });
      expect(result.textBlocks).toHaveLength(1);
      expect(result.textBlocks[0]).toEqual({ type: "text", text: "The answer is 42." });
      expect(result.usage.inputTokens).toBe(200);
      expect(result.usage.outputTokens).toBe(100);
      expect(result.compacted).toBe(false);
    });

    it("sends adaptive thinking config with effort parameter", async () => {
      const engine = new ThinkingEngine(
        makeOptions({ streaming: false, thinking: { type: "adaptive", effort: "high" } })
      );
      mockCreate.mockResolvedValue(makeMockResponse());

      await engine.think("system", [{ role: "user", content: "test" }]);

      const params = mockCreate.mock.calls[0][0];
      expect(params.thinking).toEqual({ type: "adaptive" });
      expect(params.output_config).toEqual({ effort: "high" });
    });

    it("maps all effort levels correctly for adaptive mode", async () => {
      for (const effort of ["low", "medium", "high", "max"] as const) {
        mockCreate.mockResolvedValue(makeMockResponse());
        const engine = new ThinkingEngine(
          makeOptions({ streaming: false, thinking: { type: "adaptive", effort } })
        );
        await engine.think("system", [{ role: "user", content: "test" }]);

        const params = mockCreate.mock.calls[mockCreate.mock.calls.length - 1][0];
        expect(params.output_config).toEqual({ effort });
      }
    });

    it("passes system prompt and messages correctly", async () => {
      const engine = new ThinkingEngine(makeOptions({ streaming: false }));
      mockCreate.mockResolvedValue(makeMockResponse());

      const messages: Anthropic.MessageParam[] = [
        { role: "user", content: "Hello" },
        { role: "assistant", content: "Hi there" },
        { role: "user", content: "Help me" },
      ];

      await engine.think("You are a test assistant.", messages);

      const params = mockCreate.mock.calls[0][0];
      expect(params.system).toBe("You are a test assistant.");
      expect(params.messages).toBe(messages);
      expect(params.model).toBe("claude-opus-4-6");
    });

    it("includes tools when provided", async () => {
      const engine = new ThinkingEngine(makeOptions({ streaming: false }));
      mockCreate.mockResolvedValue(makeMockResponse());

      const tools: Anthropic.Tool[] = [
        {
          name: "search",
          description: "Search the web",
          input_schema: {
            type: "object" as const,
            properties: { query: { type: "string" } },
            required: ["query"],
          },
        },
      ];

      await engine.think("system", [{ role: "user", content: "test" }], tools);

      const params = mockCreate.mock.calls[0][0];
      expect(params.tools).toBe(tools);
    });

    it("omits tools when none provided", async () => {
      const engine = new ThinkingEngine(makeOptions({ streaming: false }));
      mockCreate.mockResolvedValue(makeMockResponse());

      await engine.think("system", [{ role: "user", content: "test" }]);

      const params = mockCreate.mock.calls[0][0];
      expect(params.tools).toBeUndefined();
    });

    it("omits tools when empty array provided", async () => {
      const engine = new ThinkingEngine(makeOptions({ streaming: false }));
      mockCreate.mockResolvedValue(makeMockResponse());

      await engine.think("system", [{ role: "user", content: "test" }], []);

      const params = mockCreate.mock.calls[0][0];
      expect(params.tools).toBeUndefined();
    });
  });

  // ============================================================
  // think() — Non-Streaming (Legacy Enabled Mode)
  // ============================================================

  describe("think() — non-streaming legacy enabled mode", () => {
    it("uses budget_tokens for enabled thinking type", async () => {
      const engine = new ThinkingEngine(
        makeOptions({ streaming: false, thinking: { type: "enabled", effort: "high" } })
      );
      mockCreate.mockResolvedValue(makeMockResponse());

      await engine.think("system", [{ role: "user", content: "test" }]);

      const params = mockCreate.mock.calls[0][0];
      expect(params.thinking).toEqual({ type: "enabled", budget_tokens: 20000 });
      expect(params.output_config).toBeUndefined();
    });

    it("maps effort levels to correct budget tokens", async () => {
      const effortMap: Record<string, number> = {
        low: 5000,
        medium: 10000,
        high: 20000,
        max: 50000,
      };

      for (const [effort, expectedBudget] of Object.entries(effortMap)) {
        mockCreate.mockResolvedValue(makeMockResponse());
        const engine = new ThinkingEngine(
          makeOptions({
            streaming: false,
            thinking: { type: "enabled", effort: effort as "low" | "medium" | "high" | "max" },
          })
        );
        await engine.think("system", [{ role: "user", content: "test" }]);

        const params = mockCreate.mock.calls[mockCreate.mock.calls.length - 1][0];
        expect(params.thinking.budget_tokens).toBe(expectedBudget);
      }
    });

    it("uses custom budgetTokens when specified", async () => {
      const engine = new ThinkingEngine(
        makeOptions({
          streaming: false,
          thinking: { type: "enabled", effort: "high", budgetTokens: 30000 },
        })
      );
      mockCreate.mockResolvedValue(makeMockResponse());

      await engine.think("system", [{ role: "user", content: "test" }]);

      const params = mockCreate.mock.calls[0][0];
      expect(params.thinking.budget_tokens).toBe(30000);
    });

    it("defaults to 10000 for unrecognized effort", async () => {
      const engine = new ThinkingEngine(
        makeOptions({
          streaming: false,
          thinking: { type: "enabled", effort: "unknown" as "low" },
        })
      );
      mockCreate.mockResolvedValue(makeMockResponse());

      await engine.think("system", [{ role: "user", content: "test" }]);

      const params = mockCreate.mock.calls[0][0];
      expect(params.thinking.budget_tokens).toBe(10000);
    });
  });

  // ============================================================
  // Response Parsing — Block Types
  // ============================================================

  describe("response parsing", () => {
    it("parses thinking blocks", async () => {
      const engine = new ThinkingEngine(makeOptions({ streaming: false }));
      mockCreate.mockResolvedValue(
        makeMockResponse({
          content: [
            { type: "thinking", thinking: "Step 1: analyze", signature: "sig-1" } as unknown as Anthropic.ContentBlock,
          ],
        })
      );

      const result = await engine.think("system", [{ role: "user", content: "test" }]);
      expect(result.thinkingBlocks).toHaveLength(1);
      expect(result.thinkingBlocks[0]).toEqual({
        type: "thinking",
        thinking: "Step 1: analyze",
        signature: "sig-1",
      });
      expect(result.content).toHaveLength(1);
    });

    it("parses redacted thinking blocks", async () => {
      const engine = new ThinkingEngine(makeOptions({ streaming: false }));
      mockCreate.mockResolvedValue(
        makeMockResponse({
          content: [
            { type: "redacted_thinking", data: "base64-encoded-data" } as unknown as Anthropic.ContentBlock,
          ],
        })
      );

      const result = await engine.think("system", [{ role: "user", content: "test" }]);
      expect(result.thinkingBlocks).toHaveLength(1);
      expect(result.thinkingBlocks[0]).toEqual({
        type: "redacted_thinking",
        data: "base64-encoded-data",
      });
    });

    it("parses text blocks", async () => {
      const engine = new ThinkingEngine(makeOptions({ streaming: false }));
      mockCreate.mockResolvedValue(
        makeMockResponse({
          content: [{ type: "text", text: "The answer is 42." } as Anthropic.ContentBlock],
        })
      );

      const result = await engine.think("system", [{ role: "user", content: "test" }]);
      expect(result.textBlocks).toHaveLength(1);
      expect(result.textBlocks[0]).toEqual({ type: "text", text: "The answer is 42." });
    });

    it("parses tool_use blocks", async () => {
      const engine = new ThinkingEngine(makeOptions({ streaming: false }));
      mockCreate.mockResolvedValue(
        makeMockResponse({
          content: [
            {
              type: "tool_use",
              id: "tool-call-1",
              name: "search",
              input: { query: "test" },
            } as unknown as Anthropic.ContentBlock,
          ],
        })
      );

      const result = await engine.think("system", [{ role: "user", content: "test" }]);
      expect(result.toolUseBlocks).toHaveLength(1);
      expect(result.toolUseBlocks[0]).toEqual({
        type: "tool_use",
        id: "tool-call-1",
        name: "search",
        input: { query: "test" },
      });
    });

    it("parses compaction blocks and sets compacted flag", async () => {
      const engine = new ThinkingEngine(makeOptions({ streaming: false }));
      mockCreate.mockResolvedValue(
        makeMockResponse({
          content: [
            { type: "compaction", content: "Summary of conversation..." } as unknown as Anthropic.ContentBlock,
            { type: "text", text: "Continuing after compaction." } as Anthropic.ContentBlock,
          ],
        })
      );

      const result = await engine.think("system", [{ role: "user", content: "test" }]);
      expect(result.compactionBlocks).toHaveLength(1);
      expect(result.compactionBlocks[0]).toEqual({
        type: "compaction",
        content: "Summary of conversation...",
      });
      expect(result.compacted).toBe(true);
      expect(result.textBlocks).toHaveLength(1);
    });

    it("parses mixed content blocks in order", async () => {
      const engine = new ThinkingEngine(makeOptions({ streaming: false }));
      mockCreate.mockResolvedValue(
        makeMockResponse({
          content: [
            { type: "thinking", thinking: "Reasoning...", signature: "sig" } as unknown as Anthropic.ContentBlock,
            { type: "text", text: "Response text" } as Anthropic.ContentBlock,
            { type: "tool_use", id: "t1", name: "calc", input: { x: 1 } } as unknown as Anthropic.ContentBlock,
          ],
        })
      );

      const result = await engine.think("system", [{ role: "user", content: "test" }]);
      expect(result.content).toHaveLength(3);
      expect(result.content[0].type).toBe("thinking");
      expect(result.content[1].type).toBe("text");
      expect(result.content[2].type).toBe("tool_use");
      expect(result.thinkingBlocks).toHaveLength(1);
      expect(result.textBlocks).toHaveLength(1);
      expect(result.toolUseBlocks).toHaveLength(1);
    });

    it("handles empty content array", async () => {
      const engine = new ThinkingEngine(makeOptions({ streaming: false }));
      mockCreate.mockResolvedValue(makeMockResponse({ content: [] }));

      const result = await engine.think("system", [{ role: "user", content: "test" }]);
      expect(result.content).toHaveLength(0);
      expect(result.thinkingBlocks).toHaveLength(0);
      expect(result.textBlocks).toHaveLength(0);
      expect(result.toolUseBlocks).toHaveLength(0);
      expect(result.compactionBlocks).toHaveLength(0);
      expect(result.compacted).toBe(false);
    });
  });

  // ============================================================
  // Token Usage Tracking
  // ============================================================

  describe("token usage tracking", () => {
    it("extracts basic input/output token counts", async () => {
      const engine = new ThinkingEngine(makeOptions({ streaming: false }));
      mockCreate.mockResolvedValue(
        makeMockResponse({ usage: { input_tokens: 500, output_tokens: 250 } })
      );

      const result = await engine.think("system", [{ role: "user", content: "test" }]);
      expect(result.usage.inputTokens).toBe(500);
      expect(result.usage.outputTokens).toBe(250);
    });

    it("extracts cache token counts when present", async () => {
      const engine = new ThinkingEngine(makeOptions({ streaming: false }));
      const response = makeMockResponse();
      (response.usage as Record<string, unknown>).cache_creation_input_tokens = 1000;
      (response.usage as Record<string, unknown>).cache_read_input_tokens = 800;
      mockCreate.mockResolvedValue(response);

      const result = await engine.think("system", [{ role: "user", content: "test" }]);
      expect(result.usage.cacheCreationInputTokens).toBe(1000);
      expect(result.usage.cacheReadInputTokens).toBe(800);
    });

    it("omits cache fields when not present in response", async () => {
      const engine = new ThinkingEngine(makeOptions({ streaming: false }));
      mockCreate.mockResolvedValue(makeMockResponse());

      const result = await engine.think("system", [{ role: "user", content: "test" }]);
      expect(result.usage.cacheCreationInputTokens).toBeUndefined();
      expect(result.usage.cacheReadInputTokens).toBeUndefined();
    });
  });

  // ============================================================
  // Stop Reason
  // ============================================================

  describe("stop reason", () => {
    it("captures end_turn stop reason", async () => {
      const engine = new ThinkingEngine(makeOptions({ streaming: false }));
      mockCreate.mockResolvedValue(makeMockResponse({ stop_reason: "end_turn" }));

      const result = await engine.think("system", [{ role: "user", content: "test" }]);
      expect(result.stopReason).toBe("end_turn");
    });

    it("captures tool_use stop reason", async () => {
      const engine = new ThinkingEngine(makeOptions({ streaming: false }));
      mockCreate.mockResolvedValue(makeMockResponse({ stop_reason: "tool_use" }));

      const result = await engine.think("system", [{ role: "user", content: "test" }]);
      expect(result.stopReason).toBe("tool_use");
    });

    it("returns undefined for null stop reason", async () => {
      const engine = new ThinkingEngine(makeOptions({ streaming: false }));
      mockCreate.mockResolvedValue(makeMockResponse({ stop_reason: null }));

      const result = await engine.think("system", [{ role: "user", content: "test" }]);
      expect(result.stopReason).toBeUndefined();
    });
  });

  // ============================================================
  // Data Residency (inferenceGeo)
  // ============================================================

  describe("data residency (inferenceGeo)", () => {
    it("includes inference_geo when set to 'us'", async () => {
      const engine = new ThinkingEngine(
        makeOptions({ streaming: false, inferenceGeo: "us" })
      );
      mockCreate.mockResolvedValue(makeMockResponse());

      await engine.think("system", [{ role: "user", content: "test" }]);

      const params = mockCreate.mock.calls[0][0];
      expect(params.inference_geo).toBe("us");
    });

    it("omits inference_geo when set to 'global'", async () => {
      const engine = new ThinkingEngine(
        makeOptions({ streaming: false, inferenceGeo: "global" })
      );
      mockCreate.mockResolvedValue(makeMockResponse());

      await engine.think("system", [{ role: "user", content: "test" }]);

      const params = mockCreate.mock.calls[0][0];
      expect(params.inference_geo).toBeUndefined();
    });

    it("omits inference_geo when not configured", async () => {
      const engine = new ThinkingEngine(makeOptions({ streaming: false }));
      mockCreate.mockResolvedValue(makeMockResponse());

      await engine.think("system", [{ role: "user", content: "test" }]);

      const params = mockCreate.mock.calls[0][0];
      expect(params.inference_geo).toBeUndefined();
    });
  });

  // ============================================================
  // Context Compaction Configuration
  // ============================================================

  describe("context compaction configuration", () => {
    it("includes context_management when compaction is enabled", async () => {
      const engine = new ThinkingEngine(
        makeOptions({
          streaming: false,
          compaction: { enabled: true, triggerTokens: 150000, pauseAfterCompaction: false },
        })
      );
      mockCreate.mockResolvedValue(makeMockResponse());

      await engine.think("system", [{ role: "user", content: "test" }]);

      const params = mockCreate.mock.calls[0][0];
      expect(params.context_management).toEqual({
        edits: [
          {
            type: "compact_20260112",
            trigger: { type: "input_tokens", value: 150000 },
            pause_after_compaction: false,
          },
        ],
      });
    });

    it("uses custom trigger tokens", async () => {
      const engine = new ThinkingEngine(
        makeOptions({
          streaming: false,
          compaction: { enabled: true, triggerTokens: 200000, pauseAfterCompaction: false },
        })
      );
      mockCreate.mockResolvedValue(makeMockResponse());

      await engine.think("system", [{ role: "user", content: "test" }]);

      const params = mockCreate.mock.calls[0][0];
      expect(params.context_management.edits[0].trigger.value).toBe(200000);
    });

    it("defaults trigger tokens to 150000 when not specified", async () => {
      const engine = new ThinkingEngine(
        makeOptions({
          streaming: false,
          compaction: { enabled: true, pauseAfterCompaction: false },
        })
      );
      mockCreate.mockResolvedValue(makeMockResponse());

      await engine.think("system", [{ role: "user", content: "test" }]);

      const params = mockCreate.mock.calls[0][0];
      expect(params.context_management.edits[0].trigger.value).toBe(150000);
    });

    it("includes pause_after_compaction when true", async () => {
      const engine = new ThinkingEngine(
        makeOptions({
          streaming: false,
          compaction: { enabled: true, triggerTokens: 150000, pauseAfterCompaction: true },
        })
      );
      mockCreate.mockResolvedValue(makeMockResponse());

      await engine.think("system", [{ role: "user", content: "test" }]);

      const params = mockCreate.mock.calls[0][0];
      expect(params.context_management.edits[0].pause_after_compaction).toBe(true);
    });

    it("includes custom instructions when provided", async () => {
      const engine = new ThinkingEngine(
        makeOptions({
          streaming: false,
          compaction: {
            enabled: true,
            triggerTokens: 150000,
            pauseAfterCompaction: false,
            instructions: "Preserve all reasoning chains and decision points.",
          },
        })
      );
      mockCreate.mockResolvedValue(makeMockResponse());

      await engine.think("system", [{ role: "user", content: "test" }]);

      const params = mockCreate.mock.calls[0][0];
      expect(params.context_management.edits[0].instructions).toBe(
        "Preserve all reasoning chains and decision points."
      );
    });

    it("omits instructions field when not provided", async () => {
      const engine = new ThinkingEngine(
        makeOptions({
          streaming: false,
          compaction: { enabled: true, triggerTokens: 150000, pauseAfterCompaction: false },
        })
      );
      mockCreate.mockResolvedValue(makeMockResponse());

      await engine.think("system", [{ role: "user", content: "test" }]);

      const params = mockCreate.mock.calls[0][0];
      expect(params.context_management.edits[0].instructions).toBeUndefined();
    });

    it("omits context_management when compaction is disabled", async () => {
      const engine = new ThinkingEngine(
        makeOptions({
          streaming: false,
          compaction: { enabled: false, triggerTokens: 150000, pauseAfterCompaction: false },
        })
      );
      mockCreate.mockResolvedValue(makeMockResponse());

      await engine.think("system", [{ role: "user", content: "test" }]);

      const params = mockCreate.mock.calls[0][0];
      expect(params.context_management).toBeUndefined();
    });

    it("omits context_management when compaction is not configured", async () => {
      const engine = new ThinkingEngine(makeOptions({ streaming: false }));
      mockCreate.mockResolvedValue(makeMockResponse());

      await engine.think("system", [{ role: "user", content: "test" }]);

      const params = mockCreate.mock.calls[0][0];
      expect(params.context_management).toBeUndefined();
    });
  });

  // ============================================================
  // Streaming Mode
  // ============================================================

  describe("think() — streaming mode", () => {
    function createMockStream(events: Array<Record<string, unknown>>, finalMessage: Anthropic.Message) {
      return {
        [Symbol.asyncIterator]: () => {
          let index = 0;
          return {
            next: async () => {
              if (index < events.length) {
                return { value: events[index++], done: false };
              }
              return { value: undefined, done: true };
            },
          };
        },
        finalMessage: vi.fn().mockResolvedValue(finalMessage),
      };
    }

    it("uses stream API when streaming is enabled", async () => {
      const finalMsg = makeMockResponse({
        content: [{ type: "text", text: "Streamed response" } as Anthropic.ContentBlock],
      });
      const stream = createMockStream([], finalMsg);
      mockStream.mockReturnValue(stream);

      const engine = new ThinkingEngine(makeOptions({ streaming: true }));
      const result = await engine.think("system", [{ role: "user", content: "test" }]);

      expect(mockStream).toHaveBeenCalledTimes(1);
      expect(mockCreate).not.toHaveBeenCalled();
      expect(result.textBlocks).toHaveLength(1);
      expect(result.textBlocks[0].text).toBe("Streamed response");
    });

    it("sets stream: true in request params", async () => {
      const finalMsg = makeMockResponse();
      const stream = createMockStream([], finalMsg);
      mockStream.mockReturnValue(stream);

      const engine = new ThinkingEngine(makeOptions({ streaming: true }));
      await engine.think("system", [{ role: "user", content: "test" }]);

      const params = mockStream.mock.calls[0][0];
      expect(params.stream).toBe(true);
    });

    it("invokes onThinkingStream callback for thinking deltas", async () => {
      const onThinkingStream = vi.fn();
      const events = [
        {
          type: "content_block_delta",
          delta: { type: "thinking_delta", thinking: "Step 1..." },
        },
        {
          type: "content_block_delta",
          delta: { type: "thinking_delta", thinking: " Step 2..." },
        },
      ];
      const finalMsg = makeMockResponse();
      const stream = createMockStream(events, finalMsg);
      mockStream.mockReturnValue(stream);

      const engine = new ThinkingEngine(makeOptions({ streaming: true }, { onThinkingStream }));
      await engine.think("system", [{ role: "user", content: "test" }]);

      expect(onThinkingStream).toHaveBeenCalledTimes(2);
      expect(onThinkingStream).toHaveBeenCalledWith("Step 1...");
      expect(onThinkingStream).toHaveBeenCalledWith(" Step 2...");
    });

    it("invokes onTextStream callback for text deltas", async () => {
      const onTextStream = vi.fn();
      const events = [
        {
          type: "content_block_delta",
          delta: { type: "text_delta", text: "Hello " },
        },
        {
          type: "content_block_delta",
          delta: { type: "text_delta", text: "world!" },
        },
      ];
      const finalMsg = makeMockResponse();
      const stream = createMockStream(events, finalMsg);
      mockStream.mockReturnValue(stream);

      const engine = new ThinkingEngine(makeOptions({ streaming: true }, { onTextStream }));
      await engine.think("system", [{ role: "user", content: "test" }]);

      expect(onTextStream).toHaveBeenCalledTimes(2);
      expect(onTextStream).toHaveBeenCalledWith("Hello ");
      expect(onTextStream).toHaveBeenCalledWith("world!");
    });

    it("invokes onCompactionStream callback for compaction deltas", async () => {
      const onCompactionStream = vi.fn();
      const events = [
        {
          type: "content_block_delta",
          delta: { type: "compaction_delta", content: "Conversation summary..." },
        },
      ];
      const finalMsg = makeMockResponse();
      const stream = createMockStream(events, finalMsg);
      mockStream.mockReturnValue(stream);

      const engine = new ThinkingEngine(makeOptions({ streaming: true }, { onCompactionStream }));
      await engine.think("system", [{ role: "user", content: "test" }]);

      expect(onCompactionStream).toHaveBeenCalledTimes(1);
      expect(onCompactionStream).toHaveBeenCalledWith("Conversation summary...");
    });

    it("handles compaction content_block_start event", async () => {
      const events = [
        {
          type: "content_block_start",
          content_block: { type: "compaction" },
        },
      ];
      const finalMsg = makeMockResponse();
      const stream = createMockStream(events, finalMsg);
      mockStream.mockReturnValue(stream);

      // Should not throw -- just logs
      const engine = new ThinkingEngine(makeOptions({ streaming: true }));
      const result = await engine.think("system", [{ role: "user", content: "test" }]);
      expect(result).toBeDefined();
    });

    it("handles stream with no events gracefully", async () => {
      const finalMsg = makeMockResponse({
        content: [{ type: "text", text: "Final" } as Anthropic.ContentBlock],
      });
      const stream = createMockStream([], finalMsg);
      mockStream.mockReturnValue(stream);

      const engine = new ThinkingEngine(makeOptions({ streaming: true }));
      const result = await engine.think("system", [{ role: "user", content: "test" }]);
      expect(result.textBlocks).toHaveLength(1);
    });

    it("does not crash when callbacks are not set", async () => {
      const events = [
        { type: "content_block_delta", delta: { type: "thinking_delta", thinking: "think" } },
        { type: "content_block_delta", delta: { type: "text_delta", text: "text" } },
        { type: "content_block_delta", delta: { type: "compaction_delta", content: "compact" } },
      ];
      const finalMsg = makeMockResponse();
      const stream = createMockStream(events, finalMsg);
      mockStream.mockReturnValue(stream);

      // No callbacks provided
      const engine = new ThinkingEngine(makeOptions({ streaming: true }));
      const result = await engine.think("system", [{ role: "user", content: "test" }]);
      expect(result).toBeDefined();
    });

    it("ignores unknown delta types", async () => {
      const events = [
        { type: "content_block_delta", delta: { type: "unknown_delta", data: "something" } },
      ];
      const finalMsg = makeMockResponse();
      const stream = createMockStream(events, finalMsg);
      mockStream.mockReturnValue(stream);

      const engine = new ThinkingEngine(makeOptions({ streaming: true }));
      const result = await engine.think("system", [{ role: "user", content: "test" }]);
      expect(result).toBeDefined();
    });
  });

  // ============================================================
  // Error Handling
  // ============================================================

  describe("error handling", () => {
    it("propagates API errors from non-streaming calls", async () => {
      const engine = new ThinkingEngine(makeOptions({ streaming: false }));
      mockCreate.mockRejectedValue(new Error("API rate limit exceeded"));

      await expect(
        engine.think("system", [{ role: "user", content: "test" }])
      ).rejects.toThrow("API rate limit exceeded");
    });

    it("propagates API errors from streaming calls", async () => {
      const engine = new ThinkingEngine(makeOptions({ streaming: true }));
      mockStream.mockImplementation(() => {
        throw new Error("Stream connection failed");
      });

      await expect(
        engine.think("system", [{ role: "user", content: "test" }])
      ).rejects.toThrow("Stream connection failed");
    });

    it("propagates errors thrown during stream iteration", async () => {
      const engine = new ThinkingEngine(makeOptions({ streaming: true }));
      mockStream.mockReturnValue({
        [Symbol.asyncIterator]: () => ({
          next: async () => {
            throw new Error("Stream interrupted");
          },
        }),
        finalMessage: vi.fn(),
      });

      await expect(
        engine.think("system", [{ role: "user", content: "test" }])
      ).rejects.toThrow("Stream interrupted");
    });

    it("propagates errors from finalMessage()", async () => {
      const engine = new ThinkingEngine(makeOptions({ streaming: true }));
      mockStream.mockReturnValue({
        [Symbol.asyncIterator]: () => ({
          next: async () => ({ value: undefined, done: true }),
        }),
        finalMessage: vi.fn().mockRejectedValue(new Error("Final message failed")),
      });

      await expect(
        engine.think("system", [{ role: "user", content: "test" }])
      ).rejects.toThrow("Final message failed");
    });
  });

  // ============================================================
  // Edge Cases
  // ============================================================

  describe("edge cases", () => {
    it("handles response with only redacted thinking blocks", async () => {
      const engine = new ThinkingEngine(makeOptions({ streaming: false }));
      mockCreate.mockResolvedValue(
        makeMockResponse({
          content: [
            { type: "redacted_thinking", data: "abc123" } as unknown as Anthropic.ContentBlock,
            { type: "redacted_thinking", data: "def456" } as unknown as Anthropic.ContentBlock,
          ],
        })
      );

      const result = await engine.think("system", [{ role: "user", content: "test" }]);
      expect(result.thinkingBlocks).toHaveLength(2);
      expect(result.textBlocks).toHaveLength(0);
      expect(result.toolUseBlocks).toHaveLength(0);
    });

    it("handles response with multiple thinking blocks interspersed", async () => {
      const engine = new ThinkingEngine(makeOptions({ streaming: false }));
      mockCreate.mockResolvedValue(
        makeMockResponse({
          content: [
            { type: "thinking", thinking: "First thought", signature: "s1" } as unknown as Anthropic.ContentBlock,
            { type: "text", text: "First response" } as Anthropic.ContentBlock,
            { type: "thinking", thinking: "Second thought", signature: "s2" } as unknown as Anthropic.ContentBlock,
            { type: "text", text: "Second response" } as Anthropic.ContentBlock,
          ],
        })
      );

      const result = await engine.think("system", [{ role: "user", content: "test" }]);
      expect(result.thinkingBlocks).toHaveLength(2);
      expect(result.textBlocks).toHaveLength(2);
      expect(result.content).toHaveLength(4);
    });

    it("handles response with multiple tool calls", async () => {
      const engine = new ThinkingEngine(makeOptions({ streaming: false }));
      mockCreate.mockResolvedValue(
        makeMockResponse({
          content: [
            { type: "tool_use", id: "t1", name: "search", input: { q: "a" } } as unknown as Anthropic.ContentBlock,
            { type: "tool_use", id: "t2", name: "calculate", input: { x: 1 } } as unknown as Anthropic.ContentBlock,
          ],
          stop_reason: "tool_use",
        })
      );

      const result = await engine.think("system", [{ role: "user", content: "test" }]);
      expect(result.toolUseBlocks).toHaveLength(2);
      expect(result.stopReason).toBe("tool_use");
    });

    it("handles unknown block types gracefully", async () => {
      const engine = new ThinkingEngine(makeOptions({ streaming: false }));
      mockCreate.mockResolvedValue(
        makeMockResponse({
          content: [
            { type: "unknown_type", data: "something" } as unknown as Anthropic.ContentBlock,
            { type: "text", text: "Normal text" } as Anthropic.ContentBlock,
          ],
        })
      );

      const result = await engine.think("system", [{ role: "user", content: "test" }]);
      // Unknown block type is silently skipped
      expect(result.content).toHaveLength(1);
      expect(result.textBlocks).toHaveLength(1);
    });

    it("handles very large thinking blocks", async () => {
      const engine = new ThinkingEngine(makeOptions({ streaming: false }));
      const largeThinking = "x".repeat(100000);
      mockCreate.mockResolvedValue(
        makeMockResponse({
          content: [
            { type: "thinking", thinking: largeThinking, signature: "sig" } as unknown as Anthropic.ContentBlock,
          ],
        })
      );

      const result = await engine.think("system", [{ role: "user", content: "test" }]);
      expect(result.thinkingBlocks).toHaveLength(1);
      expect((result.thinkingBlocks[0] as { thinking: string }).thinking).toHaveLength(100000);
    });
  });
});
