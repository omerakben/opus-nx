-- ============================================================
-- Opus Nx: Reasoning Artifacts + Hypothesis Lifecycle
-- Migration: 012_reasoning_artifacts_and_hypothesis_lifecycle.sql
-- ============================================================
-- Adds:
-- 1) Normalized structured reasoning indexing tables
-- 2) Reasoning artifact store with Voyage embeddings for semantic retrieval
-- 3) Session rehydration run audit table
-- 4) Hypothesis experiment lifecycle tables
-- 5) RPC helpers for semantic and hypothesis search

-- ============================================================
-- Structured Reasoning Step Indexes
-- ============================================================

CREATE TABLE IF NOT EXISTS structured_reasoning_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thinking_node_id UUID NOT NULL REFERENCES thinking_nodes(id) ON DELETE CASCADE,
  step_number INT NOT NULL CHECK (step_number > 0),
  step_type TEXT NOT NULL CHECK (step_type IN ('analysis', 'hypothesis', 'evaluation', 'conclusion', 'consideration')),
  content TEXT NOT NULL,
  confidence FLOAT CHECK (confidence >= 0 AND confidence <= 1),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(thinking_node_id, step_number)
);

CREATE INDEX IF NOT EXISTS structured_reasoning_steps_node_idx
ON structured_reasoning_steps(thinking_node_id);

CREATE INDEX IF NOT EXISTS structured_reasoning_steps_type_idx
ON structured_reasoning_steps(step_type);

CREATE INDEX IF NOT EXISTS structured_reasoning_steps_content_fts_idx
ON structured_reasoning_steps USING gin(to_tsvector('english', content));

-- ------------------------------------------------------------
-- Structured hypotheses extracted from reasoning steps
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS structured_reasoning_hypotheses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  step_id UUID NOT NULL REFERENCES structured_reasoning_steps(id) ON DELETE CASCADE,
  thinking_node_id UUID NOT NULL REFERENCES thinking_nodes(id) ON DELETE CASCADE,
  hypothesis_text TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'proposed'
    CHECK (status IN ('proposed', 'tested', 'supported', 'rejected', 'superseded')),
  confidence FLOAT CHECK (confidence >= 0 AND confidence <= 1),
  evidence JSONB DEFAULT '[]',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS structured_reasoning_hypotheses_step_idx
ON structured_reasoning_hypotheses(step_id);

CREATE INDEX IF NOT EXISTS structured_reasoning_hypotheses_node_idx
ON structured_reasoning_hypotheses(thinking_node_id);

CREATE INDEX IF NOT EXISTS structured_reasoning_hypotheses_status_idx
ON structured_reasoning_hypotheses(status);

CREATE INDEX IF NOT EXISTS structured_reasoning_hypotheses_text_fts_idx
ON structured_reasoning_hypotheses USING gin(to_tsvector('english', hypothesis_text));

-- ============================================================
-- Reasoning Artifacts (Semantic Rehydration)
-- ============================================================

CREATE TABLE IF NOT EXISTS reasoning_artifacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  thinking_node_id UUID REFERENCES thinking_nodes(id) ON DELETE CASCADE,
  artifact_type TEXT NOT NULL
    CHECK (artifact_type IN ('node', 'decision_point', 'hypothesis', 'chain_summary', 'metacognitive')),
  title TEXT,
  content TEXT NOT NULL,
  snapshot JSONB DEFAULT '{}',
  topic_tags TEXT[] DEFAULT '{}',
  importance_score FLOAT NOT NULL DEFAULT 0.5 CHECK (importance_score >= 0 AND importance_score <= 1),
  source_confidence FLOAT CHECK (source_confidence >= 0 AND source_confidence <= 1),
  embedding extensions.vector(1024),
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

CREATE INDEX IF NOT EXISTS reasoning_artifacts_session_idx
ON reasoning_artifacts(session_id);

CREATE INDEX IF NOT EXISTS reasoning_artifacts_node_idx
ON reasoning_artifacts(thinking_node_id);

CREATE INDEX IF NOT EXISTS reasoning_artifacts_type_idx
ON reasoning_artifacts(artifact_type);

CREATE INDEX IF NOT EXISTS reasoning_artifacts_topic_tags_idx
ON reasoning_artifacts USING gin(topic_tags);

CREATE INDEX IF NOT EXISTS reasoning_artifacts_content_fts_idx
ON reasoning_artifacts USING gin(to_tsvector('english', content));

