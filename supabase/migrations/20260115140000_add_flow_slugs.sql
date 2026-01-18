-- Add nullable slug column (VARCHAR enforces max length at DB level)
ALTER TABLE flows ADD COLUMN slug VARCHAR(50);

-- Create unique index for case-insensitive lookups (partial index, only non-null)
CREATE UNIQUE INDEX idx_flows_slug_lower ON flows (LOWER(slug)) WHERE slug IS NOT NULL;

-- Add check constraint for format validation (only when slug is set)
ALTER TABLE flows ADD CONSTRAINT chk_flow_slug_format
CHECK (slug IS NULL OR (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' AND LENGTH(slug) >= 3));

-- Add check constraint for reserved slugs (only when slug is set)
ALTER TABLE flows ADD CONSTRAINT chk_flow_slug_reserved
CHECK (slug IS NULL OR slug NOT IN ('new', 'edit', 'api', 'settings'));
