import { describe, it, expect } from "vitest";
import { ThinkGraph } from "./think-graph.js";
import type { ThinkingBlock, RedactedThinkingBlock } from "./types/orchestrator.js";

describe("ThinkGraph", () => {
  const thinkGraph = new ThinkGraph();

  // ============================================================
  // Sample Data
  // ============================================================

  const sampleThinkingWithDecisions: ThinkingBlock[] = [
    {
      type: "thinking",
      thinking: `Let me analyze this problem carefully.

First, I need to consider the options available. On one hand, I could use a recursive approach which would be more elegant. On the other hand, an iterative approach would be more memory efficient.

I'm comparing Option A (recursion) versus Option B (iteration). The trade-off here is between code clarity and performance.

After weighing the pros and cons, I'll go with the iterative approach because it avoids stack overflow issues for large inputs. I'm confident this is the right choice given the requirements.

Therefore, I will implement the solution using a simple while loop with O(1) space complexity.`,
      signature: "test-signature-123",
    },
  ];

  const sampleThinkingWithAlternatives: ThinkingBlock[] = [
    {
      type: "thinking",
      thinking: `Looking at the authentication options:

Option 1: JWT tokens - stateless, but harder to revoke
Option 2: Session-based - easy to revoke, but requires server state
Option 3: OAuth integration - more complex, but supports SSO

I've decided to go with JWT tokens because the application is stateless and token revocation isn't a critical requirement. However, I ruled out sessions because they would add server complexity, and OAuth was rejected because it's overkill for this use case.

The best approach is to implement JWT with short expiration times to mitigate the revocation limitation. I'm reasonably confident this will work well for the MVP.`,
      signature: "test-signature-456",
    },
  ];

  const highConfidenceThinking: ThinkingBlock[] = [
    {
      type: "thinking",
      thinking: `This is definitely the correct approach. The evidence is conclusive and I'm absolutely certain about this decision. Based on the proven patterns and established best practices, I'm confident this will work.`,
      signature: "test-sig-hc",
    },
  ];

  const lowConfidenceThinking: ThinkingBlock[] = [
    {
      type: "thinking",
      thinking: `I'm uncertain about this. It might work, but I'm unsure. The requirements are ambiguous and the outcome is questionable. Perhaps we should consider other options, but I could be wrong.`,
      signature: "test-sig-lc",
    },
  ];

  // ============================================================
  // Parsing Tests
  // ============================================================

  describe("parseThinkingToNode()", () => {
    it("extracts reasoning text from thinking blocks", () => {
      const result = thinkGraph.parseThinkingToNode(sampleThinkingWithDecisions);
      expect(result.reasoning.length).toBeGreaterThan(0);
      expect(result.reasoning).toContain("analyze this problem");
    });

    it("extracts structured reasoning steps", () => {
      const result = thinkGraph.parseThinkingToNode(sampleThinkingWithDecisions);
      expect(result.structuredReasoning.steps.length).toBeGreaterThan(0);
    });

    it("classifies reasoning step types", () => {
      const result = thinkGraph.parseThinkingToNode(sampleThinkingWithDecisions);
      const types = result.structuredReasoning.steps.map((s) => s.type);
      const validTypes = ["analysis", "hypothesis", "evaluation", "conclusion", "consideration"];
      for (const type of types) {
        expect(validTypes).toContain(type);
      }
    });

    it("counts alternatives considered", () => {
      const result = thinkGraph.parseThinkingToNode(sampleThinkingWithDecisions);
      expect(result.structuredReasoning.alternativesConsidered).toBeGreaterThan(0);
    });

    it("extracts main conclusion", () => {
      const result = thinkGraph.parseThinkingToNode(sampleThinkingWithDecisions);
      // The conclusion should be in one of the last reasoning steps
      expect(result.structuredReasoning.mainConclusion).toBeTruthy();
    });
  });

  // ============================================================
  // Decision Point Tests
  // ============================================================

  describe("extractDecisionPoints()", () => {
    it("extracts decision points from thinking with decisions", () => {
      const result = thinkGraph.parseThinkingToNode(sampleThinkingWithDecisions);
      expect(result.decisionPoints.length).toBeGreaterThan(0);
    });

    it("extracts decision points with chosen paths", () => {
      const result = thinkGraph.parseThinkingToNode(sampleThinkingWithDecisions);
      const hasChosenPath = result.decisionPoints.some((dp) => dp.chosenPath);
      expect(hasChosenPath).toBe(true);
    });

    it("extracts alternatives from context with rejection reasons", () => {
      const result = thinkGraph.parseThinkingToNode(sampleThinkingWithAlternatives);
      expect(result.decisionPoints.length).toBeGreaterThan(0);
    });
  });

  // ============================================================
  // Confidence Scoring Tests
  // ============================================================

  describe("calculateConfidenceScore()", () => {
    it("scores high-confidence text above 0.7", () => {
      const result = thinkGraph.parseThinkingToNode(highConfidenceThinking);
      expect(result.confidenceScore).not.toBeNull();
      expect(result.confidenceScore!).toBeGreaterThanOrEqual(0.7);
    });

    it("scores low-confidence text below 0.5", () => {
      const result = thinkGraph.parseThinkingToNode(lowConfidenceThinking);
      expect(result.confidenceScore).not.toBeNull();
      expect(result.confidenceScore!).toBeLessThanOrEqual(0.5);
    });

    it("returns null for empty text", () => {
      const score = thinkGraph.calculateConfidenceScore("");
      expect(score).toBeNull();
    });

    it("scores are within valid range [0.15, 0.95]", () => {
      const score = thinkGraph.calculateConfidenceScore("Some neutral reasoning text that is moderate");
      if (score !== null) {
        expect(score).toBeGreaterThanOrEqual(0.15);
        expect(score).toBeLessThanOrEqual(0.95);
      }
    });
  });

  // ============================================================
  // Edge Cases
  // ============================================================

  describe("edge cases", () => {
    it("handles empty thinking blocks", () => {
      const result = thinkGraph.parseThinkingToNode([]);
      expect(result.reasoning).toBe("");
      expect(result.structuredReasoning.steps).toHaveLength(0);
      expect(result.decisionPoints).toHaveLength(0);
      expect(result.confidenceScore).toBeNull();
    });

    it("handles redacted thinking blocks", () => {
      const redacted: RedactedThinkingBlock[] = [
        { type: "redacted_thinking", data: "base64-data" },
      ];
      const result = thinkGraph.parseThinkingToNode(redacted);
      expect(result.reasoning).toBe("");
      expect(result.structuredReasoning.steps).toHaveLength(0);
    });

    it("handles mixed thinking and redacted blocks", () => {
      const mixed: (ThinkingBlock | RedactedThinkingBlock)[] = [
        { type: "redacted_thinking", data: "base64" },
        {
          type: "thinking",
          thinking: "This is visible reasoning. I'm confident about this approach.",
          signature: "sig",
        },
      ];
      const result = thinkGraph.parseThinkingToNode(mixed);
      expect(result.reasoning).toContain("visible reasoning");
      expect(result.reasoning).not.toContain("base64");
    });

    it("handles very short thinking text", () => {
      const short: ThinkingBlock[] = [
        { type: "thinking", thinking: "OK", signature: "sig" },
      ];
      const result = thinkGraph.parseThinkingToNode(short);
      expect(result.reasoning).toBe("OK");
      // Short text may have zero steps (below 20 char threshold)
      expect(result.structuredReasoning.steps.length).toBe(0);
    });
  });

  // ============================================================
  // Confidence Factors
  // ============================================================

  describe("confidence factors", () => {
    it("extracts confidence factors from reasoning", () => {
      const thinking: ThinkingBlock[] = [
        {
          type: "thinking",
          thinking: `I'm confident because the data clearly shows a pattern. Based on the evidence, I believe this is correct. The analysis indicates strong support for this approach.`,
          signature: "sig",
        },
      ];
      const result = thinkGraph.parseThinkingToNode(thinking);
      expect(result.structuredReasoning.confidenceFactors.length).toBeGreaterThan(0);
    });
  });
});
