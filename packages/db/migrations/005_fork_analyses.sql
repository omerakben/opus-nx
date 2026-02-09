-- Fork analyses persistence
-- Stores ThinkFork and Debate results so they survive page refresh

CREATE TABLE fork_analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  query TEXT NOT NULL,
  mode VARCHAR(10) NOT NULL DEFAULT 'fork' CHECK (mode IN ('fork', 'debate')),
  result JSONB NOT NULL,
  steering_history JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_fork_analyses_session ON fork_analyses(session_id);
CREATE INDEX idx_fork_analyses_created ON fork_analyses(created_at DESC);
