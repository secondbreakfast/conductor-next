# Changelog

All notable changes to Conductor will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- **Database-Driven Model Configuration**: AI provider and model options are now stored in database tables (`providers` and `models`) instead of hardcoded TypeScript constants
- **Admin UI for Model Management**: New settings page at `/settings/models` allows administrators to:
  - Enable/disable providers and models without code changes
  - Configure model default parameters (temperature, max_tokens, etc.)
  - Set token pricing for cost tracking
  - Add new models as they become available
  - Reorder providers and models via display_order
- **Public Models API**: New `/api/models` endpoint for fetching available models filtered by endpoint type
- **Admin API Endpoints**: CRUD operations for providers and models under `/api/settings/`
  - `GET/POST /api/settings/providers` - List/create providers
  - `GET/PATCH/DELETE /api/settings/providers/[id]` - Manage individual providers
  - `GET/POST /api/settings/models` - List/create models with filtering
  - `GET/PATCH/DELETE /api/settings/models/[id]` - Manage individual models
- **useModels React Hook**: Client-side hook for fetching models with 60-second cache
- **Database Migration**: `20260115150000_add_configurable_models.sql` creates providers and models tables with seed data
- **Flow Slugs**: Human-readable slugs for flows, accessible via both UUID and slug in API routes

### Changed
- **Prompt Forms**: Model selection now fetches from database instead of hardcoded constants
- **TypeScript Constants**: Marked `CHAT_MODELS`, `IMAGE_MODELS`, `VIDEO_MODELS` as deprecated
- **Auth Configuration**: Added `/api/models` to public routes

### Technical Details
- Model configuration supports: name, model_id, endpoint_types (array), default_params (JSONB), pricing
- Disabled models are hidden from selection but existing prompts continue to work
- Row-level security policies ensure proper access control
- GIN index on endpoint_types array for efficient filtering
