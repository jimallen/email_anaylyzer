# Story 2.2: Extract Plain Text Content from Email Body

**Epic:** Epic 2: Secure Email Reception
**Status:** review
**Story Points:** 3
**Prerequisites:** Story 2.1 (webhook endpoint exists)

## User Story

As a **team member**,
I want **the service to extract text content from my email body**,
So that **the analyzer can review my written content for tone and brand issues**.

## Acceptance Criteria

**Given** a webhook payload is received
**When** the payload contains a `text` field (plain text body)
**Then** the text content is extracted and stored for processing

**And** if `text` field is missing or empty, check for `html` field

**And** if `html` field exists, extract plain text from HTML (strip tags)

**And** if both `text` and `html` are missing/empty, set content to empty string (will be handled as error in Epic 3)

**And** the presence of text content is logged:
```json
{
  "msg": "Content extracted",
  "hasText": true,
  "textLength": 245
}
```

**And** extraction logic is encapsulated in a service module

## Technical Notes

- Create `src/services/email-processor.ts`
- Export function: `extractTextContent(payload: WebhookPayload): string`
- Extraction priority: `text` field first, then HTML conversion, then empty string
- For HTML to text conversion in MVP: simple regex to strip tags `text.replace(/<[^>]*>/g, '')`
  - Future enhancement: use proper HTML parser library if needed
- Don't log actual email content - only metadata (hasText, length)
- Call extraction function from webhook route handler
- Store extracted text in request context or local variable for future processing

## Dev Agent Record

**Context Reference:** epic-2-story-2.2.context.xml

**Implementation Notes:**

Successfully implemented text content extraction with priority-based extraction and HTML-to-text conversion.

**Files Created/Modified:**
- `src/services/email-processor.ts` - Email processing service (58 lines)
- `src/services/email-processor.test.ts` - Comprehensive tests (23 tests, 230 lines)
- `src/routes/webhook.ts` - Updated to use extractTextContent and log metadata

**Key Implementation Details:**
- Created `extractTextContent()` function with extraction priority:
  1. Text field first (if present and not empty/whitespace)
  2. HTML field converted to plain text (if text missing)
  3. Empty string (if both missing)
- Created `htmlToPlainText()` helper for HTML conversion:
  - Strips HTML tags with regex (replaces with space to preserve word boundaries)
  - Decodes common HTML entities (&nbsp;, &amp;, &lt;, &gt;, &quot;, &#39;)
  - Normalizes whitespace (multiple spaces/newlines/tabs → single space)
  - Trims leading/trailing whitespace
- Webhook route now calls extractTextContent() and logs metadata
- Logs "Content extracted" with hasText and textLength (not actual content)
- Content metadata logged separately from webhook metadata

**Test Results:**
- 23/23 email processor tests passing
- 15/15 webhook tests still passing
- All previous tests passing (87 total across all modules)
- Coverage includes:
  - Text field extraction
  - HTML field extraction
  - Priority handling (text over HTML)
  - Empty/whitespace handling
  - HTML tag stripping
  - HTML entity decoding
  - Whitespace normalization

**Manual Verification:**
```bash
# Plain text email
POST → textLength: 46, hasText: true

# HTML email
POST → textLength: 20, hasText: true  (HTML tags stripped)

# No content
POST → textLength: 0, hasText: false
```

**Log Output Example:**
```json
{
  "level": 30,
  "reqId": "req-1",
  "hasText": true,
  "textLength": 46,
  "msg": "Content extracted"
}
```

**Technical Decisions:**
- Used simple regex for HTML stripping (MVP requirement)
- Future enhancement: Use proper HTML parser library like 'html-to-text'
- Replaced tags with space (not empty string) to preserve word boundaries
- Separated content extraction logging from webhook logging for clarity
- Content itself is never logged (only metadata) for security/privacy

## Testing Requirements

- [x] Unit tests for all new functions (23 email processor tests)
- [x] Integration tests for API endpoints (if applicable) (Webhook integration verified)
- [x] Error handling validation (Empty content handling tested)
- [x] Configuration validation (if applicable) (N/A for this story)

## Definition of Done

- [x] All acceptance criteria met
- [ ] Code reviewed and approved
- [x] All tests passing (100%)
- [x] Documentation updated
- [x] No new linter errors
- [ ] Changes committed to git
