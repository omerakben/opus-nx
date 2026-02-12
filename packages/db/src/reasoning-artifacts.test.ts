import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createReasoningArtifact,
  upsertReasoningArtifact,
  getReasoningArtifact,
  getSessionReasoningArtifacts,
  updateReasoningArtifactEmbedding,
  markReasoningArtifactUsed,
  searchReasoningArtifacts,
  createSessionRehydrationRun,
  getSessionRehydrationRuns,
} from "./reasoning-artifacts.js";

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
  chain.upsert = vi.fn().mockReturnValue(chain);
  chain.select = vi.fn().mockReturnValue(chain);
  chain.eq = vi.fn().mockReturnValue(chain);
  chain.order = vi.fn().mockReturnValue(chain);
  chain.limit = vi.fn().mockReturnValue(chain);
  chain.single = vi.fn(() => terminal());
  chain.rpc = vi.fn(() => mockRpcResult);

  // Make the chain thenable for list queries
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

const sampleArtifactRow = {
  id: "art-1",
  session_id: "sess-1",
  thinking_node_id: "node-1",
  artifact_type: "hypothesis",
  title: "Test Hypothesis",
  content: "This is a test hypothesis about reasoning.",
  snapshot: { context: "test" },
  topic_tags: ["reasoning", "test"],
  importance_score: 0.8,
  source_confidence: 0.9,
  embedding: null,
  last_used_at: null,
  created_at: "2026-02-12T00:00:00Z",
  updated_at: "2026-02-12T01:00:00Z",
  created_by: "deep_thinker",
};

const sampleRehydrationRow = {
  id: "rh-1",
  session_id: "sess-1",
  query_text: "What about reasoning quality?",
  query_embedding: null,
  selected_artifact_ids: ["art-1", "art-2"],
  candidate_count: 5,
  metadata: { strategy: "semantic" },
  created_at: "2026-02-12T00:00:00Z",
};

// ---------------------------------------------------------------------------
// createReasoningArtifact
// ---------------------------------------------------------------------------

describe("createReasoningArtifact", () => {
  it("maps input and returns camelCase row", async () => {
    mockResult = { data: sampleArtifactRow, error: null };

    const result = await createReasoningArtifact({
      sessionId: "sess-1",
      thinkingNodeId: "node-1",
      artifactType: "hypothesis",
      content: "Test content",
      title: "Test Hypothesis",
      topicTags: ["reasoning"],
      importanceScore: 0.8,
    });

    expect(result.id).toBe("art-1");
    expect(result.sessionId).toBe("sess-1");
    expect(result.artifactType).toBe("hypothesis");
    expect(result.topicTags).toEqual(["reasoning", "test"]);
    expect(result.importanceScore).toBe(0.8);
    expect(result.createdAt).toBeInstanceOf(Date);
    expect(result.updatedAt).toBeInstanceOf(Date);
  });

  it("applies defaults for optional fields", async () => {
    const row = {
      ...sampleArtifactRow,
      thinking_node_id: null,
      title: null,
      topic_tags: [],
      importance_score: 0.5,
      source_confidence: null,
      created_by: null,
    };
    mockResult = { data: row, error: null };

    const result = await createReasoningArtifact({
      sessionId: "sess-1",
      artifactType: "node",
      content: "Minimal artifact",
    });

    expect(result.thinkingNodeId).toBeNull();
    expect(result.title).toBeNull();
    expect(result.topicTags).toEqual([]);
    expect(result.importanceScore).toBe(0.5);
    expect(result.sourceConfidence).toBeNull();
    expect(result.createdBy).toBeNull();
  });

  it("throws on error", async () => {
    mockResult = { data: null, error: { message: "insert failed" } };

    await expect(
      createReasoningArtifact({
        sessionId: "sess-1",
        artifactType: "node",
        content: "fail",
      })
    ).rejects.toThrow("Failed to create reasoning artifact");
  });
});

// ---------------------------------------------------------------------------
// upsertReasoningArtifact
// ---------------------------------------------------------------------------

describe("upsertReasoningArtifact", () => {
  it("returns mapped row on success", async () => {
    mockResult = { data: sampleArtifactRow, error: null };

    const result = await upsertReasoningArtifact({
      id: "art-1",
      sessionId: "sess-1",
      artifactType: "hypothesis",
      content: "Updated content",
    });

    expect(result.id).toBe("art-1");
  });

  it("throws on error", async () => {
    mockResult = { data: null, error: { message: "upsert failed" } };

    await expect(
      upsertReasoningArtifact({
        sessionId: "sess-1",
        artifactType: "node",
        content: "fail",
      })
    ).rejects.toThrow("Failed to upsert reasoning artifact");
  });
});

// ---------------------------------------------------------------------------
// getReasoningArtifact
// ---------------------------------------------------------------------------

describe("getReasoningArtifact", () => {
  it("returns mapped row when found", async () => {
    mockResult = { data: sampleArtifactRow, error: null };

    const result = await getReasoningArtifact("art-1");
    expect(result).not.toBeNull();
    expect(result!.id).toBe("art-1");
    expect(result!.content).toBe("This is a test hypothesis about reasoning.");
  });

  it("returns null for PGRST116", async () => {
    mockResult = { data: null, error: { code: "PGRST116", message: "Not found" } };

    const result = await getReasoningArtifact("missing");
    expect(result).toBeNull();
  });

  it("throws on other errors", async () => {
    mockResult = { data: null, error: { message: "connection error" } };

    await expect(getReasoningArtifact("art-1")).rejects.toThrow(
      "Failed to get reasoning artifact"
    );
  });
});

