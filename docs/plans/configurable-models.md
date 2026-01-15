# Project Plan: Configurable Models

## Overview

This plan breaks down the Configurable Models feature into 5 discrete implementation phases. Each phase is independently deployable, testable, and provides incremental value. The approach prioritizes database-first development to unblock subsequent work, followed by API layer, then UI components, and finally integration into existing features.

## Design Reference

- **Specification**: [/docs/specs/configurable-models.md](/docs/specs/configurable-models.md)
- **Technical Design**: [/docs/design/configurable-models.md](/docs/design/configurable-models.md)

## Phase Summary

| Phase | Description | Dependencies | Risk | Estimated Size |
|-------|-------------|--------------|------|----------------|
| 1 | Database schema and seed data | None | Low | Small |
| 2 | Admin API endpoints | Phase 1 | Low | Medium |
| 3 | Public models API and useModels hook | Phase 2 | Low | Small |
| 4 | Settings UI page | Phase 2 | Medium | Large |
| 5 | Prompt form integration and cost updates | Phase 3 | Medium | Medium |

## Detailed Phases

### Phase 1: Database Schema and Seed Data

**Goal**: Create the database foundation with `providers` and `models` tables, seeded with all currently hardcoded model data. This enables all subsequent phases to proceed.

**Deliverables**:
- [ ] Migration file with providers and models tables
- [ ] Indexes for efficient queries (provider_id, endpoint_types GIN, enabled)
- [ ] RLS policies (permissive, matching existing pattern)
- [ ] CHECK constraint for valid endpoint_types
- [ ] Seed data for all models from CHAT_MODELS, IMAGE_MODELS, VIDEO_MODELS
- [ ] Seed data for token pricing from TOKEN_PRICING constant
- [ ] TypeScript interfaces for Provider, Model, ModelDefaultParams, ModelOption

**Files to Create**:
- `supabase/migrations/YYYYMMDDHHMMSS_add_configurable_models.sql`

**Files to Modify**:
- `src/types/database.ts` - Add new interfaces, mark constants as @deprecated

**Tests Required**:
- [ ] Migration runs successfully on fresh database
- [ ] Migration runs successfully on existing database
- [ ] All seeded providers exist with correct slugs
- [ ] All seeded models exist with correct model_ids and endpoint_types
- [ ] Pricing data matches TOKEN_PRICING constant values
- [ ] Composite unique constraint (provider_id, model_id) is enforced
- [ ] endpoint_types CHECK constraint rejects invalid values

**Definition of Done**:
- [ ] All deliverables complete
- [ ] Migration tested locally
- [ ] TypeScript types compile without errors
- [ ] Existing prompt forms still work (constants still available)
- [ ] Code reviewed
- [ ] PR merged

**Risks/Notes**:
- Ensure updated_at trigger function exists (should exist from initial_schema.sql)
- Verify uuid_generate_v4() extension is available
- Seed data must exactly match hardcoded constants to ensure continuity

**Migration SQL Reference**:
```sql
-- Tables: providers, models
-- Indexes: idx_providers_slug, idx_providers_enabled_order, idx_models_provider_id,
--          idx_models_endpoint_types (GIN), idx_models_enabled, idx_models_enabled_provider_order
-- Constraints: uq_provider_model (provider_id, model_id), valid_endpoint_types CHECK
-- RLS: Permissive policies for both tables
-- Seed: OpenAI, Anthropic, Gemini, Stability, Rails providers
-- Seed: All models from CHAT_MODELS, IMAGE_MODELS, VIDEO_MODELS with pricing from TOKEN_PRICING
```

---

### Phase 2: Admin API Endpoints

**Depends On**: Phase 1

**Goal**: Create CRUD API endpoints for providers and models under `/api/settings/`. These endpoints enable the admin UI (Phase 4) and can be tested independently.

