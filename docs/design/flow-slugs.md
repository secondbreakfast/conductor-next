# Technical Design: Flow Slugs

## Overview

This document describes the technical implementation for adding human-readable slugs to flows in Conductor. Slugs provide memorable, URL-friendly identifiers that can be used in place of UUIDs for API calls and UI navigation.

## Requirements Reference

See [/docs/specs/flow-slugs.md](/docs/specs/flow-slugs.md) for full functional specification.

Key requirements summary:
- Slug format: lowercase alphanumeric with hyphens, 3-50 chars
- Optional field (nullable), globally unique when set, case-insensitive
- UI pre-generates from flow name (user can modify or clear)
- Reserved slugs: `new`, `edit`, `api`, `settings`
- Support lookup by both UUID and slug
- No migration needed: existing flows work without slugs

## Architecture

### High-Level Design

```
┌─────────────────────────────────────────────────────────────────┐
│                         UI Layer                                 │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │ /flows/new  │  │ /flows/[id] │  │ flows-grid.tsx          │  │
│  │ (slug input)│  │ (slug edit) │  │ (slug-based links)      │  │
│  └──────┬──────┘  └──────┬──────┘  └───────────┬─────────────┘  │
└─────────┼────────────────┼─────────────────────┼────────────────┘
          │                │                     │
          ▼                ▼                     ▼
┌─────────────────────────────────────────────────────────────────┐
│                        API Layer                                 │
│  ┌─────────────────┐  ┌──────────────────┐  ┌────────────────┐  │
│  │ POST /api/flows │  │ GET/PUT/DELETE   │  │ POST /api/runs │  │
│  │ (validate+gen)  │  │ /api/flows/[id]  │  │ (resolve slug) │  │
│  └────────┬────────┘  └────────┬─────────┘  └───────┬────────┘  │
└───────────┼────────────────────┼────────────────────┼───────────┘
            │                    │                    │
            ▼                    ▼                    ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Utility Layer                               │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ /src/lib/slug.ts                                            ││
│  │ - generateSlug(name)    - isReservedSlug(slug)              ││
│  │ - validateSlug(slug)    - resolveFlowIdentifier(id)         ││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
            │
            ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Database Layer                              │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ flows table                                                  ││
│  │ + slug TEXT UNIQUE (nullable)                                ││
│  │ + idx_flows_slug_lower (for case-insensitive lookup)         ││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
```

### Data Model

#### Schema Changes

Add `slug` column to the `flows` table:

```sql
-- New nullable column (VARCHAR matches the 50-char max length requirement)
ALTER TABLE flows ADD COLUMN slug VARCHAR(50);

-- Unique constraint (case-insensitive via index, nulls allowed)
CREATE UNIQUE INDEX idx_flows_slug_lower ON flows (LOWER(slug)) WHERE slug IS NOT NULL;
```

#### Updated Flow Entity

```typescript
// /src/types/database.ts
export interface Flow {
  id: string;
  slug: string | null;  // NEW - nullable
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
  prompts?: Prompt[];
  runs_count?: number;
}
```

## Technical Decisions

### Decision 1: Slug Generation Package

**Options Considered**:

1. **slugify** (npm: `slugify`)
   - Pros: Lightweight (1.5KB), well-maintained (2M+ weekly downloads), simple API, handles unicode/transliteration
   - Cons: Does not enforce min length or handle uniqueness suffix
   - Customizable via options: `{ lower: true, strict: true }`

2. **url-slug** (npm: `url-slug`)
   - Pros: Similar to slugify, handles transliteration
   - Cons: Less popular, similar feature set

3. **Custom implementation**
   - Pros: Exact control over format
   - Cons: Violates NFR-4 (prefer standard packages), more code to maintain

**Chosen**: `slugify`

**Rationale**:
- Aligns with NFR-4 requirement to prefer standard packages
- Most popular package with active maintenance
- The `strict: true` option removes special characters, which aligns with FR-1.1
- Built-in lowercase conversion with `lower: true`
- We only need thin wrapper logic for: min length enforcement, reserved slug check, and uniqueness suffix

**Package Installation**:
```bash
npm install slugify
npm install --save-dev @types/slugify  # Note: may not be needed, check if types bundled
```

### Decision 2: Uniqueness Suffix Strategy

**Options Considered**:

1. **Numeric suffix** (`-1`, `-2`, `-3`)
   - Pros: Simple, predictable
   - Cons: Requires query to find next available number

