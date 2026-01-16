# Conductor

AI-powered image processing platform built with Next.js and Supabase.

## Deployment

- **Hosting**: Vercel (owner-app org)
- **Production URL**: https://conductor-zeta.owner-preview.dev/
- **Database**: Supabase

## Authentication

Uses NextAuth.js with Google OAuth. Only @owner.com email addresses are allowed.

### Required Environment Variables

```bash
# NextAuth
AUTH_SECRET=<generate-random-32-char-string>

# Google OAuth
# Create at https://console.cloud.google.com/apis/credentials
GOOGLE_CLIENT_ID=<your-google-client-id>
GOOGLE_CLIENT_SECRET=<your-google-client-secret>

# Supabase
NEXT_PUBLIC_SUPABASE_URL=<supabase-url>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<supabase-anon-key>
SUPABASE_SERVICE_ROLE_KEY=<supabase-service-role-key>

# Database (Drizzle)
DATABASE_URL=<postgres-connection-string>

# AI Providers
OPENAI_API_KEY=<openai-key>
ANTHROPIC_API_KEY=<anthropic-key>
STABILITY_API_KEY=<stability-key>
GOOGLE_AI_API_KEY=<google-ai-key>
```

### Google OAuth Setup

1. Go to Google Cloud Console → APIs & Credentials
2. Create OAuth 2.0 credentials
3. Add authorized redirect URI: `https://conductor-zeta.owner-preview.dev/api/auth/callback/google`
4. For local development, also add: `http://localhost:3002/api/auth/callback/google`

## Development

```bash
npm install
npm run dev  # Runs on port 3002
```

## Database

Uses Drizzle ORM with Supabase PostgreSQL. **Migrations run automatically on deploy** as part of the build process.

```bash
# Run migrations locally
npm run db:migrate:local

# Run migrations (used in build, requires DATABASE_URL env var)
npm run db:migrate

# Open Drizzle Studio to view/edit data
npm run db:studio

# Generate migrations (creates SQL files in drizzle/migrations/)
npm run db:generate
```

### Adding Schema Changes

1. Update schema in `src/lib/db/schema.ts`
2. Create a new migration file in `drizzle/migrations/` (e.g., `0002_add_new_column.sql`)
3. Commit and push - migrations run automatically on Vercel deploy

Migration files are in `drizzle/migrations/` and run in alphabetical order.

## Architecture

- **Route Groups**:
  - `(app)` - Main app pages with sidebar (requires auth)
  - `(auth)` - Auth pages without sidebar
- **API Routes**: `/api/runs`, `/api/flows`, `/api/prompts`, `/api/upload`
- **Runners**: AI model integrations in `/src/lib/runners/`

## Features

- Flow-based image processing pipelines
- Multiple AI providers (OpenAI, Stability, Gemini)
- Background removal (Stability `remove-background`)
- Real-time run updates via Supabase Realtime
- Drag-and-drop image uploads
- Webhook notifications
