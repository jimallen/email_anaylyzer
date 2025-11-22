# Story 5.3: Format Error Email Responses for Failures

**Epic:** Epic 5: Response Delivery & User Feedback
**Status:** ready-for-dev
**Story Points:** 3
**Prerequisites:** Stories 3.6 (content errors), 4.4 (LLM errors)

## User Story

As a **team member**,
I want **helpful error messages when analysis fails**,
So that **I understand what went wrong and know what to do next**.

## Acceptance Criteria

**Given** an error occurred during processing (content errors or LLM errors)
**When** formatting an error email response
**Then** subject line is: `Email Analysis Error`

**And** email body is plain text with user-friendly error message from the error object

**And** error email templates exist for each error type:

**Content Processing Errors:**
```
Hi,

I couldn't analyze your email draft:

[User-friendly error message]

Please correct the issue and try again.

---
Email Analyzer
```

**LLM Errors:**
```
Hi,

I encountered an issue while analyzing your email:

[User-friendly error message]

This is usually temporary. Please try sending your draft again in a moment.

---
Email Analyzer
```

**And** error messages are taken from error objects (ContentProcessingError or LLMError)

**And** technical details are NOT included in user-facing email (logged separately)

**And** error email formatting is logged:
```json
{
  "msg": "Error email formatted",
  "to": "user@company.com",
  "errorCode": "LLM_TIMEOUT"
}
```

**And** different templates are used based on error type:
- Content errors (NO_CONTENT, INVALID_FORMAT, etc.) → actionable fix
- LLM errors (TIMEOUT, NETWORK_ERROR, etc.) → retry suggestion

## Technical Notes

- Add to `src/services/email-formatter.ts`
- Export function: `formatErrorEmail(to: string, error: ContentProcessingError | LLMError): EmailContent`
- Use error.userMessage for the specific error description
- Template selection based on error.code or error type
- Keep messages concise and actionable
- Avoid technical jargon (no stack traces, error codes in user email)
- Error codes are logged, not emailed
- Consider: Add support contact info in footer if available

## Dev Agent Record

**Context Reference:** docs/sprint-artifacts/epic-5-story-5.3.context.xml
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