2. **Random suffix** (`-a3x9`, `-7kp2`)
   - Pros: No query needed, low collision probability
   - Cons: Less readable

3. **Timestamp suffix** (`-1705329600`)
   - Pros: Unique, sortable
   - Cons: Long, ugly

**Chosen**: Numeric suffix (matching FR-3.3)

**Rationale**: Spec explicitly mentions `-1, -2, etc.` format. The extra query is acceptable given flow creation is infrequent.

### Decision 3: Identifier Resolution Strategy

**Options Considered**:

1. **Try UUID first, then slug**
   - Check if identifier matches UUID format (regex)
   - If UUID format, query by `id`; otherwise query by `slug`
   - Pros: Single query, deterministic
   - Cons: Valid slugs that look like UUIDs would fail (edge case)

2. **Query both simultaneously**
   - Use `OR` clause: `WHERE id = $1 OR slug = $1`
   - Pros: Always finds if exists
   - Cons: Slightly less efficient, potential edge case if UUID and slug somehow match

3. **Separate endpoints**
   - `/api/flows/by-id/:uuid` and `/api/flows/by-slug/:slug`
   - Pros: Explicit
   - Cons: More endpoints, less ergonomic

**Chosen**: Try UUID first, then slug

**Rationale**:
- UUID format is unambiguous (`xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`)
- Slugs cannot match UUID format due to format restrictions (hyphens pattern differs)
- Single query path, simple logic

**Resolution Logic**:
```typescript
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUUID(str: string): boolean {
  return UUID_REGEX.test(str);
}
```

## API Design

### Updated Endpoints

#### POST /api/flows (Create Flow)

**Request**:
```typescript
{
  flow: {
    name: string;        // required
    description?: string;
    slug?: string;       // optional, auto-generated if not provided
  }
}
```

**Response** (201):
```typescript
{
  id: string;
  slug: string;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}
```

**Errors**:
- `400`: Invalid slug format, reserved slug, or slug already exists
- `400`: Missing flow name

**Validation Flow**:
1. If slug provided:
   - Validate format (FR-1)
   - Check not reserved (FR-4)
   - Check uniqueness (FR-2)
2. If slug not provided:
   - Generate from name using `slugify`
   - Ensure uniqueness with numeric suffix if needed

#### GET /api/flows/[id] (Get Flow)

**Path Parameter**: `id` - UUID or slug

**Response** (200): Same as create response, plus prompts

**Errors**:
- `404`: Flow not found by UUID or slug

#### PUT/PATCH /api/flows/[id] (Update Flow)

**Path Parameter**: `id` - UUID or slug

**Request**:
```typescript
{
  flow: {
    name?: string;
    description?: string;
    slug?: string;  // NEW: can update slug
  }
}
```

**Response** (200): Updated flow object

**Errors**:
- `400`: Invalid slug format, reserved slug, or slug already exists
- `404`: Flow not found

#### DELETE /api/flows/[id] (Delete Flow)

**Path Parameter**: `id` - UUID or slug

No changes to request/response, just supports slug lookup.

#### POST /api/runs (Create Run)

**Request** (updated `flow_id` handling):
```typescript
{
  run: {
    flow_id: string | number;  // UUID, slug, or legacy numeric ID
    // ... other fields unchanged
  }
}
```

**Resolution Order**:
1. If numeric, use legacy ID map
2. If UUID format, query by `id`
3. Otherwise, query by `slug`

### Validation Schema (Zod)

```typescript
// /src/lib/slug.ts
import { z } from 'zod';

const RESERVED_SLUGS = ['new', 'edit'] as const;

export const slugSchema = z
  .string()
  .min(3, 'Slug must be at least 3 characters')
  .max(50, 'Slug must be at most 50 characters')
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    'Slug must contain only lowercase letters, numbers, and hyphens (no leading/trailing/consecutive hyphens)')
  .refine(
    (slug) => !RESERVED_SLUGS.includes(slug as typeof RESERVED_SLUGS[number]),
    { message: 'This slug is reserved and cannot be used' }
  );
```

## Service Layer

### New Module: `/src/lib/slug.ts`

