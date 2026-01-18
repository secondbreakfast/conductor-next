# Technical Design: Configurable Models

## Overview

This document describes the technical implementation for moving AI provider and model configuration from hardcoded TypeScript constants to a database-driven system with an admin UI. The feature enables administrators to manage models, set default parameters, configure pricing, and control availability without code changes.

## Requirements Reference

See [/docs/specs/configurable-models.md](/docs/specs/configurable-models.md) for full functional specification.

Key requirements summary:
- FR-1: Provider management (name, slug, enabled, display_order)
- FR-2: Model management (model_id, endpoint_types[], enabled, display_order)
- FR-3: Default parameters per model (temperature, max_tokens, etc.)
- FR-4: Token pricing per model (input/output per 1K tokens)
- FR-5: Admin UI at /settings/models
- FR-6: Model selection in prompts uses database instead of constants
- FR-7: API endpoints for CRUD operations
- FR-8: Seed migration with current hardcoded models

## Architecture

### High-Level Design

```
+------------------------------------------------------------------+
|                          UI Layer                                  |
|  +------------------+  +--------------------+  +----------------+  |
|  | /settings/models |  | prompt-card.tsx    |  | new-prompt-    |  |
|  | (admin CRUD)     |  | (model selection)  |  | dialog.tsx     |  |
|  +--------+---------+  +---------+----------+  +-------+--------+  |
+-----------|-----------------------|--------------------|-----------+
            |                       |                    |
            v                       v                    v
+------------------------------------------------------------------+
|                          API Layer                                 |
|  +------------------------+  +----------------------------------+  |
|  | /api/settings/providers|  | /api/models                      |  |
|  | /api/settings/models   |  | (public read for prompt forms)   |  |
|  | (admin CRUD)           |  +----------------------------------+  |
|  +------------------------+                                        |
+------------------------------------------------------------------+
            |                       |
            v                       v
+------------------------------------------------------------------+
|                       Database Layer                               |
|  +------------------+       +------------------+                   |
|  | providers        |<------| models           |                   |
|  | - id, name, slug |  FK   | - id, model_id   |                   |
|  | - enabled        |       | - endpoint_types |                   |
|  | - display_order  |       | - defaults, price|                   |
|  +------------------+       +------------------+                   |
+------------------------------------------------------------------+
```

### Data Flow

1. **Admin Configuration**: Admin uses `/settings/models` to manage providers and models
2. **Model Selection**: Prompt forms fetch enabled models from `/api/models` filtered by endpoint_type
3. **Prompt Saving**: Selected model stored as `selected_model` (TEXT) - no FK constraint
4. **Run Execution**: Runners use model ID directly, pricing looked up from database
5. **Cost Display**: Run detail page queries model pricing for cost calculation

## Database Design

### Schema Overview

Two new tables: `providers` and `models` with a one-to-many relationship.

### Table: providers

```sql
CREATE TABLE providers (
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
```

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| name | TEXT | Display name (e.g., "OpenAI") |
| slug | TEXT | API identifier (e.g., "openai") |
| enabled | BOOLEAN | Whether provider is active |
| display_order | INTEGER | Sort order in UI (ascending) |

### Table: models

