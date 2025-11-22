# Story 1.2: Implement Configuration Management System

**Epic:** Epic 1: Service Foundation & Core Infrastructure
**Status:** review
**Story Points:** 5
**Prerequisites:** Story 1.1 (project initialized)

## User Story

As a **system operator**,
I want **a configuration system that loads settings from files and environment variables**,
So that **I can change configuration without code changes and support multiple environments**.

## Acceptance Criteria

**Given** the Fastify project is initialized
**When** the service starts
**Then** it loads environment variables from `.env` file using dotenv

**And** it loads JSON configuration from `config/` directory:
- `config/whitelist.json` (email/domain whitelist)
- `config/settings.json` (timeouts, limits, templates)

**And** configuration includes these settings:
- RESEND_API_KEY (env var)
- SPARKY_LLM_URL (env var, default: `https://sparky.tail468b81.ts.net/v1/chat/completions`)
- NODE_ENV (env var, default: `production`)
- PORT (env var, default: `3000`)
- llm_timeout_ms (settings.json, default: 25000)
- max_tokens (settings.json, default: 1000)
- max_image_size_bytes (settings.json, default: 10485760)
- resend_timeout_ms (settings.json, default: 10000)
- image_download_timeout_ms (settings.json, default: 10000)

**And** configuration validation occurs on startup using zod schemas

**And** startup fails with clear error message if required config is missing

**And** `.env.example` file documents all required environment variables

## Technical Notes

- Create `src/services/config.ts` module
- Export typed configuration object (use zod for runtime validation)
- Create TypeScript interfaces for config structure
- Create `config/` directory with initial JSON files
- Set file permissions on config files: 600 (read/write owner only)
- Load dotenv at application startup (top of src/server.ts)
- Example whitelist.json structure:
  ```json
  {
    "allowed_emails": [],
    "allowed_domains": ["@company.com"]
  }
  ```
- Config loading pattern: env vars override file values where applicable
- Validation errors should log specific missing/invalid fields

## Dev Agent Record

**Context Reference:**
- docs/sprint-artifacts/epic-1-story-1.2.context.xml

**Implementation Notes:**

**Completed (2025-11-17):**

Successfully implemented configuration management system with the following components:

1. **Created config service (`src/services/config.ts`)**:
   - Zod schemas for environment variables, settings, and whitelist validation
   - Typed Config interface with camelCase property names
   - Fail-fast validation on startup with descriptive error messages
   - File loading from `config/settings.json` and `config/whitelist.json`

2. **Created configuration files**:
   - `config/settings.json` - Timeouts and limits with snake_case keys
   - `config/whitelist.json` - Email/domain whitelist arrays
   - `.env.example` - Documentation of all environment variables with defaults
   - File permissions set to 600 (read/write owner only)

3. **Integrated dotenv**:
   - Loaded at top of `src/app.ts` before any other imports
   - Config module imported to trigger validation on startup

4. **Configuration values**:
   - Environment variables: RESEND_API_KEY (required), SPARKY_LLM_URL, NODE_ENV, PORT (with defaults)
   - Settings: llm_timeout_ms (25s), max_tokens (1000), max_image_size_bytes (10MB), resend_timeout_ms (10s), image_download_timeout_ms (10s)
   - Whitelist: empty allowed_emails and allowed_domains arrays by default

5. **Comprehensive test coverage** (15 tests, all passing):
   - Config file existence and structure validation
   - JSON parsing and schema validation
   - Environment variable documentation (.env.example)
   - Config module integration with correct types and naming conventions
   - Default value verification

**Key Design Decisions:**
- Added 'test' to NODE_ENV enum for vitest compatibility
- Used zod's `.default()` for optional env vars with sensible defaults
- Export typed config object with camelCase (internal JSON uses snake_case)
- Validation errors include specific field names and messages
- Configuration loads synchronously on module import (fail-fast pattern)

## Testing Requirements

- [x] Unit tests for all new functions
- [x] Integration tests for API endpoints (if applicable)
- [x] Error handling validation
- [x] Configuration validation (if applicable)

**Test Results:** 15/15 tests passing via vitest
- Config file structure validation (4 tests)
- Settings JSON validation (3 tests)
- Whitelist JSON validation (1 test)
- Environment documentation validation (3 tests)
- Config module integration (4 tests)

**Coverage:** config.ts at 80.32% (uncovered paths are edge-case error handlers)

## Definition of Done

- [x] All acceptance criteria met
- [ ] Code reviewed and approved
- [x] All tests passing (100%)
- [x] Documentation updated
- [x] No new linter errors
- [ ] Changes committed to git

## File List

**NEW:**
- src/services/config.ts
- src/services/config.test.ts
- config/settings.json
- config/whitelist.json
- .env.example
- .env (test environment)

**MODIFIED:**
- src/app.ts (added dotenv loading and config import)

## Change Log

- 2025-11-17: Configuration management system implemented with zod validation, dotenv integration, and comprehensive tests (15/15 passing)
