# Configurable Models Feature Specification

## Overview

Move AI provider and model options from hardcoded TypeScript constants to a database-driven configuration system with an admin UI. This allows administrators to manage available models, set default parameters, configure pricing, and enable/disable models without code changes.

## Goals

1. Remove hardcoded model lists from the codebase
2. Enable administrators to add, edit, and disable models via UI
3. Support default parameters per model (temperature, max_tokens, etc.)
4. Include token pricing configuration for cost tracking
5. Maintain backward compatibility with existing prompts

## Functional Requirements

### FR-1: Provider Management

- **FR-1.1**: System must store a list of AI providers (OpenAI, Anthropic, Gemini, Stability, etc.)
- **FR-1.2**: Each provider has a name (display), slug (API identifier), and enabled status
- **FR-1.3**: Providers can be enabled or disabled globally
- **FR-1.4**: Disabled providers hide all their models from selection but existing prompts continue to work
- **FR-1.5**: Providers have a display_order for consistent UI ordering

### FR-2: Model Management

- **FR-2.1**: Each model belongs to exactly one provider
- **FR-2.2**: Models have: name (display), model_id (API identifier), enabled status, display_order
- **FR-2.3**: A model can support multiple endpoint types (Chat, ImageToImage, ImageToVideo, etc.)
- **FR-2.4**: Models can be enabled or disabled independently of their provider
- **FR-2.5**: Disabled models cannot be selected for new prompts but existing prompts continue to work
- **FR-2.6**: The combination of provider_id and model_id must be unique

### FR-3: Default Parameters

- **FR-3.1**: Each model can have optional default parameters stored as JSON
- **FR-3.2**: Supported parameters include (but are not limited to):
  - Chat: temperature, max_tokens, top_p, frequency_penalty, presence_penalty
  - Image: size, quality, style
- **FR-3.3**: Default parameters serve as initial values when creating/editing prompts
- **FR-3.4**: Per-prompt settings override model defaults (defaults are not enforced)

### FR-4: Token Pricing

- **FR-4.1**: Each model can have optional pricing configuration
- **FR-4.2**: Pricing includes input token cost and output token cost (per 1K tokens in USD)
- **FR-4.3**: Pricing is used for cost estimation and tracking in run history
- **FR-4.4**: Models without pricing configured show "N/A" for cost estimates

### FR-5: Admin UI

- **FR-5.1**: Admin page accessible at `/settings/models`
- **FR-5.2**: Page displays all providers with their models in an organized view
- **FR-5.3**: Admins can toggle provider enabled status
- **FR-5.4**: Admins can add new models with: name, model_id, endpoint types, defaults, pricing
- **FR-5.5**: Admins can edit existing model configuration
- **FR-5.6**: Admins can delete models (with confirmation, warns if used by prompts)
- **FR-5.7**: Admins can reorder providers and models via drag-and-drop or order field
- **FR-5.8**: UI indicates when a provider's API key is not configured (warning badge)

### FR-6: Model Selection in Prompts

- **FR-6.1**: Prompt creation/editing UI fetches available models from database
- **FR-6.2**: Model dropdown only shows enabled models for the selected endpoint type
- **FR-6.3**: Provider dropdown only shows providers with enabled models for the endpoint type
- **FR-6.4**: When editing a prompt with a disabled model, show warning but allow saving
- **FR-6.5**: Default parameters auto-populate when selecting a model (if configured)

### FR-7: API Endpoints

- **FR-7.1**: `GET /api/settings/providers` - List all providers with model counts
- **FR-7.2**: `POST /api/settings/providers` - Create new provider
- **FR-7.3**: `PATCH /api/settings/providers/{id}` - Update provider (enable/disable, reorder)
- **FR-7.4**: `DELETE /api/settings/providers/{id}` - Delete provider (cascades to models)
- **FR-7.5**: `GET /api/settings/models` - List models (filterable by provider_id, endpoint_type, enabled)
- **FR-7.6**: `POST /api/settings/models` - Create new model
- **FR-7.7**: `PATCH /api/settings/models/{id}` - Update model configuration
- **FR-7.8**: `DELETE /api/settings/models/{id}` - Delete model

### FR-8: Data Migration

- **FR-8.1**: On first deployment, seed database with currently hardcoded models
- **FR-8.2**: Existing prompts continue working without modification (model_id stored as string)
- **FR-8.3**: Hardcoded constants remain in codebase as documentation/fallback during transition

## Non-Functional Requirements

- **NFR-1**: Model list API response should be cached (client-side) with 60-second TTL
- **NFR-2**: Database indexes on models.provider_id and models.endpoint_types for fast lookups
- **NFR-3**: Admin UI changes should reflect immediately (cache invalidation)
- **NFR-4**: API endpoints require authentication (existing auth middleware)
- **NFR-5**: Validation on both client and server side for model configuration

## Out of Scope

- Per-flow model restrictions (all models available to all flows)
- Per-user/role model permissions
- Model version tracking or changelog
- Automatic model discovery from provider APIs
- Provider API key management through this UI (remains in environment variables)

## Acceptance Criteria

1. Admin can view all providers and models at `/settings/models`
2. Admin can add a new model with name, model_id, endpoint types, and defaults
3. Admin can disable a model and it no longer appears in prompt dropdowns
4. Admin can enable a disabled model and it reappears in prompt dropdowns
5. Existing prompts using a disabled model continue to execute successfully
6. When creating a prompt, model dropdown shows only database-configured models
7. Model default parameters auto-fill when selecting a model in prompt editor
8. Token pricing displays in run history for models with configured pricing
9. Warning appears if prompt uses a model whose provider API key is not set
10. Seed migration populates all currently hardcoded models into database
