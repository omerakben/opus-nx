import { describe, it, expect } from "vitest";
import {
  RecordInsightToolInputSchema,
  InsightTypeSchema,
  EvidenceItemSchema,
  MetacognitionOptionsSchema,
  MetacognitionResultSchema,
  FocusAreaSchema,
  AnalysisScopeSchema,
} from "./types/metacognition.js";

// ============================================================
// RecordInsightToolInputSchema Validation
// ============================================================

describe("RecordInsightToolInputSchema", () => {
  it("accepts valid insight input", () => {
    const result = RecordInsightToolInputSchema.safeParse({
      insight_type: "bias_detection",
      insight: "Anchoring bias detected in cost estimation",
      evidence: [
        {
          nodeId: "abc-123",
          excerpt: "The initial estimate anchored all subsequent reasoning",
          relevance: 0.9,
        },
      ],
      confidence: 0.85,
    });
    expect(result.success).toBe(true);
  });

  it("accepts all three insight types", () => {
    for (const type of ["bias_detection", "pattern", "improvement_hypothesis"]) {
      const result = RecordInsightToolInputSchema.safeParse({
        insight_type: type,
        insight: "Some insight",
        evidence: [],
        confidence: 0.5,
      });
      expect(result.success).toBe(true);
    }
  });

  it("rejects invalid insight type", () => {
    const result = RecordInsightToolInputSchema.safeParse({
      insight_type: "unknown_type",
      insight: "Some insight",
      evidence: [],
      confidence: 0.5,
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty insight text", () => {
    const result = RecordInsightToolInputSchema.safeParse({
      insight_type: "pattern",
      insight: "",
      evidence: [],
      confidence: 0.5,
    });
    expect(result.success).toBe(false);
  });

  it("rejects confidence below 0", () => {
    const result = RecordInsightToolInputSchema.safeParse({
      insight_type: "pattern",
      insight: "Some insight",
      evidence: [],
      confidence: -0.5,
    });
    expect(result.success).toBe(false);
  });

  it("rejects confidence above 1", () => {
    const result = RecordInsightToolInputSchema.safeParse({
      insight_type: "pattern",
      insight: "Some insight",
      evidence: [],
      confidence: 1.5,
    });
    expect(result.success).toBe(false);
  });

  it("accepts confidence at boundaries (0 and 1)", () => {
    expect(
      RecordInsightToolInputSchema.safeParse({
        insight_type: "pattern",
        insight: "Zero confidence",
        evidence: [],
        confidence: 0,
      }).success
    ).toBe(true);

    expect(
      RecordInsightToolInputSchema.safeParse({
        insight_type: "pattern",
        insight: "Full confidence",
        evidence: [],
        confidence: 1,
      }).success
    ).toBe(true);
  });

  it("rejects missing required fields", () => {
    expect(
      RecordInsightToolInputSchema.safeParse({
        insight_type: "pattern",
        // missing insight, evidence, confidence
      }).success
    ).toBe(false);
  });

  describe("evidence validation", () => {
    it("accepts evidence with valid node ID (non-UUID, relaxed)", () => {
      // RecordInsightToolInputSchema uses relaxed validation (min(1) not uuid())
      const result = RecordInsightToolInputSchema.safeParse({
        insight_type: "bias_detection",
        insight: "Bias found",
        evidence: [
          {
            nodeId: "some-non-uuid-id",
            excerpt: "Relevant text",
            relevance: 0.8,
          },
        ],
        confidence: 0.7,
      });
      expect(result.success).toBe(true);
    });

    it("rejects empty nodeId in evidence", () => {
      const result = RecordInsightToolInputSchema.safeParse({
        insight_type: "pattern",
        insight: "Pattern found",
        evidence: [
          {
            nodeId: "",
            excerpt: "Text",
            relevance: 0.5,
          },
        ],
        confidence: 0.6,
      });
      expect(result.success).toBe(false);
    });

    it("rejects excerpt exceeding 1000 chars", () => {
      const result = RecordInsightToolInputSchema.safeParse({
        insight_type: "pattern",
        insight: "Pattern",
        evidence: [
          {
            nodeId: "node-1",
            excerpt: "x".repeat(1001),
            relevance: 0.5,
          },
        ],
        confidence: 0.5,
      });
      expect(result.success).toBe(false);
    });

    it("accepts excerpt at exactly 1000 chars", () => {
      const result = RecordInsightToolInputSchema.safeParse({
        insight_type: "pattern",
        insight: "Pattern",
        evidence: [
          {
            nodeId: "node-1",
            excerpt: "x".repeat(1000),
            relevance: 0.5,
          },
        ],
        confidence: 0.5,
      });
      expect(result.success).toBe(true);
    });

    it("rejects relevance outside 0-1", () => {
      const result = RecordInsightToolInputSchema.safeParse({
        insight_type: "pattern",
        insight: "Pattern",
        evidence: [
          {
            nodeId: "node-1",
            excerpt: "Text",
            relevance: 2.0,
          },
        ],
        confidence: 0.5,
      });
      expect(result.success).toBe(false);
    });

    it("accepts multiple evidence items", () => {
      const result = RecordInsightToolInputSchema.safeParse({
        insight_type: "bias_detection",
        insight: "Multi-evidence bias",
        evidence: [
          { nodeId: "node-1", excerpt: "First evidence", relevance: 0.9 },
          { nodeId: "node-2", excerpt: "Second evidence", relevance: 0.7 },
          { nodeId: "node-3", excerpt: "Third evidence", relevance: 0.5 },
        ],
        confidence: 0.88,
      });
      expect(result.success).toBe(true);
      expect(result.data?.evidence).toHaveLength(3);
    });
  });
});

// ============================================================
// Strict EvidenceItemSchema (used in persistence layer)
// ============================================================

describe("EvidenceItemSchema (strict)", () => {
  it("requires valid UUID for nodeId", () => {
    const result = EvidenceItemSchema.safeParse({
      nodeId: "not-a-uuid",
      excerpt: "Text",
      relevance: 0.5,
    });
    expect(result.success).toBe(false);
  });

  it("accepts valid UUID nodeId", () => {
    const result = EvidenceItemSchema.safeParse({
      nodeId: "550e8400-e29b-41d4-a716-446655440000",
      excerpt: "Text",
      relevance: 0.5,
    });
    expect(result.success).toBe(true);
  });

  it("enforces 500 char limit on excerpt", () => {
    expect(
      EvidenceItemSchema.safeParse({
        nodeId: "550e8400-e29b-41d4-a716-446655440000",
        excerpt: "x".repeat(501),
        relevance: 0.5,
      }).success
    ).toBe(false);

    expect(
      EvidenceItemSchema.safeParse({
        nodeId: "550e8400-e29b-41d4-a716-446655440000",
        excerpt: "x".repeat(500),
        relevance: 0.5,
      }).success
    ).toBe(true);
  });
});

// ============================================================
// InsightTypeSchema
// ============================================================

describe("InsightTypeSchema", () => {
  it("accepts all three valid types", () => {
    expect(InsightTypeSchema.safeParse("bias_detection").success).toBe(true);
    expect(InsightTypeSchema.safeParse("pattern").success).toBe(true);
    expect(InsightTypeSchema.safeParse("improvement_hypothesis").success).toBe(true);
  });

  it("rejects invalid types", () => {
    expect(InsightTypeSchema.safeParse("warning").success).toBe(false);
    expect(InsightTypeSchema.safeParse("").success).toBe(false);
  });
});

// ============================================================
// MetacognitionOptionsSchema
// ============================================================

describe("MetacognitionOptionsSchema", () => {
  it("applies defaults", () => {
    const result = MetacognitionOptionsSchema.parse({});
    expect(result.nodeLimit).toBe(15);
    expect(result.analysisScope).toBe("session");
    expect(result.focusAreas).toEqual(["reasoning_patterns", "bias_detection"]);
  });

  it("clamps nodeLimit to 5-50", () => {
    expect(
      MetacognitionOptionsSchema.safeParse({ nodeLimit: 4 }).success
    ).toBe(false);
    expect(
      MetacognitionOptionsSchema.safeParse({ nodeLimit: 51 }).success
    ).toBe(false);
    expect(
      MetacognitionOptionsSchema.safeParse({ nodeLimit: 25 }).success
    ).toBe(true);
  });

  it("accepts all analysis scopes", () => {
    for (const scope of ["session", "cross_session", "global"]) {
      expect(
        AnalysisScopeSchema.safeParse(scope).success
      ).toBe(true);
    }
  });

  it("accepts all focus areas", () => {
    const areas = [
      "decision_quality",
      "reasoning_patterns",
      "confidence_calibration",
      "alternative_exploration",
      "bias_detection",
    ];
    for (const area of areas) {
      expect(FocusAreaSchema.safeParse(area).success).toBe(true);
    }
  });
});

// ============================================================
// MetacognitionResultSchema
// ============================================================

describe("MetacognitionResultSchema", () => {
  it("accepts result with hallucination tracking fields", () => {
    const result = MetacognitionResultSchema.safeParse({
      insights: [],
      nodesAnalyzed: 10,
      analysisTokensUsed: 5000,
      summary: "Analysis summary",
      invalidNodeRefs: ["fake-id-1", "fake-id-2"],
      hallucinationCount: 2,
    });
    expect(result.success).toBe(true);
    expect(result.data?.invalidNodeRefs).toEqual(["fake-id-1", "fake-id-2"]);
    expect(result.data?.hallucinationCount).toBe(2);
  });

  it("accepts result without optional hallucination fields", () => {
    const result = MetacognitionResultSchema.safeParse({
      insights: [],
      nodesAnalyzed: 5,
    });
    expect(result.success).toBe(true);
    expect(result.data?.invalidNodeRefs).toBeUndefined();
    expect(result.data?.hallucinationCount).toBeUndefined();
  });

  it("accepts result with errors array", () => {
    const result = MetacognitionResultSchema.safeParse({
      insights: [],
      nodesAnalyzed: 0,
      errors: ["Failed to connect", "Timeout"],
    });
    expect(result.success).toBe(true);
    expect(result.data?.errors).toHaveLength(2);
  });
});
