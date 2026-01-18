-- Add source_image_id column to media table to track image→video relationships
ALTER TABLE media ADD COLUMN IF NOT EXISTS source_image_id TEXT REFERENCES media(id);

-- Create index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_media_source_image_id ON media(source_image_id);
