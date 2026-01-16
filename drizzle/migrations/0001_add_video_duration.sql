-- Add video_duration column to prompts table
ALTER TABLE prompts ADD COLUMN IF NOT EXISTS video_duration INTEGER;
