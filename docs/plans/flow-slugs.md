# Flow Slugs - Implementation Plan

## Overview

This plan breaks down the Flow Slugs feature into three sequential phases, each resulting in a deployable, testable unit of work. The feature adds optional human-readable slugs to flows, enabling URL-friendly identifiers alongside existing UUIDs.

**Key Simplification**: Slugs are optional (nullable), so no data migration is required. Existing flows continue to work with UUID-only access.

## Design Reference

- Specification: [/docs/specs/flow-slugs.md](/docs/specs/flow-slugs.md)
- Technical Design: [/docs/design/flow-slugs.md](/docs/design/flow-slugs.md)

## Phase Summary

| Phase | Description | Dependencies | Risk | Estimated Effort |
|-------|-------------|--------------|------|------------------|
| 1 | Foundation (package, utilities, types, migration) | None | Low | Small |
| 2 | API Updates (all API routes) | Phase 1 | Medium | Medium |
| 3 | UI Updates (all UI components) | Phase 2 | Low | Medium |

---

## Phase 1: Foundation

### Goal

Establish the foundational infrastructure for slug support: install the slugify package, create utility functions, update TypeScript types, and apply the database migration. After this phase, the codebase is ready for slug handling but no functionality is exposed yet.

### Scope

- Install `slugify` npm package
- Create slug utility module with generation, validation, and resolution functions
- Update Flow TypeScript interface to include nullable slug field
- Create and apply database migration to add slug column and index

### Files to Create/Modify

| File | Action | Changes |
|------|--------|---------|
| `package.json` | Modify | Add `slugify` dependency |
| `/src/lib/slug.ts` | Create | Slug utilities (generateSlug, validateSlug, isUUID, isReservedSlug, slugSchema, resolveFlowByIdentifier) |
| `/src/types/database.ts` | Modify | Add `slug: string \| null` to Flow interface |
| `supabase/migrations/YYYYMMDDHHMMSS_add_flow_slugs.sql` | Create | Add nullable slug column, unique index, and check constraints |

### Deliverables

- [ ] `slugify` package installed and listed in package.json
- [ ] `/src/lib/slug.ts` created with all utility functions:
  - `generateSlug(name: string): string` - Generate slug from flow name
  - `validateSlug(slug: string): { valid: boolean; error?: string }` - Validate slug format
  - `slugSchema` - Zod schema for server-side validation
  - `isUUID(str: string): boolean` - Check if string is UUID format
  - `isReservedSlug(slug: string): boolean` - Check against reserved list
  - `resolveFlowByIdentifier(supabase, identifier)` - Resolve flow by UUID or slug
- [ ] Flow interface updated with `slug: string | null`
- [ ] Database migration file created and applied
- [ ] TypeScript compiles without errors

### Testing

**Manual Testing Steps:**

1. **Package Installation**
   - Run `npm install` and verify no errors
   - Verify `slugify` appears in `node_modules`

2. **Utility Functions (via Node REPL or test file)**
   ```typescript
   import { generateSlug, validateSlug, isUUID, isReservedSlug } from '@/lib/slug';

   // Test generateSlug
   console.log(generateSlug('Hello World')); // Expected: 'hello-world'
   console.log(generateSlug('A')); // Expected: slug with random suffix (min 3 chars)
   console.log(generateSlug('Test!!!@@@###')); // Expected: 'test' or with suffix

   // Test validateSlug
   console.log(validateSlug('valid-slug')); // Expected: { valid: true }
   console.log(validateSlug('Invalid')); // Expected: { valid: false, error: '...' }
   console.log(validateSlug('new')); // Expected: { valid: false, error: 'reserved' }
   console.log(validateSlug('ab')); // Expected: { valid: false, error: 'min length' }

   // Test isUUID
   console.log(isUUID('550e8400-e29b-41d4-a716-446655440000')); // Expected: true
   console.log(isUUID('my-flow-slug')); // Expected: false

   // Test isReservedSlug
   console.log(isReservedSlug('new')); // Expected: true
   console.log(isReservedSlug('edit')); // Expected: true
   console.log(isReservedSlug('my-flow')); // Expected: false
   ```

