-- ============================================================
-- Opus Nx: Hypothesis Lifecycle Deferred Status
-- Migration: 014_hypothesis_lifecycle_deferred_status.sql
-- ============================================================
-- Adds `deferred` as a first-class lifecycle status.

ALTER TABLE IF EXISTS hypothesis_experiments
  DROP CONSTRAINT IF EXISTS hypothesis_experiments_status_check;

ALTER TABLE IF EXISTS hypothesis_experiments
  ADD CONSTRAINT hypothesis_experiments_status_check
  CHECK (
    status IN (
      'promoted',
      'checkpointed',
      'rerunning',
      'comparing',
      'retained',
      'deferred',
      'archived'
    )
  );
