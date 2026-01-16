# Conductor (Next.js)

AI-powered image upscaling and processing platform. This is a modern rebuild of the original Rails Conductor app using Next.js, Supabase, Tailwind CSS, and shadcn/ui.

## Features

- **Runs Management**: Create, view, and track image/video processing runs
- **Flows**: Define multi-step workflows with different AI providers
- **Prompts**: Configure prompts for each step (Chat, ImageToImage, ImageToVideo)
- **Multi-Provider Support**: OpenAI, Anthropic, Gemini, Stability AI
- **Cost Tracking**: Monitor token usage and estimated costs
- **Webhooks**: Receive status updates when runs complete
- **Analytics**: View usage statistics and trends

## API Compatibility

This app maintains backwards compatibility with the original Rails API:

### Create a Run

```bash
POST /api/runs
# or /api/runs.json

{
  "run": {
    "flow_id": "uuid-or-legacy-id",
    "attachment_urls": ["https://example.com/image.jpg"],
    "variables": {},
    "webhook_url": "https://your-server.com/webhook"
  }
}
```

The first attachment is used as the primary input image for image processing flows.

### Get a Run

```bash
GET /api/runs/{id}
# or /api/runs/{id}.json
```

### Response Format

```json
{
  "id": "uuid",
  "flow_id": "uuid",
  "status": "pending | completed | failed | timed-out",
  "started_at": "2025-01-01T00:00:00.000Z",
  "completed_at": "2025-01-01T00:00:01.000Z",
  "created_at": "2025-01-01T00:00:00.000Z",
  "updated_at": "2025-01-01T00:00:01.000Z",
  "data": {
    "image_url": "https://your-storage.com/output.webp"
  },
  "url": "/api/runs/{id}.json"
}
```

### Legacy Flow IDs

For backwards compatibility, numeric flow IDs are mapped:
- `1` → Default Image Upscale
- `2` → Background Replace & Relight
- `3` → Image to Video

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Set Up Supabase

1. Create a new project at [supabase.com](https://supabase.com)
2. Run the schema in `supabase/schema.sql` via the SQL Editor
3. Copy your project URL and keys from Settings > API

### 3. Configure Environment Variables

Copy `.env.local.example` to `.env.local` and fill in:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# AI Providers
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
GEMINI_API_KEY=...
STABILITY_API_KEY=sk-...

# Google Cloud (for video generation)
GOOGLE_CLOUD_PROJECT_ID=your-project-id
```

### 4. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

### 5. Deploy

Deploy to Vercel, Railway, or any platform that supports Next.js:

```bash
# Vercel
vercel deploy

# Or build for production
npm run build
npm start
```

## Supported AI Providers

### Chat Models
- **OpenAI**: gpt-4.1, gpt-4o, gpt-4o-mini
- **Anthropic**: claude-3-5-sonnet, claude-3-7-sonnet
- **Gemini**: gemini-2.5-pro, gemini-2.5-flash

### Image Models
- **OpenAI**: dall-e-3, gpt-image-1
- **Gemini**: gemini-2.5-flash-image-preview
- **Stability**: replace_background_and_relight

### Video Models
- **Gemini**: veo-3.0-generate-001

## Project Structure

```
conductor-next/
├── src/
│   ├── app/                    # Next.js App Router pages
│   │   ├── api/               # API routes
│   │   ├── runs/              # Runs pages
│   │   ├── flows/             # Flows pages
│   │   └── ...
│   ├── components/            # React components
│   │   ├── ui/               # shadcn/ui components
│   │   ├── layout/           # Layout components
│   │   ├── runs/             # Run-specific components
│   │   └── flows/            # Flow-specific components
│   ├── lib/                   # Utilities
│   │   ├── supabase/         # Supabase clients
│   │   └── runners/          # AI provider implementations
│   └── types/                 # TypeScript types
└── supabase/
    └── schema.sql            # Database schema
```

## Development

```bash
# Run dev server with Turbopack
npm run dev

# Build for production
npm run build

# Run production build
npm start

# Lint
npm run lint
```

## Migration from Rails

The database schema is designed to be similar to the Rails version. Key differences:
- Uses Supabase (PostgreSQL) instead of Rails Active Record
- File storage uses Supabase Storage instead of Active Storage
- Background jobs use fetch-based async execution instead of SolidQueue

## License

MIT
