# Story 3.6: Implement Error Handling for Missing/Invalid Content

**Epic:** Epic 3: Content Extraction & Processing
**Status:** review
**Story Points:** 3
**Prerequisites:** Story 3.5 (content categorization)

## User Story

As a **team member**,
I want **clear error messages when my email has missing or invalid content**,
So that **I understand what went wrong and can fix it**.

## Acceptance Criteria

**Given** content processing encounters errors
**When** handling different error conditions
**Then** appropriate errors are created for each scenario:

**Error 1: No Content (Empty Email)**
- Both text and images are empty/missing
- Error message: "No content found to analyze. Please include email text or screenshot."
- Error logged with context

**Error 2: All Images Failed to Download**
- Text is empty, images were detected but all downloads failed
- Error message: "Unable to download screenshots. Please check file sizes and try again."
- Error logged with download failure details

**Error 3: All Images Invalid Format**
- Text is empty, images downloaded but all were unsupported formats
- Error message: "Unsupported image formats detected. Please use PNG or JPEG screenshots."
- Error logged with detected MIME types

**Error 4: All Images Too Large**
- Images exceed size limit
- Error message: "Screenshots are too large (max 10MB). Please reduce file size and try again."
- Error logged with actual sizes

**And** errors are structured for use in Epic 5 (email response generation):
```typescript
interface ProcessingError {
  code: 'NO_CONTENT' | 'DOWNLOAD_FAILED' | 'INVALID_FORMAT' | 'SIZE_EXCEEDED';
  message: string; // User-friendly message
  details: Record<string, unknown>; // Technical details for logging
}
```

**And** errors are logged with full context for debugging:
```json
{
  "level": "error",
  "msg": "Content processing failed",
  "errorCode": "NO_CONTENT",
  "from": "user@company.com",
  "hasTextAttempt": false,
  "imageAttempts": 0
}
```

**And** processing errors do NOT crash the service - errors are returned to webhook handler

## Technical Notes

- Create `src/lib/errors.ts` for error classes
- Define custom error types:
  ```typescript
  export class ContentProcessingError extends Error {
    constructor(
      public code: string,
      public userMessage: string,
      public details: Record<string, unknown>
    ) {
      super(userMessage);
      this.name = 'ContentProcessingError';
    }
  }
  ```
- Add validation in email-processor service
- Throw `ContentProcessingError` for each scenario
- Webhook handler will catch and handle (Epic 5)
- Error messages should be user-friendly, non-technical
- Log technical details separately (not in user-facing message)

## Dev Agent Record

**Context Reference:** epic-3-story-3.6.context.xml

**Implementation Notes:**

Successfully implemented comprehensive error handling for missing and invalid email content with user-friendly error messages and detailed logging.

**Files Created:**
- `src/lib/errors.ts` - Custom error classes and helper functions (80 lines)
- `src/lib/errors.test.ts` - Comprehensive error class tests (149 lines, 14 tests)

**Files Modified:**
- `src/services/email-processor.ts` - Added validation function and ProcessingContext interface (222 lines total, +70 lines)
- `src/services/email-processor.test.ts` - Added 14 comprehensive validation tests (912 lines total, +349 lines)

**Key Implementation Details:**

**Error Infrastructure:**
- Created `ContentProcessingError` class extending Error
- Defined 4 error codes: NO_CONTENT, DOWNLOAD_FAILED, INVALID_FORMAT, SIZE_EXCEEDED
- Each error includes:
  - `code`: Machine-readable error code
  - `userMessage`: User-friendly, actionable message
  - `details`: Technical details for logging
- Helper functions for creating each error type with predefined messages

**Validation Logic:**
- Added `ProcessingContext` interface to track processing attempts and failures
- Created `validateContentPackage()` function with smart error prioritization:
  1. Return early if content is valid (has text or images)
  2. DOWNLOAD_FAILED: All attachments failed to download
  3. INVALID_FORMAT: Downloaded but all formats unsupported
  4. SIZE_EXCEEDED: Downloaded but all too large
  5. NO_CONTENT: No attachments and no text
- Comprehensive error details included in all scenarios
- Optional logging support for debugging

**Error Messages (User-Friendly):**
- NO_CONTENT: "No content found to analyze. Please include email text or screenshot."
- DOWNLOAD_FAILED: "Unable to download screenshots. Please check file sizes and try again."
- INVALID_FORMAT: "Unsupported image formats detected. Please use PNG or JPEG screenshots."
- SIZE_EXCEEDED: "Screenshots are too large (max 10MB). Please reduce file size and try again."

**Test Coverage:**
- 14 error class tests (all passing)
- 14 validation tests (all passing)
- Total: 28 new tests for error handling
- Tests cover:
  - Error class creation and properties
  - Helper function correctness
  - All validation scenarios (valid and invalid)
  - Error prioritization logic
  - Error details completeness
  - User-friendly message quality

**Technical Decisions:**
- Use custom error class for structured error handling
- Separate user-facing messages from technical details
- Error prioritization based on processing workflow
- No crashes - errors are thrown and caught by webhook handler
- Comprehensive logging for debugging
- ProcessingContext provides full audit trail of what was attempted

## Testing Requirements

- [x] Unit tests for all new functions (28 tests passing: 14 error class + 14 validation)
- [x] Integration tests for API endpoints (if applicable) (N/A - will be tested in Epic 5)
- [x] Error handling validation (All error scenarios tested)
- [x] Configuration validation (if applicable) (N/A - no config needed)

## Definition of Done

- [x] All acceptance criteria met
- [ ] Code reviewed and approved
- [x] All tests passing (100% - 71 tests in email processor + errors, 206 total project tests)
- [x] Documentation updated
- [x] No new linter errors
- [ ] Changes committed to git
