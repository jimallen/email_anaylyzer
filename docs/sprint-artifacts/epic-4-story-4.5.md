# Story 4.5: Add Structured Logging for LLM Analysis Metrics

**Epic:** Epic 4: AI Analysis Integration
**Status:** ready-for-dev
**Story Points:** 3
**Prerequisites:** Stories 4.1, 4.2, 4.3 (full LLM pipeline)

## User Story

As a **system operator**,
I want **comprehensive metrics and logs for LLM analysis**,
So that **I can monitor performance, track usage, and debug issues**.

## Acceptance Criteria

**Given** LLM analysis is performed
**When** logging metrics throughout the process
**Then** the following events are logged:

**1. Analysis Started:**
```json
{
  "level": "info",
  "msg": "LLM analysis started",
  "reqId": "req-abc123",
  "from": "user@company.com",
  "contentType": "hybrid",
  "hasText": true,
  "imageCount": 2
}
```

**2. Analysis Completed (Success):**
```json
{
  "level": "info",
  "msg": "LLM analysis completed",
  "reqId": "req-abc123",
  "duration": 3245,
  "feedbackLength": 342,
  "success": true
}
```

**3. Analysis Failed:**
```json
{
  "level": "error",
  "msg": "LLM analysis failed",
  "reqId": "req-abc123",
  "duration": 25000,
  "errorCode": "LLM_TIMEOUT",
  "success": false
}
```

**And** performance metrics are tracked:
- Total analysis duration (start to completion)
- API call duration (time spent waiting for Sparky)
- Request formatting duration
- Response parsing duration

**And** metrics are logged in a summary:
```json
{
  "msg": "LLM performance metrics",
  "totalDuration": 3456,
  "apiCallDuration": 3245,
  "formattingDuration": 12,
  "parsingDuration": 8,
  "overhead": 191
}
```

**And** correlation ID (request.id) is included in all LLM-related logs

**And** logs never contain:
- Actual email content (text or images)
- Actual LLM feedback text
- Base64 encoded images
- API keys or sensitive config

**And** logs DO contain metadata useful for debugging:
- Sender email
- Content type and structure
- Timing metrics
- Error codes and types
- Request IDs for tracing

## Technical Notes

- Add comprehensive logging throughout `src/services/llm-client.ts`
- Use `request.log` for correlation (pass logger from webhook handler)
- Track timing with `Date.now()` at key points
- Calculate overhead: `totalDuration - (format + apiCall + parse)`
- Log at appropriate levels:
  - `info`: Normal operations (start, complete)
  - `warn`: Recoverable issues (timeout, retry)
  - `error`: Failures (API errors, invalid response)
- Create helper function for performance logging:
  ```typescript
  function logPerformanceMetrics(metrics: PerformanceMetrics, logger: Logger) {
    logger.info(metrics, 'LLM performance metrics');
  }
  ```
- Ensure FR34, FR37, FR38 compliance (analysis results, timing, structured logs)

## Dev Agent Record

**Context Reference:**
- docs/sprint-artifacts/epic-4-story-4.5.context.xml
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
