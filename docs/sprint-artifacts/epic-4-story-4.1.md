# Story 4.1: Build OpenAI-Compatible Request Formatter

**Epic:** Epic 4: AI Analysis Integration
**Status:** review
**Story Points:** 5
**Prerequisites:** Story 3.5 (content package ready)

## User Story

As a **developer**,
I want **content formatted for OpenAI-compatible API requests**,
So that **the Sparky LLM can analyze both text and images in a single request**.

## Acceptance Criteria

**Given** a content package from Epic 3 (text and/or images)
**When** formatting for LLM API request
**Then** the request body follows OpenAI chat completion format:
```json
{
  "model": "email-analyzer",
  "messages": [
    {
      "role": "user",
      "content": [...]
    }
  ],
  "max_tokens": 1000
}
```

**And** the `content` array is built based on content type:

**For text-only emails:**
```json
"content": [
  { "type": "text", "text": "Email content here..." }
]
```

**For screenshot-only emails:**
```json
"content": [
  {
    "type": "image_url",
    "image_url": { "url": "data:image/png;base64,..." }
  }
]
```

**For hybrid emails (text + screenshots):**
```json
"content": [
  { "type": "text", "text": "Email content here..." },
  {
    "type": "image_url",
    "image_url": { "url": "data:image/png;base64,..." }
  },
  {
    "type": "image_url",
    "image_url": { "url": "data:image/jpeg;base64,..." }
  }
]
```

**And** model name is loaded from configuration (default: "email-analyzer")

**And** max_tokens is loaded from configuration (default: 1000)

**And** request formatting is encapsulated in a dedicated function

**And** formatted request is logged (without base64 data):
```json
{
  "msg": "LLM request formatted",
  "model": "email-analyzer",
  "contentItems": 3,
  "hasText": true,
  "imageCount": 2
}
```

## Technical Notes

- Create `src/services/llm-client.ts`
- Export function: `formatLLMRequest(package: ContentPackage, config: LLMConfig): LLMRequest`
- Type definitions:
  ```typescript
  interface LLMRequest {
    model: string;
    messages: Array<{
      role: 'user';
      content: Array<TextContent | ImageContent>;
    }>;
    max_tokens: number;
  }

  interface TextContent {
    type: 'text';
    text: string;
  }

  interface ImageContent {
    type: 'image_url';
    image_url: {
      url: string; // data URI with base64
    };
  }
  ```
- Build content array: text first (if exists), then all images
- Load config values from settings.json
- Don't log actual content - only metadata (count, types)

## Dev Agent Record

**Context Reference:**
- docs/sprint-artifacts/epic-4-story-4.1.context.xml

**Implementation Notes:**

Successfully implemented OpenAI-compatible LLM request formatter with support for text-only, screenshot-only, and hybrid email content.

**Files Created:**
- `src/services/llm-client.ts` - LLM request formatter (129 lines)
- `src/services/llm-client.test.ts` - Comprehensive formatter tests (420 lines, 20 tests)

**Files Modified:**
- `src/services/config.ts` - Added llm_model to settings schema (+1 field)
- `config/settings.json` - Added llm_model: "qwen2vl-email-analyzer"

**Key Implementation Details:**

**Type Definitions:**
- `TextContent` - Text content item with type and text fields
- `ImageContent` - Image content item with type and image_url object
- `ContentItem` - Union type of text or image content
- `LLMMessage` - User message with content array
- `LLMRequest` - Complete API request with model, messages, max_tokens
- `LLMConfig` - Configuration subset (model name, max tokens)

**Request Formatter Function:**
- Created `formatLLMRequest(contentPackage, config, logger?)` function
- Builds OpenAI-compatible request structure
- Content array ordering: text first (if exists), then all images
- Uses config for model name and max_tokens
- Optional logging of request metadata (not actual content/base64)

**Content Type Support:**
- **Text-only**: Single text content item
- **Screenshot-only**: One or more image_url content items
- **Hybrid**: Text content item followed by image_url items
- Whitespace-only text treated as empty (no text content item)

**Configuration:**
- Model name: `qwen2vl-email-analyzer` (from settings.json)
- Max tokens: 1000 (from settings.json)
- Both values configurable via settings.json

**Request Structure:**
```json
{
  "model": "qwen2vl-email-analyzer",
  "messages": [
    {
      "role": "user",
      "content": [
        { "type": "text", "text": "..." },
        { "type": "image_url", "image_url": { "url": "data:image/png;base64,..." } }
      ]
    }
  ],
  "max_tokens": 1000
}
```

**Test Coverage:**
- 20 comprehensive tests, all passing
- Tests cover:
  - Text-only scenarios (4 tests: basic, long text, whitespace, newlines)
  - Screenshot-only scenarios (3 tests: single, multiple, whitespace text)
  - Hybrid scenarios (3 tests: basic, multiple images, ordering)
  - Configuration options (3 tests: custom model, tokens, both)
  - Request structure (3 tests: structure, single message, content array)
  - Logging (4 tests: with logger, without logger, metadata accuracy)

**Technical Decisions:**
- Use TypeScript interfaces for type safety
- Build content array programmatically (text first, then images)
- Log metadata only (no base64 or content in logs)
- Accept LLMConfig subset instead of full config for testability
- Preserve original text (no trimming) in request

## Testing Requirements

- [x] Unit tests for all new functions (20 comprehensive formatter tests passing)
- [x] Integration tests for API endpoints (if applicable) (N/A - will be tested in Story 4.2)
- [x] Error handling validation (Tested with empty content, whitespace scenarios)
- [x] Configuration validation (if applicable) (Config tests updated and passing)

## Definition of Done

- [x] All acceptance criteria met
- [ ] Code reviewed and approved
- [x] All tests passing (100% - 20 llm-client tests + 15 config tests, 226 total project tests)
- [x] Documentation updated
- [x] No new linter errors
- [ ] Changes committed to git
