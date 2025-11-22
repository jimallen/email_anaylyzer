# Story 2.1: Create Webhook Endpoint with Payload Validation

**Epic:** Epic 2: Secure Email Reception
**Status:** review
**Story Points:** 5
**Prerequisites:** Epic 1 complete (Stories 1.1-1.5)

## User Story

As a **team member**,
I want **the service to receive emails via Resend webhook**,
So that **I can send draft emails to the analyzer service for review**.

## Acceptance Criteria

**Given** the service is running with configuration loaded
**When** Resend sends a webhook POST to `/webhook/inbound-email`
**Then** the endpoint accepts the request and returns HTTP 200

**And** the webhook payload is validated using zod schema with these required fields:
- `from` (string, email format)
- `to` (string, email format)
- `subject` (string)
- `text` (string, optional)
- `html` (string, optional)
- `attachments` (array, optional, each with `url`, `filename`, `contentType`)

**And** invalid payloads return HTTP 500 with error logged

**And** the endpoint extracts and logs metadata:
- Sender email
- Recipient email
- Subject line
- Timestamp (current time in ISO 8601)
- Correlation ID (Fastify request.id)

**And** request processing is logged:
```json
{
  "level": "info",
  "reqId": "req-abc123",
  "msg": "Webhook received",
  "from": "user@company.com",
  "to": "analyzer@resend.dev",
  "subject": "Draft: Customer email"
}
```

## Technical Notes

- Create `src/routes/webhook.ts` as Fastify plugin
- Create `src/lib/schemas.ts` for zod schemas
- Define `WebhookPayloadSchema` using zod with email validation
- Use TypeScript type inference: `type WebhookPayload = z.infer<typeof WebhookPayloadSchema>`
- Register webhook route in `src/app.ts`
- Route pattern:
  ```typescript
  export default async function webhookRoute(fastify: FastifyInstance) {
    fastify.post('/webhook/inbound-email', async (request, reply) => {
      const payload = WebhookPayloadSchema.parse(request.body);
      request.log.info({ from: payload.from, subject: payload.subject }, 'Webhook received');
      return { success: true };
    });
  }
  ```
- Zod parse errors automatically return 500 (handled by error plugin)
- For now, just acknowledge receipt - actual processing comes in later epics

## Dev Agent Record

**Context Reference:**
- docs/sprint-artifacts/epic-2-story-2.1.context.xml

**Implementation Notes:**

Successfully implemented webhook endpoint with zod payload validation and structured logging.

**Files Created/Modified:**
- `src/lib/schemas.ts` - Zod schemas for webhook payload validation (40 lines)
- `src/routes/webhook.ts` - Webhook endpoint implementation (47 lines)
- `src/routes/webhook.test.ts` - Comprehensive tests (15 tests, 265 lines)

**Key Implementation Details:**
- Created WebhookPayloadSchema with zod for payload validation
- Required fields: from (email), to (email), subject (string)
- Optional fields: text, html, attachments (array with url, filename, contentType)
- Attachment schema validates URL format, requires filename and contentType
- POST endpoint at /webhook/inbound-email
- Returns HTTP 200 with {success: true} for valid payloads
- Returns HTTP 500 with error details for invalid payloads
- Logs webhook metadata: from, to, subject, hasText, hasAttachments, attachmentCount, timestamp
- Uses correlation ID (request.id) for request tracing

**Test Results:**
- 15/15 webhook tests passing
- Valid payload tests: text-only, HTML-only, with attachments, multiple attachments, hybrid content
- Invalid payload tests: bad emails, missing fields, invalid URLs, empty filenames
- All previous tests still passing (49 total: config 15, health 16, logger 18)

**Manual Testing:**
- Valid payload: Returns 200, logs structured metadata with correlation ID
- Invalid payload: Returns 500 with zod error, logs validation failure at error level

**Log Output Example (Valid):**
```json
{
  "level": 30,
  "reqId": "req-1",
  "from": "sender@example.com",
  "to": "analyzer@resend.dev",
  "subject": "Draft: Customer email",
  "hasText": true,
  "hasAttachments": false,
  "attachmentCount": 0,
  "timestamp": "2025-11-17T16:52:43.886Z",
  "msg": "Webhook received"
}
```

**Log Output Example (Invalid):**
```json
{
  "level": 50,
  "reqId": "req-2",
  "err": {
    "type": "ZodError",
    "message": "Invalid sender email address",
    "stack": "..."
  },
  "body": {"from": "invalid-email", ...},
  "msg": "Webhook validation failed"
}
```

**Technical Decisions:**
- Used zod's built-in email validation for from/to fields
- Created separate AttachmentSchema for reusability
- Error handling in try/catch to return 500 on validation errors
- Logged both successful receipts (info) and validation failures (error)
- No authentication yet - will be added in Story 2.5 (whitelist integration)

## Testing Requirements

- [x] Unit tests for all new functions (15 webhook endpoint tests)
- [x] Integration tests for API endpoints (if applicable) (Fastify inject testing)
- [x] Error handling validation (Invalid payloads, zod validation errors)
- [x] Configuration validation (if applicable) (Schema validation tests)

## Definition of Done

- [x] All acceptance criteria met
- [ ] Code reviewed and approved
- [x] All tests passing (100%)
- [x] Documentation updated
- [x] No new linter errors
- [ ] Changes committed to git
