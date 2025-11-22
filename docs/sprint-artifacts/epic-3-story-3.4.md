# Story 3.4: Encode Images as Base64 for LLM API

**Epic:** Epic 3: Content Extraction & Processing
**Status:** review
**Story Points:** 2
**Prerequisites:** Story 3.3 (validated images)

## User Story

As a **developer**,
I want **images encoded as base64 strings**,
So that **they can be embedded in JSON requests to the LLM API**.

## Acceptance Criteria

**Given** validated images (Buffer format)
**When** encoding to base64
**Then** each image Buffer is converted to base64 string using Node's built-in encoding:
```typescript
const base64 = buffer.toString('base64');
```

**And** base64 strings are prefixed with data URI scheme:
- PNG: `data:image/png;base64,<base64_string>`
- JPEG/JPG: `data:image/jpeg;base64,<base64_string>`

**And** encoded images are returned as array with metadata:
```typescript
interface EncodedImage {
  filename: string;
  contentType: string;
  dataUrl: string; // Full data URI with base64
}
```

**And** encoding is logged (without actual base64 data):
```json
{
  "msg": "Images encoded for LLM",
  "imageCount": 2,
  "totalSize": 456789
}
```

**And** base64 encoding completes in <1 second for images under 10MB

**And** encoded images are ready for inclusion in LLM API request content array

## Technical Notes

- Add to `src/services/image-processor.ts`
- Export function: `encodeImage(buffer: Buffer, contentType: string): string`
- Built-in encoding: `buffer.toString('base64')` (no external library needed)
- Data URI format: `data:${contentType};base64,${base64String}`
- Process multiple images: map over validated image array
- Return type: `EncodedImage[]`
- No need to store encoded images to disk - keep in memory only
- Calculate total size for logging: sum of buffer lengths before encoding

## Dev Agent Record

**Context Reference:** epic-3-story-3.4.context.xml

**Implementation Notes:**

Successfully implemented base64 encoding for images to prepare them for LLM API requests.

**Files Modified:**
- `src/services/image-processor.ts` - Added encoding interface and functions (271 lines total, +67 lines)
- `src/services/image-processor.test.ts` - Added 14 comprehensive encoding tests (729 lines total, +241 lines)

**Key Implementation Details:**
- Added `EncodedImage` interface with filename, contentType, and dataUrl fields
- Created `encodeImage(buffer, contentType)` function
  - Converts Buffer to base64 using Node's built-in `buffer.toString('base64')`
  - Normalizes `image/jpg` → `image/jpeg` in data URI
  - Creates proper data URI: `data:image/png;base64,<base64>`
  - No external libraries needed
- Created `encodeImages(images, logger?)` function
  - Maps over image array to encode all images
  - Calculates total size before encoding for logging
  - Logs imageCount and totalSize (not base64 strings)
  - Returns array of EncodedImage objects ready for LLM API

**Data URI Format:**
- PNG: `data:image/png;base64,<base64_string>`
- JPEG/JPG: `data:image/jpeg;base64,<base64_string>` (jpg normalized to jpeg)

**Test Coverage:**
- 14 new encoding tests, all passing (38 total image processor tests)
- Tests cover:
  - PNG and JPEG encoding (2 tests)
  - JPG normalization to JPEG (1 test)
  - Empty buffer handling (1 test)
  - Binary data round-trip (1 test)
  - Large buffer handling (1 test)
  - Multiple images encoding (1 test)
  - Empty array handling (1 test)
  - Logging verification (1 test)
  - No logger provided (1 test)
  - Metadata preservation (1 test)
  - Mixed image types (1 test)
  - Total size calculation (1 test)

**Performance:**
- Base64 encoding is fast (<1ms for typical images)
- No disk I/O - all in-memory operations
- Built-in Node.js encoding (no external dependencies)

**Technical Decisions:**
- Use Node's built-in base64 encoding (fast and reliable)
- Normalize jpg → jpeg for API consistency
- Keep encoded images in memory (no disk storage)
- Log metadata only (security/performance)

## Testing Requirements

- [x] Unit tests for all new functions (14 encoding tests passing)
- [x] Integration tests for API endpoints (if applicable) (N/A - utility functions)
- [x] Error handling validation (Empty buffers, binary data tested)
- [x] Configuration validation (if applicable) (N/A - no config needed)

## Definition of Done

- [x] All acceptance criteria met
- [ ] Code reviewed and approved
- [x] All tests passing (100% - 38/38 image processor tests, 164 total tests)
- [x] Documentation updated
- [x] No new linter errors
- [ ] Changes committed to git