**Deliverables**:
- [ ] GET /api/settings/providers - List all providers with model counts
- [ ] POST /api/settings/providers - Create new provider
- [ ] GET /api/settings/providers/[id] - Get single provider
- [ ] PATCH /api/settings/providers/[id] - Update provider
- [ ] DELETE /api/settings/providers/[id] - Delete provider (cascades to models)
- [ ] GET /api/settings/models - List models with filtering (provider_id, endpoint_type, enabled)
- [ ] POST /api/settings/models - Create new model
- [ ] GET /api/settings/models/[id] - Get single model
- [ ] PATCH /api/settings/models/[id] - Update model
- [ ] DELETE /api/settings/models/[id] - Delete model (returns prompts_affected count)

**Files to Create**:
- `src/app/api/settings/providers/route.ts` (GET, POST)
- `src/app/api/settings/providers/[id]/route.ts` (GET, PATCH, DELETE)
- `src/app/api/settings/models/route.ts` (GET, POST)
- `src/app/api/settings/models/[id]/route.ts` (GET, PATCH, DELETE)

**Files to Modify**: None

**Tests Required**:
- [ ] GET providers returns all providers with accurate model counts
- [ ] POST providers creates provider with valid data
- [ ] POST providers rejects duplicate slug
- [ ] PATCH providers updates enabled status
- [ ] DELETE providers cascades to delete all associated models
- [ ] GET models filters correctly by provider_id
- [ ] GET models filters correctly by endpoint_type
- [ ] GET models filters correctly by enabled status
- [ ] POST models creates model with endpoint_types array
- [ ] POST models rejects invalid endpoint_type values
- [ ] POST models enforces unique (provider_id, model_id)
- [ ] PATCH models updates default_params JSON
- [ ] DELETE models returns correct prompts_affected count

**Definition of Done**:
- [ ] All deliverables complete
- [ ] All tests pass
- [ ] CORS headers included (matching existing pattern)
- [ ] Proper error responses (400, 404, 500)
- [ ] Field allowlist for PATCH operations
- [ ] Code reviewed
- [ ] PR merged

**Risks/Notes**:
- Follow existing patterns from `/api/flows/route.ts` (CORS, service client, error handling)
- Use field allowlist pattern for PATCH to prevent unauthorized field updates
- Return arrays directly (not wrapped objects) to match existing API style

**API Pattern Reference**:
```typescript
// Response format matches /api/flows
// GET returns array: [{ id, name, slug, ... }]
// POST returns object: { id, name, slug, ... }
// PATCH/DELETE returns object: { success: true } or updated entity
```

---

### Phase 3: Public Models API and Hook

**Depends On**: Phase 2

**Goal**: Create the public endpoint for fetching enabled models (used by prompt forms) and a React hook for easy consumption. This phase bridges the backend to the frontend.

**Deliverables**:
- [ ] GET /api/models endpoint with endpoint_type filter
- [ ] Cache-Control header (60-second max-age per NFR-1)
- [ ] Returns only enabled models from enabled providers
- [ ] Sorted by provider.display_order, then model.display_order
- [ ] useModels hook for fetching models by endpoint type

**Files to Create**:
- `src/app/api/models/route.ts` (GET only)
- `src/hooks/use-models.ts`

**Files to Modify**: None

**Tests Required**:
- [ ] GET /api/models requires endpoint_type parameter
- [ ] GET /api/models returns only enabled models
- [ ] GET /api/models excludes models from disabled providers
- [ ] GET /api/models sorts by display_order correctly
- [ ] Response includes provider info (id, name, slug) for each model
- [ ] Response includes default_params for form population
- [ ] Cache-Control header is set correctly
- [ ] useModels hook returns models array
- [ ] useModels hook handles loading state
- [ ] useModels hook handles error state
- [ ] useModels hook deduplicates concurrent requests

**Definition of Done**:
- [ ] All deliverables complete
- [ ] All tests pass
- [ ] Hook uses fetch with useEffect/useState (matching codebase pattern)
- [ ] Empty state handled (returns empty array, not error)
- [ ] Code reviewed
- [ ] PR merged

**Risks/Notes**:
- Design doc notes using simple fetch + useState/useEffect (not SWR) to match existing patterns
- Hook should handle the case where no models exist for an endpoint type
- Consider caching at hook level (simple cache with TTL)

