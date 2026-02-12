import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createHypothesisExperiment,
  getHypothesisExperiment,
  getSessionHypothesisExperiments,
  updateHypothesisExperiment,
  createHypothesisExperimentAction,
  getHypothesisExperimentActions,
} from "./hypothesis-experiments.js";

// ---------------------------------------------------------------------------
// Supabase mock
// ---------------------------------------------------------------------------

type MockResult = { data: unknown; error: unknown };

let mockResult: MockResult = { data: null, error: null };
let mockRpcResult: MockResult = { data: null, error: null };
let capturedInsert: unknown = null;
let capturedUpdate: unknown = null;
let capturedFilters: Record<string, unknown> = {};

function createChainMock(terminal: () => MockResult) {
  const chain: Record<string, unknown> = {};
  const self = () => chain;

  chain.from = vi.fn().mockReturnValue(chain);
  chain.insert = vi.fn((payload: unknown) => {
    capturedInsert = payload;
    return chain;
  });
  chain.update = vi.fn((payload: unknown) => {
    capturedUpdate = payload;
    return chain;
  });
  chain.upsert = vi.fn().mockReturnValue(chain);
  chain.select = vi.fn().mockReturnValue(chain);
  chain.eq = vi.fn((col: string, val: unknown) => {
    capturedFilters[col] = val;
    return chain;
  });
  chain.order = vi.fn().mockReturnValue(chain);
  chain.limit = vi.fn().mockReturnValue(chain);
  chain.single = vi.fn(() => terminal());
  chain.rpc = vi.fn(() => mockRpcResult);

  // For queries without .single() (list queries) — make the chain thenable
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
  capturedInsert = null;
  capturedUpdate = null;
  capturedFilters = {};
});

// ---------------------------------------------------------------------------
// Sample DB rows
// ---------------------------------------------------------------------------

const sampleExperimentRow = {
  id: "exp-1",
  session_id: "sess-1",
  hypothesis_node_id: "node-1",
  promoted_by: "human",
  alternative_summary: "Try approach B",
  status: "promoted",
  preferred_run_id: null,
  rerun_run_id: null,
  comparison_result: null,
  retention_decision: null,
  metadata: {},
  created_at: "2026-02-12T00:00:00Z",
  last_updated: "2026-02-12T00:00:00Z",
};

const sampleActionRow = {
  id: "act-1",
  experiment_id: "exp-1",
  session_id: "sess-1",
  action: "promote",
  performed_by: "human",
  details: { reason: "test" },
  created_at: "2026-02-12T00:00:00Z",
};

// ---------------------------------------------------------------------------
// createHypothesisExperiment
// ---------------------------------------------------------------------------

describe("createHypothesisExperiment", () => {
  it("maps input to snake_case and returns mapped row", async () => {
    mockResult = { data: sampleExperimentRow, error: null };

    const result = await createHypothesisExperiment({
      sessionId: "sess-1",
      hypothesisNodeId: "node-1",
      alternativeSummary: "Try approach B",
    });

    expect(result.id).toBe("exp-1");
    expect(result.sessionId).toBe("sess-1");
    expect(result.hypothesisNodeId).toBe("node-1");
    expect(result.promotedBy).toBe("human");
    expect(result.status).toBe("promoted");
    expect(result.createdAt).toBeInstanceOf(Date);
  });

  it("passes custom promotedBy", async () => {
    mockResult = { data: { ...sampleExperimentRow, promoted_by: "metacognition" }, error: null };

    const result = await createHypothesisExperiment({
      sessionId: "sess-1",
      hypothesisNodeId: "node-1",
      alternativeSummary: "Alt",
      promotedBy: "metacognition",
    });

    expect(result.promotedBy).toBe("metacognition");
  });

  it("throws on Supabase error", async () => {
    mockResult = { data: null, error: { message: "insert failed", code: "23505" } };

    await expect(
      createHypothesisExperiment({
        sessionId: "sess-1",
        hypothesisNodeId: "node-1",
        alternativeSummary: "Alt",
      })
    ).rejects.toThrow("Failed to create hypothesis experiment");
  });
});

// ---------------------------------------------------------------------------
// getHypothesisExperiment
// ---------------------------------------------------------------------------

