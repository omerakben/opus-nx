-- ============================================================
-- Opus Nx: Add response column to thinking_nodes
-- Migration: 006_thinking_nodes_response.sql
-- ============================================================
-- Stores the model's final output/response alongside the reasoning.
-- Previously, only extended thinking (reasoning) was persisted;
-- the actual conclusion/answer was returned to the client and lost.

ALTER TABLE thinking_nodes
ADD COLUMN IF NOT EXISTS response TEXT;