// ---------------------------------------------------------------------------
// getSessionReasoningArtifacts
// ---------------------------------------------------------------------------

describe("getSessionReasoningArtifacts", () => {
  it("returns mapped rows", async () => {
    mockResult = { data: [sampleArtifactRow], error: null };

    const results = await getSessionReasoningArtifacts("sess-1");
    expect(results).toHaveLength(1);
    expect(results[0].sessionId).toBe("sess-1");
  });

  it("returns empty array when data is null", async () => {
    mockResult = { data: null, error: null };

    const results = await getSessionReasoningArtifacts("sess-1");
    expect(results).toEqual([]);
  });

  it("throws on error", async () => {
    mockResult = { data: null, error: { message: "timeout" } };

    await expect(
      getSessionReasoningArtifacts("sess-1")
    ).rejects.toThrow("Failed to get session reasoning artifacts");
  });
});

// ---------------------------------------------------------------------------
// updateReasoningArtifactEmbedding
// ---------------------------------------------------------------------------

describe("updateReasoningArtifactEmbedding", () => {
  it("completes without error on success", async () => {
    mockResult = { data: null, error: null };

    // update().eq() doesn't call .single(), so the mock chain resolves via .then
    await expect(
      updateReasoningArtifactEmbedding("art-1", [0.1, 0.2, 0.3])
    ).resolves.toBeUndefined();
  });

  it("throws on error", async () => {
    mockResult = { data: null, error: { message: "update failed" } };

    await expect(
      updateReasoningArtifactEmbedding("art-1", [0.1])
    ).rejects.toThrow("Failed to update reasoning artifact embedding");
  });
});

// ---------------------------------------------------------------------------
// markReasoningArtifactUsed
// ---------------------------------------------------------------------------

describe("markReasoningArtifactUsed", () => {
  it("completes without error on success", async () => {
    mockResult = { data: null, error: null };

    await expect(markReasoningArtifactUsed("art-1")).resolves.toBeUndefined();
  });

  it("throws on error", async () => {
    mockResult = { data: null, error: { message: "update failed" } };

    await expect(markReasoningArtifactUsed("art-1")).rejects.toThrow(
      "Failed to mark reasoning artifact as used"
    );
  });
});

// ---------------------------------------------------------------------------
// searchReasoningArtifacts
// ---------------------------------------------------------------------------

describe("searchReasoningArtifacts", () => {
  it("returns mapped match results", async () => {
    mockRpcResult = {
      data: [
        {
          id: "art-1",
          session_id: "sess-1",
          thinking_node_id: "node-1",
          artifact_type: "hypothesis",
          content: "Test hypothesis",
          importance_score: 0.8,
          source_confidence: 0.9,
          last_used_at: null,
          similarity: 0.92,
        },
      ],
      error: null,
    };

    const results = await searchReasoningArtifacts([0.1, 0.2, 0.3]);
    expect(results).toHaveLength(1);
    expect(results[0].similarity).toBe(0.92);
    expect(results[0].artifactType).toBe("hypothesis");
  });

  it("returns empty array when data is null", async () => {
    mockRpcResult = { data: null, error: null };

    const results = await searchReasoningArtifacts([0.1]);
    expect(results).toEqual([]);
  });

  it("throws on RPC error", async () => {
    mockRpcResult = { data: null, error: { message: "function not found" } };

    await expect(searchReasoningArtifacts([0.1])).rejects.toThrow(
      "Failed to search reasoning artifacts"
    );
  });
});

// ---------------------------------------------------------------------------
// createSessionRehydrationRun
// ---------------------------------------------------------------------------

describe("createSessionRehydrationRun", () => {
  it("maps input and returns row", async () => {
    mockResult = { data: sampleRehydrationRow, error: null };

    const result = await createSessionRehydrationRun({
      sessionId: "sess-1",
      queryText: "What about reasoning quality?",
      selectedArtifactIds: ["art-1", "art-2"],
      candidateCount: 5,
    });

    expect(result.id).toBe("rh-1");
    expect(result.queryText).toBe("What about reasoning quality?");
    expect(result.selectedArtifactIds).toEqual(["art-1", "art-2"]);
    expect(result.candidateCount).toBe(5);
  });

  it("throws on error", async () => {
    mockResult = { data: null, error: { message: "insert failed" } };

    await expect(
      createSessionRehydrationRun({
        sessionId: "sess-1",
        queryText: "query",
      })
    ).rejects.toThrow("Failed to create session rehydration run");
  });
});

// ---------------------------------------------------------------------------
// getSessionRehydrationRuns
// ---------------------------------------------------------------------------

describe("getSessionRehydrationRuns", () => {
  it("returns mapped rows", async () => {
    mockResult = { data: [sampleRehydrationRow], error: null };

    const results = await getSessionRehydrationRuns("sess-1");
    expect(results).toHaveLength(1);
    expect(results[0].queryText).toBe("What about reasoning quality?");
    expect(results[0].createdAt).toBeInstanceOf(Date);
  });

  it("returns empty array when data is null", async () => {
    mockResult = { data: null, error: null };

    const results = await getSessionRehydrationRuns("sess-1");
    expect(results).toEqual([]);
  });
});
