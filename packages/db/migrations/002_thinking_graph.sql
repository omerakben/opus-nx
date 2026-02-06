-- ============================================================
-- Opus Nx: Cognitive Architect - ThinkGraph Schema
-- Migration: 002_thinking_graph.sql
-- ============================================================
-- This migration adds tables for the ThinkGraph feature:
-- - thinking_nodes: Persistent reasoning graph nodes
-- - reasoning_edges: Graph relationships between nodes
-- - decision_points: Extracted decision points from reasoning
-- - contradictions: Conflict detection and resolution tracking
-- - metacognitive_insights: Self-audit patterns and biases

-- ============================================================
-- Thinking Nodes
-- ============================================================
-- Stores each extended thinking session as a graph node

CREATE TABLE IF NOT EXISTS thinking_nodes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  parent_node_id UUID REFERENCES thinking_nodes(id) ON DELETE SET NULL,
  reasoning TEXT NOT NULL,
  structured_reasoning JSONB DEFAULT '{}',
  confidence_score FLOAT CHECK (confidence_score >= 0 AND confidence_score <= 1),
  thinking_budget INT,
  signature TEXT,
  input_query TEXT,
  token_usage JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for session queries
CREATE INDEX IF NOT EXISTS thinking_nodes_session_idx
ON thinking_nodes(session_id);

-- Index for parent traversal
CREATE INDEX IF NOT EXISTS thinking_nodes_parent_idx
ON thinking_nodes(parent_node_id);

-- Index for full-text search on reasoning
CREATE INDEX IF NOT EXISTS thinking_nodes_reasoning_search_idx
ON thinking_nodes USING gin(to_tsvector('english', reasoning));

-- Index for timestamp ordering
CREATE INDEX IF NOT EXISTS thinking_nodes_created_idx
ON thinking_nodes(created_at DESC);

-- ============================================================
-- Reasoning Edges
-- ============================================================
-- Graph edges connecting thinking nodes

CREATE TABLE IF NOT EXISTS reasoning_edges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id UUID NOT NULL REFERENCES thinking_nodes(id) ON DELETE CASCADE,
  target_id UUID NOT NULL REFERENCES thinking_nodes(id) ON DELETE CASCADE,
  edge_type TEXT NOT NULL CHECK (edge_type IN ('influences', 'contradicts', 'supports', 'supersedes', 'refines')),
  weight FLOAT DEFAULT 1.0 CHECK (weight >= 0 AND weight <= 1),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(source_id, target_id, edge_type)
);

-- Indexes for graph traversal
CREATE INDEX IF NOT EXISTS reasoning_edges_source_idx
ON reasoning_edges(source_id);

CREATE INDEX IF NOT EXISTS reasoning_edges_target_idx
ON reasoning_edges(target_id);

CREATE INDEX IF NOT EXISTS reasoning_edges_type_idx
ON reasoning_edges(edge_type);

-- ============================================================
-- Decision Points
-- ============================================================
-- Extracted decision points from reasoning chains

