# Story 3.3: Validate Image Formats and Size Limits

**Epic:** Epic 3: Content Extraction & Processing
**Status:** review
**Story Points:** 3
**Prerequisites:** Story 3.2 (image download)

## User Story

As a **system operator**,
I want **image format and size validation**,
So that **only supported formats are processed and large files don't consume excessive resources**.

## Acceptance Criteria

**Given** an image is downloaded successfully
**When** validation checks run
**Then** MIME type is checked against supported formats:
- `image/png` → supported
- `image/jpeg` → supported
- `image/jpg` → supported
- All others → unsupported

**And** file size is checked against configured limit (from config: `max_image_size_bytes`, default 10MB)

**And** if image is valid (supported format AND under size limit):
- Validation passes
- Image proceeds to base64 encoding

**And** if MIME type is unsupported:
- Image is rejected
- Warning logged:
```json
{
  "level": "warn",
  "msg": "Unsupported image format",
  "filename": "document.pdf",
  "contentType": "application/pdf"
}
```
- Unsupported image skipped, processing continues

**And** if image exceeds size limit:
- Image is rejected
- Warning logged:
```json
{
  "level": "warn",
  "msg": "Image exceeds size limit",
  "filename": "large.png",
  "size": 15728640,
  "limit": 10485760
}
```
- Oversized image skipped, processing continues

**And** validation results include list of valid images only

## Technical Notes

- Add to `src/services/image-processor.ts`
- Export function: `validateImage(attachment: Attachment, data: Buffer): boolean`
- Supported MIME types constant:
  ```typescript
  const SUPPORTED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/jpg'];
  ```
- Size check: `data.byteLength <= maxSize`
- MIME check: `SUPPORTED_IMAGE_TYPES.includes(contentType)`
- Load max size from config service
- Return validated images only (filter invalid)
- Consider: Check actual file header (magic bytes) for extra security vs just trusting MIME type
  - MVP: Trust MIME type from Resend
  - Future: Add magic byte verification

## Dev Agent Record

**Context Reference:** epic-3-story-3.3.context.xml

**Implementation Notes:**

Successfully implemented image validation for MIME types and size limits with comprehensive testing.

**Files Modified:**
- `src/services/image-processor.ts` - Added validation constants and function (204 lines total, +54 lines)
- `src/services/image-processor.test.ts` - Added 12 comprehensive validation tests (488 lines total, +180 lines)

**Key Implementation Details:**
- Exported `SUPPORTED_IMAGE_TYPES` constant: `['image/png', 'image/jpeg', 'image/jpg']`
- Created `validateImage(attachment, data, maxSizeBytes, logger?)` function
  - MIME type validation against supported formats
  - Size validation using `data.byteLength <= maxSizeBytes`
  - Returns boolean: true if valid, false if invalid
  - Logs warnings for unsupported formats and oversized images
  - No exceptions thrown - graceful validation
- Leverages existing config: `maxImageSizeBytes` (10MB default)
- Simple validation logic: format check → size check → return result

**Validation Logic:**
1. Check MIME type against SUPPORTED_IMAGE_TYPES
   - If unsupported → log warning, return false
2. Check buffer size against maxSizeBytes
   - If oversized → log warning, return false
3. If both pass → return true

**Test Coverage:**
- 12 new validation tests, all passing
- Tests cover:
  - Valid formats: PNG, JPEG, JPG (3 tests)
  - Unsupported formats: PDF, GIF, WebP (3 tests)
  - Size validation: over limit, at limit (2 tests)
  - Logging verification: unsupported format, oversized image (2 tests)
  - No logger provided (1 test)
  - SUPPORTED_IMAGE_TYPES constant export (1 test)

**Technical Decisions:**
- Trust MIME type from Resend (MVP approach)
- No magic byte verification (future enhancement)
- Return boolean for simple filtering in calling code
- Warnings logged but don't throw exceptions
- Exact size match (<=) allows images at limit

## Testing Requirements

- [x] Unit tests for all new functions (12 validation tests passing)
- [x] Integration tests for API endpoints (if applicable) (N/A - utility function)
- [x] Error handling validation (Unsupported formats and oversized images tested)
- [x] Configuration validation (if applicable) (maxImageSizeBytes from config, tested with various limits)

## Definition of Done

- [x] All acceptance criteria met
- [ ] Code reviewed and approved
- [x] All tests passing (100% - 24/24 image processor tests, 150 total tests)
- [x] Documentation updated
- [x] No new linter errors
- [ ] Changes committed to git
