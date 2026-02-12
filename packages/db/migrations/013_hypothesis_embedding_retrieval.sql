-- ============================================================
-- Opus Nx: Hypothesis Embedding Retrieval
-- Migration: 013_hypothesis_embedding_retrieval.sql
-- ============================================================
-- Adds:
-- 1) Embedding support on structured_reasoning_hypotheses
-- 2) Deterministic hypothesis text hash for dedupe
-- 3) Semantic hypothesis retrieval RPC

ALTER TABLE IF EXISTS structured_reasoning_hypotheses
  ADD COLUMN IF NOT EXISTS embedding extensions.vector(1024);

ALTER TABLE IF EXISTS structured_reasoning_hypotheses
  ADD COLUMN IF NOT EXISTS hypothesis_text_hash TEXT
  GENERATED ALWAYS AS (md5(lower(trim(hypothesis_text)))) STORED;

CREATE INDEX IF NOT EXISTS structured_reasoning_hypotheses_hash_idx
ON structured_reasoning_hypotheses(hypothesis_text_hash);

CREATE UNIQUE INDEX IF NOT EXISTS structured_reasoning_hypotheses_node_hash_unique_idx
ON structured_reasoning_hypotheses(thinking_node_id, hypothesis_text_hash);

CREATE INDEX IF NOT EXISTS structured_reasoning_hypotheses_embedding_idx
ON structured_reasoning_hypotheses
USING hnsw (embedding extensions.vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

ALTER TABLE IF EXISTS hypothesis_experiments
  DROP CONSTRAINT IF EXISTS hypothesis_experiments_status_check;

ALTER TABLE IF EXISTS hypothesis_experiments
  ADD CONSTRAINT hypothesis_experiments_status_check
  CHECK (status IN ('promoted', 'checkpointed', 'rerunning', 'comparing', 'retained', 'archived'));

CREATE OR REPLACE FUNCTION match_structured_reasoning_hypotheses(
  query_embedding extensions.vector(1024),
  match_threshold FLOAT DEFAULT 0.65,
  match_count INT DEFAULT 10,
  filter_session_id UUID DEFAULT NULL,
  filter_status TEXT DEFAULT NULL
)
RETURNS TABLE (
  hypothesis_id UUID,
  session_id UUID,
  thinking_node_id UUID,
  step_id UUID,
  hypothesis_text TEXT,
  status TEXT,
  confidence FLOAT,
  created_at TIMESTAMPTZ,
  importance_score FLOAT,
  retained_policy_bonus FLOAT,
  similarity FLOAT,
  hypothesis_text_hash TEXT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    h.id AS hypothesis_id,
    tn.session_id,
    h.thinking_node_id,
    h.step_id,
    h.hypothesis_text,
    h.status,
    h.confidence,
    h.created_at,
    COALESCE(h.confidence, 0.5) AS importance_score,
    CASE
      WHEN COALESCE(h.metadata->>'retention_decision', '') = 'retain' THEN 1.0
      WHEN h.status = 'supported' THEN 1.0
      ELSE 0.0
    END AS retained_policy_bonus,
    1 - (h.embedding <=> query_embedding) AS similarity,
    h.hypothesis_text_hash
  FROM structured_reasoning_hypotheses h
  JOIN thinking_nodes tn ON tn.id = h.thinking_node_id
  WHERE h.embedding IS NOT NULL
    AND 1 - (h.embedding <=> query_embedding) > match_threshold
    AND (filter_session_id IS NULL OR tn.session_id = filter_session_id)
    AND (filter_status IS NULL OR h.status = filter_status)
  ORDER BY h.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

COMMENT ON FUNCTION match_structured_reasoning_hypotheses IS
'Semantic retrieval of structured hypothesis rows with session/status filters';