CREATE TABLE IF NOT EXISTS decision_points (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thinking_node_id UUID NOT NULL REFERENCES thinking_nodes(id) ON DELETE CASCADE,
  step_number INT NOT NULL,
  description TEXT NOT NULL,
  chosen_path TEXT NOT NULL,
  alternatives JSONB DEFAULT '[]',
  confidence FLOAT CHECK (confidence >= 0 AND confidence <= 1),
  reasoning_excerpt TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for node lookup
CREATE INDEX IF NOT EXISTS decision_points_node_idx
ON decision_points(thinking_node_id);

-- ============================================================
-- Contradictions
-- ============================================================
-- Tracks detected contradictions and their resolutions

CREATE TABLE IF NOT EXISTS contradictions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
  knowledge_a_id UUID REFERENCES knowledge_entries(id) ON DELETE SET NULL,
  knowledge_b_id UUID REFERENCES knowledge_entries(id) ON DELETE SET NULL,
  thinking_node_id UUID REFERENCES thinking_nodes(id) ON DELETE SET NULL,
  contradiction_type TEXT CHECK (contradiction_type IN ('factual', 'temporal', 'perspective', 'scope')),
  severity TEXT DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high')),
  description TEXT,
  resolution_summary TEXT,
  resolved_in_favor TEXT CHECK (resolved_in_favor IN ('a', 'b', 'synthesized', 'unresolved')),
  resolved_by TEXT DEFAULT 'auto' CHECK (resolved_by IN ('auto', 'user')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);

-- Index for knowledge lookup
CREATE INDEX IF NOT EXISTS contradictions_knowledge_a_idx
ON contradictions(knowledge_a_id);

CREATE INDEX IF NOT EXISTS contradictions_knowledge_b_idx
ON contradictions(knowledge_b_id);

-- Index for session
CREATE INDEX IF NOT EXISTS contradictions_session_idx
ON contradictions(session_id);

-- ============================================================
-- Metacognitive Insights
-- ============================================================
-- Stores self-audit patterns, biases, and improvement hypotheses

CREATE TABLE IF NOT EXISTS metacognitive_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
  thinking_nodes_analyzed UUID[] DEFAULT '{}',
  insight_type TEXT NOT NULL CHECK (insight_type IN ('bias_detection', 'pattern', 'improvement_hypothesis')),
  insight TEXT NOT NULL,
  evidence JSONB DEFAULT '[]',
  confidence FLOAT CHECK (confidence >= 0 AND confidence <= 1),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for session lookup
CREATE INDEX IF NOT EXISTS metacognitive_insights_session_idx
ON metacognitive_insights(session_id);

-- Index for type filtering
CREATE INDEX IF NOT EXISTS metacognitive_insights_type_idx
ON metacognitive_insights(insight_type);

-- ============================================================
-- RPC Functions
-- ============================================================

-- Traverse reasoning graph from a starting node
CREATE OR REPLACE FUNCTION traverse_reasoning_graph(
  start_node_id UUID,
  max_depth INT DEFAULT 3,
  edge_types TEXT[] DEFAULT ARRAY['influences', 'supports', 'refines']
)
RETURNS TABLE (
  node_id UUID,
  reasoning TEXT,
  confidence_score FLOAT,
  edge_type TEXT,
  hop_distance INT
)
LANGUAGE plpgsql
AS $$
DECLARE
  valid_edge_types TEXT[] := ARRAY['influences', 'contradicts', 'supports', 'supersedes', 'refines', 'branches_from'];
  invalid_types TEXT[];
BEGIN
  -- Validate edge_types if provided
  IF edge_types IS NOT NULL THEN
    SELECT array_agg(et)
    INTO invalid_types
    FROM unnest(edge_types) et
    WHERE et != ALL(valid_edge_types);

    IF array_length(invalid_types, 1) > 0 THEN
      RAISE EXCEPTION 'Invalid edge types: %. Valid types are: %',
        array_to_string(invalid_types, ', '),
        array_to_string(valid_edge_types, ', ');
    END IF;
  END IF;

  RETURN QUERY
  WITH RECURSIVE graph AS (
    -- Base case: direct edges from start node
    SELECT
      re.target_id AS node_id,
      tn.reasoning,
      tn.confidence_score,
      re.edge_type,
      1 AS hop_distance,
      ARRAY[start_node_id, re.target_id] AS path  -- Track visited nodes
    FROM reasoning_edges re
    JOIN thinking_nodes tn ON tn.id = re.target_id
    WHERE re.source_id = start_node_id
      AND re.edge_type = ANY(edge_types)

    UNION ALL

    -- Recursive case: follow edges up to max_depth with cycle detection
    SELECT
      re.target_id,
      tn.reasoning,
      tn.confidence_score,
      re.edge_type,
      g.hop_distance + 1,
      g.path || re.target_id  -- Append to path
    FROM graph g
    JOIN reasoning_edges re ON re.source_id = g.node_id
    JOIN thinking_nodes tn ON tn.id = re.target_id
    WHERE g.hop_distance < max_depth
      AND re.edge_type = ANY(edge_types)
      AND re.target_id != ALL(g.path)  -- CYCLE DETECTION: skip already visited nodes
  )
  SELECT DISTINCT ON (graph.node_id)
    graph.node_id,
    graph.reasoning,
    graph.confidence_score,
    graph.edge_type,
    graph.hop_distance
  FROM graph
  ORDER BY graph.node_id, graph.hop_distance;
END;
$$;

-- Get session reasoning context (recent nodes with stats)
CREATE OR REPLACE FUNCTION get_session_reasoning_context(
  p_session_id UUID,
  node_limit INT DEFAULT 20
)
RETURNS TABLE (
  node_id UUID,
  reasoning TEXT,
  confidence_score FLOAT,
  decision_count BIGINT,
  input_query TEXT,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    tn.id AS node_id,
    tn.reasoning,
    tn.confidence_score,
    (SELECT COUNT(*) FROM decision_points dp WHERE dp.thinking_node_id = tn.id) AS decision_count,
    tn.input_query,
    tn.created_at
  FROM thinking_nodes tn
  WHERE tn.session_id = p_session_id
  ORDER BY tn.created_at DESC
  LIMIT node_limit;
END;
$$;

-- Search reasoning nodes by text
CREATE OR REPLACE FUNCTION search_reasoning_nodes(
  search_query TEXT,
  p_session_id UUID DEFAULT NULL,
  result_limit INT DEFAULT 10
)
RETURNS TABLE (
  node_id UUID,
  reasoning TEXT,
  confidence_score FLOAT,
  rank REAL
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    tn.id AS node_id,
    tn.reasoning,
    tn.confidence_score,
    ts_rank(to_tsvector('english', tn.reasoning), plainto_tsquery('english', search_query)) AS rank
  FROM thinking_nodes tn
  WHERE to_tsvector('english', tn.reasoning) @@ plainto_tsquery('english', search_query)
    AND (p_session_id IS NULL OR tn.session_id = p_session_id)
  ORDER BY rank DESC
  LIMIT result_limit;
END;
$$;

-- Get reasoning chain (path from root to node)
CREATE OR REPLACE FUNCTION get_reasoning_chain(
  target_node_id UUID
)
RETURNS TABLE (
  node_id UUID,
  reasoning TEXT,
  confidence_score FLOAT,
  chain_position INT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  WITH RECURSIVE chain AS (
    -- Start from target node
    SELECT
      tn.id AS node_id,
      tn.reasoning,
      tn.confidence_score,
      tn.parent_node_id,
      0 AS chain_position
    FROM thinking_nodes tn
    WHERE tn.id = target_node_id

    UNION ALL

    -- Walk up to parent
    SELECT
      tn.id,
      tn.reasoning,
      tn.confidence_score,
      tn.parent_node_id,
      c.chain_position + 1
    FROM chain c
    JOIN thinking_nodes tn ON tn.id = c.parent_node_id
    WHERE c.parent_node_id IS NOT NULL
  )
  SELECT
    chain.node_id,
    chain.reasoning,
    chain.confidence_score,
    chain.chain_position
  FROM chain
  ORDER BY chain.chain_position DESC;
END;
$$;

-- ============================================================
-- Triggers
-- ============================================================

-- No updated_at needed for thinking_nodes (immutable after creation)
-- Decision points and insights are also immutable

-- ============================================================
-- Comments
-- ============================================================

COMMENT ON TABLE thinking_nodes IS 'Stores extended thinking sessions as graph nodes for the ThinkGraph feature';
COMMENT ON TABLE reasoning_edges IS 'Graph edges connecting thinking nodes with typed relationships';
COMMENT ON TABLE decision_points IS 'Extracted decision points from reasoning chains showing alternatives considered';
COMMENT ON TABLE contradictions IS 'Tracks detected knowledge contradictions and their resolutions';
COMMENT ON TABLE metacognitive_insights IS 'Stores self-audit patterns, biases, and improvement hypotheses from metacognition';

COMMENT ON FUNCTION traverse_reasoning_graph IS 'Recursively traverses the reasoning graph from a starting node up to max_depth';
COMMENT ON FUNCTION get_session_reasoning_context IS 'Gets recent reasoning nodes for a session with decision counts';
COMMENT ON FUNCTION search_reasoning_nodes IS 'Full-text search over reasoning content';
COMMENT ON FUNCTION get_reasoning_chain IS 'Gets the full chain from root to a specific node via parent links';
