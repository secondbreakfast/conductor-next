-- Conductor Database Schema for Supabase
-- Run this in your Supabase SQL Editor to set up the database

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Flows table (workflow definitions)
CREATE TABLE IF NOT EXISTS flows (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for flows
CREATE INDEX IF NOT EXISTS idx_flows_created_at ON flows(created_at DESC);

-- Prompts table (individual steps in a flow)
CREATE TABLE IF NOT EXISTS prompts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  flow_id UUID REFERENCES flows(id) ON DELETE CASCADE,
  type TEXT DEFAULT 'Prompt',
  action TEXT,
  endpoint_type TEXT NOT NULL DEFAULT 'Chat',
  selected_provider TEXT NOT NULL DEFAULT 'OpenAI',
  selected_model TEXT NOT NULL DEFAULT 'gpt-4o',
  -- Chat configuration
  system_prompt TEXT,
  tools JSONB DEFAULT '[]'::jsonb,
  -- Image configuration
  background_prompt TEXT,
  foreground_prompt TEXT,
  negative_prompt TEXT,
  preserve_original_subject FLOAT,
  original_background_depth FLOAT,
  keep_original_background BOOLEAN DEFAULT false,
  light_source_direction TEXT,
  light_source_strength FLOAT,
  seed FLOAT,
  output_format TEXT,
  size TEXT,
  quality TEXT,
  -- Attachments (stored as URLs)
  subject_image_url TEXT,
  background_reference_url TEXT,
  attachment_urls JSONB DEFAULT '[]'::jsonb,
  -- Ordering
  position INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for prompts
CREATE INDEX IF NOT EXISTS idx_prompts_flow_id ON prompts(flow_id);
CREATE INDEX IF NOT EXISTS idx_prompts_position ON prompts(flow_id, position);

-- Conversations table (for grouping related runs)
CREATE TABLE IF NOT EXISTS conversations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Runs table (individual workflow executions)
CREATE TABLE IF NOT EXISTS runs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  flow_id UUID REFERENCES flows(id) ON DELETE SET NULL,
  conversation_id UUID REFERENCES conversations(id) ON DELETE SET NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed', 'timed-out')),
  message TEXT,
  input_image_url TEXT,
  webhook_url TEXT,
  variables JSONB DEFAULT '{}'::jsonb,
  attachment_urls JSONB DEFAULT '[]'::jsonb,
  -- Output data
  data JSONB DEFAULT '{}'::jsonb,
  -- Timestamps
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for runs
CREATE INDEX IF NOT EXISTS idx_runs_flow_id ON runs(flow_id);
CREATE INDEX IF NOT EXISTS idx_runs_conversation_id ON runs(conversation_id);
CREATE INDEX IF NOT EXISTS idx_runs_status ON runs(status);
CREATE INDEX IF NOT EXISTS idx_runs_created_at ON runs(created_at DESC);

-- PromptRuns table (execution record for each prompt in a run)
CREATE TABLE IF NOT EXISTS prompt_runs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  prompt_id UUID REFERENCES prompts(id) ON DELETE CASCADE,
  run_id UUID REFERENCES runs(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed')),
  response JSONB,
  input_tokens INTEGER,
  output_tokens INTEGER,
  total_tokens INTEGER,
  selected_provider TEXT,
  model TEXT,
  -- Attachments
  source_attachment_urls JSONB DEFAULT '[]'::jsonb,
  attachment_urls JSONB DEFAULT '[]'::jsonb,
  -- Timestamps
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for prompt_runs
CREATE INDEX IF NOT EXISTS idx_prompt_runs_prompt_id ON prompt_runs(prompt_id);
CREATE INDEX IF NOT EXISTS idx_prompt_runs_run_id ON prompt_runs(run_id);
CREATE INDEX IF NOT EXISTS idx_prompt_runs_status ON prompt_runs(status);

-- Responses table (response metadata from API calls)
CREATE TABLE IF NOT EXISTS responses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  prompt_run_id UUID REFERENCES prompt_runs(id) ON DELETE CASCADE,
  provider_id TEXT,
  role TEXT,
  response_type TEXT,
  status TEXT,
  call_id TEXT,
  name TEXT,
  arguments TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for responses
CREATE INDEX IF NOT EXISTS idx_responses_prompt_run_id ON responses(prompt_run_id);

-- Outputs table (individual output items from responses)
CREATE TABLE IF NOT EXISTS outputs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  response_id UUID REFERENCES responses(id) ON DELETE CASCADE,
  provider_id TEXT,
  text TEXT,
  content_type TEXT,
  annotations TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for outputs
CREATE INDEX IF NOT EXISTS idx_outputs_response_id ON outputs(response_id);

-- RunWebhooks table (webhook delivery tracking)
CREATE TABLE IF NOT EXISTS run_webhooks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  run_id UUID REFERENCES runs(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'delivered', 'failed')),
  attempt_count INTEGER DEFAULT 0,
  last_attempted_at TIMESTAMPTZ,
  error_message TEXT,
  endpoint_url TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for run_webhooks
CREATE INDEX IF NOT EXISTS idx_run_webhooks_run_id ON run_webhooks(run_id);
CREATE INDEX IF NOT EXISTS idx_run_webhooks_status ON run_webhooks(status);

-- Sessions table (user authentication)
CREATE TABLE IF NOT EXISTS sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for sessions
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_flows_updated_at BEFORE UPDATE ON flows FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_prompts_updated_at BEFORE UPDATE ON prompts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_runs_updated_at BEFORE UPDATE ON runs FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_prompt_runs_updated_at BEFORE UPDATE ON prompt_runs FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_responses_updated_at BEFORE UPDATE ON responses FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_outputs_updated_at BEFORE UPDATE ON outputs FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_run_webhooks_updated_at BEFORE UPDATE ON run_webhooks FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_conversations_updated_at BEFORE UPDATE ON conversations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_sessions_updated_at BEFORE UPDATE ON sessions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security (RLS) policies
-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE flows ENABLE ROW LEVEL SECURITY;
ALTER TABLE prompts ENABLE ROW LEVEL SECURITY;
ALTER TABLE runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE prompt_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE outputs ENABLE ROW LEVEL SECURITY;
ALTER TABLE run_webhooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;

-- For now, allow all authenticated and anon access (configure based on your needs)
-- Flows policies
CREATE POLICY "Allow all access to flows" ON flows FOR ALL USING (true);
CREATE POLICY "Allow all access to prompts" ON prompts FOR ALL USING (true);
CREATE POLICY "Allow all access to runs" ON runs FOR ALL USING (true);
CREATE POLICY "Allow all access to prompt_runs" ON prompt_runs FOR ALL USING (true);
CREATE POLICY "Allow all access to responses" ON responses FOR ALL USING (true);
CREATE POLICY "Allow all access to outputs" ON outputs FOR ALL USING (true);
CREATE POLICY "Allow all access to run_webhooks" ON run_webhooks FOR ALL USING (true);
CREATE POLICY "Allow all access to conversations" ON conversations FOR ALL USING (true);

-- Create storage bucket for attachments
INSERT INTO storage.buckets (id, name, public) VALUES ('attachments', 'attachments', true) ON CONFLICT DO NOTHING;

-- Storage policy - allow public read access
CREATE POLICY "Public read access" ON storage.objects FOR SELECT USING (bucket_id = 'attachments');
CREATE POLICY "Authenticated upload access" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'attachments');
CREATE POLICY "Authenticated update access" ON storage.objects FOR UPDATE USING (bucket_id = 'attachments');
CREATE POLICY "Authenticated delete access" ON storage.objects FOR DELETE USING (bucket_id = 'attachments');

