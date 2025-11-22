# Story 1.5: Implement Structured Logging Infrastructure

**Epic:** Epic 1: Service Foundation & Core Infrastructure
**Status:** review
**Story Points:** 3
**Prerequisites:** Story 1.1 (Fastify initialized with pino)

## User Story

As a **developer**,
I want **structured JSON logging with correlation IDs**,
So that **I can debug issues by tracing individual requests through the system**.

## Acceptance Criteria

**Given** Fastify is configured with pino logger
**When** a request is processed
**Then** each request gets a unique correlation ID (Fastify auto-generated request.id)

**And** all logs include:
- Timestamp (ISO 8601, UTC)
- Log level (info, warn, error, fatal)
- Correlation ID (request.id)
- Message
- Structured context (key-value pairs)

**And** log levels are used appropriately:
- `info`: Normal operations (service start, request received, response sent)
- `warn`: Recoverable issues (timeout, retry)
- `error`: Failures (API errors, validation failures)
- `fatal`: Service crash

**And** logs are written to stdout (PM2 captures to files)

**And** log format is JSON for structured parsing

**And** sensitive data is NOT logged (API keys, email content beyond metadata)

**And** example log structure:
```json
{
  "level": 30,
  "time": 1700000000000,
  "pid": 12345,
  "hostname": "sparky",
  "reqId": "req-abc123",
  "msg": "Request received",
  "sender": "user@company.com",
  "hasScreenshot": true
}
```

## Technical Notes

- Pino is included with Fastify by default - configure in src/app.ts
- Configure pino options:
  ```typescript
  const app = Fastify({
    logger: {
      level: process.env.LOG_LEVEL || 'info',
      serializers: {
        req: (req) => ({
          method: req.method,
          url: req.url,
          remoteAddress: req.ip
        })
      }
    }
  });
  ```
- Access logger via `request.log.info()`, `request.log.error()`, etc.
- Correlation ID available as `request.id` (auto-generated)
- Create logging helper utilities in `src/lib/logger.ts` if needed
- PM2 handles log rotation (configured in Story 1.4)
- Never log full email content - only metadata (sender, has_text, has_image)

## Dev Agent Record

**Context Reference:**
- /home/jima/Code/email_anaylyzer/docs/sprint-artifacts/epic-1-story-1.5.context.xml

**Implementation Notes:**

Successfully implemented structured logging with pino, including correlation IDs, request/response serializers, and sensitive data protection.

**Files Created/Modified:**
- `.env.example` - Added LOG_LEVEL environment variable
- `src/app.ts` - Configured pino logger with serializers in options
- `src/server.ts` - Removed hardcoded logger config to use options from app.ts
- `src/lib/logger.ts` - Created logging utilities (127 lines)
- `src/lib/logger.test.ts` - Comprehensive tests (18 tests)

**Key Implementation Details:**
- Configured pino logger in app.ts options with LOG_LEVEL from env (default: 'info')
- Request serializer includes: method, url, remoteAddress, id (correlation ID)
- Response serializer includes: statusCode
- Created logging utilities for safe, structured logging:
  - `redactSensitiveData()` - Removes API keys, passwords, tokens, secrets from logs
  - `extractEmailMetadata()` - Safely extracts email metadata without full content
  - `logEmailReceived()` - Structured log for email processing
  - `logError()` - Error logging with sanitized context
  - `logWarning()` - Warning logging with sanitized context

**Test Results:**
- 18/18 logger utility tests passing
- Verified structured JSON logging output
- Confirmed correlation IDs (request.id) appear in logs: "req-1", "req-3", etc.
- Verified each request gets unique correlation ID
- Confirmed logs include: level, time, pid, hostname, reqId, msg
- Tested request/response serializers work correctly
- Verified sensitive data redaction patterns work (api_key, password, token, secret, auth)

**Log Format Validation:**
```json
{
  "level": 30,
  "time": 1763393241883,
  "pid": 1442307,
  "hostname": "cachyos-desktop",
  "reqId": "req-1",
  "req": {
    "method": "GET",
    "url": "/health",
    "remoteAddress": "127.0.0.1",
    "id": "req-1"
  },
  "msg": "incoming request"
}
```

**Technical Decisions:**
- Used pino's built-in serializers for req/res
- Implemented pattern-based sensitive data detection (case-insensitive regex)
- Created reusable logger utilities in src/lib/logger.ts instead of inline in routes
- Maintained separation of concerns: app.ts configures logger, server.ts uses it
- Never log full email content - only metadata (sender, hasText, hasImage, lengths)

## Testing Requirements

- [x] Unit tests for all new functions (18 tests for logger utilities)
- [x] Integration tests for API endpoints (if applicable) (Verified with PM2 + health endpoint)
- [x] Error handling validation (logError function tested)
- [x] Configuration validation (if applicable) (LOG_LEVEL env var tested)

## Definition of Done

- [x] All acceptance criteria met
- [ ] Code reviewed and approved
- [x] All tests passing (100%)
- [x] Documentation updated
- [x] No new linter errors
- [ ] Changes committed to git