**Hook Interface Reference**:
```typescript
interface UseModelsOptions {
  endpointType: EndpointType;
}

interface UseModelsResult {
  models: ModelOption[];
  isLoading: boolean;
  error: Error | null;
}

function useModels({ endpointType }: UseModelsOptions): UseModelsResult
```

---

### Phase 4: Settings UI Page

**Depends On**: Phase 2

**Goal**: Create the admin interface at `/settings/models` for managing providers and models. This includes the page, accordion list, and create/edit dialogs.

**Deliverables**:
- [ ] Settings models page at `/settings/models`
- [ ] ProvidersAccordion component with expandable provider sections
- [ ] Provider toggle (enabled/disabled) with immediate API call
- [ ] Model rows within each provider showing status and actions
- [ ] ProviderDialog for creating/editing providers
- [ ] ModelDialog for creating/editing models (including default_params and pricing)
- [ ] Delete confirmation for models (shows prompts_affected warning)
- [ ] Navigation link from main settings page

**Files to Create**:
- `src/app/(app)/settings/models/page.tsx`
- `src/components/settings/providers-list.tsx`
- `src/components/settings/provider-dialog.tsx`
- `src/components/settings/model-dialog.tsx`

**Files to Modify**:
- `src/app/(app)/settings/page.tsx` - Add link to models settings

**Tests Required**:
- [ ] Page loads and displays all providers
- [ ] Providers can be expanded to show models
- [ ] Provider enabled toggle updates immediately via API
- [ ] Model enabled toggle updates immediately via API
- [ ] Add provider dialog opens and submits correctly
- [ ] Edit provider dialog pre-fills values
- [ ] Add model dialog shows all fields (name, model_id, endpoint_types, defaults, pricing)
- [ ] Edit model dialog pre-fills all values including JSON defaults
- [ ] Delete model shows confirmation with prompts_affected count
- [ ] Page refreshes after mutations (matching existing pattern)

**Definition of Done**:
- [ ] All deliverables complete
- [ ] UI matches existing settings page styling
- [ ] All CRUD operations work end-to-end
- [ ] Error toasts shown for failed operations
- [ ] Success toasts shown for completed operations
- [ ] Code reviewed
- [ ] PR merged

**Risks/Notes**:
- Server component for initial data fetch, client components for interactions
- Use page reload after mutations (consistent with existing settings pattern)
- ModelDialog is complex (multiple endpoint_types, JSON editor for defaults)
- Consider accordion from shadcn/ui or Collapsible pattern from prompt-card

**UI Layout Reference**:
```
/settings/models
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
+------------------------------------------+
```

---

### Phase 5: Prompt Form Integration and Cost Updates

**Depends On**: Phase 3

**Goal**: Update prompt forms to use the database-driven models API instead of hardcoded constants. Update cost calculations to use database pricing.

**Deliverables**:
- [ ] Update prompt-card.tsx to use useModels hook
- [ ] Update new-prompt-dialog.tsx to use useModels hook
- [ ] Replace getModelsForEndpoint() with hook-driven data
- [ ] Replace getProvidersForEndpoint() with hook-derived providers
- [ ] Apply model default_params when selecting a model (FR-6.5)
- [ ] Warning badge when editing prompt with disabled model (FR-6.4)
- [ ] Update run-detail.tsx to fetch pricing from database
- [ ] Update analytics page to fetch pricing from database
- [ ] Handle missing pricing gracefully (show "N/A")

**Files to Create**: None

**Files to Modify**:
- `src/components/flows/prompt-card.tsx` - Use useModels hook
- `src/components/flows/new-prompt-dialog.tsx` - Use useModels hook
- `src/components/runs/run-detail.tsx` - Database pricing lookup
- `src/app/(app)/analytics/page.tsx` - Database pricing lookup

