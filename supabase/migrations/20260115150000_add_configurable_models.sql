-- Migration: Add configurable models
-- Moves provider/model configuration from hardcoded constants to database tables

-- ============================================================================
-- PROVIDERS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS providers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  enabled BOOLEAN NOT NULL DEFAULT true,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_providers_slug ON providers(slug);
CREATE INDEX idx_providers_enabled_order ON providers(enabled, display_order);

-- ============================================================================
-- MODELS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS models (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  provider_id UUID NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  model_id TEXT NOT NULL,
  endpoint_types TEXT[] NOT NULL DEFAULT '{}',
  enabled BOOLEAN NOT NULL DEFAULT true,
  display_order INTEGER NOT NULL DEFAULT 0,
  default_params JSONB DEFAULT '{}',
  input_price DECIMAL(10,6),
  output_price DECIMAL(10,6),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT uq_provider_model UNIQUE (provider_id, model_id)
);

CREATE INDEX idx_models_provider_id ON models(provider_id);
CREATE INDEX idx_models_endpoint_types ON models USING GIN(endpoint_types);
CREATE INDEX idx_models_enabled ON models(enabled);
CREATE INDEX idx_models_enabled_provider_order ON models(enabled, provider_id, display_order);

-- Validate endpoint types
ALTER TABLE models ADD CONSTRAINT valid_endpoint_types
  CHECK (endpoint_types <@ ARRAY['Chat', 'ImageToImage', 'ImageToVideo', 'VideoToVideo', 'AudioToText', 'TextToAudio']::TEXT[]);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE providers ENABLE ROW LEVEL SECURITY;
ALTER TABLE models ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to providers" ON providers FOR ALL USING (true);
CREATE POLICY "Allow all access to models" ON models FOR ALL USING (true);

-- ============================================================================
-- UPDATED_AT TRIGGERS
-- ============================================================================

CREATE TRIGGER update_providers_updated_at
  BEFORE UPDATE ON providers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_models_updated_at
  BEFORE UPDATE ON models
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- SEED DATA: PROVIDERS
-- ============================================================================

INSERT INTO providers (name, slug, display_order) VALUES
  ('OpenAI', 'openai', 10),
  ('Anthropic', 'anthropic', 20),
  ('Gemini', 'gemini', 30),
  ('Stability', 'stability', 40),
  ('Rails', 'rails', 50)
ON CONFLICT (slug) DO NOTHING;

-- ============================================================================
-- SEED DATA: CHAT MODELS
-- ============================================================================

-- OpenAI Chat Models
INSERT INTO models (provider_id, name, model_id, endpoint_types, input_price, output_price, display_order)
SELECT p.id, 'GPT-4.1', 'gpt-4.1', ARRAY['Chat'], 0.002, 0.008, 10
FROM providers p WHERE p.slug = 'openai'
ON CONFLICT (provider_id, model_id) DO NOTHING;

INSERT INTO models (provider_id, name, model_id, endpoint_types, input_price, output_price, display_order)
SELECT p.id, 'GPT-4.1 Mini', 'gpt-4.1-mini', ARRAY['Chat'], 0.0004, 0.0016, 20
FROM providers p WHERE p.slug = 'openai'
ON CONFLICT (provider_id, model_id) DO NOTHING;

INSERT INTO models (provider_id, name, model_id, endpoint_types, input_price, output_price, display_order)
SELECT p.id, 'GPT-4.1 Nano', 'gpt-4.1-nano', ARRAY['Chat'], 0.0001, 0.0004, 30
FROM providers p WHERE p.slug = 'openai'
ON CONFLICT (provider_id, model_id) DO NOTHING;

INSERT INTO models (provider_id, name, model_id, endpoint_types, input_price, output_price, display_order)
SELECT p.id, 'GPT-4o', 'gpt-4o', ARRAY['Chat'], 0.005, 0.015, 40
FROM providers p WHERE p.slug = 'openai'
ON CONFLICT (provider_id, model_id) DO NOTHING;

INSERT INTO models (provider_id, name, model_id, endpoint_types, input_price, output_price, display_order)
SELECT p.id, 'GPT-4o Mini', 'gpt-4o-mini', ARRAY['Chat'], 0.00015, 0.0006, 50
FROM providers p WHERE p.slug = 'openai'
ON CONFLICT (provider_id, model_id) DO NOTHING;

INSERT INTO models (provider_id, name, model_id, endpoint_types, input_price, output_price, display_order)
SELECT p.id, 'GPT-4o (2024-08-06)', 'gpt-4o-2024-08-06', ARRAY['Chat'], 0.005, 0.015, 60
FROM providers p WHERE p.slug = 'openai'
ON CONFLICT (provider_id, model_id) DO NOTHING;

-- Anthropic Chat Models
INSERT INTO models (provider_id, name, model_id, endpoint_types, input_price, output_price, display_order)
SELECT p.id, 'Claude 3.5 Sonnet', 'claude-3-5-sonnet-20240620', ARRAY['Chat'], 0.003, 0.015, 10
FROM providers p WHERE p.slug = 'anthropic'
ON CONFLICT (provider_id, model_id) DO NOTHING;

