import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createStructuredReasoningStep,
  createStructuredReasoningSteps,
  getThinkingNodeStructuredReasoningSteps,
  createStructuredReasoningHypothesis,
  createStructuredReasoningHypotheses,
  getThinkingNodeStructuredReasoningHypotheses,
  updateStructuredReasoningHypothesisStatus,
  updateStructuredReasoningHypothesisEmbedding,
  searchStructuredReasoningHypotheses,
  matchStructuredReasoningHypotheses,
} from "./structured-reasoning.js";

// ---------------------------------------------------------------------------
// Supabase mock
// ---------------------------------------------------------------------------

type MockResult = { data: unknown; error: unknown };

let mockResult: MockResult = { data: null, error: null };
let mockRpcResult: MockResult = { data: null, error: null };

function createChainMock(terminal: () => MockResult) {
  const chain: Record<string, unknown> = {};

  chain.from = vi.fn().mockReturnValue(chain);
  chain.insert = vi.fn().mockReturnValue(chain);
  chain.update = vi.fn().mockReturnValue(chain);
  chain.select = vi.fn().mockReturnValue(chain);
  chain.eq = vi.fn().mockReturnValue(chain);
  chain.order = vi.fn().mockReturnValue(chain);
  chain.limit = vi.fn().mockReturnValue(chain);
  chain.single = vi.fn(() => terminal());
  chain.rpc = vi.fn(() => mockRpcResult);

  chain.then = vi.fn((resolve: (v: MockResult) => void) => {
    resolve(terminal());
  });

  return chain;
}

vi.mock("./client.js", () => {
  return {
    getSupabase: () => {
      const terminal = () => mockResult;
      return createChainMock(terminal);
    },
  };
});

beforeEach(() => {
  mockResult = { data: null, error: null };
  mockRpcResult = { data: null, error: null };
});

// ---------------------------------------------------------------------------
// Sample rows
// ---------------------------------------------------------------------------

const sampleStepRow = {
  id: "step-1",
  thinking_node_id: "node-1",
  step_number: 1,
  step_type: "analysis",
  content: "Analyzing the problem space.",
  confidence: 0.85,
  metadata: { source: "deep_thinker" },
  created_at: "2026-02-12T00:00:00Z",
};

const sampleHypothesisRow = {
  id: "hyp-1",
  step_id: "step-1",
  thinking_node_id: "node-1",
  hypothesis_text: "The system benefits from persistent reasoning artifacts.",
  hypothesis_text_hash: "abc123",
  status: "proposed",
  confidence: 0.7,
  evidence: [{ type: "observation", text: "Tests show improvement" }],
  embedding: null,
  metadata: {},
  created_at: "2026-02-12T00:00:00Z",
};

// ---------------------------------------------------------------------------
// Structured Reasoning Steps
// ---------------------------------------------------------------------------

describe("createStructuredReasoningStep", () => {
  it("maps input and returns camelCase row", async () => {
    mockResult = { data: sampleStepRow, error: null };

    const result = await createStructuredReasoningStep({
      thinkingNodeId: "node-1",
      stepNumber: 1,
      stepType: "analysis",
      content: "Analyzing the problem space.",
      confidence: 0.85,
    });

    expect(result.id).toBe("step-1");
    expect(result.thinkingNodeId).toBe("node-1");
    expect(result.stepNumber).toBe(1);
    expect(result.stepType).toBe("analysis");
    expect(result.confidence).toBe(0.85);
    expect(result.createdAt).toBeInstanceOf(Date);
  });

  it("throws on error", async () => {
    mockResult = { data: null, error: { message: "insert failed" } };

    await expect(
      createStructuredReasoningStep({
        thinkingNodeId: "node-1",
        stepNumber: 1,
        stepType: "analysis",
        content: "fail",
      })
    ).rejects.toThrow("Failed to create structured reasoning step");
  });
});

