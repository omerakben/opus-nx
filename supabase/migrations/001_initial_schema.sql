-- ============================================================
-- Opus Nx Initial Schema
-- ============================================================
-- This migration creates the core tables for Opus Nx:
-- - Knowledge entries with Voyage AI embeddings (1024-dim)
-- - Knowledge relations (graph edges)
-- - Decision log for audit trail
-- - Agent runs for observability
-- - Sessions for state management

-- Enable pgvector extension for vector similarity search
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;

-- ============================================================
-- Knowledge Entries
-- ============================================================
-- Stores knowledge with semantic embeddings for retrieval

CREATE TABLE IF NOT EXISTS knowledge_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  embedding extensions.vector(1024), -- Voyage AI voyage-3 dimension
  category VARCHAR(50) NOT NULL,
  subcategory VARCHAR(100),
  source VARCHAR(100), -- 'user', 'agent', 'research', 'auto'
  source_url TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

-- Index for fast similarity search (HNSW)
CREATE INDEX IF NOT EXISTS knowledge_entries_embedding_idx
ON knowledge_entries
USING hnsw (embedding extensions.vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

-- Index for category filtering
CREATE INDEX IF NOT EXISTS knowledge_entries_category_idx
ON knowledge_entries(category);

-- Index for full-text search
CREATE INDEX IF NOT EXISTS knowledge_entries_content_idx
ON knowledge_entries USING gin(to_tsvector('english', title || ' ' || content));

-- ============================================================
-- Knowledge Relations
-- ============================================================
-- Graph edges connecting knowledge entries

CREATE TABLE IF NOT EXISTS knowledge_relations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id UUID NOT NULL REFERENCES knowledge_entries(id) ON DELETE CASCADE,
  target_id UUID NOT NULL REFERENCES knowledge_entries(id) ON DELETE CASCADE,
  relation_type VARCHAR(50) NOT NULL, -- 'related_to', 'derived_from', 'contradicts', 'updates', 'part_of'
  weight FLOAT DEFAULT 1.0,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(source_id, target_id, relation_type)
);

-- Index for graph traversal
CREATE INDEX IF NOT EXISTS knowledge_relations_source_idx
ON knowledge_relations(source_id);

CREATE INDEX IF NOT EXISTS knowledge_relations_target_idx
ON knowledge_relations(target_id);

-- ============================================================
-- Sessions
-- ============================================================
-- Orchestration session state

CREATE TABLE IF NOT EXISTS sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  status VARCHAR(20) DEFAULT 'active', -- 'active', 'completed', 'archived'
  current_plan JSONB,
  knowledge_context TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for user sessions
CREATE INDEX IF NOT EXISTS sessions_user_idx
ON sessions(user_id);

CREATE INDEX IF NOT EXISTS sessions_status_idx
ON sessions(status);

-- ============================================================
-- Decision Log
-- ============================================================
-- Audit trail for orchestrator decisions

CREATE TABLE IF NOT EXISTS decision_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  task_plan_id UUID,
  decision_type VARCHAR(50) NOT NULL, -- 'task_routing', 'agent_selection', 'knowledge_retrieval', 'synthesis'
  input_context TEXT NOT NULL,
  thinking_summary TEXT,
  thinking_signature TEXT, -- For verification
  decision_output JSONB NOT NULL,
  tokens_used JSONB, -- { input, output, thinking }
  latency_ms INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for session decisions
CREATE INDEX IF NOT EXISTS decision_log_session_idx
ON decision_log(session_id);

CREATE INDEX IF NOT EXISTS decision_log_type_idx
ON decision_log(decision_type);

-- ============================================================
-- Agent Runs
-- ============================================================
-- Observability for agent executions

CREATE TABLE IF NOT EXISTS agent_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  task_id VARCHAR(100),
  agent_name VARCHAR(50) NOT NULL,
  model VARCHAR(100) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'running', -- 'running', 'completed', 'failed'
  input_context TEXT,
  output_result JSONB,
  error_message TEXT,
  tokens_used JSONB, -- { input, output, thinking }
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- Index for session agent runs
CREATE INDEX IF NOT EXISTS agent_runs_session_idx
ON agent_runs(session_id);

CREATE INDEX IF NOT EXISTS agent_runs_agent_idx
ON agent_runs(agent_name);

CREATE INDEX IF NOT EXISTS agent_runs_status_idx
ON agent_runs(status);

-- ============================================================
-- Functions
-- ============================================================

-- Semantic search function
CREATE OR REPLACE FUNCTION match_knowledge(
  query_embedding extensions.vector(1024),
  match_threshold FLOAT DEFAULT 0.7,
  match_count INT DEFAULT 10,
  filter_category TEXT DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  title TEXT,
  content TEXT,
  category VARCHAR(50),
  similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    ke.id,
    ke.title,
    ke.content,
    ke.category,
    1 - (ke.embedding <=> query_embedding) AS similarity
  FROM knowledge_entries ke
  WHERE
    1 - (ke.embedding <=> query_embedding) > match_threshold
    AND (filter_category IS NULL OR ke.category = filter_category)
  ORDER BY ke.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Graph traversal function for related knowledge
CREATE OR REPLACE FUNCTION get_related_knowledge(
  entry_id UUID,
  depth INT DEFAULT 1
)
RETURNS TABLE (
  id UUID,
  title TEXT,
  relation_type VARCHAR(50),
  relation_weight FLOAT,
  hop_distance INT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  WITH RECURSIVE related AS (
    -- Base case: direct relations
    SELECT
      kr.target_id AS id,
      ke.title,
      kr.relation_type,
      kr.weight AS relation_weight,
      1 AS hop_distance
    FROM knowledge_relations kr
    JOIN knowledge_entries ke ON ke.id = kr.target_id
    WHERE kr.source_id = entry_id

    UNION ALL

    -- Recursive case: follow relations up to depth
    SELECT
      kr.target_id,
      ke.title,
      kr.relation_type,
      kr.weight,
      r.hop_distance + 1
    FROM related r
    JOIN knowledge_relations kr ON kr.source_id = r.id
    JOIN knowledge_entries ke ON ke.id = kr.target_id
    WHERE r.hop_distance < depth
  )
  SELECT DISTINCT * FROM related
  ORDER BY hop_distance, relation_weight DESC;
END;
$$;

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to tables with updated_at
CREATE TRIGGER knowledge_entries_updated_at
  BEFORE UPDATE ON knowledge_entries
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER sessions_updated_at
  BEFORE UPDATE ON sessions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();
