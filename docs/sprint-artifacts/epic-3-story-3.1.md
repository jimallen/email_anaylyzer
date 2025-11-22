# Story 3.1: Detect and Parse Image Attachments

**Epic:** Epic 3: Content Extraction & Processing
**Status:** review
**Story Points:** 3
**Prerequisites:** Story 2.1 (webhook endpoint with payload parsing)

## User Story

As a **team member**,
I want **the service to detect when I include screenshots in my email**,
So that **the analyzer can review both my text and visual presentation**.

## Acceptance Criteria

**Given** a webhook payload is received
**When** the payload contains an `attachments` array
**Then** the service iterates through all attachments

**And** for each attachment, extracts:
- `url` (download URL from Resend)
- `filename` (original filename)
- `contentType` (MIME type)

**And** attachment detection is logged:
```json
{
  "msg": "Attachments detected",
  "attachmentCount": 2,
  "attachments": [
    {"filename": "screenshot.png", "contentType": "image/png"},
    {"filename": "draft.jpg", "contentType": "image/jpeg"}
  ]
}
```

**And** if no attachments exist (empty array or undefined), service continues with text-only processing

**And** attachment information is stored for download processing in next story

## Technical Notes

- Extend `src/services/email-processor.ts`
- Export function: `detectAttachments(payload: WebhookPayload): Attachment[]`
- Type definition:
  ```typescript
  interface Attachment {
    url: string;
    filename: string;
    contentType: string;
  }
  ```
- Handle edge cases:
  - `attachments` field missing → return empty array
  - `attachments` is empty array → return empty array
  - Attachments without required fields → skip and log warning
- Don't download yet - just detect and parse metadata
- Log attachment count and types (not URLs or content)

## Dev Agent Record

**Context Reference:**
- /home/jima/Code/email_anaylyzer/docs/sprint-artifacts/epic-3-story-3.1.context.xml

**Implementation Notes:**

Successfully implemented attachment detection and metadata extraction from webhook payloads.

**Files Created/Modified:**
- `src/services/email-processor.ts` - Added `detectAttachments()` function (84 lines total)
- `src/services/email-processor.test.ts` - Added 6 attachment detection tests (367 lines, 29 tests total)
- `src/routes/webhook.ts` - Integrated attachment detection with logging (99 lines total)
- `src/lib/schemas.ts` - Already had Attachment type exported (no changes needed)

**Key Implementation Details:**
- Created `detectAttachments(payload): Attachment[]` function
- Returns empty array for missing or empty attachments (graceful handling)
- Leverages zod schema validation (attachments already validated in payload)
- Extracts metadata: url, filename, contentType
- No downloading yet - just detection and parsing
- Integrated into webhook route with structured logging
- Logs attachment count and metadata (not URLs for security)

**Attachment Logging Format:**
```json
{
  "level": "info",
  "msg": "Attachments detected",
  "attachmentCount": 2,
  "attachments": [
    {"filename": "screenshot.png", "contentType": "image/png"},
    {"filename": "draft.jpg", "contentType": "image/jpeg"}
  ]
}
```

**Test Results:**
- 29/29 email processor tests passing (23 original + 6 new)
- 20/20 webhook tests passing
- 126/126 total tests passing across all modules
- Test coverage includes:
  - Missing attachments field → empty array (1 test)
  - Empty attachments array → empty array (1 test)
  - Single attachment detection (1 test)
  - Multiple attachments detection (1 test)
  - Metadata preservation (1 test)
  - Different content types (1 test)

**Technical Decisions:**
- Simple function leveraging existing zod validation
- No need to re-validate attachment structure (already done in schema)
- Graceful handling of missing/empty attachments
- Metadata-only logging (URLs not logged for security)
- Attachment data available for next story (download processing)

## Testing Requirements

- [x] Unit tests for all new functions (6 attachment detection tests)
- [x] Integration tests for API endpoints (if applicable) (Integrated with webhook endpoint)
- [x] Error handling validation (Missing/empty attachments tested)
- [x] Configuration validation (if applicable) (N/A - uses existing schema validation)

## Definition of Done

- [x] All acceptance criteria met
- [ ] Code reviewed and approved
- [x] All tests passing (100%)
- [x] Documentation updated
- [x] No new linter errors
- [ ] Changes committed to git
