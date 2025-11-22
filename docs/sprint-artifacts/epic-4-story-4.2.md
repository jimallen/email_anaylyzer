# Story 4.2: Implement LLM API Client with Timeout Handling

**Epic:** Epic 4: AI Analysis Integration
**Status:** review
**Story Points:** 5
**Prerequisites:** Story 4.1 (request formatter)

## User Story

As a **team member**,
I want **the service to call the Sparky LLM API for analysis**,
So that **I receive AI-generated feedback on my email draft**.

## Acceptance Criteria

**Given** an LLM request is formatted
**When** calling the Sparky API
**Then** HTTP POST request is made to configured endpoint (from config: SPARKY_LLM_URL)

**And** request uses native fetch with these settings:
- Method: POST
- Headers: `{ 'Content-Type': 'application/json' }`
- Body: JSON.stringify(llmRequest)
- No authentication (internal network)

**And** timeout is enforced at 25 seconds using AbortController:
```typescript
const controller = new AbortController();
const timeoutId = setTimeout(() => controller.abort(), 25000);
const response = await fetch(url, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(request),
  signal: controller.signal
});
clearTimeout(timeoutId);
```

**And** successful API call (HTTP 200) returns response body as JSON

**And** API call timing is tracked and logged:
```json
{
  "msg": "LLM API call completed",
  "duration": 3245,
  "statusCode": 200
}
```

**And** if timeout occurs (>25 seconds):
- AbortController triggers abort
- Error is caught and wrapped in custom error
- Timeout logged:
```json
{
  "level": "warn",
  "msg": "LLM API timeout",
  "duration": 25000,
  "url": "https://sparky.tail468b81.ts.net/v1/chat/completions"
}
```

**And** if API returns non-200 status:
- Response is logged with status code and body
- Error is thrown for handling

**And** if network error occurs:
- Error is caught and logged with details
- Error is re-thrown for upstream handling

## Technical Notes

- Add to `src/services/llm-client.ts`
- Export function: `callLLMAPI(request: LLMRequest, timeout: number): Promise<LLMResponse>`
- Use native fetch (Node 25 built-in)
- AbortController pattern (see acceptance criteria)
- Track timing: `const start = Date.now(); const duration = Date.now() - start;`
- Error handling: catch fetch errors, timeout errors, HTTP errors separately
- Load timeout from config (25000ms default)
- Load API URL from environment variable (SPARKY_LLM_URL)
- Return type: `Promise<LLMResponse>` where response has OpenAI-compatible structure

## Dev Agent Record

**Context Reference:**
- docs/sprint-artifacts/epic-4-story-4.2.context.xml

**Implementation Notes:**

Successfully implemented LLM API client with AbortController-based timeout handling, comprehensive error handling, and request timing tracking.

**Files Modified:**
- `src/services/llm-client.ts` - Added LLMResponse interface and callLLMAPI function (+113 lines)
- `src/services/llm-client.test.ts` - Added 21 comprehensive API client tests (+468 lines)

**Key Implementation Details:**

**Type Definitions:**
- `LLMChoice` - API response choice with index, message, finish_reason
- `LLMResponse` - OpenAI-compatible response with id, object, created, model, choices array

**API Client Function:**
- Created `callLLMAPI(request, apiUrl, timeoutMs, logger?)` async function
- Uses native fetch with POST method and JSON body
- Implements AbortController pattern for timeout:
  ```typescript
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  fetch(url, { signal: controller.signal });
  clearTimeout(timeoutId);
  ```
- Tracks request timing: `startTime = Date.now()`, `duration = Date.now() - startTime`
- Handles JSON parsing of response body

**Error Handling:**
1. **Timeout**: AbortError caught and wrapped with timeout message
2. **HTTP errors**: Non-200 status codes logged and thrown with error body
3. **Network errors**: Connection errors logged and re-thrown
4. **Cleanup**: clearTimeout called in both success and error paths

**Logging:**
- Success: Logs duration and status code
- Timeout: Warns with duration and URL
- HTTP errors: Logs status code, duration, URL, and error body
- Network errors: Logs duration, URL, and error message
- No sensitive data logged (no request/response content)

**Test Coverage:**
- 21 comprehensive API client tests (41 total tests in file)
- All tests passing
- Test categories:
  - Successful API calls (4 tests)
  - HTTP error handling (4 tests)
  - Timeout handling (4 tests)
  - Network error handling (4 tests)
  - Request validation (3 tests)
  - Timing tracking (2 tests)

**Timeout Test Implementation:**
- Uses real timers for timeout tests (not fake timers)
- Mocks fetch to respond to abort signal properly
- Short timeout (50ms) for fast test execution
- Proper cleanup with timer restoration

**Technical Decisions:**
- Use native fetch (no external HTTP library)
- AbortController for cancellation (standard web API)
- Clear separation of concerns (timeout, errors, logging)
- Always clear timeout to prevent memory leaks
- Re-throw errors for upstream handling

## Testing Requirements

- [x] Unit tests for all new functions (21 API client tests passing)
- [x] Integration tests for API endpoints (if applicable) (N/A - will be tested in Story 4.3)
- [x] Error handling validation (Timeout, HTTP errors, network errors all tested)
- [x] Configuration validation (if applicable) (Uses passed parameters, no config changes)

## Definition of Done

- [x] All acceptance criteria met
- [ ] Code reviewed and approved
- [x] All tests passing (100% - 41/41 llm-client tests, 247 total project tests)
- [x] Documentation updated
- [x] No new linter errors
- [ ] Changes committed to git
