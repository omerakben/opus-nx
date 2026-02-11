-- ============================================================
-- Opus Nx: Add branches_from edge type to CHECK constraint
-- Migration: 009_add_branches_from_edge_type.sql
-- ============================================================
-- ThinkFork creates edges with type 'branches_from' for fork-branch
-- relationships, but migration 008 did not include it in the CHECK
-- constraint. This adds it alongside the existing types.
-- Idempotent: safe to run multiple times.

-- 1. Drop existing CHECK constraint
ALTER TABLE reasoning_edges DROP CONSTRAINT IF EXISTS reasoning_edges_edge_type_check;

-- 2. Recreate with ALL edge types (V1 + V2 + branches_from)
ALTER TABLE reasoning_edges
  ADD CONSTRAINT reasoning_edges_edge_type_check
  CHECK (edge_type IN (
    'influences', 'contradicts', 'supports', 'supersedes', 'refines',
    'challenges', 'verifies', 'merges', 'observes', 'leads_to',
    'branches_from'
  ));