```sql
CREATE TABLE models (
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

-- RLS policies (matching existing permissive pattern)
ALTER TABLE providers ENABLE ROW LEVEL SECURITY;
ALTER TABLE models ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to providers" ON providers FOR ALL USING (true);
CREATE POLICY "Allow all access to models" ON models FOR ALL USING (true);

-- Updated_at triggers
CREATE TRIGGER update_providers_updated_at BEFORE UPDATE ON providers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_models_updated_at BEFORE UPDATE ON models FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| provider_id | UUID | FK to providers |
| name | TEXT | Display name (e.g., "GPT-4.1") |
| model_id | TEXT | API model identifier (e.g., "gpt-4.1") |
| endpoint_types | TEXT[] | Array of supported types: 'Chat', 'ImageToImage', etc. |
| enabled | BOOLEAN | Whether model is selectable |
| display_order | INTEGER | Sort order within provider |
| default_params | JSONB | Default parameters (temperature, max_tokens, etc.) |
| input_price | DECIMAL | Cost per 1K input tokens (USD) |
| output_price | DECIMAL | Cost per 1K output tokens (USD) |

### Default Parameters Schema

The `default_params` JSONB field supports the following structure:

```typescript
interface ModelDefaultParams {
  temperature?: number;      // 0.0 - 2.0
  max_tokens?: number;       // e.g., 4096
  top_p?: number;            // 0.0 - 1.0
  frequency_penalty?: number; // -2.0 - 2.0
  presence_penalty?: number;  // -2.0 - 2.0
  size?: string;             // e.g., "1024x1024" for image models
  quality?: string;          // e.g., "hd", "standard"
  style?: string;            // e.g., "vivid", "natural"
}
```

### Migration Strategy

The migration seeds all currently hardcoded models. Existing prompts continue working because `selected_model` is stored as TEXT without a FK constraint.

```sql
-- Example seed data (from CHAT_MODELS, IMAGE_MODELS, VIDEO_MODELS in database.ts)
INSERT INTO providers (name, slug, display_order) VALUES
  ('OpenAI', 'openai', 10),
  ('Anthropic', 'anthropic', 20),
  ('Gemini', 'gemini', 30),
  ('Stability', 'stability', 40),
  ('Rails', 'rails', 50)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO models (provider_id, name, model_id, endpoint_types, input_price, output_price, display_order)
SELECT
  p.id,
  'GPT-4.1',
  'gpt-4.1',
  ARRAY['Chat'],
  0.002,
  0.008,
  10
FROM providers p WHERE p.slug = 'openai'
ON CONFLICT (provider_id, model_id) DO NOTHING;
-- ... additional models
```

## API Design

### Admin Endpoints (under /api/settings/)

These endpoints are for admin configuration. All require authentication.

#### GET /api/settings/providers

List all providers with model counts.

**Response** (200):
```typescript
{
  providers: Array<{
    id: string;
    name: string;
    slug: string;
    enabled: boolean;
    display_order: number;
    models_count: number;
    enabled_models_count: number;
    created_at: string;
    updated_at: string;
  }>;
}
```

#### POST /api/settings/providers

Create a new provider.

**Request**:
```typescript
{
  provider: {
    name: string;
    slug: string;
    enabled?: boolean;      // default: true
    display_order?: number; // default: 0
  }
}
```

**Response** (201): Created provider object

**Errors**:
- 400: Missing name or slug, duplicate slug

#### PATCH /api/settings/providers/{id}

Update a provider.

**Request**:
```typescript
{
  provider: {
    name?: string;
    slug?: string;
    enabled?: boolean;
    display_order?: number;
  }
}
```

**Allowed fields**: `name`, `slug`, `enabled`, `display_order`

**Response** (200): Updated provider object

#### DELETE /api/settings/providers/{id}

Delete a provider and cascade to all its models.

**Response** (200): `{ success: true }`

**Note**: Returns 400 if provider has models in use by prompts (optional safeguard).

#### GET /api/settings/models

List all models with filtering.

**Query Parameters**:
- `provider_id`: Filter by provider UUID
- `endpoint_type`: Filter by supported endpoint type
- `enabled`: Filter by enabled status (true/false)

**Response** (200):
```typescript
{
  models: Array<{
    id: string;
    provider_id: string;
    provider: { id: string; name: string; slug: string };
    name: string;
    model_id: string;
    endpoint_types: string[];
    enabled: boolean;
    display_order: number;
    default_params: Record<string, unknown>;
    input_price: number | null;
    output_price: number | null;
    created_at: string;
    updated_at: string;
  }>;
}
```

#### POST /api/settings/models

Create a new model.

**Request**:
```typescript
{
  model: {
    provider_id: string;
    name: string;
    model_id: string;
    endpoint_types: string[];  // ['Chat', 'ImageToImage', etc.]
    enabled?: boolean;
    display_order?: number;
    default_params?: Record<string, unknown>;
    input_price?: number;
    output_price?: number;
  }
}
```

**Response** (201): Created model object

**Errors**:
- 400: Missing required fields, invalid provider_id, duplicate model_id for provider

#### PATCH /api/settings/models/{id}

Update a model.

**Request**:
```typescript
{
  model: {
    name?: string;
    model_id?: string;
    endpoint_types?: string[];
    enabled?: boolean;
    display_order?: number;
    default_params?: Record<string, unknown>;
    input_price?: number | null;
    output_price?: number | null;
  }
}
```

**Allowed fields**: All model fields except `provider_id`

**Response** (200): Updated model object

#### DELETE /api/settings/models/{id}

Delete a model.

**Response** (200): `{ success: true, prompts_affected: number }`

Returns count of prompts using this model (they continue to work but show warning).

### Public Endpoints

These endpoints are for prompt forms to fetch available models.

#### GET /api/models

List enabled models for selection. This is the endpoint used by prompt forms.

**Query Parameters**:
- `endpoint_type`: Required. Filter by endpoint type ('Chat', 'ImageToImage', etc.)

**Response** (200):
```typescript
{
  models: Array<{
    id: string;
    provider: {
      id: string;
      name: string;
      slug: string;
    };
    name: string;
    model_id: string;
    default_params: Record<string, unknown>;
  }>;
}
```

Only returns enabled models from enabled providers, sorted by provider.display_order, then model.display_order.

**Response Headers**:
- `Cache-Control: public, max-age=60` (NFR-1: 60-second client cache)

## TypeScript Types

### New Interfaces

Add to `/src/types/database.ts`:

```typescript
export interface Provider {
  id: string;
  name: string;
  slug: string;
  enabled: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
  models?: Model[];
  models_count?: number;
}