INSERT INTO models (provider_id, name, model_id, endpoint_types, input_price, output_price, display_order)
SELECT p.id, 'Claude 3.7 Sonnet', 'claude-3-7-sonnet', ARRAY['Chat'], 0.003, 0.015, 20
FROM providers p WHERE p.slug = 'anthropic'
ON CONFLICT (provider_id, model_id) DO NOTHING;

-- Gemini Chat Models
INSERT INTO models (provider_id, name, model_id, endpoint_types, input_price, output_price, display_order)
SELECT p.id, 'Gemini 2.5 Pro', 'gemini-2.5-pro', ARRAY['Chat'], 0.00125, 0.005, 10
FROM providers p WHERE p.slug = 'gemini'
ON CONFLICT (provider_id, model_id) DO NOTHING;

INSERT INTO models (provider_id, name, model_id, endpoint_types, input_price, output_price, display_order)
SELECT p.id, 'Gemini 2.5 Flash', 'gemini-2.5-flash', ARRAY['Chat'], 0.000075, 0.0003, 20
FROM providers p WHERE p.slug = 'gemini'
ON CONFLICT (provider_id, model_id) DO NOTHING;

INSERT INTO models (provider_id, name, model_id, endpoint_types, input_price, output_price, display_order)
SELECT p.id, 'Gemini 3 Pro Preview', 'gemini-3-pro-preview', ARRAY['Chat'], 0.00125, 0.005, 30
FROM providers p WHERE p.slug = 'gemini'
ON CONFLICT (provider_id, model_id) DO NOTHING;

INSERT INTO models (provider_id, name, model_id, endpoint_types, input_price, output_price, display_order)
SELECT p.id, 'Gemini 3 Flash Preview', 'gemini-3-flash-preview', ARRAY['Chat'], 0.000075, 0.0003, 40
FROM providers p WHERE p.slug = 'gemini'
ON CONFLICT (provider_id, model_id) DO NOTHING;

-- ============================================================================
-- SEED DATA: IMAGE MODELS
-- ============================================================================

-- OpenAI Image Models
INSERT INTO models (provider_id, name, model_id, endpoint_types, display_order)
SELECT p.id, 'GPT Image 1', 'gpt-image-1', ARRAY['ImageToImage'], 110
FROM providers p WHERE p.slug = 'openai'
ON CONFLICT (provider_id, model_id) DO NOTHING;

INSERT INTO models (provider_id, name, model_id, endpoint_types, display_order)
SELECT p.id, 'GPT Image 1.5', 'gpt-image-1.5', ARRAY['ImageToImage'], 120
FROM providers p WHERE p.slug = 'openai'
ON CONFLICT (provider_id, model_id) DO NOTHING;

INSERT INTO models (provider_id, name, model_id, endpoint_types, display_order)
SELECT p.id, 'DALL-E 3', 'dall-e-3', ARRAY['ImageToImage'], 130
FROM providers p WHERE p.slug = 'openai'
ON CONFLICT (provider_id, model_id) DO NOTHING;

INSERT INTO models (provider_id, name, model_id, endpoint_types, display_order)
SELECT p.id, 'DALL-E 2', 'dall-e-2', ARRAY['ImageToImage'], 140
FROM providers p WHERE p.slug = 'openai'
ON CONFLICT (provider_id, model_id) DO NOTHING;

-- Gemini Image Models
INSERT INTO models (provider_id, name, model_id, endpoint_types, display_order)
SELECT p.id, 'Gemini 2.5 Flash Image Preview', 'gemini-2.5-flash-image-preview', ARRAY['ImageToImage'], 110
FROM providers p WHERE p.slug = 'gemini'
ON CONFLICT (provider_id, model_id) DO NOTHING;

INSERT INTO models (provider_id, name, model_id, endpoint_types, display_order)
SELECT p.id, 'Gemini 3 Pro Image Preview', 'gemini-3-pro-image-preview', ARRAY['ImageToImage'], 120
FROM providers p WHERE p.slug = 'gemini'
ON CONFLICT (provider_id, model_id) DO NOTHING;

-- Stability Image Models
INSERT INTO models (provider_id, name, model_id, endpoint_types, display_order)
SELECT p.id, 'Remove Background', 'remove-background', ARRAY['ImageToImage'], 10
FROM providers p WHERE p.slug = 'stability'
ON CONFLICT (provider_id, model_id) DO NOTHING;

INSERT INTO models (provider_id, name, model_id, endpoint_types, display_order)
SELECT p.id, 'Replace Background and Relight', 'replace-background-and-relight', ARRAY['ImageToImage'], 20
FROM providers p WHERE p.slug = 'stability'
ON CONFLICT (provider_id, model_id) DO NOTHING;

-- ============================================================================
-- SEED DATA: VIDEO MODELS
-- ============================================================================

-- Gemini Video Models
INSERT INTO models (provider_id, name, model_id, endpoint_types, display_order)
SELECT p.id, 'Veo 3.0', 'veo-3.0-generate-001', ARRAY['ImageToVideo'], 210
FROM providers p WHERE p.slug = 'gemini'
ON CONFLICT (provider_id, model_id) DO NOTHING;

-- Rails Video Models
INSERT INTO models (provider_id, name, model_id, endpoint_types, display_order)
SELECT p.id, 'FFmpeg Concat', 'ffmpeg-concat', ARRAY['VideoToVideo'], 10
FROM providers p WHERE p.slug = 'rails'
ON CONFLICT (provider_id, model_id) DO NOTHING;
