-- ============================================================
-- Memory Entries
-- ============================================================
-- Persists the MemGPT-inspired 3-tier memory hierarchy
-- (main_context / recall_storage / archival_storage) to Supabase
-- so that memory survives Vercel serverless cold starts.

CREATE TABLE IF NOT EXISTS memory_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  tier VARCHAR(20) NOT NULL CHECK (tier IN ('main_context', 'recall_storage', 'archival_storage')),
  content TEXT NOT NULL,
  importance FLOAT NOT NULL DEFAULT 0.5 CHECK (importance >= 0 AND importance <= 1),
  source VARCHAR(30) NOT NULL DEFAULT 'thinking_node'
    CHECK (source IN ('user_input', 'thinking_node', 'decision_point', 'metacognitive', 'knowledge_base', 'compaction')),
  source_id TEXT,
  tags TEXT[] DEFAULT '{}',
  access_count INTEGER NOT NULL DEFAULT 0,
  last_accessed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Fast lookup by session + tier (the primary access pattern)
CREATE INDEX IF NOT EXISTS memory_entries_session_tier_idx
ON memory_entries(session_id, tier);

-- Fast ordering within a session for recall window enforcement
CREATE INDEX IF NOT EXISTS memory_entries_session_created_idx
ON memory_entries(session_id, created_at DESC);

-- Keyword search within memory content
CREATE INDEX IF NOT EXISTS memory_entries_content_idx
ON memory_entries USING gin(to_tsvector('english', content));
