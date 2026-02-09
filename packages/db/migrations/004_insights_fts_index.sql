-- Full-text search index on metacognitive insights
-- Enables efficient text search across insight content
CREATE INDEX IF NOT EXISTS idx_metacognitive_insights_fts
ON metacognitive_insights USING GIN (to_tsvector('english', insight));
