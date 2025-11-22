# Story 5.5: Orchestrate End-to-End Request Flow in Webhook Handler

**Epic:** Epic 5: Response Delivery & User Feedback
**Status:** ready-for-dev
**Story Points:** 8
**Prerequisites:** Epic 3 complete, Epic 4 complete, Stories 5.1-5.4

## User Story

As a **team member**,
I want **the complete email analysis workflow to execute seamlessly**,
So that **I send a draft email and receive feedback without any manual steps**.

## Acceptance Criteria

**Given** a webhook request is received and passes whitelist validation
**When** processing the request end-to-end
**Then** the following steps execute in order:

**1. Content Extraction (Epic 3)**
- Extract text content
- Detect and download images
- Validate and encode images
- Categorize content type

**2. LLM Analysis (Epic 4)**
- Format LLM request
- Call Sparky API
- Parse response
- Extract feedback

**3. Response Delivery (Epic 5)**
- Format success email
- Send via Resend with retry
- Log delivery status

**And** if ANY step fails with a known error (ContentProcessingError or LLMError):
- Catch error in webhook handler
- Format error email with user-friendly message
- Send error email via Resend with retry
- Log error details
- Return HTTP 200 to Resend (processed, even if failed internally)

**And** if unexpected error occurs:
- Catch generic Error
- Log with full stack trace
- Send generic error email to user
- Return HTTP 500 to Resend

**And** total processing time is tracked and logged:
```json
{
  "msg": "Request processing completed",
  "reqId": "req-abc123",
  "from": "user@company.com",
  "totalDuration": 4567,
  "success": true,
  "emailSent": true
}
```

**And** processing completes within 30 seconds target (FR24):
- Content extraction: <2s
- Image processing: <10s
- LLM analysis: <25s
- Email send: <2s
- Total budget: ~39s (allows some overhead)

**And** if 30-second target is missed, warning is logged but processing continues

**And** all processing stages are logged for debugging and monitoring

**And** correlation ID (request.id) ties all logs together for a single request

## Technical Notes

- Update `src/routes/webhook.ts` route handler
- Orchestration pattern:
  ```typescript
  fastify.post('/webhook/inbound-email', async (request, reply) => {
    const startTime = Date.now();
    try {
      // 1. Extract content (Epic 3)
      const content = await extractAndProcessContent(payload, request.log);

      // 2. Analyze with LLM (Epic 4)
      const feedback = await analyzeLLM(content, request.log);

      // 3. Send response (Epic 5)
      const emailContent = formatSuccessEmail(payload.from, payload.subject, feedback);
      await sendEmailWithRetry(emailContent.to, emailContent.subject, emailContent.body);

      const duration = Date.now() - startTime;
      request.log.info({ duration, success: true }, 'Request completed');
      return { success: true };

    } catch (error) {
      if (error instanceof ContentProcessingError || error instanceof LLMError) {
        // Send error email
        const errorEmail = formatErrorEmail(payload.from, error);
        await sendEmailWithRetry(errorEmail.to, errorEmail.subject, errorEmail.body);
        return { success: true }; // Processed, even though analysis failed
      }
      // Unexpected error
      request.log.error({ err: error }, 'Unexpected error');
      return reply.code(500).send({ success: false });
    }
  });
  ```
- Error handling: known errors get error emails, unknown errors return 500
- Timing: track and log total duration, warn if >30s
- FR24 compliance: target <30s end-to-end
- FR35, FR36 compliance: log delivery status, log errors with context
- Always return 200 for processed requests (even if analysis failed)
- Only return 500 for truly unexpected errors

## Dev Agent Record

**Context Reference:** docs/sprint-artifacts/epic-5-story-5.5.context.xml
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
