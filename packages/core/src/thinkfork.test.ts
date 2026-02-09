import { describe, it, expect } from "vitest";
import {
  ForkStyleSchema,
  ForkBranchResultSchema,
  ThinkForkOptionsSchema,
  DebateOptionsSchema,
  DebateRoundEntrySchema,
  BranchSteeringActionSchema,
} from "./types/thinkfork.js";
import { ThinkForkEngine } from "./thinkfork.js";
import type { ForkBranchResult } from "./types/thinkfork.js";
import type { ToolUseBlock } from "./types/orchestrator.js";

// ============================================================
// Expose private methods for testing via subclass
// ============================================================

class TestableThinkForkEngine extends ThinkForkEngine {
  public testParseBranchResult(
    style: "conservative" | "aggressive" | "balanced" | "contrarian",
    toolUseBlocks: ToolUseBlock[],
    tokensUsed: number
  ): ForkBranchResult {
    return (this as any).parseBranchResult(style, toolUseBlocks, tokensUsed);
  }

  public testCreateFailedBranchResult(
    style: "conservative" | "aggressive" | "balanced" | "contrarian",
    error: string,
    durationMs: number
  ): ForkBranchResult {
    return (this as any).createFailedBranchResult(style, error, durationMs);
  }

  public testGenerateBasicMetaInsight(branches: ForkBranchResult[]): string {
    return (this as any).generateBasicMetaInsight(branches);
  }
}

// ============================================================
// Zod Schema Validation Tests
// ============================================================

