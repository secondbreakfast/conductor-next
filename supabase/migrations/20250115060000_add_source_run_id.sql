-- Add source_run_id to track reruns
ALTER TABLE runs ADD COLUMN IF NOT EXISTS source_run_id UUID REFERENCES runs(id);

-- Index for finding reruns of a run
CREATE INDEX IF NOT EXISTS idx_runs_source_run_id ON runs(source_run_id);