```typescript
import slugify from 'slugify';
import { z } from 'zod';

const RESERVED_SLUGS = ['new', 'edit', 'api', 'settings'] as const;
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MIN_SLUG_LENGTH = 3;
const MAX_SLUG_LENGTH = 50;

// Zod schema for validation
export const slugSchema = z
  .string()
  .min(MIN_SLUG_LENGTH)
  .max(MAX_SLUG_LENGTH)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  .refine((slug) => !RESERVED_SLUGS.includes(slug as any), { message: 'This slug is reserved' })
  .refine((slug) => !UUID_REGEX.test(slug), { message: 'Slug cannot look like a UUID' });

// Generate slug from name
export function generateSlug(name: string): string {
  let slug = slugify(name, { lower: true, strict: true });

  // Ensure minimum length
  if (slug.length < MIN_SLUG_LENGTH) {
    const suffix = Math.random().toString(36).substring(2, 6);
    slug = slug ? `${slug}-${suffix}` : suffix;
  }

  // Truncate if too long
  if (slug.length > MAX_SLUG_LENGTH) {
    slug = slug.substring(0, MAX_SLUG_LENGTH).replace(/-+$/, '');
  }

  return slug;
}

// Validate slug format and reserved words
export function validateSlug(slug: string): { valid: boolean; error?: string } {
  const result = slugSchema.safeParse(slug);
  if (!result.success) {
    return { valid: false, error: result.error.issues[0].message };
  }
  return { valid: true };
}

// Check if string is a UUID
export function isUUID(str: string): boolean {
  return UUID_REGEX.test(str);
}

// Check if slug is reserved
export function isReservedSlug(slug: string): boolean {
  return RESERVED_SLUGS.includes(slug.toLowerCase() as any);
}

// Generate unique slug with numeric suffix
export async function generateUniqueSlug(
  baseSlug: string,
  checkExists: (slug: string) => Promise<boolean>
): Promise<string> {
  // Check if base slug is available
  if (!(await checkExists(baseSlug))) {
    return baseSlug;
  }

  // Try with numeric suffixes
  let suffix = 1;
  while (suffix < 1000) {
    const candidateSlug = `${baseSlug}-${suffix}`;
    if (candidateSlug.length > MAX_SLUG_LENGTH) {
      // Truncate base to make room for suffix
      const truncatedBase = baseSlug.substring(0, MAX_SLUG_LENGTH - suffix.toString().length - 1);
      const truncatedCandidate = `${truncatedBase}-${suffix}`;
      if (!(await checkExists(truncatedCandidate))) {
        return truncatedCandidate;
      }
    } else if (!(await checkExists(candidateSlug))) {
      return candidateSlug;
    }
    suffix++;
  }

  throw new Error('Unable to generate unique slug');
}
```

### Helper for Flow Resolution

```typescript
// /src/lib/slug.ts (additional export)

import { SupabaseClient } from '@supabase/supabase-js';

export async function resolveFlowByIdentifier(
  supabase: SupabaseClient,
  identifier: string
): Promise<{ id: string; slug: string } | null> {
  const isId = isUUID(identifier);
  const column = isId ? 'id' : 'slug';
  // Normalize slug to lowercase for case-insensitive lookup
  const normalizedIdentifier = isId ? identifier : identifier.toLowerCase();

  const { data, error } = await supabase
    .from('flows')
    .select('id, slug')
    .eq(column, normalizedIdentifier)
    .single();

  if (error || !data) {
    return null;
  }

  return data;
}
```

## Integration Points

### Files to Modify

| File | Changes |
|------|---------|
| `/supabase/migrations/YYYYMMDDHHMMSS_add_flow_slugs.sql` | New migration file |
| `/src/types/database.ts` | Add `slug` to `Flow` interface |
| `/src/lib/slug.ts` | New file with slug utilities |
| `/src/app/api/flows/route.ts` | Slug validation and generation on create |
| `/src/app/api/flows/[id]/route.ts` | Resolve by UUID or slug, validate slug updates |
| `/src/app/api/runs/route.ts` | Resolve `flow_id` by slug |
| `/src/app/(app)/flows/[id]/page.tsx` | Use `resolveFlowByIdentifier` |
| `/src/app/(app)/flows/new/page.tsx` | Add slug input field |
| `/src/components/flows/flow-detail.tsx` | Add slug editing with warning |
| `/src/components/flows/flows-grid.tsx` | Use slug in links |

### Existing Pattern Reference

The legacy numeric ID resolution in `/src/app/api/runs/route.ts` (lines 98-108) provides a pattern for backwards-compatible identifier resolution:

