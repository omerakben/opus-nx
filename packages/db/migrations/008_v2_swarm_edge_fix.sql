-- ============================================================
-- Opus Nx V2: Fix swarm edge types + agent attribution
-- Migration: 008_v2_swarm_edge_fix.sql
-- ============================================================
-- Ensures the reasoning_edges CHECK constraint includes ALL
-- edge types used by both V1 (TypeScript) and V2 (Python swarm):
--   V1: influences, contradicts, supports, supersedes, refines
--   V2: challenges, verifies, merges, observes, leads_to
-- Also ensures agent_name column exists on thinking_nodes.
-- Idempotent: safe to run whether or not migration 007 was applied.

-- ============================================================
-- 1. Drop existing CHECK constraint (handles both 002 and 007 names)
-- ============================================================

-- Drop named constraint from 007 (if applied)
ALTER TABLE reasoning_edges DROP CONSTRAINT IF EXISTS reasoning_edges_edge_type_check;

-- ============================================================
-- 2. Recreate with ALL edge types (V1 + V2)
-- ============================================================

ALTER TABLE reasoning_edges
  ADD CONSTRAINT reasoning_edges_edge_type_check
  CHECK (edge_type IN (
    'influences', 'contradicts', 'supports', 'supersedes', 'refines',
    'challenges', 'verifies', 'merges', 'observes', 'leads_to'
  ));

-- ============================================================
-- 3. Ensure agent_name column exists on thinking_nodes
-- ============================================================

ALTER TABLE thinking_nodes
  ADD COLUMN IF NOT EXISTS agent_name TEXT;

COMMENT ON COLUMN thinking_nodes.agent_name IS 'V2 multi-agent attribution: which swarm agent produced this node';
