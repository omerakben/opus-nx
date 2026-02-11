-- ============================================================
-- Opus Nx: Composite index for session node queries
-- Migration: 011_thinking_nodes_composite_index.sql
-- ============================================================
-- The most common query pattern fetches thinking nodes filtered by
-- session_id and ordered by created_at. A composite index lets
-- PostgreSQL satisfy both the filter and sort from the index,
-- avoiding a separate sort step on large sessions.
-- Idempotent: IF NOT EXISTS.

CREATE INDEX IF NOT EXISTS thinking_nodes_session_created_idx
ON thinking_nodes(session_id, created_at DESC);