```typescript
// Existing pattern - extend this for slug support
let flowId = runData.flow_id;
if (typeof flowId === 'number') {
  const legacyFlowMap: Record<number, string> = { ... };
  flowId = legacyFlowMap[flowId] || flowId.toString();
}
// NEW: Add slug resolution here
if (typeof flowId === 'string' && !isUUID(flowId)) {
  const resolved = await resolveFlowByIdentifier(supabase, flowId);
  if (!resolved) {
    return NextResponse.json({ error: 'Flow not found' }, { status: 404 });
  }
  flowId = resolved.id;
}
```

## Database Migration

### Migration File: `supabase/migrations/YYYYMMDDHHMMSS_add_flow_slugs.sql`

```sql
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
```

Note: No data migration is needed. Existing flows will have `slug = NULL` and continue to work via UUID access. Slugs will be added when flows are created or edited going forward.

## UI Changes

### New Flow Page (`/src/app/(app)/flows/new/page.tsx`)

Add slug input field with pre-generation:

```tsx
// Additional state
const [slug, setSlug] = useState('');
const [slugTouched, setSlugTouched] = useState(false);
const [slugError, setSlugError] = useState('');

// Auto-generate slug as user types name (until they manually edit it)
useEffect(() => {
  if (!slugTouched && name) {
    setSlug(generateSlug(name));
  }
}, [name, slugTouched]);

// In the form
<div className="space-y-2">
  <Label htmlFor="slug">
    Slug
    <span className="text-muted-foreground ml-2 text-sm font-normal">
      (optional - leave empty to use UUID only)
    </span>
  </Label>
  <Input
    id="slug"
    value={slug}
    onChange={(e) => {
      setSlug(e.target.value.toLowerCase());
      setSlugTouched(true);
      setSlugError('');
    }}
    placeholder="my-flow-name"
  />
  {slugError && <p className="text-sm text-destructive">{slugError}</p>}
  {slug && (
    <p className="text-xs text-muted-foreground">
      URL: /flows/{slug}
    </p>
  )}
</div>
```

### Flow Detail Page (`/src/components/flows/flow-detail.tsx`)

Add slug editing with warning and pre-generation for flows without slugs:

```tsx
// Additional state - pre-generate slug for flows that don't have one
const [editedSlug, setEditedSlug] = useState(flow.slug || '');
const [slugTouched, setSlugTouched] = useState(!!flow.slug);
const [showSlugWarning, setShowSlugWarning] = useState(false);

// Pre-generate slug when editing a flow without one
useEffect(() => {
  if (isEditing && !slugTouched && !flow.slug && editedName) {
    setEditedSlug(generateSlug(editedName));
  }
}, [isEditing, editedName, slugTouched, flow.slug]);

// When editing slug
{isEditing && (
  <div className="space-y-2">
    <Label htmlFor="slug">Slug (optional)</Label>
    <Input
      id="slug"
      value={editedSlug}
      onChange={(e) => {
        const newSlug = e.target.value.toLowerCase();
        setEditedSlug(newSlug);
        setSlugTouched(true);
        // Only show warning if changing an existing slug
        if (flow.slug && newSlug !== flow.slug) {
          setShowSlugWarning(true);
        }
      }}
      placeholder="my-flow-name"
    />
    {showSlugWarning && (
      <p className="text-sm text-amber-600">
        Changing the slug may break external links and integrations using the old URL.
      </p>
    )}
  </div>
)}

// Display slug when not editing (only if set)
{flow.slug && <span>Slug: <code className="text-xs">{flow.slug}</code></span>}
```

### Flows Grid (`/src/components/flows/flows-grid.tsx`)

Update links to use slug when available, UUID as fallback:

```tsx
// Change from:
<Link href={`/flows/${flow.id}`}>

// To (use slug if available, otherwise UUID):
<Link href={`/flows/${flow.slug || flow.id}`}>
```

### Flow Interface Update

```tsx
// Update local interface to include nullable slug
interface Flow {
  id: string;
  slug: string | null;  // Add this (nullable)
  name: string;
  // ...
}
```

## Security Considerations

1. **Input Validation**: All slug inputs validated server-side with Zod schema before database operations
2. **SQL Injection**: Using parameterized queries via Supabase client (existing pattern)
3. **Reserved Slugs**: Database-level constraint prevents reserved slug insertion even if application validation bypassed
4. **Case Sensitivity**: Stored lowercase, unique index on `LOWER(slug)` prevents case-variant duplicates

## Performance Considerations

1. **Index Strategy**:
   - `idx_flows_slug_lower` functional index enables efficient case-insensitive lookups
   - Existing `idx_flows_created_at` remains for listing queries

