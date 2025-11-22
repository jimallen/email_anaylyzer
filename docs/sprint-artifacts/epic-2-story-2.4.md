# Story 2.4: Implement Whitelist Hot-Reload Capability

**Epic:** Epic 2: Secure Email Reception
**Status:** review
**Story Points:** 5
**Prerequisites:** Story 2.3 (whitelist validation service exists)

## User Story

As a **system operator**,
I want **whitelist changes to take effect within 60 seconds without restarting the service**,
So that **I can quickly add or remove team members without downtime**.

## Acceptance Criteria

**Given** the service is running with whitelist loaded
**When** I modify `config/whitelist.json` file
**Then** the file system watcher detects the change within 60 seconds

**And** the whitelist configuration is reloaded from disk

**And** new whitelist rules take effect immediately for subsequent requests

**And** configuration reload is logged:
```json
{
  "level": "info",
  "msg": "Whitelist configuration reloaded",
  "allowed_emails_count": 3,
  "allowed_domains_count": 2
}
```

**And** if the new configuration is invalid JSON, reload fails gracefully:
- Previous valid configuration remains active
- Error is logged with details
- Service continues running with old config

**And** hot-reload is tested by:
1. Starting service
2. Sending request from non-whitelisted email → blocked
3. Adding email to whitelist.json
4. Waiting 60 seconds
5. Sending same request → allowed

## Technical Notes

- Use Node.js `fs.watch()` API to monitor `config/whitelist.json`
- Implement in `src/services/config.ts` or dedicated `src/services/whitelist.ts` module
- Watch setup pattern:
  ```typescript
  import fs from 'fs';
  fs.watch('config/whitelist.json', (eventType) => {
    if (eventType === 'change') {
      reloadWhitelist();
    }
  });
  ```
- Debounce file changes (editors may trigger multiple events): wait 1 second after last change
- Reload function:
  1. Read file
  2. Parse JSON
  3. Validate with zod schema
  4. If valid: update in-memory config
  5. If invalid: log error, keep old config
- Store whitelist in module-level variable (shared across requests)
- Test hot-reload with manual file edits in integration test

## Dev Agent Record

**Context Reference:** epic-2-story-2.4.context.xml

**Implementation Notes:**

Successfully implemented whitelist hot-reload capability with file watching, debouncing, and graceful error handling.

**Files Created/Modified:**
- `src/services/whitelist-manager.ts` - WhitelistManager class (162 lines)
- `src/services/whitelist-manager.test.ts` - Comprehensive tests (13 tests, 246 lines)
- `src/services/whitelist.ts` - Updated to use WhitelistManager (60 lines)
- `src/services/whitelist.test.ts` - Updated for new architecture (180 lines)
- `src/app.ts` - Initialize watcher on startup and cleanup on close

**Key Implementation Details:**
- Created `WhitelistManager` class to manage whitelist lifecycle
- File watching using Node.js `fs.watch()` API
- Debouncing with 1-second timeout to handle rapid file changes
- Graceful error handling: keeps old config if new one is invalid
- Structured logging for reload events and errors
- Global singleton instance for shared state across requests
- Test-friendly design with `setWhitelist()` method
- Automatic cleanup via Fastify `onClose` hook

**Whitelist Manager Features:**
- `loadWhitelistSync()` - Loads and validates whitelist from disk
- `getWhitelist()` - Returns current whitelist configuration
- `setWhitelist()` - Sets whitelist directly (for testing)
- `startWatching()` - Starts file watcher with optional logger
- `stopWatching()` - Stops watcher and clears debounce timer
- `reloadWhitelist()` - Private method for hot-reload logic

**Validation & Error Handling:**
- Strict zod schema rejects unknown keys
- JSON parse errors caught and logged
- Schema validation errors caught and logged
- Previous configuration kept on any reload error
- Detailed error messages in logs with stack traces

**Test Results:**
- 13/13 WhitelistManager tests passing
- 15/15 whitelist service tests passing
- 115/115 total tests passing across all modules
- Test coverage includes:
  - Initial whitelist loading (5 tests)
  - Get/set whitelist (2 tests)
  - File watching lifecycle (3 tests)
  - Hot-reload success (1 test)
  - Error handling for invalid JSON (1 test)
  - Error handling for invalid schema (1 test)

**Manual Testing Results:**
- Server starts with watcher initialized successfully
- Whitelist file modified → reloaded within 2 seconds (well under 60s requirement)
- Log output: `"Whitelist configuration reloaded", allowed_emails_count: 1, allowed_domains_count: 1`
- Invalid JSON written → error logged, previous config kept
- Log output: `"Failed to reload whitelist configuration - keeping previous configuration"`
- Server continues running with old config after error

**Technical Decisions:**
- Used singleton pattern for WhitelistManager (single source of truth)
- Debounce timeout set to 1 second (editors often trigger multiple events)
- Strict schema validation (rejects unknown keys) for hot-reload safety
- WhitelistManager separated from config service (single responsibility)
- File watcher initialized in app.ts after Fastify plugins load
- Cleanup hook ensures watcher is stopped on server shutdown

## Testing Requirements

- [x] Unit tests for all new functions (13 WhitelistManager tests)
- [x] Integration tests for API endpoints (if applicable) (Manual testing verified)
- [x] Error handling validation (Invalid JSON and schema tests passing)
- [x] Configuration validation (if applicable) (Strict schema validation)

## Definition of Done

- [x] All acceptance criteria met
- [ ] Code reviewed and approved
- [x] All tests passing (100%)
- [x] Documentation updated
- [x] No new linter errors
- [ ] Changes committed to git