3. **Database Migration**
   - Run migration against Supabase
   - Verify column exists: `SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name = 'flows' AND column_name = 'slug';`
   - Verify index exists: `SELECT indexname FROM pg_indexes WHERE tablename = 'flows' AND indexname = 'idx_flows_slug_lower';`
   - Verify existing flows have `slug = NULL`

4. **TypeScript Compilation**
   - Run `npm run build` or `npx tsc --noEmit`
   - Verify no type errors related to Flow interface

### Definition of Done

- [ ] All deliverables complete
- [ ] `npm install` succeeds
- [ ] `npm run build` succeeds (TypeScript compiles)
- [ ] Database migration applied successfully
- [ ] Existing flows unaffected (still accessible by UUID)
- [ ] Code reviewed
- [ ] PR merged to main

### Risks and Mitigation

| Risk | Impact | Mitigation |
|------|--------|------------|
| Migration fails on production | High | Test migration on staging first; migration is additive (no data changes) |
| Type conflicts in existing code | Medium | Flow interface change is additive; null slug handled gracefully |
| slugify package issues | Low | Well-maintained package with 2M+ weekly downloads |

---

## Phase 2: API Updates

### Goal

Update all API routes to support slug-based operations. After this phase, flows can be created with slugs, looked up by slug, and the runs API accepts slugs for `flow_id`. The UI will not yet use these capabilities.

### Scope

- Update flow creation API to handle optional slug (validate, auto-generate if provided name but no slug preference)
- Update flow GET/PUT/DELETE to resolve identifiers as UUID or slug
- Update runs API to accept slug in `flow_id` parameter
- Add appropriate error responses for slug validation failures

### Dependencies

- **Phase 1 must be complete**: Requires slug utilities and database column

### Files to Create/Modify

| File | Action | Changes |
|------|--------|---------|
| `/src/app/api/flows/route.ts` | Modify | Handle optional `slug` field on POST; validate format, reserved words, uniqueness |
| `/src/app/api/flows/[id]/route.ts` | Modify | Use `resolveFlowByIdentifier` for GET/PUT/DELETE; handle slug updates on PUT |
| `/src/app/api/runs/route.ts` | Modify | Resolve `flow_id` by slug when not UUID or numeric |

### Deliverables

- [ ] POST `/api/flows` accepts optional `slug` field
  - If slug provided: validate and use
  - If slug is empty string or null: store as NULL (UUID-only access)
  - Return slug in response
- [ ] GET `/api/flows/[id]` resolves by UUID or slug
- [ ] PUT `/api/flows/[id]` resolves by UUID or slug; handles slug updates with validation
- [ ] DELETE `/api/flows/[id]` resolves by UUID or slug
- [ ] POST `/api/runs` accepts slug in `flow_id` parameter
- [ ] Appropriate 400 errors for:
  - Invalid slug format
  - Reserved slug
  - Duplicate slug
- [ ] Appropriate 404 errors for non-existent slug

### Testing

**Manual Testing Steps:**

1. **Create Flow with Custom Slug**
   ```bash
   curl -X POST http://localhost:3002/api/flows \
     -H "Content-Type: application/json" \
     -d '{"flow": {"name": "Test Flow", "slug": "test-flow"}}'
   ```
   - Expected: 201 with `slug: "test-flow"` in response

2. **Create Flow without Slug**
   ```bash
   curl -X POST http://localhost:3002/api/flows \
     -H "Content-Type: application/json" \
     -d '{"flow": {"name": "Another Flow"}}'
   ```
   - Expected: 201 with `slug: null` in response

3. **Create Flow with Reserved Slug**
   ```bash
   curl -X POST http://localhost:3002/api/flows \
     -H "Content-Type: application/json" \
     -d '{"flow": {"name": "New Flow", "slug": "new"}}'
   ```
   - Expected: 400 with error about reserved slug

4. **Create Flow with Duplicate Slug**
   ```bash
   curl -X POST http://localhost:3002/api/flows \
     -H "Content-Type: application/json" \
     -d '{"flow": {"name": "Duplicate", "slug": "test-flow"}}'
   ```
   - Expected: 400 with error about duplicate slug

