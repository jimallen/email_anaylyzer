# Story 2.5: Integrate Whitelist Authentication into Webhook

**Epic:** Epic 2: Secure Email Reception
**Status:** review
**Story Points:** 3
**Prerequisites:** Stories 2.1, 2.3, 2.4 (webhook endpoint, whitelist service, hot-reload)

## User Story

As a **system operator**,
I want **whitelist validation enforced before any email processing**,
So that **unauthorized senders are blocked immediately with no resource consumption**.

## Acceptance Criteria

**Given** whitelist validation service is implemented
**When** a webhook request is received
**Then** sender email is extracted from payload

**And** whitelist validation runs BEFORE any other processing (preHandler hook)

**And** if sender is whitelisted:
- Request proceeds to route handler
- HTTP 200 returned after processing
- Request logged with sender info

**And** if sender is NOT whitelisted:
- Request is blocked immediately
- HTTP 403 Forbidden returned
- Response body: `{ "success": false, "error": "Unauthorized sender" }`
- No internal details exposed to sender
- Blocked attempt is logged:
```json
{
  "level": "warn",
  "msg": "Blocked non-whitelisted sender",
  "from": "unauthorized@external.com"
}
```

**And** whitelist validation occurs before content extraction or logging of email content

**And** HTTP status codes are returned correctly:
- 200: Success (whitelisted, processed)
- 403: Forbidden (not whitelisted)
- 500: Internal error (invalid payload, processing failure)

## Technical Notes

- Create `src/plugins/auth.ts` as Fastify plugin
- Register as `preHandler` hook on webhook route:
  ```typescript
  export default async function authPlugin(fastify: FastifyInstance) {
    fastify.addHook('preHandler', async (request, reply) => {
      const payload = request.body as WebhookPayload;
      if (!isWhitelisted(payload.from)) {
        request.log.warn({ from: payload.from }, 'Blocked non-whitelisted sender');
        return reply.code(403).send({ success: false, error: 'Unauthorized sender' });
      }
    });
  }
  ```
- Register auth plugin in webhook route (route-specific, not global)
- Ensure hook runs BEFORE route handler executes
- Test with integration test:
  1. Send request from whitelisted email → 200
  2. Send request from non-whitelisted email → 403
  3. Verify 403 response contains no internal details
- Security: Never reveal which emails are whitelisted in error messages

## Dev Agent Record

**Context Reference:** epic-2-story-2.5.context.xml

**Implementation Notes:**

Successfully integrated whitelist authentication into webhook endpoint using preHandler hook for immediate sender validation.

**Files Modified:**
- `src/routes/webhook.ts` - Added whitelist preHandler hook (82 lines total)
- `src/routes/webhook.test.ts` - Added whitelist authentication tests (471 lines, 20 tests total)

**Key Implementation Details:**
- Added `preHandler` hook to webhook route for authentication
- Hook runs BEFORE main route handler (validates sender first)
- Validates payload structure to ensure 'from' field exists
- Calls `isWhitelisted()` to check sender authorization
- Returns HTTP 403 Forbidden if sender not whitelisted
- Logs blocked attempts with warning level
- Generic error message (no internal details exposed)
- Graceful error handling in preHandler (lets main handler deal with validation errors)

**Security Features:**
- Pre-processing validation (blocks before content extraction)
- No resource consumption for unauthorized senders
- Generic error messages (doesn't reveal whitelist details)
- Structured logging for security monitoring
- HTTP status codes correctly implemented (200/403/500)

**Test Results:**
- 20/20 webhook tests passing (15 original + 5 new)
- 120/120 total tests passing across all modules
- New test coverage includes:
  - Whitelisted email acceptance (1 test)
  - Whitelisted domain acceptance (1 test)
  - Non-whitelisted sender rejection with 403 (1 test)
  - Response doesn't expose internal details (1 test)
  - Blocks before processing content (1 test)

**HTTP Status Codes:**
- 200 OK: Whitelisted sender, processed successfully
- 403 Forbidden: Not whitelisted (unauthorized sender)
- 500 Internal Server Error: Invalid payload or processing failure

**Logging:**
```json
{
  "level": "warn",
  "msg": "Blocked non-whitelisted sender",
  "from": "unauthorized@external.com"
}
```

**Technical Decisions:**
- Used route-specific preHandler (not global plugin) for targeted security
- Validation errors in preHandler are passed to main handler (consistent error handling)
- Generic error message prevents enumeration attacks
- Warning-level logging for blocked attempts (security monitoring)

## Testing Requirements

- [x] Unit tests for all new functions (N/A - integration with existing functions)
- [x] Integration tests for API endpoints (if applicable) (5 new webhook auth tests)
- [x] Error handling validation (403 responses, security testing)
- [x] Configuration validation (if applicable) (Uses existing whitelist config)

## Definition of Done

- [x] All acceptance criteria met
- [ ] Code reviewed and approved
- [x] All tests passing (100%)
- [x] Documentation updated
- [x] No new linter errors
- [ ] Changes committed to git