export interface Model {
  id: string;
  provider_id: string;
  provider?: Provider;
  name: string;
  model_id: string;
  endpoint_types: EndpointType[];
  enabled: boolean;
  display_order: number;
  default_params: ModelDefaultParams;
  input_price: number | null;
  output_price: number | null;
  created_at: string;
  updated_at: string;
}

export interface ModelDefaultParams {
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  frequency_penalty?: number;
  presence_penalty?: number;
  size?: string;
  quality?: string;
  style?: string;
  [key: string]: unknown;
}

export interface ModelOption {
  id: string;
  provider: { id: string; name: string; slug: string };
  name: string;
  model_id: string;
  default_params: ModelDefaultParams;
}
```

### Deprecation of Constants

Mark existing constants as deprecated but keep for backward compatibility during transition:

```typescript
/**
 * @deprecated Use database-driven models via /api/models endpoint.
 * These constants remain for backward compatibility during transition.
 */
export const CHAT_MODELS = { ... } as const;

/**
 * @deprecated Use database-driven token pricing via Model.input_price/output_price.
 */
export const TOKEN_PRICING: Record<string, { input: number; output: number }> = { ... };
```

## UI Architecture

### Settings Models Page

New page at `/src/app/(app)/settings/models/page.tsx`.

**Layout**:
```
+------------------------------------------+
| Settings > Models                    [+] |
+------------------------------------------+
| Providers                                |
| +--------------------------------------+ |
| | [x] OpenAI                    [Edit] | |
| |     - gpt-4.1         [x] [Edit][Del]| |
| |     - gpt-4.1-mini    [x] [Edit][Del]| |
| +--------------------------------------+ |
| | [x] Anthropic                 [Edit] | |
| |     - claude-3-7      [x] [Edit][Del]| |
| +--------------------------------------+ |
| | [ ] Stability (disabled)      [Edit] | |
| |     - remove-bg       [ ] [Edit][Del]| |
| +--------------------------------------+ |
+------------------------------------------+
```

**Components**:
1. `ProvidersAccordion` - Expandable list of providers
2. `ProviderRow` - Provider name, enabled toggle, edit button
3. `ModelRow` - Model details, enabled toggle, edit/delete buttons
4. `ProviderDialog` - Create/edit provider modal
5. `ModelDialog` - Create/edit model modal with default params and pricing

**Data Fetching**:
- Server component fetches providers with models
- Mutations via fetch() to API endpoints
- Page reload after mutations (consistent with existing pattern in settings page)

### Model Selection in Prompts

Update `prompt-card.tsx` and `new-prompt-dialog.tsx` to fetch models from API.

**Changes**:
1. Replace hardcoded `CHAT_MODELS`, `IMAGE_MODELS`, `VIDEO_MODELS` imports with API call
2. Use React state/context to cache model list (SWR or simple useState with useEffect)
3. Filter models by selected endpoint_type
4. Group by provider in dropdown

**New Hook** (`/src/hooks/use-models.ts`):

```typescript
import useSWR from 'swr';

