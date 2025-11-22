# Story 5.4: Implement Retry Logic for Failed Email Sends

**Epic:** Epic 5: Response Delivery & User Feedback
**Status:** ready-for-dev
**Story Points:** 3
**Prerequisites:** Story 5.1 (Resend client)

## User Story

As a **system operator**,
I want **automatic retry for failed email sends**,
So that **temporary Resend API issues don't prevent users from receiving feedback**.

## Acceptance Criteria

**Given** an email send attempt fails
**When** the initial send fails
**Then** the failure is logged with details:
```json
{
  "level": "warn",
  "msg": "Email send failed, retrying",
  "to": "user@company.com",
  "attempt": 1,
  "error": "Network timeout"
}
```

**And** service waits 1 second before retry (exponential backoff)

**And** exactly ONE retry is attempted (total: 2 attempts maximum)

**And** if retry succeeds:
- Success is logged:
```json
{
  "level": "info",
  "msg": "Email sent on retry",
  "to": "user@company.com",
  "attempt": 2,
  "totalDuration": 1456
}
```
- Function returns success result

**And** if retry also fails:
- Permanent failure is logged:
```json
{
  "level": "error",
  "msg": "Email send permanently failed",
  "to": "user@company.com",
  "attempts": 2,
  "lastError": "HTTP 503 Service Unavailable"
}
```
- Function returns failure result (no exception thrown)

**And** retry logic handles these failures:
- Network timeouts
- HTTP 5xx errors (server errors)
- Connection errors

**And** retry logic does NOT retry:
- HTTP 4xx errors (client errors like bad API key)
- Invalid email addresses
- Missing configuration

**And** total retry duration does not exceed 5 seconds (1s wait + retries)

## Technical Notes

- Add to `src/services/resend-client.ts`
- Export function: `sendEmailWithRetry(to: string, subject: string, body: string): Promise<EmailResult>`
- Retry pattern:
  ```typescript
  async function sendEmailWithRetry(...) {
    try {
      return await sendEmail(...);
    } catch (error) {
      if (isRetryable(error)) {
        await sleep(1000); // 1 second wait
        try {
          return await sendEmail(...);
        } catch (retryError) {
          // Log permanent failure
          return { success: false, error: retryError };
        }
      }
      throw error; // Non-retryable errors
    }
  }
  ```
- Retryable errors: timeouts, 5xx status codes, network errors
- Non-retryable: 4xx status codes, validation errors
- Track total duration (initial + wait + retry)
- FR25 compliance: retry once before logging permanent failure

## Dev Agent Record

**Context Reference:** docs/sprint-artifacts/epic-5-story-5.4.context.xml
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
