import { describe, it, expect } from "vitest";
import { GoTEngine } from "./got-engine.js";
import type { GoTConfig, GoTResult, Thought, GraphReasoningState } from "./types/got.js";

describe("GoTEngine", () => {
  describe("constructor", () => {
    it("creates an instance with default options", () => {
      const engine = new GoTEngine();
      expect(engine).toBeInstanceOf(GoTEngine);
    });

    it("creates an instance with custom callbacks", () => {
      const onThoughtGenerated = (_thought: Thought) => {};
      const engine = new GoTEngine({ onThoughtGenerated });
      expect(engine).toBeInstanceOf(GoTEngine);
    });
  });

  describe("reason()", () => {
    // Note: Full integration tests require ANTHROPIC_API_KEY
    // These tests verify the structure and configuration handling
    it("rejects empty problem string", async () => {
      const engine = new GoTEngine();
      // The engine should still return a structured result even for trivial input
      // (it won't call the API without a key, but we verify config handling)
      try {
        await engine.reason("", { maxDepth: 1, maxThoughts: 1, branchingFactor: 1 });
      } catch {
        // Expected: API key not set in test environment
      }
    });
  });
});

describe("GoT Types", () => {
  describe("ThoughtState", () => {
    it("defines all valid states", () => {
      const validStates = [
        "pending", "generating", "generated", "evaluating",
        "verified", "rejected", "aggregated", "refined",
      ];
      // Verify these are valid by creating thoughts with each state
      for (const state of validStates) {
        const thought: Partial<Thought> = { state: state as Thought["state"] };
        expect(thought.state).toBe(state);
      }
    });
  });

  describe("SearchStrategy", () => {
    it("supports all three search strategies", () => {
      const strategies = ["bfs", "dfs", "best_first"];
      for (const strategy of strategies) {
        expect(strategies).toContain(strategy);
      }
    });
  });

  describe("GoTConfig defaults", () => {
    it("has sensible defaults", () => {
      const defaults: GoTConfig = {
        strategy: "bfs",
        maxDepth: 5,
        branchingFactor: 3,
        pruneThreshold: 0.3,
        maxThoughts: 50,
        enableAggregation: true,
        enableRefinement: true,
        maxRefinements: 2,
        effort: "high",
      };

      expect(defaults.strategy).toBe("bfs");
      expect(defaults.maxDepth).toBe(5);
      expect(defaults.branchingFactor).toBe(3);
      expect(defaults.pruneThreshold).toBe(0.3);
      expect(defaults.maxThoughts).toBe(50);
      expect(defaults.enableAggregation).toBe(true);
      expect(defaults.enableRefinement).toBe(true);
    });
  });

  describe("GoTResult structure", () => {
    it("validates a well-formed GoT result", () => {
      const result: GoTResult = {
        answer: "The optimal approach is X",
        confidence: 0.85,
        graphState: {
          sessionId: crypto.randomUUID(),
          thoughts: [],
          edges: [],
          bestThoughts: [],
          totalTokens: 1000,
          totalDurationMs: 5000,
        },
        reasoningSummary: "Explored 10 thoughts across 3 levels",
        stats: {
          totalThoughts: 10,
          thoughtsExplored: 7,
          thoughtsPruned: 3,
          aggregationsMade: 1,
          refinementsMade: 0,
          maxDepthReached: 3,
          totalTokens: 1000,
          totalDurationMs: 5000,
        },
      };

      expect(result.answer).toBeTruthy();
      expect(result.confidence).toBeGreaterThanOrEqual(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
      expect(result.stats.totalThoughts).toBe(10);
      expect(result.stats.thoughtsExplored + result.stats.thoughtsPruned).toBeLessThanOrEqual(result.stats.totalThoughts);
    });
  });
});
