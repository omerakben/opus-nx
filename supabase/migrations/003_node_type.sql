-- ============================================================
-- Opus Nx: Durable node_type for thinking nodes
-- Migration: 003_node_type.sql
-- ============================================================

ALTER TABLE thinking_nodes
ADD COLUMN IF NOT EXISTS node_type TEXT NOT NULL DEFAULT 'thinking'
CHECK (node_type IN ('thinking', 'compaction', 'fork_branch', 'human_annotation'));

CREATE INDEX IF NOT EXISTS thinking_nodes_node_type_idx
ON thinking_nodes(node_type);

COMMENT ON COLUMN thinking_nodes.node_type IS 'Node category used for graph semantics and visualization.';
