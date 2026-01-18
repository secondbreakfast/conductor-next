# Flow Slugs Feature Specification

## Overview

Add the ability to give flows a human-readable slug that can be used in place of the UUID to uniquely identify a flow in URLs and API calls.

## Functional Requirements

### FR-1: Slug Format

- **FR-1.1**: Slugs must contain only lowercase letters (a-z), numbers (0-9), and hyphens (-)
- **FR-1.2**: Slugs must be between 3 and 50 characters in length
- **FR-1.3**: Slugs must not start or end with a hyphen
- **FR-1.4**: Slugs must not contain consecutive hyphens

### FR-2: Slug Uniqueness

- **FR-2.1**: Slugs must be globally unique across all flows
- **FR-2.2**: Slug uniqueness validation must be case-insensitive (all slugs stored as lowercase)

### FR-3: Slug Creation

- **FR-3.1**: Slugs are optional for all flows
- **FR-3.2**: When creating or editing a flow, the UI should pre-generate a slug from the flow name (user can modify or clear it)
- **FR-3.3**: Auto-generation rules:
  - Convert name to lowercase
  - Replace spaces and underscores with hyphens
  - Remove characters not matching [a-z0-9-]
  - Collapse consecutive hyphens to single hyphen
  - Trim hyphens from start and end
  - If result is less than 3 characters, append random suffix
  - If slug already exists, append numeric suffix (-1, -2, etc.)
- **FR-3.4**: Flows without slugs are only accessible by UUID

### FR-4: Reserved Slugs

- **FR-4.1**: The following slugs are reserved and cannot be used: `new`, `edit`, `api`, `settings`
- **FR-4.2**: Attempting to use a reserved slug must return a validation error

### FR-5: Slug Editability

- **FR-5.1**: Slugs can be edited after flow creation
- **FR-5.2**: When editing a slug, the UI must display a warning that changing the slug may break external links or integrations
- **FR-5.3**: The same validation rules (format, uniqueness, reserved) apply when editing

### FR-6: Flow Lookup

- **FR-6.1**: Flows must remain accessible by UUID (existing behavior preserved)
- **FR-6.2**: Flows with slugs must also be accessible by slug
- **FR-6.3**: API endpoints must support both UUID and slug as identifiers:
  - `GET /api/flows/{id-or-slug}`
  - `PUT /api/flows/{id-or-slug}`
  - `DELETE /api/flows/{id-or-slug}`
- **FR-6.4**: The `flow_id` parameter in run creation must accept slugs
- **FR-6.5**: UI routes must support slug-based URLs: `/flows/{slug}`
- **FR-6.6**: UI should use slug in URLs when available, falling back to UUID when not

## Non-Functional Requirements

- **NFR-1**: Add database index on slug column for fast lookups
- **NFR-2**: Slug validation should happen on both client and server side
- **NFR-3**: API responses should include the slug field in flow objects
- **NFR-4**: Prefer using a standard/well-maintained package for slug generation and validation over a custom implementation. Functional requirements (e.g., exact format rules in FR-1 and FR-3) may be adjusted to align with the chosen package's behavior.

## Out of Scope

- Slug history/redirect tracking (changed slugs do not redirect)
- Per-user slug namespacing (all slugs globally unique)

## Acceptance Criteria

1. User can create a flow with a custom slug
2. User can create a flow without a slug (clears pre-generated value)
3. UI pre-generates slug from name when creating/editing flows
4. User can edit a flow's slug and sees a warning about breaking links
5. User cannot use reserved slugs (`new`, `edit`)
6. User cannot use duplicate slugs
7. Flows with slugs are accessible via `/flows/{slug}` in the UI
8. API accepts both UUID and slug for flow operations
9. Existing flows without slugs continue to work (UUID access only)