2. **Query Efficiency**:
   - UUID vs slug detection is O(1) regex check, no database query
   - Single query path for resolution (either by `id` or by `slug`)

3. **Uniqueness Check**:
   - Uses database unique constraint for atomic uniqueness guarantee
   - Application-level check before insert provides better error messages

## Testing Strategy

### Unit Tests

1. **Slug Generation**:
   - `generateSlug('Hello World')` returns `'hello-world'`
   - `generateSlug('A')` returns slug with random suffix (meets min length)
   - `generateSlug('Very Long Name...')` returns truncated slug (max 50 chars)
   - Special characters removed correctly

2. **Slug Validation**:
   - Valid slugs pass: `'my-flow'`, `'a1b2'`, `'test-123'`
   - Invalid slugs fail: `'My-Flow'`, `'-start'`, `'end-'`, `'double--hyphen'`, `'ab'`, `'new'`

3. **UUID Detection**:
   - `isUUID('550e8400-e29b-41d4-a716-446655440000')` returns `true`
   - `isUUID('my-flow-slug')` returns `false`

### Integration Tests

1. **Flow Creation**:
   - Create flow with custom slug succeeds
   - Create flow without slug auto-generates slug
   - Create flow with reserved slug fails with 400
   - Create flow with duplicate slug fails with 400

2. **Flow Lookup**:
   - `GET /api/flows/{uuid}` returns flow
   - `GET /api/flows/{slug}` returns same flow
   - `GET /api/flows/nonexistent` returns 404

3. **Flow Update**:
   - Update slug succeeds with unique value
   - Update to duplicate slug fails with 400

4. **Run Creation**:
   - `POST /api/runs` with `flow_id` as UUID works
   - `POST /api/runs` with `flow_id` as slug works
   - `POST /api/runs` with `flow_id` as legacy number works

## Implementation Phases

### Phase 1: Foundation (Backend)
1. Install `slugify` package
2. Create `/src/lib/slug.ts` with utilities
3. Add `slug` field to TypeScript interface (nullable)
4. Create and apply database migration (adds column + index only)

### Phase 2: API Updates
1. Update `POST /api/flows` for optional slug handling
2. Update `GET/PUT/DELETE /api/flows/[id]` for slug resolution
3. Update `POST /api/runs` for slug-based `flow_id`
4. Add appropriate error responses

### Phase 3: UI Updates
1. Add slug input to new flow form (pre-generated, clearable)
2. Add slug editing to flow detail page (pre-generated for existing flows without slugs)
3. Update flow links to use `slug || id`
4. Update flow detail page to resolve by slug

## Architecture Review Findings

The design was reviewed by an architecture reviewer. Key findings addressed:

### Critical/High (Fixed)
1. **Reserved slugs incomplete** - Added `api` and `settings` to reserved list
2. **UUID-like slugs** - Added validation to reject slugs matching UUID format
3. **Case-insensitive lookup** - Fixed `resolveFlowByIdentifier` to normalize to lowercase

### Acknowledged (Acceptable Risk)
- **Uniqueness race condition**: Mitigated by database constraint; rare for this use case
- **No slug audit trail**: Out of scope per spec; can be added later if needed

### Simplified by Design Change
- **Migration complexity eliminated** - Slugs are now optional, so no data migration needed. Existing flows work with UUID-only access.

## File Change Summary

| File | Action | Description |
|------|--------|-------------|
| `package.json` | Modify | Add `slugify` dependency |
| `supabase/migrations/YYYYMMDDHHMMSS_add_flow_slugs.sql` | Create | Add nullable slug column + index (no data migration) |
| `/src/types/database.ts` | Modify | Add `slug: string \| null` to Flow interface |
| `/src/lib/slug.ts` | Create | Slug utilities (generate, validate, resolve) |
| `/src/app/api/flows/route.ts` | Modify | Handle optional slug on create |
| `/src/app/api/flows/[id]/route.ts` | Modify | Add slug resolution and update validation |
| `/src/app/api/runs/route.ts` | Modify | Add slug resolution for flow_id |
| `/src/app/(app)/flows/[id]/page.tsx` | Modify | Use slug resolution for lookup |
| `/src/app/(app)/flows/new/page.tsx` | Modify | Add slug input field with pre-generation |
| `/src/components/flows/flow-detail.tsx` | Modify | Add slug editing with pre-generation |
| `/src/components/flows/flows-grid.tsx` | Modify | Use `slug \|\| id` in flow links |