describe("getHypothesisExperiment", () => {
  it("returns mapped row when found", async () => {
    mockResult = { data: sampleExperimentRow, error: null };

    const result = await getHypothesisExperiment("exp-1");
    expect(result).not.toBeNull();
    expect(result!.id).toBe("exp-1");
    expect(result!.alternativeSummary).toBe("Try approach B");
  });

  it("returns null for PGRST116 not-found", async () => {
    mockResult = { data: null, error: { code: "PGRST116", message: "Not found" } };

    const result = await getHypothesisExperiment("missing");
    expect(result).toBeNull();
  });

  it("throws on other errors", async () => {
    mockResult = { data: null, error: { code: "42P01", message: "table missing" } };

    await expect(getHypothesisExperiment("exp-1")).rejects.toThrow(
      "Failed to get hypothesis experiment"
    );
  });
});

// ---------------------------------------------------------------------------
// getSessionHypothesisExperiments
// ---------------------------------------------------------------------------

describe("getSessionHypothesisExperiments", () => {
  it("returns mapped rows", async () => {
    mockResult = { data: [sampleExperimentRow], error: null };

    const results = await getSessionHypothesisExperiments("sess-1");
    expect(results).toHaveLength(1);
    expect(results[0].sessionId).toBe("sess-1");
  });

  it("returns empty array when data is null", async () => {
    mockResult = { data: null, error: null };

    const results = await getSessionHypothesisExperiments("sess-1");
    expect(results).toEqual([]);
  });

  it("throws on error", async () => {
    mockResult = { data: null, error: { message: "timeout" } };

    await expect(
      getSessionHypothesisExperiments("sess-1")
    ).rejects.toThrow("Failed to get session hypothesis experiments");
  });
});

// ---------------------------------------------------------------------------
// updateHypothesisExperiment
// ---------------------------------------------------------------------------

describe("updateHypothesisExperiment", () => {
  it("updates and returns mapped row", async () => {
    const updated = { ...sampleExperimentRow, status: "retained", retention_decision: "retain" };
    mockResult = { data: updated, error: null };

    const result = await updateHypothesisExperiment("exp-1", {
      status: "retained",
      retentionDecision: "retain",
    });

    expect(result.status).toBe("retained");
    expect(result.retentionDecision).toBe("retain");
  });

  it("throws when no fields to update", async () => {
    await expect(updateHypothesisExperiment("exp-1", {})).rejects.toThrow(
      "requires at least one field"
    );
  });

  it("throws on Supabase error", async () => {
    mockResult = { data: null, error: { message: "constraint violation" } };

    await expect(
      updateHypothesisExperiment("exp-1", { status: "retained" })
    ).rejects.toThrow("Failed to update hypothesis experiment");
  });
});

// ---------------------------------------------------------------------------
// createHypothesisExperimentAction
// ---------------------------------------------------------------------------

describe("createHypothesisExperimentAction", () => {
  it("creates and returns mapped action", async () => {
    mockResult = { data: sampleActionRow, error: null };

    const result = await createHypothesisExperimentAction({
      experimentId: "exp-1",
      sessionId: "sess-1",
      action: "promote",
      performedBy: "human",
      details: { reason: "test" },
    });

    expect(result.id).toBe("act-1");
    expect(result.experimentId).toBe("exp-1");
    expect(result.action).toBe("promote");
    expect(result.performedBy).toBe("human");
  });

  it("defaults performedBy to null", async () => {
    mockResult = {
      data: { ...sampleActionRow, performed_by: null },
      error: null,
    };

    const result = await createHypothesisExperimentAction({
      experimentId: "exp-1",
      sessionId: "sess-1",
      action: "checkpoint",
    });

    expect(result.performedBy).toBeNull();
  });

  it("throws on error", async () => {
    mockResult = { data: null, error: { message: "FK violation" } };

    await expect(
      createHypothesisExperimentAction({
        experimentId: "missing",
        sessionId: "sess-1",
        action: "promote",
      })
    ).rejects.toThrow("Failed to create hypothesis experiment action");
  });
});

// ---------------------------------------------------------------------------
// getHypothesisExperimentActions
// ---------------------------------------------------------------------------

describe("getHypothesisExperimentActions", () => {
  it("returns mapped actions", async () => {
    mockResult = { data: [sampleActionRow], error: null };

    const results = await getHypothesisExperimentActions("exp-1");
    expect(results).toHaveLength(1);
    expect(results[0].action).toBe("promote");
    expect(results[0].createdAt).toBeInstanceOf(Date);
  });

  it("returns empty array when data is null", async () => {
    mockResult = { data: null, error: null };

    const results = await getHypothesisExperimentActions("exp-1");
    expect(results).toEqual([]);
  });
});