describe("ThinkFork Zod Schemas", () => {
  describe("ForkStyleSchema", () => {
    it("accepts all four valid styles", () => {
      expect(ForkStyleSchema.safeParse("conservative").success).toBe(true);
      expect(ForkStyleSchema.safeParse("aggressive").success).toBe(true);
      expect(ForkStyleSchema.safeParse("balanced").success).toBe(true);
      expect(ForkStyleSchema.safeParse("contrarian").success).toBe(true);
    });

    it("rejects invalid styles", () => {
      expect(ForkStyleSchema.safeParse("radical").success).toBe(false);
      expect(ForkStyleSchema.safeParse("").success).toBe(false);
      expect(ForkStyleSchema.safeParse(123).success).toBe(false);
    });
  });

  describe("ThinkForkOptionsSchema", () => {
    it("applies defaults for missing fields", () => {
      const result = ThinkForkOptionsSchema.parse({});
      expect(result.styles).toEqual(["conservative", "aggressive", "balanced", "contrarian"]);
      expect(result.effort).toBe("high");
      expect(result.analyzeConvergence).toBe(true);
    });

    it("accepts valid complete options", () => {
      const result = ThinkForkOptionsSchema.safeParse({
        styles: ["conservative", "aggressive"],
        effort: "max",
        analyzeConvergence: false,
        additionalContext: "some context",
      });
      expect(result.success).toBe(true);
    });

    it("rejects styles array with fewer than 2 items", () => {
      const result = ThinkForkOptionsSchema.safeParse({
        styles: ["conservative"],
      });
      expect(result.success).toBe(false);
    });

    it("accepts valid effort levels", () => {
      for (const effort of ["low", "medium", "high", "max"]) {
        const result = ThinkForkOptionsSchema.safeParse({ effort });
        expect(result.success).toBe(true);
      }
    });

    it("rejects invalid effort level", () => {
      const result = ThinkForkOptionsSchema.safeParse({ effort: "turbo" });
      expect(result.success).toBe(false);
    });
  });

  describe("DebateOptionsSchema", () => {
    it("applies defaults", () => {
      const result = DebateOptionsSchema.parse({});
      expect(result.rounds).toBe(2);
      expect(result.effort).toBe("high");
      expect(result.styles).toEqual(["conservative", "aggressive", "balanced", "contrarian"]);
    });

    it("clamps rounds to 1-5 range", () => {
      expect(DebateOptionsSchema.safeParse({ rounds: 0 }).success).toBe(false);
      expect(DebateOptionsSchema.safeParse({ rounds: 6 }).success).toBe(false);
      expect(DebateOptionsSchema.safeParse({ rounds: 3 }).success).toBe(true);
    });

    it("requires at least 2 styles for debate", () => {
      expect(
        DebateOptionsSchema.safeParse({ styles: ["conservative"] }).success
      ).toBe(false);
      expect(
        DebateOptionsSchema.safeParse({ styles: ["conservative", "aggressive"] }).success
      ).toBe(true);
    });
  });

  describe("DebateRoundEntrySchema", () => {
    it("accepts valid debate round entry", () => {
      const result = DebateRoundEntrySchema.safeParse({
        style: "conservative",
        round: 1,
        response: "My counterargument is...",
        confidence: 0.75,
        positionChanged: false,
        keyCounterpoints: ["Point A is wrong"],
        concessions: [],
      });
      expect(result.success).toBe(true);
    });

    it("rejects confidence outside 0-1", () => {
      const result = DebateRoundEntrySchema.safeParse({
        style: "aggressive",
        round: 1,
        response: "Response",
        confidence: 1.5,
        positionChanged: true,
        keyCounterpoints: [],
        concessions: [],
      });
      expect(result.success).toBe(false);
    });
  });

  describe("BranchSteeringActionSchema", () => {
    it("accepts expand action", () => {
      const result = BranchSteeringActionSchema.safeParse({
        action: "expand",
        style: "aggressive",
        direction: "Focus on risks",
      });
      expect(result.success).toBe(true);
    });

    it("accepts merge action with 2+ styles", () => {
      const result = BranchSteeringActionSchema.safeParse({
        action: "merge",
        styles: ["conservative", "balanced"],
      });
      expect(result.success).toBe(true);
    });

    it("rejects merge action with fewer than 2 styles", () => {
      const result = BranchSteeringActionSchema.safeParse({
        action: "merge",
        styles: ["conservative"],
      });
      expect(result.success).toBe(false);
    });

    it("accepts challenge action", () => {
      const result = BranchSteeringActionSchema.safeParse({
        action: "challenge",
        style: "contrarian",
        challenge: "What about edge case X?",
      });
      expect(result.success).toBe(true);
    });

    it("accepts refork action", () => {
      const result = BranchSteeringActionSchema.safeParse({
        action: "refork",
        newContext: "Updated context for re-analysis",
      });
      expect(result.success).toBe(true);
    });

    it("rejects unknown action", () => {
      const result = BranchSteeringActionSchema.safeParse({
        action: "delete",
        style: "conservative",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("ForkBranchResultSchema", () => {
    it("accepts valid branch result", () => {
      const result = ForkBranchResultSchema.safeParse({
        style: "conservative",
        conclusion: "This approach is safest",
        confidence: 0.85,
        keyInsights: ["Point 1", "Point 2"],
        outputTokensUsed: 1500,
        durationMs: 3000,
      });
      expect(result.success).toBe(true);
    });

    it("accepts branch result with error", () => {
      const result = ForkBranchResultSchema.safeParse({
        style: "aggressive",
        conclusion: "",
        confidence: 0,
        keyInsights: [],
        outputTokensUsed: 0,
        durationMs: 100,
        error: "API rate limit exceeded",
      });
      expect(result.success).toBe(true);
      expect(result.data?.error).toBe("API rate limit exceeded");
    });

    it("rejects confidence > 1", () => {
      const result = ForkBranchResultSchema.safeParse({
        style: "balanced",
        conclusion: "Result",
        confidence: 1.5,
        keyInsights: [],
        outputTokensUsed: 0,
        durationMs: 0,
      });
      expect(result.success).toBe(false);
    });
  });
});

// ============================================================
// Private Method Tests (via TestableThinkForkEngine)
// ============================================================

describe("ThinkForkEngine", () => {
  const engine = new TestableThinkForkEngine();

  describe("parseBranchResult()", () => {
    it("parses valid tool output", () => {
      const toolBlocks: ToolUseBlock[] = [
        {
          type: "tool_use",
          id: "tool-1",
          name: "record_conclusion",
          input: {
            conclusion: "The iterative approach is best",
            confidence: 0.85,
            key_insights: ["Avoids stack overflow", "O(1) space"],
            risks: ["Harder to read"],
            opportunities: ["Performance gains"],
            assumptions: ["Large input sizes"],
          },
        },
      ];

      const result = engine.testParseBranchResult("conservative", toolBlocks, 2000);

      expect(result.style).toBe("conservative");
      expect(result.conclusion).toBe("The iterative approach is best");
      expect(result.confidence).toBe(0.85);
      expect(result.keyInsights).toEqual(["Avoids stack overflow", "O(1) space"]);
      expect(result.risks).toEqual(["Harder to read"]);
      expect(result.opportunities).toEqual(["Performance gains"]);
      expect(result.assumptions).toEqual(["Large input sizes"]);
      expect(result.outputTokensUsed).toBe(2000);
      expect(result.error).toBeUndefined();
    });

    it("handles missing conclusion tool gracefully", () => {
      const toolBlocks: ToolUseBlock[] = [
        {
          type: "tool_use",
          id: "tool-1",
          name: "some_other_tool",
          input: {},
        },
      ];

      const result = engine.testParseBranchResult("aggressive", toolBlocks, 500);

      expect(result.style).toBe("aggressive");
      expect(result.conclusion).toBe("");
      expect(result.confidence).toBe(0);
      expect(result.keyInsights).toEqual([]);
      expect(result.error).toContain("did not provide structured conclusion");
    });

    it("clamps confidence to 0-1 range", () => {
      const toolBlocks: ToolUseBlock[] = [
        {
          type: "tool_use",
          id: "tool-1",
          name: "record_conclusion",
          input: {
            conclusion: "Test",
            confidence: 5.0,
            key_insights: ["Point"],
          },
        },
      ];

      const result = engine.testParseBranchResult("balanced", toolBlocks, 100);
      expect(result.confidence).toBe(1);
    });

    it("handles NaN confidence by defaulting to 0.5", () => {
      const toolBlocks: ToolUseBlock[] = [
        {
          type: "tool_use",
          id: "tool-1",
          name: "record_conclusion",
          input: {
            conclusion: "Test",
            confidence: "not-a-number",
            key_insights: [],
          },
        },
      ];

      const result = engine.testParseBranchResult("contrarian", toolBlocks, 100);
      expect(result.confidence).toBe(0.5);
    });

    it("handles confidence of exactly 0", () => {
      const toolBlocks: ToolUseBlock[] = [
        {
          type: "tool_use",
          id: "tool-1",
          name: "record_conclusion",
          input: {
            conclusion: "Low confidence result",
            confidence: 0,
            key_insights: ["Uncertain"],
          },
        },
      ];

      const result = engine.testParseBranchResult("balanced", toolBlocks, 100);
      expect(result.confidence).toBe(0);
    });

    it("filters non-string items from key_insights", () => {
      const toolBlocks: ToolUseBlock[] = [
        {
          type: "tool_use",
          id: "tool-1",
          name: "record_conclusion",
          input: {
            conclusion: "Test",
            confidence: 0.7,
            key_insights: ["Valid", 123, null, "Also valid"],
          },
        },
      ];

      const result = engine.testParseBranchResult("conservative", toolBlocks, 100);
      expect(result.keyInsights).toEqual(["Valid", "Also valid"]);
    });

    it("handles non-array key_insights gracefully", () => {
      const toolBlocks: ToolUseBlock[] = [
        {
          type: "tool_use",
          id: "tool-1",
          name: "record_conclusion",
          input: {
            conclusion: "Test",
            confidence: 0.5,
            key_insights: "not an array",
          },
        },
      ];

      const result = engine.testParseBranchResult("conservative", toolBlocks, 100);
      expect(result.keyInsights).toEqual([]);
    });
  });

  describe("createFailedBranchResult()", () => {
    it("returns a result with zero confidence and error message", () => {
      const result = engine.testCreateFailedBranchResult(
        "aggressive",
        "API rate limit exceeded",
        1500
      );

      expect(result.style).toBe("aggressive");
      expect(result.conclusion).toBe("");
      expect(result.confidence).toBe(0);
      expect(result.keyInsights).toEqual([]);
      expect(result.outputTokensUsed).toBe(0);
      expect(result.durationMs).toBe(1500);
      expect(result.error).toBe("API rate limit exceeded");
    });

    it("passes through arbitrary error messages", () => {
      const result = engine.testCreateFailedBranchResult(
        "contrarian",
        "Unexpected failure: Connection reset",
        0
      );

      expect(result.error).toBe("Unexpected failure: Connection reset");
    });

    it("validates against ForkBranchResultSchema", () => {
      const result = engine.testCreateFailedBranchResult(
        "balanced",
        "Test error",
        500
      );

      const validation = ForkBranchResultSchema.safeParse(result);
      expect(validation.success).toBe(true);
    });
  });

  describe("generateBasicMetaInsight()", () => {
    it("returns empty message for no branches", () => {
      const result = engine.testGenerateBasicMetaInsight([]);
      expect(result).toBe("No branches were analyzed.");
    });

    it("returns failure message when all branches have errors", () => {
      const branches: ForkBranchResult[] = [
        {
          style: "conservative",
          conclusion: "",
          confidence: 0,
          keyInsights: [],
          outputTokensUsed: 0,
          durationMs: 0,
          error: "Failed",
        },
        {
          style: "aggressive",
          conclusion: "",
          confidence: 0,
          keyInsights: [],
          outputTokensUsed: 0,
          durationMs: 0,
          error: "Also failed",
        },
      ];

      const result = engine.testGenerateBasicMetaInsight(branches);
      expect(result).toContain("All branches failed");
    });

    it("detects high-confidence consensus", () => {
      const branches: ForkBranchResult[] = [
        {
          style: "conservative",
          conclusion: "Option A",
          confidence: 0.9,
          keyInsights: ["A1"],
          outputTokensUsed: 1000,
          durationMs: 500,
        },
        {
          style: "aggressive",
          conclusion: "Option A agrees",
          confidence: 0.85,
          keyInsights: ["A2"],
          outputTokensUsed: 1000,
          durationMs: 600,
        },
      ];

      const result = engine.testGenerateBasicMetaInsight(branches);
      expect(result).toContain("high-confidence");
      expect(result).toContain("robust");
    });

    it("detects low-confidence uncertainty", () => {
      const branches: ForkBranchResult[] = [
        {
          style: "balanced",
          conclusion: "Maybe A",
          confidence: 0.4,
          keyInsights: [],
          outputTokensUsed: 500,
          durationMs: 300,
        },
        {
          style: "contrarian",
          conclusion: "Maybe B",
          confidence: 0.35,
          keyInsights: [],
          outputTokensUsed: 500,
          durationMs: 300,
        },
      ];

      const result = engine.testGenerateBasicMetaInsight(branches);
      expect(result).toContain("low confidence");
      expect(result).toContain("uncertainty");
    });

    it("reports mixed confidence with average", () => {
      const branches: ForkBranchResult[] = [
        {
          style: "conservative",
          conclusion: "A",
          confidence: 0.9,
          keyInsights: [],
          outputTokensUsed: 100,
          durationMs: 100,
        },
        {
          style: "aggressive",
          conclusion: "B",
          confidence: 0.4,
          keyInsights: [],
          outputTokensUsed: 100,
          durationMs: 100,
        },
      ];

      const result = engine.testGenerateBasicMetaInsight(branches);
      expect(result).toContain("Mixed confidence");
      expect(result).toContain("65%"); // (90 + 40) / 2
    });

    it("ignores failed branches when computing confidence", () => {
      const branches: ForkBranchResult[] = [
        {
          style: "conservative",
          conclusion: "Solid",
          confidence: 0.9,
          keyInsights: ["Good"],
          outputTokensUsed: 1000,
          durationMs: 500,
        },
        {
          style: "aggressive",
          conclusion: "",
          confidence: 0,
          keyInsights: [],
          outputTokensUsed: 0,
          durationMs: 0,
          error: "Failed",
        },
        {
          style: "balanced",
          conclusion: "Also solid",
          confidence: 0.85,
          keyInsights: ["Good too"],
          outputTokensUsed: 800,
          durationMs: 400,
        },
      ];

      const result = engine.testGenerateBasicMetaInsight(branches);
      // Only successful branches (0.9 and 0.85) should be considered
      expect(result).toContain("high-confidence");
    });
  });
});
