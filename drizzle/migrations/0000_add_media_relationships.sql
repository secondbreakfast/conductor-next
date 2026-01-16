-- Add media relationship columns to runs and prompt_runs tables

-- Add input_media_ids to runs table (array of media IDs)
ALTER TABLE runs ADD COLUMN IF NOT EXISTS input_media_ids TEXT[] DEFAULT '{}';

-- Add input_media_ids and output_media_ids to prompt_runs table
ALTER TABLE prompt_runs ADD COLUMN IF NOT EXISTS input_media_ids TEXT[] DEFAULT '{}';
ALTER TABLE prompt_runs ADD COLUMN IF NOT EXISTS output_media_ids TEXT[] DEFAULT '{}';

-- Create indexes for efficient lookups
CREATE INDEX IF NOT EXISTS idx_runs_input_media_ids ON runs USING GIN (input_media_ids);
CREATE INDEX IF NOT EXISTS idx_prompt_runs_input_media_ids ON prompt_runs USING GIN (input_media_ids);
CREATE INDEX IF NOT EXISTS idx_prompt_runs_output_media_ids ON prompt_runs USING GIN (output_media_ids);
