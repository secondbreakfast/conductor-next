import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

// POST /api/setup - Initialize database tables
export async function POST() {
  const supabase = createServiceClient();

  // Check if users table exists by trying to query it
  const { error: checkError } = await supabase
    .from('users')
    .select('id')
    .limit(1);

  if (checkError?.code === '42P01') {
    // Table doesn't exist - we need to create it
    // Unfortunately supabase-js doesn't support DDL, so we'll use a workaround
    // by calling a database function or using the SQL editor

    return NextResponse.json({
      success: false,
      message: 'Users table does not exist. Please run the migration.',
      migration: `
-- Run this in Supabase Dashboard > SQL Editor:

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  image TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_login_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view all users" ON users FOR SELECT USING (true);
CREATE POLICY "Service role can manage users" ON users FOR ALL USING (true);
      `.trim(),
    }, { status: 428 }); // 428 Precondition Required
  }

  if (checkError) {
    return NextResponse.json({
      success: false,
      error: checkError.message,
    }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    message: 'Database is properly configured',
  });
}

// GET /api/setup - Check database status
export async function GET() {
  const supabase = createServiceClient();

  const checks = {
    users: false,
    flows: false,
    runs: false,
    prompts: false,
  };

  // Check each table
  for (const table of Object.keys(checks) as (keyof typeof checks)[]) {
    const { error } = await supabase.from(table).select('id').limit(1);
    checks[table] = !error || error.code !== '42P01';
  }

  const allGood = Object.values(checks).every(Boolean);

  return NextResponse.json({
    success: allGood,
    tables: checks,
  });
}