CREATE INDEX IF NOT EXISTS reasoning_artifacts_embedding_idx
ON reasoning_artifacts
USING hnsw (embedding extensions.vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

-- Reuse updated_at trigger behavior for reasoning_artifacts
DROP TRIGGER IF EXISTS reasoning_artifacts_updated_at ON reasoning_artifacts;
CREATE TRIGGER reasoning_artifacts_updated_at
  BEFORE UPDATE ON reasoning_artifacts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- Session Rehydration Audit
-- ============================================================

CREATE TABLE IF NOT EXISTS session_rehydration_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  query_text TEXT NOT NULL,
  query_embedding extensions.vector(1024),
  selected_artifact_ids UUID[] DEFAULT '{}',
  candidate_count INT NOT NULL DEFAULT 0,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS session_rehydration_runs_session_idx
ON session_rehydration_runs(session_id);

CREATE INDEX IF NOT EXISTS session_rehydration_runs_created_idx
ON session_rehydration_runs(created_at DESC);

-- ============================================================
-- Hypothesis Lifecycle Tables
-- ============================================================

CREATE TABLE IF NOT EXISTS hypothesis_experiments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  hypothesis_node_id UUID NOT NULL REFERENCES thinking_nodes(id) ON DELETE CASCADE,
  promoted_by TEXT NOT NULL DEFAULT 'human',
  alternative_summary TEXT NOT NULL,
  status TEXT NOT NULL
    CHECK (status IN ('promoted', 'rerunning', 'comparing', 'retained', 'archived')),
  preferred_run_id UUID REFERENCES agent_runs(id) ON DELETE SET NULL,
  rerun_run_id UUID REFERENCES agent_runs(id) ON DELETE SET NULL,
  comparison_result JSONB,
  retention_decision TEXT
    CHECK (retention_decision IN ('retain', 'defer', 'archive')),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_updated TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS hypothesis_experiments_session_status_idx
ON hypothesis_experiments(session_id, status);

CREATE INDEX IF NOT EXISTS hypothesis_experiments_node_idx
ON hypothesis_experiments(hypothesis_node_id);

CREATE INDEX IF NOT EXISTS hypothesis_experiments_updated_idx
ON hypothesis_experiments(last_updated DESC);

CREATE TABLE IF NOT EXISTS hypothesis_experiment_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  experiment_id UUID NOT NULL REFERENCES hypothesis_experiments(id) ON DELETE CASCADE,
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  action TEXT NOT NULL CHECK (action IN ('promote', 'checkpoint', 'rerun', 'compare', 'retain')),
  performed_by TEXT,
  details JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS hypothesis_experiment_actions_experiment_action_idx
ON hypothesis_experiment_actions(experiment_id, action);

CREATE INDEX IF NOT EXISTS hypothesis_experiment_actions_session_created_idx
ON hypothesis_experiment_actions(session_id, created_at DESC);

-- Maintain last_updated on experiment updates
CREATE OR REPLACE FUNCTION set_hypothesis_last_updated()
RETURNS TRIGGER AS $$
BEGIN
  NEW.last_updated = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS hypothesis_experiments_last_updated ON hypothesis_experiments;
CREATE TRIGGER hypothesis_experiments_last_updated
  BEFORE UPDATE ON hypothesis_experiments
  FOR EACH ROW
  EXECUTE FUNCTION set_hypothesis_last_updated();

-- ============================================================
-- RPC: Semantic reasoning artifact match
-- ============================================================

CREATE OR REPLACE FUNCTION match_reasoning_artifacts(
  query_embedding extensions.vector(1024),
  match_threshold FLOAT DEFAULT 0.65,
  match_count INT DEFAULT 10,
  filter_session_id UUID DEFAULT NULL,
  filter_artifact_type TEXT DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  session_id UUID,
  thinking_node_id UUID,
  artifact_type TEXT,
  content TEXT,
  importance_score FLOAT,
  source_confidence FLOAT,
  last_used_at TIMESTAMPTZ,
  similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    ra.id,
    ra.session_id,
    ra.thinking_node_id,
    ra.artifact_type,
    ra.content,
    ra.importance_score,
    ra.source_confidence,
    ra.last_used_at,
    1 - (ra.embedding <=> query_embedding) AS similarity
  FROM reasoning_artifacts ra
  WHERE ra.embedding IS NOT NULL
    AND 1 - (ra.embedding <=> query_embedding) > match_threshold
    AND (filter_session_id IS NULL OR ra.session_id = filter_session_id)
    AND (filter_artifact_type IS NULL OR ra.artifact_type = filter_artifact_type)
  ORDER BY ra.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- ============================================================
-- RPC: Search structured hypotheses
-- ============================================================

CREATE OR REPLACE FUNCTION search_structured_reasoning_hypotheses(
  search_query TEXT,
  p_session_id UUID DEFAULT NULL,
  p_status TEXT DEFAULT NULL,
  result_limit INT DEFAULT 20
)
RETURNS TABLE (
  hypothesis_id UUID,
  thinking_node_id UUID,
  step_id UUID,
  hypothesis_text TEXT,
  status TEXT,
  confidence FLOAT,
  created_at TIMESTAMPTZ,
  rank REAL
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    h.id AS hypothesis_id,
    h.thinking_node_id,
    h.step_id,
    h.hypothesis_text,
    h.status,
    h.confidence,
    h.created_at,
    ts_rank(to_tsvector('english', h.hypothesis_text), plainto_tsquery('english', search_query)) AS rank
  FROM structured_reasoning_hypotheses h
  JOIN thinking_nodes tn ON tn.id = h.thinking_node_id
  WHERE to_tsvector('english', h.hypothesis_text) @@ plainto_tsquery('english', search_query)
    AND (p_session_id IS NULL OR tn.session_id = p_session_id)
    AND (p_status IS NULL OR h.status = p_status)
  ORDER BY rank DESC, h.created_at DESC
  LIMIT result_limit;
END;
$$;

-- ============================================================
-- Comments
-- ============================================================

COMMENT ON TABLE structured_reasoning_steps IS 'Normalized reasoning steps for step-level querying and indexing';
COMMENT ON TABLE structured_reasoning_hypotheses IS 'Hypothesis records extracted from structured reasoning steps';
COMMENT ON TABLE reasoning_artifacts IS 'Semantic reasoning artifacts used for cross-session rehydration and similarity retrieval';
COMMENT ON TABLE session_rehydration_runs IS 'Audit trail of rehydration candidate selection per session query';
COMMENT ON TABLE hypothesis_experiments IS 'Lifecycle state machine for promoted reasoning hypotheses';
COMMENT ON TABLE hypothesis_experiment_actions IS 'Append-only action log for hypothesis experiments';

COMMENT ON FUNCTION match_reasoning_artifacts IS 'Semantic match for reasoning artifacts using Voyage-compatible vectors';
COMMENT ON FUNCTION search_structured_reasoning_hypotheses IS 'Full-text search over normalized hypothesis artifacts';