describe("createStructuredReasoningSteps", () => {
  it("returns empty array for empty input", async () => {
    const results = await createStructuredReasoningSteps([]);
    expect(results).toEqual([]);
  });

  it("batch inserts and returns mapped rows", async () => {
    const step2 = { ...sampleStepRow, id: "step-2", step_number: 2, step_type: "hypothesis" };
    mockResult = { data: [sampleStepRow, step2], error: null };

    const results = await createStructuredReasoningSteps([
      { thinkingNodeId: "node-1", stepNumber: 1, stepType: "analysis", content: "Step 1" },
      { thinkingNodeId: "node-1", stepNumber: 2, stepType: "hypothesis", content: "Step 2" },
    ]);

    expect(results).toHaveLength(2);
    expect(results[0].stepNumber).toBe(1);
    expect(results[1].stepNumber).toBe(2);
  });

  it("throws on error", async () => {
    mockResult = { data: null, error: { message: "batch insert failed" } };

    await expect(
      createStructuredReasoningSteps([
        { thinkingNodeId: "node-1", stepNumber: 1, stepType: "analysis", content: "fail" },
      ])
    ).rejects.toThrow("Failed to create structured reasoning steps");
  });
});

describe("getThinkingNodeStructuredReasoningSteps", () => {
  it("returns steps ordered by step_number", async () => {
    mockResult = { data: [sampleStepRow], error: null };

    const results = await getThinkingNodeStructuredReasoningSteps("node-1");
    expect(results).toHaveLength(1);
    expect(results[0].stepType).toBe("analysis");
  });

  it("returns empty array when data is null", async () => {
    mockResult = { data: null, error: null };

    const results = await getThinkingNodeStructuredReasoningSteps("node-1");
    expect(results).toEqual([]);
  });

  it("throws on error", async () => {
    mockResult = { data: null, error: { message: "query failed" } };

    await expect(
      getThinkingNodeStructuredReasoningSteps("node-1")
    ).rejects.toThrow("Failed to get structured reasoning steps");
  });
});

// ---------------------------------------------------------------------------
// Structured Hypotheses
// ---------------------------------------------------------------------------

describe("createStructuredReasoningHypothesis", () => {
  it("maps input and returns camelCase row", async () => {
    mockResult = { data: sampleHypothesisRow, error: null };

    const result = await createStructuredReasoningHypothesis({
      stepId: "step-1",
      thinkingNodeId: "node-1",
      hypothesisText: "Test hypothesis",
      confidence: 0.7,
    });

    expect(result.id).toBe("hyp-1");
    expect(result.stepId).toBe("step-1");
    expect(result.hypothesisText).toContain("persistent reasoning");
    expect(result.hypothesisTextHash).toBe("abc123");
    expect(result.status).toBe("proposed");
    expect(result.evidence).toHaveLength(1);
  });

  it("defaults status to proposed", async () => {
    mockResult = { data: sampleHypothesisRow, error: null };

    const result = await createStructuredReasoningHypothesis({
      stepId: "step-1",
      thinkingNodeId: "node-1",
      hypothesisText: "Test",
    });

    expect(result.status).toBe("proposed");
  });

  it("throws on error", async () => {
    mockResult = { data: null, error: { message: "insert failed" } };

    await expect(
      createStructuredReasoningHypothesis({
        stepId: "step-1",
        thinkingNodeId: "node-1",
        hypothesisText: "fail",
      })
    ).rejects.toThrow("Failed to create structured reasoning hypothesis");
  });
});

describe("createStructuredReasoningHypotheses", () => {
  it("returns empty array for empty input", async () => {
    const results = await createStructuredReasoningHypotheses([]);
    expect(results).toEqual([]);
  });

  it("batch inserts and returns mapped rows", async () => {
    const hyp2 = { ...sampleHypothesisRow, id: "hyp-2", status: "tested" };
    mockResult = { data: [sampleHypothesisRow, hyp2], error: null };

    const results = await createStructuredReasoningHypotheses([
      { stepId: "step-1", thinkingNodeId: "node-1", hypothesisText: "H1" },
      { stepId: "step-1", thinkingNodeId: "node-1", hypothesisText: "H2" },
    ]);

    expect(results).toHaveLength(2);
  });
});

describe("getThinkingNodeStructuredReasoningHypotheses", () => {
  it("returns hypotheses for a thinking node", async () => {
    mockResult = { data: [sampleHypothesisRow], error: null };

    const results = await getThinkingNodeStructuredReasoningHypotheses("node-1");
    expect(results).toHaveLength(1);
    expect(results[0].hypothesisText).toContain("persistent reasoning");
  });

  it("returns empty array when data is null", async () => {
    mockResult = { data: null, error: null };

    const results = await getThinkingNodeStructuredReasoningHypotheses("node-1");
    expect(results).toEqual([]);
  });
});

