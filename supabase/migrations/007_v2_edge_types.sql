-- ============================================================
-- Opus Nx V2: Extended Edge Types & Agent Attribution
-- Migration: 007_v2_edge_types.sql
-- ============================================================
-- Adds 4 new edge types for multi-agent swarm interactions:
--   challenges, verifies, merges, observes
-- Adds agent_name column to thinking_nodes for V2 attribution.
-- Updates traverse_reasoning_graph RPC valid_edge_types.

-- ============================================================
-- 1. Expand reasoning_edges CHECK constraint
-- ============================================================

-- Drop the existing unnamed CHECK constraint on edge_type
ALTER TABLE reasoning_edges DROP CONSTRAINT reasoning_edges_edge_type_check;

-- Add new constraint with all 9 edge types
ALTER TABLE reasoning_edges
  ADD CONSTRAINT reasoning_edges_edge_type_check
  CHECK (edge_type IN (
    'influences', 'contradicts', 'supports', 'supersedes', 'refines',
    'challenges', 'verifies', 'merges', 'observes'
  ));

-- ============================================================
-- 2. Add agent_name to thinking_nodes
-- ============================================================

ALTER TABLE thinking_nodes
  ADD COLUMN IF NOT EXISTS agent_name TEXT;

COMMENT ON COLUMN thinking_nodes.agent_name IS 'V2 multi-agent attribution: which swarm agent produced this node';

-- ============================================================
-- 3. Update traverse_reasoning_graph valid_edge_types
-- ============================================================

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
  valid_edge_types TEXT[] := ARRAY[
    'influences', 'contradicts', 'supports', 'supersedes', 'refines',
    'branches_from', 'challenges', 'verifies', 'merges', 'observes'
  ];
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
      ARRAY[start_node_id, re.target_id] AS path
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
      g.path || re.target_id
    FROM graph g
    JOIN reasoning_edges re ON re.source_id = g.node_id
    JOIN thinking_nodes tn ON tn.id = re.target_id
    WHERE g.hop_distance < max_depth
      AND re.edge_type = ANY(edge_types)
      AND re.target_id != ALL(g.path)
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
