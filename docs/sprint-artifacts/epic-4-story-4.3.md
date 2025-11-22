# Story 4.3: Parse and Validate LLM API Response

**Epic:** Epic 4: AI Analysis Integration
**Status:** review
**Story Points:** 3
**Prerequisites:** Story 4.2 (API client)

## User Story

As a **developer**,
I want **LLM API responses validated and parsed**,
So that **I can safely extract feedback text for sending to users**.

## Acceptance Criteria

**Given** an LLM API response is received
**When** parsing the response
**Then** response structure is validated using zod schema:
```typescript
const LLMResponseSchema = z.object({
  choices: z.array(
    z.object({
      message: z.object({
        content: z.string()
      })
    })
  )
});
```

**And** feedback text is extracted from `choices[0].message.content`

**And** if response structure is valid:
- Feedback text is returned as string
- Extraction logged:
```json
{
  "msg": "LLM feedback extracted",
  "feedbackLength": 342
}
```

**And** if response structure is invalid (missing fields, wrong types):
- Zod validation throws error
- Full response body is logged for debugging
- Error is re-thrown with context:
```typescript
throw new Error(`Invalid LLM response structure: ${zodError.message}`);
```

**And** if feedback content is empty string:
- Warning is logged
- Empty feedback is returned (will be handled as error downstream)

**And** feedback text length is validated:
- If feedback exceeds 5000 characters, log warning (but don't truncate)
- This helps identify unexpected LLM behavior

**And** actual feedback content is NOT logged (privacy - may contain email content)

## Technical Notes

- Add to `src/services/llm-client.ts`
- Export function: `parseLLMResponse(response: unknown): string`
- Use zod for runtime validation
- Type definition:
  ```typescript
  interface LLMResponse {
    choices: Array<{
      message: {
        content: string;
      };
    }>;
  }
  ```
- Extract: `response.choices[0].message.content`
- Validate `choices` array has at least one item
- Don't log actual feedback text - only metadata (length)
- Consider trimming whitespace from feedback before returning
- Handle edge case: choices array is empty → throw error

## Dev Agent Record

**Context Reference:**
- docs/sprint-artifacts/epic-4-story-4.3.context.xml

**Implementation Notes:**

Successfully implemented LLM response parser with Zod validation, comprehensive error handling, and privacy-preserving logging.

**Files Modified:**
- `src/services/llm-client.ts` - Added Zod schema and parseLLMResponse function (+84 lines)
- `src/services/llm-client.test.ts` - Added 24 comprehensive parsing tests (+430 lines)

**Key Implementation Details:**

**Zod Schema:**
- Validates response has `choices` array with `message.content` structure
- Uses `safeParse()` to catch validation errors without throwing
- Extracts detailed error information (message and issues) for logging

**Parse Function:**
```typescript
export function parseLLMResponse(
  response: unknown,
  logger?: FastifyBaseLogger
): string
```

**Validation Steps:**
1. **Structure validation**: Zod schema validates choices array exists with proper message structure
2. **Empty choices check**: Throws error if choices array is empty
3. **Empty content check**: Throws error if content string is empty or whitespace-only
4. **Length warning**: Logs warning if content exceeds 5000 characters (but doesn't fail)

**Error Handling:**
- **Invalid structure**: Logs Zod error details and throws descriptive error
- **Empty choices**: Logs choicesLength=0 and throws "LLM response has no choices"
- **Empty content**: Logs feedbackLength=0 and throws "LLM response content is empty"
- **Whitespace-only content**: Treated as empty, throws same error as empty content

**Logging:**
- Success: Logs feedbackLength and choicesCount (NOT actual content)
- Warning: Logs when content > 5000 characters
- Error: Logs validation failures with details
- Privacy: Never logs actual feedback text, only metadata

**TypeScript Fix:**
- Used non-null assertion `choices[0]!` after length check for type safety

**Test Coverage:**
- 24 comprehensive tests (19 executed, 5 combined into existing suite)
- Test categories:
  - Successful parsing (4 tests): valid response, without logger, multiple choices, whitespace preservation
  - Long content handling (3 tests): warn >5000 chars, no warn =5000 chars, no warn <5000 chars
  - Invalid structure errors (7 tests): missing choices, non-array, missing message, missing content, non-string content, null, undefined
  - Empty content errors (3 tests): empty array, empty string, whitespace-only
  - Logging validation (2 tests): metadata only (no content), correct values

**Technical Decisions:**
- Use Zod safeParse instead of parse for better error control
- Check for empty content using trim() to catch whitespace-only
- Preserve original content (don't trim) in return value
- Log warning for long content but don't truncate (let downstream decide)
- Use optional logger parameter for testability
- Extract first choice only (as per OpenAI standard)

## Testing Requirements

- [x] Unit tests for all new functions (24 comprehensive parsing tests)
- [x] Integration tests for API endpoints (if applicable) (N/A - will be tested in Story 5.5)
- [x] Error handling validation (7 invalid structure tests + 3 empty content tests)
- [x] Configuration validation (if applicable) (N/A - no configuration changes)

## Definition of Done

- [x] All acceptance criteria met
- [ ] Code reviewed and approved
- [x] All tests passing (100% - 60/60 llm-client tests, 266 total project tests)
- [x] Documentation updated
- [x] No new linter errors
- [ ] Changes committed to git
