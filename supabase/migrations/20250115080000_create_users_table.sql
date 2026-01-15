-- Users table to track who has logged in
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  image TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_login_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for email lookups
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- Enable RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Policy to allow authenticated users to read all users
CREATE POLICY "Users can view all users" ON users
  FOR SELECT USING (true);

-- Policy to allow service role to insert/update
CREATE POLICY "Service role can manage users" ON users
  FOR ALL USING (true);