-- Seed some default flows for backwards compatibility
INSERT INTO flows (id, name, description) VALUES
  ('00000000-0000-0000-0000-000000000001', 'Default Image Upscale', 'Default image upscaling flow using Stability AI'),
  ('00000000-0000-0000-0000-000000000002', 'Background Replace & Relight', 'Replace background and apply relighting using Stability AI'),
  ('00000000-0000-0000-0000-000000000003', 'Image to Video', 'Convert image to video using Gemini Veo')
ON CONFLICT DO NOTHING;

-- Seed default prompts for the flows
INSERT INTO prompts (flow_id, endpoint_type, selected_provider, selected_model, system_prompt) VALUES
  ('00000000-0000-0000-0000-000000000001', 'ImageToImage', 'Stability', 'replace_background_and_relight', NULL),
  ('00000000-0000-0000-0000-000000000002', 'ImageToImage', 'Stability', 'replace_background_and_relight', NULL),
  ('00000000-0000-0000-0000-000000000003', 'ImageToVideo', 'Gemini', 'veo-3.0-generate-001', NULL)
ON CONFLICT DO NOTHING;

-- Function to get run URL
CREATE OR REPLACE FUNCTION get_run_url(run_id UUID)
RETURNS TEXT AS $$
BEGIN
  RETURN '/runs/' || run_id::text || '.json';
END;
$$ LANGUAGE plpgsql;
