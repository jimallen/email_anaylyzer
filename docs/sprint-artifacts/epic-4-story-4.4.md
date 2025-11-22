# Story 4.4: Implement Comprehensive Error Handling for LLM Failures

**Epic:** Epic 4: AI Analysis Integration
**Status:** ready-for-dev
**Story Points:** 5
**Prerequisites:** Stories 4.2, 4.3 (API client, response parser)

## User Story

As a **team member**,
I want **graceful handling of LLM API failures**,
So that **I receive a helpful error message even when the AI is unavailable**.

## Acceptance Criteria

**Given** LLM API call encounters an error
**When** handling different failure scenarios
**Then** appropriate errors are created for each case:

**Error 1: Timeout (>25 seconds)**
- AbortController aborts request
- Error code: `LLM_TIMEOUT`
- User message: "Analysis is taking longer than expected. Please try again in a moment."
- Technical details logged: duration, endpoint URL

**Error 2: Network Error (DNS, connection refused, etc.)**
- Fetch throws network error
- Error code: `LLM_NETWORK_ERROR`
- User message: "Unable to reach analysis service. Please try again shortly."
- Technical details logged: error type, endpoint URL

**Error 3: HTTP Error (non-200 status)**
- API returns 4xx or 5xx status
- Error code: `LLM_HTTP_ERROR`
- User message: "Analysis service returned an error. Please try again later."
- Technical details logged: status code, response body

**Error 4: Invalid Response Structure**
- Response doesn't match expected schema
- Error code: `LLM_INVALID_RESPONSE`
- User message: "Received unexpected response from analysis service. Please try again."
- Technical details logged: validation error, response snippet

**And** errors are structured for Epic 5 (response generation):
```typescript
class LLMError extends Error {
  constructor(
    public code: string,
    public userMessage: string,
    public details: Record<string, unknown>
  ) {
    super(userMessage);
    this.name = 'LLMError';
  }
}
```

**And** all LLM errors are logged with full context:
```json
{
  "level": "error",
  "msg": "LLM API call failed",
  "errorCode": "LLM_TIMEOUT",
  "duration": 25000,
  "from": "user@company.com",
  "contentType": "hybrid"
}
```

**And** errors do NOT crash the service - they're caught in webhook handler for email response

## Technical Notes

- Add to `src/lib/errors.ts`
- Define `LLMError` class (extends Error)
- Error codes: `LLM_TIMEOUT`, `LLM_NETWORK_ERROR`, `LLM_HTTP_ERROR`, `LLM_INVALID_RESPONSE`
- Wrap all fetch errors in try/catch in llm-client.ts
- Re-throw as `LLMError` with appropriate code and user message
- Log technical details before re-throwing
- Webhook handler (Epic 5) will catch `LLMError` and send fallback email
- User messages should be non-technical and actionable ("try again")

## Dev Agent Record

**Context Reference:**
- docs/sprint-artifacts/epic-4-story-4.4.context.xml
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