describe("updateStructuredReasoningHypothesisStatus", () => {
  it("updates and returns mapped row", async () => {
    const updated = { ...sampleHypothesisRow, status: "supported" };
    mockResult = { data: updated, error: null };

    const result = await updateStructuredReasoningHypothesisStatus("hyp-1", "supported");
    expect(result.status).toBe("supported");
  });

  it("throws on error", async () => {
    mockResult = { data: null, error: { message: "update failed" } };

    await expect(
      updateStructuredReasoningHypothesisStatus("hyp-1", "rejected")
    ).rejects.toThrow("Failed to update structured reasoning hypothesis status");
  });
});

describe("updateStructuredReasoningHypothesisEmbedding", () => {
  it("completes without error on success", async () => {
    mockResult = { data: null, error: null };

    await expect(
      updateStructuredReasoningHypothesisEmbedding("hyp-1", [0.1, 0.2])
    ).resolves.toBeUndefined();
  });

  it("throws on error", async () => {
    mockResult = { data: null, error: { message: "update failed" } };

    await expect(
      updateStructuredReasoningHypothesisEmbedding("hyp-1", [0.1])
    ).rejects.toThrow("Failed to update structured reasoning hypothesis embedding");
  });
});

// ---------------------------------------------------------------------------
// Search / Match (RPC)
// ---------------------------------------------------------------------------

describe("searchStructuredReasoningHypotheses", () => {
  it("returns mapped search results", async () => {
    mockRpcResult = {
      data: [
        {
          hypothesis_id: "hyp-1",
          thinking_node_id: "node-1",
          step_id: "step-1",
          hypothesis_text: "Test",
          status: "proposed",
          confidence: 0.7,
          created_at: "2026-02-12T00:00:00Z",
          rank: 1,
        },
      ],
      error: null,
    };

    const results = await searchStructuredReasoningHypotheses("reasoning");
    expect(results).toHaveLength(1);
    expect(results[0].hypothesisId).toBe("hyp-1");
    expect(results[0].rank).toBe(1);
  });

  it("returns empty array when data is null", async () => {
    mockRpcResult = { data: null, error: null };

    const results = await searchStructuredReasoningHypotheses("query");
    expect(results).toEqual([]);
  });

  it("throws on RPC error", async () => {
    mockRpcResult = { data: null, error: { message: "function not found" } };

    await expect(
      searchStructuredReasoningHypotheses("query")
    ).rejects.toThrow("Failed to search structured reasoning hypotheses");
  });
});

describe("matchStructuredReasoningHypotheses", () => {
  it("returns mapped semantic match results", async () => {
    mockRpcResult = {
      data: [
        {
          hypothesis_id: "hyp-1",
          session_id: "sess-1",
          thinking_node_id: "node-1",
          step_id: "step-1",
          hypothesis_text: "Test",
          hypothesis_text_hash: "abc123",
          status: "proposed",
          confidence: 0.7,
          created_at: "2026-02-12T00:00:00Z",
          importance_score: 0.8,
          retained_policy_bonus: 0.1,
          similarity: 0.95,
        },
      ],
      error: null,
    };

    const results = await matchStructuredReasoningHypotheses([0.1, 0.2, 0.3]);
    expect(results).toHaveLength(1);
    expect(results[0].similarity).toBe(0.95);
    expect(results[0].retainedPolicyBonus).toBe(0.1);
    expect(results[0].importanceScore).toBe(0.8);
    expect(results[0].hypothesisTextHash).toBe("abc123");
  });

  it("handles null optional fields in match results", async () => {
    mockRpcResult = {
      data: [
        {
          hypothesis_id: "hyp-1",
          session_id: "sess-1",
          thinking_node_id: "node-1",
          step_id: "step-1",
          hypothesis_text: "Test",
          hypothesis_text_hash: null,
          status: "proposed",
          confidence: null,
          created_at: "2026-02-12T00:00:00Z",
          importance_score: null,
          retained_policy_bonus: null,
          similarity: null,
        },
      ],
      error: null,
    };

    const results = await matchStructuredReasoningHypotheses([0.1]);
    expect(results).toHaveLength(1);
    expect(results[0].hypothesisTextHash).toBeNull();
    expect(results[0].confidence).toBeNull();
    expect(results[0].importanceScore).toBe(0);
    expect(results[0].retainedPolicyBonus).toBe(0);
    expect(results[0].similarity).toBe(0);
  });

  it("throws on RPC error", async () => {
    mockRpcResult = { data: null, error: { message: "function not found" } };

    await expect(matchStructuredReasoningHypotheses([0.1])).rejects.toThrow(
      "Failed to semantically match structured reasoning hypotheses"
    );
  });
});