5. **Get Flow by UUID**
   ```bash
   curl http://localhost:3002/api/flows/{uuid}
   ```
   - Expected: 200 with flow data

6. **Get Flow by Slug**
   ```bash
   curl http://localhost:3002/api/flows/test-flow
   ```
   - Expected: 200 with same flow data

7. **Get Non-existent Slug**
   ```bash
   curl http://localhost:3002/api/flows/nonexistent-slug
   ```
   - Expected: 404

8. **Update Flow Slug**
   ```bash
   curl -X PUT http://localhost:3002/api/flows/test-flow \
     -H "Content-Type: application/json" \
     -d '{"flow": {"slug": "renamed-flow"}}'
   ```
   - Expected: 200 with updated slug

9. **Create Run with Slug-based flow_id**
   ```bash
   curl -X POST http://localhost:3002/api/runs \
     -H "Content-Type: application/json" \
     -d '{"run": {"flow_id": "test-flow", "message": "Test"}}'
   ```
   - Expected: 201 (or appropriate status) with run created for correct flow

10. **Create Run with UUID flow_id (existing behavior)**
    ```bash
    curl -X POST http://localhost:3002/api/runs \
      -H "Content-Type: application/json" \
      -d '{"run": {"flow_id": "{uuid}", "message": "Test"}}'
    ```
    - Expected: Works as before

### Definition of Done

- [ ] All deliverables complete
- [ ] All manual test cases pass
- [ ] Existing API behavior preserved (UUID access still works)
- [ ] Error messages are clear and actionable
- [ ] `npm run build` succeeds
- [ ] `npm run lint` passes
- [ ] Code reviewed
- [ ] PR merged to main

### Risks and Mitigation

| Risk | Impact | Mitigation |
|------|--------|------------|
| Breaking existing UUID-based API calls | High | UUID detection happens first; slug lookup only if not UUID format |
| Race condition on uniqueness check | Low | Database constraint provides final guarantee; rare for flow creation |
| Performance impact on lookups | Low | Index on slug column; single query path |

---

## Phase 3: UI Updates

### Goal

Update all UI components to use slugs. After this phase, users can create flows with slugs (pre-generated from name), edit slugs on existing flows, and navigate using slug-based URLs.

### Scope

- Add slug input field to new flow form with auto-generation from name
- Add slug editing to flow detail page with change warning
- Update flow grid to use slugs in links (with UUID fallback)
- Update flow detail page to resolve flows by slug

### Dependencies

- **Phase 2 must be complete**: API must support slug operations

### Files to Create/Modify

| File | Action | Changes |
|------|--------|---------|
| `/src/app/(app)/flows/new/page.tsx` | Modify | Add slug input with pre-generation; allow clearing |
| `/src/components/flows/flow-detail.tsx` | Modify | Add slug editing with pre-generation and warning |
| `/src/components/flows/flows-grid.tsx` | Modify | Use `flow.slug \|\| flow.id` in links |
| `/src/app/(app)/flows/[id]/page.tsx` | Modify | Ensure page works with slug-based URLs (likely already works via API) |

### Deliverables

- [ ] New flow form has slug input field
  - Auto-generates from name as user types
  - User can modify or clear (empty = UUID-only)
  - Shows preview URL when slug is set
  - Displays validation errors
- [ ] Flow detail page has slug editing
  - Shows current slug (or "None" if null)
  - Pre-generates slug when editing flow without one
  - Shows warning when changing existing slug
  - Allows clearing slug (reverts to UUID-only)
- [ ] Flows grid uses slug-based URLs
  - Link to `/flows/{slug}` when slug exists
  - Fall back to `/flows/{uuid}` when no slug
- [ ] Flow detail page loads correctly via slug URL
- [ ] All existing UI functionality preserved

### Testing

**Manual Testing Steps:**

1. **New Flow - Slug Auto-Generation**
   - Navigate to `/flows/new`
   - Type "My Test Flow" in the name field
   - Verify slug field auto-populates with "my-test-flow"
   - Verify URL preview shows "/flows/my-test-flow"

