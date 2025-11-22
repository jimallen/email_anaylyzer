# Story 5.1: Implement Resend Email Sending Client

**Epic:** Epic 5: Response Delivery & User Feedback
**Status:** ready-for-dev
**Story Points:** 5
**Prerequisites:** Story 1.2 (config with RESEND_API_KEY)

## User Story

As a **developer**,
I want **a Resend API client for sending email responses**,
So that **feedback can be delivered to users programmatically**.

## Acceptance Criteria

**Given** feedback text is ready to send
**When** sending an email via Resend API
**Then** HTTP POST request is made to Resend's sending endpoint

**And** request uses native fetch with these settings:
- Endpoint: Resend REST API `/emails` endpoint
- Method: POST
- Headers: `{ 'Authorization': 'Bearer <RESEND_API_KEY>', 'Content-Type': 'application/json' }`
- Body: JSON with email details
- Timeout: 10 seconds (from config: `resend_timeout_ms`)

**And** request body includes:
```json
{
  "from": "Email Analyzer <analyzer@yourdomain.com>",
  "to": "user@company.com",
  "subject": "Re: Original Subject",
  "text": "Feedback content..."
}
```

**And** successful send (HTTP 200/201) returns response with email ID

**And** send timing is tracked and logged:
```json
{
  "msg": "Email sent via Resend",
  "to": "user@company.com",
  "emailId": "abc123-def456",
  "duration": 234
}
```

**And** if send fails (timeout, network error, HTTP error):
- Error is caught and logged with details
- Error includes status code and response body
- Error is re-thrown for retry logic

**And** timeout is enforced using AbortController (10 seconds)

**And** from address is configurable (from config or environment variable)

## Technical Notes

- Create `src/services/resend-client.ts`
- Export function: `sendEmail(to: string, subject: string, body: string): Promise<EmailResult>`
- Type definition:
  ```typescript
  interface EmailResult {
    success: boolean;
    emailId?: string;
    error?: string;
  }
  ```
- Use native fetch (Node 25 built-in)
- Load API key from environment: `process.env.RESEND_API_KEY`
- Load from address from config (default: "Email Analyzer <noreply@yourdomain.com>")
- Timeout pattern with AbortController (similar to LLM API)
- Track timing: `const start = Date.now(); const duration = Date.now() - start;`
- Handle Resend API errors (4xx, 5xx) with proper error messages
- Don't log email body content - only metadata (to, subject, result)

## Dev Agent Record

**Context Reference:**
- /home/jima/Code/email_anaylyzer/docs/sprint-artifacts/epic-5-story-5.1.context.xml
**Implementation Notes:** _[To be filled during development]_

## Testing Requirements

- [ ] Unit tests for all new functions
- [ ] Integration tests for API endpoints (if applicable)
- [ ] Error handling validation
- [ ] Configuration validation (if applicable)

## Definition of Done

- [ ] All acceptance criteria met
- [ ] Code reviewed and approved
- [ ] All tests passing (100%)
- [ ] Documentation updated
- [ ] No new linter errors
- [ ] Changes committed to git