interface UseModelsOptions {
  endpointType: EndpointType;
}

export function useModels({ endpointType }: UseModelsOptions) {
  const { data, error, isLoading } = useSWR(
    `/api/models?endpoint_type=${endpointType}`,
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 60000 }
  );

  return {
    models: data?.models ?? [],
    isLoading,
    error,
  };
}
```

**Model Selection UI Pattern**:

Option 1: Single dropdown with grouped options
```
[Select model...]
  OpenAI
    gpt-4.1
    gpt-4.1-mini
  Anthropic
    claude-3-7-sonnet
```

Option 2: Two dropdowns (provider first, then model)
```
Provider: [OpenAI ▼]
Model:    [gpt-4.1 ▼]
```

**Recommended**: Option 2 (two dropdowns) - matches current UI pattern and is easier to implement.

### Warning States

1. **Disabled model in use**: When editing a prompt that uses a disabled model, show amber warning badge
2. **Missing API key**: Show warning icon next to provider if env var not configured
3. **Orphaned model**: When a model_id in prompt doesn't match any database model, show info badge

## Implementation Approach

### Phase 1: Database and Types

1. Create migration file `supabase/migrations/YYYYMMDDHHMMSS_add_configurable_models.sql`
   - Create `providers` and `models` tables
   - Add indexes and constraints
   - Seed with current hardcoded models and pricing
   - Add updated_at triggers

2. Update TypeScript types in `/src/types/database.ts`
   - Add `Provider`, `Model`, `ModelDefaultParams`, `ModelOption` interfaces
   - Mark existing constants as deprecated

### Phase 2: Admin API

1. Create `/src/app/api/settings/providers/route.ts` (GET, POST)
2. Create `/src/app/api/settings/providers/[id]/route.ts` (GET, PATCH, DELETE)
3. Create `/src/app/api/settings/models/route.ts` (GET, POST)
4. Create `/src/app/api/settings/models/[id]/route.ts` (GET, PATCH, DELETE)

Follow existing patterns from `/src/app/api/flows/route.ts`:
- CORS headers
- Service client for database access
- Allowlist for PATCH fields
- Consistent error responses

### Phase 3: Public API

1. Create `/src/app/api/models/route.ts` (GET only)
   - Filter by endpoint_type (required)
   - Return only enabled models from enabled providers
   - Include provider info for grouping
   - Set cache headers

### Phase 4: Settings UI

1. Create `/src/app/(app)/settings/models/page.tsx`
2. Create components:
   - `/src/components/settings/providers-list.tsx`
   - `/src/components/settings/provider-dialog.tsx`
   - `/src/components/settings/model-dialog.tsx`
3. Add navigation link in sidebar or settings page

### Phase 5: Prompt Form Integration

1. Create `/src/hooks/use-models.ts` hook
2. Update `/src/components/flows/prompt-card.tsx`:
   - Replace constant imports with useModels hook
   - Update getModelsForEndpoint() and getProvidersForEndpoint()
   - Add disabled model warning
3. Update `/src/components/flows/new-prompt-dialog.tsx`:
   - Same changes as prompt-card

### Phase 6: Cost Calculation Update

1. Update `/src/components/runs/run-detail.tsx`:
   - Fetch model pricing from database instead of TOKEN_PRICING constant
   - Handle missing pricing gracefully (show "N/A")
2. Update `/src/app/(app)/analytics/page.tsx`:
   - Same pricing lookup changes

## Technical Decisions

### Decision 1: Model Reference Strategy

**Options Considered**:

1. **Foreign Key to models.id (UUID)**
   - Pros: Referential integrity, easy joins
   - Cons: Breaking change if model deleted, migration required for existing prompts

2. **Store model_id as TEXT (current approach)**
   - Pros: No FK constraint, existing prompts work unchanged, models can be deleted
   - Cons: No referential integrity, orphaned references possible

**Chosen**: Option 2 - Store model_id as TEXT

**Rationale**: Matches FR-8.2 requirement that existing prompts continue working. Orphaned references are acceptable (show warning, still execute with stored model_id).

### Decision 2: Endpoint Types Storage

**Options Considered**:

1. **Junction table (model_endpoint_types)**
   - Pros: Normalized, easy to query single type
   - Cons: Extra table, more complex inserts

2. **PostgreSQL TEXT[] array**
   - Pros: Simple schema, native GIN index support
   - Cons: Slightly harder to query in some ORMs

**Chosen**: Option 2 - TEXT[] array with GIN index

**Rationale**: Supabase client handles arrays well. GIN index enables efficient `@>` (contains) queries. Simpler schema reduces complexity.

### Decision 3: Admin UI Location

**Options Considered**:

1. **New page at /settings/models**
   - Pros: Clear navigation, dedicated space
   - Cons: Another settings sub-page

2. **Section within existing /settings page**
   - Pros: All settings in one place
   - Cons: Page becomes long, mixes concerns

**Chosen**: Option 1 - New page at /settings/models

**Rationale**: Models configuration is complex enough to warrant its own page. Existing settings page focuses on environment variables and webhooks. The sidebar already links to /settings; users can navigate to /settings/models from there.

### Decision 4: Model Selection Component

**Options Considered**:

1. **Single combined dropdown**
   - Pros: Fewer clicks
   - Cons: Long list, harder to scan

2. **Two cascading dropdowns (Provider, then Model)**
   - Pros: Matches current UI pattern, familiar to users
   - Cons: Two selections required

**Chosen**: Option 2 - Two cascading dropdowns

**Rationale**: Matches existing pattern in prompt-card.tsx (lines 222-266). Users are already familiar with Provider/Model selection flow.

## Security Considerations

1. **Authentication**: All admin endpoints require authentication (existing NextAuth middleware)
2. **Input Validation**: Validate model_id format, endpoint_types array values, price ranges
3. **SQL Injection**: Using Supabase client with parameterized queries (existing pattern)
4. **XSS Prevention**: React escapes output by default; no raw HTML insertion

## Performance Considerations

1. **Model List Caching**: 60-second client-side cache via Cache-Control header (NFR-1)
2. **Indexes**: GIN index on endpoint_types for efficient filtering, indexes on enabled and display_order
3. **Query Efficiency**: Admin endpoints use single query with join for providers + model counts
4. **Deduplication**: SWR hook deduplicates concurrent requests

## Testing Strategy

### Unit Tests

1. **API Validation**:
   - Valid/invalid model_id formats
   - Endpoint types array validation
   - Price range validation (non-negative)

### Integration Tests

1. **Provider CRUD**:
   - Create provider with valid/invalid data
   - Update provider enabled status
   - Delete provider cascades to models

2. **Model CRUD**:
   - Create model with endpoint types
   - Update default params
   - Delete model and check prompts_affected count

3. **Model Selection**:
   - GET /api/models returns only enabled models from enabled providers
   - Filter by endpoint_type works correctly
   - Sort order matches display_order

### Manual Testing Checklist

1. Create new provider and model via admin UI
2. Disable a model and verify it disappears from prompt dropdowns
3. Edit a prompt using a disabled model - warning appears
4. Run a flow with a disabled model - executes successfully
5. View run detail - cost displays correctly from database pricing

## Migration Plan

### Pre-Migration

1. Deploy API endpoints (no UI changes yet)
2. Run migration to create tables and seed data
3. Verify seeded data matches hardcoded constants

### Migration

1. Deploy settings/models UI
2. Deploy updated prompt forms (using API instead of constants)
3. Keep deprecated constants in codebase

### Post-Migration

1. Monitor for issues with model selection
2. Verify cost calculations match previous behavior
3. After 2 weeks stable, remove deprecated constants (optional, low priority)

## File Changes Summary

| File | Action | Description |
|------|--------|-------------|
| `supabase/migrations/YYYYMMDDHHMMSS_add_configurable_models.sql` | Create | Providers and models tables with seed data |
| `/src/types/database.ts` | Modify | Add Provider, Model interfaces; deprecate constants |
| `/src/app/api/settings/providers/route.ts` | Create | GET, POST for providers |
| `/src/app/api/settings/providers/[id]/route.ts` | Create | GET, PATCH, DELETE for provider |
| `/src/app/api/settings/models/route.ts` | Create | GET, POST for models (admin) |
| `/src/app/api/settings/models/[id]/route.ts` | Create | GET, PATCH, DELETE for model |
| `/src/app/api/models/route.ts` | Create | GET for model selection (public) |
| `/src/app/(app)/settings/models/page.tsx` | Create | Admin UI page |
| `/src/components/settings/providers-list.tsx` | Create | Provider accordion component |
| `/src/components/settings/provider-dialog.tsx` | Create | Provider create/edit dialog |
| `/src/components/settings/model-dialog.tsx` | Create | Model create/edit dialog |
| `/src/hooks/use-models.ts` | Create | Hook for fetching models |
| `/src/components/flows/prompt-card.tsx` | Modify | Use useModels hook instead of constants |
| `/src/components/flows/new-prompt-dialog.tsx` | Modify | Use useModels hook instead of constants |
| `/src/components/runs/run-detail.tsx` | Modify | Fetch pricing from database |
| `/src/app/(app)/analytics/page.tsx` | Modify | Fetch pricing from database |

## Rollback Plan

### Database Rollback

If critical issues are found:
```sql
DROP TABLE IF EXISTS models;
DROP TABLE IF EXISTS providers;
```

### Code Rollback

The deprecated constants in `/src/types/database.ts` remain functional. If the database-driven approach has issues:
1. Revert prompt-card.tsx and new-prompt-dialog.tsx to use constants
2. Keep database tables but don't use them
3. Fix issues and redeploy

### Feature Flag (Optional)

For gradual rollout, add environment variable:
```
USE_DATABASE_MODELS=true
```

The `useModels` hook can fall back to constants when this is false.

## Architecture Review Findings

The following issues were identified in architecture review and have been addressed:

### Addressed in Design
1. ✅ Added composite index `idx_models_enabled_provider_order` for public API queries
2. ✅ Added CHECK constraint for valid endpoint_types
3. ✅ Added RLS policies for providers and models tables
4. ✅ Added updated_at triggers
5. ✅ Added rollback plan

### Implementation Notes
6. **FR-6.5 Default Params**: When a model is selected in prompt forms, the `default_params` from `ModelOption` should spread into form state. Example:
   ```typescript
   const handleModelSelect = (model: ModelOption) => {
     setFormData(prev => ({
       ...prev,
       selected_model: model.model_id,
       ...model.default_params  // spread defaults into form
     }));
   };
   ```

7. **API Response Format**: Return arrays directly (not wrapped in objects) to match existing patterns in flows/prompts APIs.

8. **Data Fetching**: Use simple `fetch()` with `useState`/`useEffect` pattern to match existing codebase. Consider SWR as future enhancement.

9. **Empty States**: Handle gracefully:
   - No enabled providers for endpoint type → Show message "No models available"
   - Provider has no enabled models → Hide provider from dropdown

## Resolved Questions

1. **API Key Validation**: Show warning badge only, do not block. Users may configure keys after enabling models.

2. **Model Version Tracking**: Out of scope. If model_id changes, create new model record and disable old one.

3. **Bulk Operations**: Defer to v2. MVP uses manual display_order number input.
