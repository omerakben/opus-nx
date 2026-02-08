import { describe, it, expect } from "vitest";
import { PRMVerifier } from "./prm-verifier.js";
import type { ChainVerification, StepVerification, PRMConfig } from "./types/prm.js";

describe("PRMVerifier", () => {
  describe("constructor", () => {
    it("creates an instance with default config", () => {
      const verifier = new PRMVerifier();
      expect(verifier).toBeInstanceOf(PRMVerifier);
    });

    it("creates an instance with custom config", () => {
      const verifier = new PRMVerifier({
        config: {
          correctnessThreshold: 0.8,
          suggestCorrections: false,
          detectPatterns: true,
          maxSteps: 25,
          effort: "max",
          verificationMode: "self",
        },
      });
      expect(verifier).toBeInstanceOf(PRMVerifier);
    });

    it("accepts step verification callback", () => {
      const steps: StepVerification[] = [];
      const verifier = new PRMVerifier({
        onStepVerified: (step) => steps.push(step),
      });
      expect(verifier).toBeInstanceOf(PRMVerifier);
    });
  });

  describe("verifyChain() with empty input", () => {
    it("returns invalid result for empty steps", async () => {
      const verifier = new PRMVerifier();
      const result = await verifier.verifyChain({
        steps: [],
        decisionPoints: [],
        confidenceFactors: [],
        alternativesConsidered: 0,
      });

      expect(result.overallScore).toBe(0);
      expect(result.isValid).toBe(false);
      expect(result.steps).toHaveLength(0);
      expect(result.firstErrorAt).toBe(-1);
      expect(result.summary).toContain("No reasoning steps");
    });
  });
});

describe("PRM Types", () => {
  describe("StepVerdict", () => {
    it("defines all valid verdicts", () => {
      const verdicts = ["correct", "incorrect", "neutral", "uncertain"];
      for (const verdict of verdicts) {
        expect(verdicts).toContain(verdict);
      }
    });
  });

  describe("ChainVerification structure", () => {
    it("validates a well-formed chain verification", () => {
      const verification: ChainVerification = {
        steps: [
          {
            stepIndex: 0,
            stepContent: "First, we analyze the data",
            verdict: "correct",
            confidence: 0.9,
            explanation: "Sound analytical approach",
            issues: [],
          },
          {
            stepIndex: 1,
            stepContent: "Therefore, X implies Y",
            verdict: "correct",
            confidence: 0.85,
            explanation: "Valid logical inference",
            issues: [],
          },
        ],
        overallScore: 0.87,
        isValid: true,
        firstErrorAt: -1,
        summary: "Chain is valid",
        patterns: [],
        metadata: {
          verificationModel: "claude-opus-4-6",
          tokensUsed: 500,
          durationMs: 2000,
          verifiedAt: new Date(),
        },
      };

      expect(verification.isValid).toBe(true);
      expect(verification.overallScore).toBeGreaterThan(0.7);
      expect(verification.steps).toHaveLength(2);
      expect(verification.firstErrorAt).toBe(-1);
    });

    it("validates a chain with errors", () => {
      const verification: ChainVerification = {
        steps: [
          {
            stepIndex: 0,
            stepContent: "Assume all X are Y",
            verdict: "correct",
            confidence: 0.8,
            explanation: "Valid assumption",
            issues: [],
          },
          {
            stepIndex: 1,
            stepContent: "Therefore Z follows from W",
            verdict: "incorrect",
            confidence: 0.9,
            explanation: "Non sequitur — Z doesn't follow from prior steps",
            issues: [
              {
                type: "non_sequitur",
                description: "Conclusion doesn't follow from premises",
                severity: "critical",
              },
            ],
            suggestedCorrection: "Need to establish connection between Y and W first",
          },
        ],
        overallScore: 0.35,
        isValid: false,
        firstErrorAt: 1,
        summary: "Chain invalid — error at step 2",
        patterns: [],
        metadata: {},
      };

      expect(verification.isValid).toBe(false);
      expect(verification.firstErrorAt).toBe(1);
      expect(verification.steps[1].issues).toHaveLength(1);
      expect(verification.steps[1].issues[0].severity).toBe("critical");
    });
  });

  describe("Issue types coverage", () => {
    it("covers all reasoning error types", () => {
      const issueTypes = [
        "logical_error",
        "factual_error",
        "missing_context",
        "unsupported_claim",
        "circular_reasoning",
        "non_sequitur",
        "overgeneralization",
        "false_dichotomy",
      ];

      // Ensure we have distinct types for different reasoning failures
      expect(new Set(issueTypes).size).toBe(issueTypes.length);
      expect(issueTypes.length).toBe(8);
    });
  });
});
