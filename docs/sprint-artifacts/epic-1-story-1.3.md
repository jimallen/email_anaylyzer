# Story 1.3: Implement Health Check Endpoint

**Epic:** Epic 1: Service Foundation & Core Infrastructure
**Status:** review
**Story Points:** 2
**Prerequisites:** Story 1.2 (configuration system exists)

## User Story

As a **system operator**,
I want **a health check endpoint that reports service status and dependencies**,
So that **I can monitor service health and integration with PM2 monitoring**.

## Acceptance Criteria

**Given** the service is running
**When** I send `GET /health` request
**Then** it returns HTTP 200 with JSON body:
```json
{
  "status": "ok",
  "uptime": 12345,
  "timestamp": "2025-11-17T12:34:56.789Z",
  "dependencies": {
    "sparky": "ok",
    "resend": "ok"
  }
}
```

**And** uptime is in seconds (process.uptime())

**And** timestamp is ISO 8601 format (UTC)

**And** dependency checks perform lightweight validation:
- sparky: URL is configured (not null/empty)
- resend: API key is configured (not null/empty)

**And** response time is <100ms (no network calls, just config checks)

**And** endpoint does not require authentication (public health check)

## Technical Notes

- Create `src/routes/health.ts` as Fastify plugin
- Register route in `src/app.ts`
- Use Fastify route handler pattern:
  ```typescript
  export default async function healthRoute(fastify: FastifyInstance) {
    fastify.get('/health', async (request, reply) => {
      // implementation
    });
  }
  ```
- No external HTTP calls - just check if config values exist
- Consider adding Node.js version to response for debugging
- Health check should always return 200 unless service is shutting down

## Dev Agent Record

**Context Reference:**
- /home/jima/Code/email_anaylyzer/docs/sprint-artifacts/epic-1-story-1.3.context.xml

**Implementation Notes:**

Created health check endpoint at GET /health that returns service status and dependency checks.

**Files Created/Modified:**
- `src/routes/health.ts` - Health check endpoint implementation
- `src/routes/health.test.ts` - Comprehensive test suite (16 tests)
- `vitest.config.ts` - Vitest configuration to load .env before tests

**Key Implementation Details:**
- Lightweight dependency checks (no network calls, just config validation)
- Returns uptime from process.uptime() in seconds
- Timestamp in ISO 8601 UTC format
- Includes Node.js version for debugging
- Response time <100ms as required
- No authentication required (public endpoint)
- Returns 200 status code with HealthResponse interface

**Test Coverage:**
- All 16 tests passing
- Tests cover: status code, JSON response, required fields, uptime validation, timestamp format/timezone, dependency status checks, performance, and authentication

**Technical Decisions:**
- Created vitest.config.ts to load dotenv before tests run (fixes test environment variable access)
- Used Math.floor() for uptime to return integer seconds
- Dependency checks validate config values exist but don't make network calls

## Testing Requirements

- [x] Unit tests for all new functions
- [x] Integration tests for API endpoints (if applicable)
- [x] Error handling validation
- [x] Configuration validation (if applicable)

## Definition of Done

- [x] All acceptance criteria met
- [ ] Code reviewed and approved
- [x] All tests passing (100%)
- [x] Documentation updated
- [x] No new linter errors
- [ ] Changes committed to git