**Tests Required**:
- [ ] Prompt card model dropdown shows database models only
- [ ] Prompt card provider dropdown shows providers with enabled models
- [ ] New prompt dialog model selection works end-to-end
- [ ] Selecting a model auto-populates default_params into form
- [ ] Disabled model warning appears when editing prompt with disabled model
- [ ] Prompt with disabled model can still be saved
- [ ] Run detail page shows correct cost from database pricing
- [ ] Run detail page shows "N/A" for models without pricing
- [ ] Analytics page calculates total cost from database pricing
- [ ] Existing prompts continue to work (backward compatibility)

**Definition of Done**:
- [ ] All deliverables complete
- [ ] All tests pass
- [ ] Prompt forms work identically to before (same UX)
- [ ] Cost display matches previous behavior for seeded models
- [ ] No regressions in existing functionality
- [ ] Code reviewed
- [ ] PR merged

**Risks/Notes**:
- This phase has the most potential for regressions - test thoroughly
- Keep deprecated constants in codebase during this phase
- Loading state while fetching models should show skeleton or spinner
- If models API fails, show error message (not empty dropdown)

**Default Params Application Reference**:
```typescript
const handleModelSelect = (model: ModelOption) => {
  setFormData(prev => ({
    ...prev,
    selected_model: model.model_id,
    selected_provider: model.provider.name,
    ...model.default_params  // Spread defaults into form state
  }));
};
```

---

## Testing Strategy

### Per-Phase Testing

Each phase should be tested in isolation before merging:

1. **Phase 1**: Run migration locally, verify seed data in Supabase dashboard
2. **Phase 2**: Use curl/Postman to test all CRUD endpoints
3. **Phase 3**: Test hook in isolation with a simple test component
4. **Phase 4**: Manual testing of all UI flows (create, edit, delete, toggle)
5. **Phase 5**: End-to-end test of creating a new flow with prompts

### Integration Testing

After all phases are merged:
- [ ] Create new provider and model via UI
- [ ] Create prompt using new model
- [ ] Run flow and verify execution succeeds
- [ ] Verify cost calculation uses new pricing
- [ ] Disable model and verify it disappears from dropdowns
- [ ] Verify existing prompts with disabled model still execute

### Regression Testing

- [ ] All existing flows continue to work
- [ ] All existing prompts display correctly
- [ ] All existing runs show correct cost data
- [ ] Analytics page totals are unchanged (for same data)

## Rollback Considerations

### Phase 1 Rollback
Drop tables if critical issues found:
```sql
DROP TABLE IF EXISTS models;
DROP TABLE IF EXISTS providers;
```

### Phase 5 Rollback
If integration issues occur, revert to constants:
- Prompt forms: Revert to using CHAT_MODELS, IMAGE_MODELS, VIDEO_MODELS
- Cost calculation: Revert to using TOKEN_PRICING constant
- Database tables remain but are unused

### Feature Flag Option
For gradual rollout, add environment variable:
```
USE_DATABASE_MODELS=true
```
The useModels hook can fall back to constants when this is false.

## Open Questions

1. **Migration Timing**: Should we deploy Phase 1 ahead of other phases to run migration in production early?
   - **Recommendation**: Yes, database changes are low-risk and unblock testing

2. **Display Order UI**: Should Phase 4 include drag-and-drop reordering or just numeric input?
   - **Recommendation**: Numeric input for MVP, defer drag-and-drop to v2

3. **Provider Creation**: How often will new providers be added vs just new models?
   - **Recommendation**: Provider creation is rare, keep UI simple

## Recommended Approach

1. **Start with Phase 1** - Deploy database migration early to validate schema
2. **Parallel work possible** - Phase 2 and Phase 4 can be developed in parallel after Phase 1
3. **Phase 3 is a dependency** - Must complete before Phase 5
4. **Phase 5 last** - Has most integration risk, test thoroughly

## File Summary

| Phase | Files to Create | Files to Modify |
|-------|-----------------|-----------------|
| 1 | 1 migration | 1 (database.ts) |
| 2 | 4 API routes | 0 |
| 3 | 2 (API + hook) | 0 |
| 4 | 4 (page + 3 components) | 1 (settings page) |
| 5 | 0 | 4 (prompt-card, new-prompt-dialog, run-detail, analytics) |
| **Total** | **11** | **6** |