2. **New Flow - Slug Modification**
   - In slug field, change to "custom-slug"
   - Verify URL preview updates
   - Submit form
   - Verify redirected to `/flows/custom-slug`

3. **New Flow - Clear Slug**
   - Create new flow
   - Clear the slug field completely
   - Submit form
   - Verify flow created with slug: null
   - Verify redirected to `/flows/{uuid}`

4. **New Flow - Invalid Slug**
   - Try entering "Invalid Slug" (uppercase)
   - Verify validation error appears
   - Try entering "ab" (too short)
   - Verify validation error appears
   - Try entering "new" (reserved)
   - Verify validation error appears

5. **Edit Existing Flow - Add Slug**
   - Open a flow that has no slug
   - Click edit
   - Verify slug field pre-generates from flow name
   - Save the flow
   - Verify slug is now set and URL works

6. **Edit Existing Flow - Change Slug**
   - Open a flow that has a slug
   - Click edit
   - Change the slug
   - Verify warning appears about breaking links
   - Save the flow
   - Verify new slug works

7. **Edit Existing Flow - Remove Slug**
   - Open a flow that has a slug
   - Click edit
   - Clear the slug field
   - Save the flow
   - Verify flow now accessible only by UUID

8. **Flows Grid - Slug Links**
   - Create multiple flows (some with slugs, some without)
   - Go to flows list
   - Verify flows with slugs link to `/flows/{slug}`
   - Verify flows without slugs link to `/flows/{uuid}`
   - Click links and verify navigation works

9. **Direct URL Navigation**
   - Navigate directly to `/flows/{slug}` in browser
   - Verify flow loads correctly
   - Navigate to `/flows/{uuid}` for same flow
   - Verify flow loads correctly

### Definition of Done

- [ ] All deliverables complete
- [ ] All manual test cases pass
- [ ] UI is intuitive and matches existing patterns
- [ ] Slug change warning is clear
- [ ] No TypeScript errors
- [ ] `npm run build` succeeds
- [ ] `npm run lint` passes
- [ ] Visual review completed (no broken layouts)
- [ ] Code reviewed
- [ ] PR merged to main

### Risks and Mitigation

| Risk | Impact | Mitigation |
|------|--------|------------|
| Breaking existing flow navigation | High | UUID access preserved; slugs are additive |
| User confusion about slugs | Medium | Clear UI labels ("optional"); URL preview |
| Form state complexity | Medium | Follow existing patterns; keep state minimal |

---

## Overall Dependencies

```
Phase 1 (Foundation)
    |
    v
Phase 2 (API Updates)
    |
    v
Phase 3 (UI Updates)
```

Each phase must be fully complete and merged before starting the next.

## Overall Risks and Mitigation

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| Database migration issues | High | Low | Test on staging; migration is additive only |
| Breaking existing flows | High | Low | Slugs are optional; all existing UUID access preserved |
| Slug collisions | Medium | Low | Database unique constraint; numeric suffix for auto-generation |
| User changes slug breaking integrations | Medium | Medium | Clear warning in UI; no redirect tracking (out of scope) |
| Performance regression on lookups | Low | Low | Indexed column; single query path |

## Rollback Considerations

### Phase 1 Rollback
- Drop the slug column: `ALTER TABLE flows DROP COLUMN slug;`
- Remove the index (will be dropped with column)
- Revert code changes

### Phase 2 Rollback
- Revert API route changes
- Database column can remain (unused) or be dropped

### Phase 3 Rollback
- Revert UI changes
- API and database can remain (unused)

Each phase can be rolled back independently without affecting the others, though full rollback requires reversing in order (Phase 3 -> 2 -> 1).

## Open Questions

None - all design decisions have been made in the technical design document.

## Success Criteria

The feature is complete when:

1. Users can create flows with optional human-readable slugs
2. Slugs are pre-generated from flow names but can be modified or cleared
3. Flows with slugs are accessible via `/flows/{slug}` URLs
4. API accepts both UUIDs and slugs for flow operations
5. Existing flows (without slugs) continue to work unchanged
6. Clear warnings are shown when changing slugs
7. Reserved slugs (new, edit, api, settings) are rejected
8. Duplicate slugs are rejected with clear error messages
