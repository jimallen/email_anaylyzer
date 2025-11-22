# email_anaylyzer - Epic Breakdown

**Author:** Jim
**Date:** 2025-11-17
**Project Level:** Low Complexity
**Target Scale:** Internal Team Tool (3 users)

---

## Overview

This document provides the complete epic and story breakdown for email_anaylyzer, decomposing the requirements from the [PRD](./PRD.md) into implementable stories.

**Living Document Notice:** This is the initial version created from PRD and Architecture documents. The epic structure organizes work into value-delivering increments.

## Workflow Mode
**Mode:** CREATE
**Context Available:**
- ✅ PRD with 50 functional requirements
- ✅ Architecture with technology stack and patterns
- ✅ Product Brief with vision

---

## Available Context

**Context Incorporated:**
- ✅ PRD requirements
- ✅ Architecture technical decisions

**Status:** Ready for Phase 4 Implementation!

---

## Functional Requirements Inventory

**Total: 50 Functional Requirements**

### Email Reception & Processing (FR1-6)
- **FR1:** System receives incoming emails via Resend webhook at designated endpoint
- **FR2:** System parses email metadata (sender, recipient, subject, timestamp) from webhook payload
- **FR3:** System extracts plain text content from email body (if present)
- **FR4:** System detects image attachments (screenshots) in incoming email
- **FR5:** System downloads image attachments from Resend's attachment URLs
- **FR6:** System supports common image formats (PNG, JPG, JPEG) for screenshot analysis

### Security & Access Control (FR7-11)
- **FR7:** System validates sender email address against whitelist before processing
- **FR8:** System validates sender domain against whitelist if exact email not matched
- **FR9:** System blocks emails from non-whitelisted senders and returns HTTP 403
- **FR10:** System loads whitelist configuration from config file (emails and domains)
- **FR11:** System allows whitelist updates without service redeployment

### Content Analysis (FR12-20)
- **FR12:** System formats extracted content (text and/or screenshot images) for LLM API input using OpenAI vision format
- **FR13:** System encodes screenshot images as base64 or provides image URLs in messages array
- **FR14:** System sends multimodal requests to sparky LLM API endpoint with text and image content
- **FR15:** System specifies "email-analyzer" model in API requests
- **FR16:** System configures max_tokens for LLM response (500-1000 tokens)
- **FR17:** System receives tone and brand feedback from LLM API response (covering both textual and visual aspects)
- **FR18:** System handles screenshot-only emails (no text in body) by sending image-only analysis request
- **FR19:** System handles text-only emails (no screenshot) by sending text-only analysis request
- **FR20:** System handles hybrid emails (text + screenshot) by sending combined multimodal request

### Response Generation (FR21-25)
- **FR21:** System sends email response to original sender via Resend sending API
- **FR22:** System formats response with appropriate subject line (Re: original subject or custom format)
- **FR23:** System includes LLM-generated feedback in plain text format
- **FR24:** System sends responses within 30 seconds of receiving inbound email
- **FR25:** System retries failed email sends once before logging permanent failure

### Error Handling & Recovery (FR26-32)
- **FR26:** System detects LLM API timeouts (>25 seconds) and handles gracefully
- **FR27:** System sends fallback error email to sender if LLM API fails or times out
- **FR28:** System logs all processing errors with context for debugging
- **FR29:** System returns appropriate HTTP status codes to Resend webhook (200/403/500)
- **FR30:** System handles missing email content gracefully (no text, no screenshot)
- **FR31:** System handles image download failures without blocking entire analysis
- **FR32:** System handles unsupported image formats by notifying user in response

### Logging & Monitoring (FR33-39)
- **FR33:** System logs every inbound email request with sender and timestamp
- **FR34:** System logs LLM API analysis results for each request
- **FR35:** System logs response delivery status and timing
- **FR36:** System logs all errors with full context (sender, content summary, error details)
- **FR37:** System tracks response time metrics for performance monitoring
- **FR38:** System provides structured logs suitable for debugging and auditing
- **FR39:** System logs whether request included screenshot, text, or both

### Configuration Management (FR40-46)
- **FR40:** System reads configuration from file without requiring code changes
- **FR41:** System supports environment-specific configuration (dev/staging/prod)
- **FR42:** System configures Resend API credentials via config
- **FR43:** System configures sparky LLM API endpoint URL via config
- **FR44:** System configures email response templates via config
- **FR45:** System configures timeout values via config
- **FR46:** System configures max image size limits via config

### Service Operations (FR47-50)
- **FR47:** System maintains >95% uptime for reliable team usage
- **FR48:** System handles concurrent email processing for multiple team members
- **FR49:** System gracefully shuts down and rejects new requests during maintenance
- **FR50:** System provides health check endpoint for monitoring service status

---

## Key Project Information

**Project Type:** API Backend
**Domain:** General (Internal Tooling)
**Complexity:** Low
**Team Size:** 3 users (plus 1 CMO beneficiary)

**User Workflow:**
Team member drafts email → takes screenshot → attaches screenshot to email → sends to analyzer service → receives feedback within 30 seconds

**Product Differentiator:**
Personalized AI that knows YOUR standards - uses a model fine-tuned specifically on company's tone and brand voice, not generic writing advice.

**Success Criteria:**
- All 3 team members use service for every CRM email draft
- CMO reports 50%+ reduction in review time
- Fewer emails bounced back for basic fixes
- Response speed under 30 seconds consistently
- >95% uptime

**Non-Functional Requirements Summary:**
- **Performance:** <30s end-to-end, LLM timeout 25s, webhook response <5s, 10 concurrent requests
- **Security:** Whitelist validation before processing, no persistent email storage beyond 30-day logs, restricted log access
- **Reliability:** >95% uptime, graceful degradation, auto-restart on crash, retry logic for email sends
- **Integration:** OpenAI-compatible API format, Resend webhook/API support, version-tolerant payload handling
- **Maintainability:** Externalized config, hot-reload whitelist (60s), correlation IDs, health check endpoint, zero-downtime deploys

**Technical Stack (from Architecture):**
- **Runtime:** Node.js 25.1.0
- **Framework:** Fastify (TypeScript)
- **Package Manager:** pnpm
- **HTTP Client:** Native fetch (zero dependencies)
- **Schema Validation:** zod
- **Logging:** pino (Fastify default)
- **Testing:** vitest
- **Process Manager:** PM2
- **Deployment:** Bare metal on sparky.tail468b81.ts.net

---

## Epic Structure Summary

This project is organized into **5 epics** that deliver incremental value. Each epic enables user-facing capabilities or critical operational requirements.

### Epic 1: Service Foundation & Core Infrastructure
**Goal:** Establish the foundational service infrastructure with proper configuration, deployment, and operational capabilities.

**User Value:** Service is deployed, running, and ready to accept requests. Team has a reliable base to build upon.

**Scope:**
- Fastify TypeScript project initialization (using `fastify generate`)
- Core application structure (routes, services, plugins)
- Configuration system (environment variables + JSON config files)
- Deployment setup (PM2 process manager)
- Health check endpoint for monitoring
- Basic logging infrastructure with pino

**Why This Epic:** Greenfield project requires foundation before any features can work. This establishes the runtime, framework, and operational baseline.

---

### Epic 2: Secure Email Reception
**Goal:** Enable the service to receive emails via Resend webhooks with whitelist-based security.

**User Value:** Team members can send emails to the analyzer service, and unauthorized senders are blocked. Emails are validated and queued for processing.

**Scope:**
- Webhook endpoint (`POST /webhook/inbound-email`)
- Resend payload validation with zod schemas
- Whitelist security (email + domain matching)
- Config-based whitelist with hot-reload capability
- HTTP 200/403 responses to Resend
- Request logging with correlation IDs

**Why This Epic:** This is the entry point to the system. Users can interact with the service (even if processing isn't complete yet).

---

### Epic 3: Content Extraction & Processing
**Goal:** Extract and prepare email content (text and images) for analysis.

**User Value:** Service can handle all email content types - text only, screenshot only, or both combined.

**Scope:**
- Plain text extraction from email body
- Image attachment detection and validation
- Image download from Resend URLs
- Base64 encoding for LLM API
- Support for PNG, JPG, JPEG formats
- Content-specific error handling (missing content, unsupported formats, download failures)

**Why This Epic:** Enables multimodal processing - critical differentiator for screenshot analysis capability.

---

### Epic 4: AI Analysis Integration
**Goal:** Integrate with Sparky LLM API to analyze email content and generate tone/brand feedback.

**User Value:** Service produces intelligent, personalized feedback using the fine-tuned model.

**Scope:**
- Sparky LLM API client with native fetch
- OpenAI-compatible request formatting
- Multimodal content array (text + base64 images)
- Model specification ("email-analyzer")
- Response parsing and validation
- Timeout handling (25 second limit)
- Structured logging for analysis results

**Why This Epic:** This is the core intelligence - what makes the service valuable vs. generic email tools.

---

### Epic 5: Response Delivery & User Feedback
**Goal:** Deliver AI feedback to users via email and handle errors gracefully.

**User Value:** Users receive actionable feedback within 30 seconds, or helpful error messages if something fails.

**Scope:**
- Resend sending API integration
- Email response formatting (subject, body, plain text)
- Retry logic for failed sends
- Fallback error emails for LLM failures
- Response timing and delivery logging
- End-to-end error handling and user notifications

**Why This Epic:** Closes the feedback loop - users get results. Without this, the service has no output.

---

## FR Coverage Map

This map ensures every functional requirement is implemented in at least one epic.

### Epic 1: Service Foundation & Core Infrastructure
**Covers Infrastructure Needs for All FRs**
- FR40: System reads configuration from file
- FR41: Environment-specific configuration support
- FR42: Resend API credentials via config
- FR43: Sparky LLM API endpoint URL via config
- FR45: Timeout values via config
- FR46: Max image size limits via config
- FR47: >95% uptime maintenance
- FR48: Concurrent email processing capability
- FR49: Graceful shutdown during maintenance
- FR50: Health check endpoint
- **Logging Foundation:** FR33, FR37, FR38 (basic structured logging setup)

### Epic 2: Secure Email Reception
**Covers Email Reception & Security (FR1-11)**
- FR1: Receive emails via Resend webhook
- FR2: Parse email metadata (sender, recipient, subject, timestamp)
- FR3: Extract plain text content from body
- FR7: Validate sender email against whitelist
- FR8: Validate sender domain against whitelist
- FR9: Block non-whitelisted senders (HTTP 403)
- FR10: Load whitelist from config file
- FR11: Whitelist updates without redeployment
- FR29: Return appropriate HTTP status codes (200/403/500)
- FR44: Email response templates via config

### Epic 3: Content Extraction & Processing
**Covers Image Handling & Content Errors (FR4-6, FR18-20, FR30-32)**
- FR4: Detect image attachments in email
- FR5: Download images from Resend URLs
- FR6: Support PNG, JPG, JPEG formats
- FR18: Handle screenshot-only emails
- FR19: Handle text-only emails
- FR20: Handle hybrid emails (text + screenshot)
- FR30: Handle missing email content gracefully
- FR31: Handle image download failures
- FR32: Handle unsupported image formats
- FR39: Log content type (screenshot, text, or both)

### Epic 4: AI Analysis Integration
**Covers LLM Integration (FR12-17, FR26-28)**
- FR12: Format content for LLM API (OpenAI vision format)
- FR13: Encode screenshots as base64
- FR14: Send multimodal requests to Sparky API
- FR15: Specify "email-analyzer" model
- FR16: Configure max_tokens (500-1000)
- FR17: Receive tone/brand feedback from LLM
- FR26: Detect LLM API timeouts (>25 seconds)
- FR27: Send fallback error email on LLM failure
- FR28: Log processing errors with context
- FR34: Log LLM analysis results
- FR37: Track response time metrics
- FR38: Structured logs for debugging

### Epic 5: Response Delivery & User Feedback
**Covers Response Generation & Error Recovery (FR21-25, FR35-36)**
- FR21: Send email response via Resend API
- FR22: Format response subject line
- FR23: Include LLM feedback in plain text
- FR24: Send responses within 30 seconds
- FR25: Retry failed email sends once
- FR35: Log response delivery status and timing
- FR36: Log all errors with full context

---

## Epic Sequencing & Dependencies

**Sequence Rationale:**
1. **Epic 1 (Foundation)** → Must come first - establishes runtime and framework
2. **Epic 2 (Secure Reception)** → Requires foundation, enables email intake
3. **Epic 3 (Content Processing)** → Requires reception, prepares content for analysis
4. **Epic 4 (AI Analysis)** → Requires processed content, generates feedback
5. **Epic 5 (Response Delivery)** → Requires analysis results, completes user loop

**Value Delivery Progression:**
- After Epic 1: Service runs and is health-checkable
- After Epic 2: Emails can be received securely
- After Epic 3: Content can be extracted and prepared
- After Epic 4: AI analysis produces feedback
- After Epic 5: **COMPLETE MVP - Users receive AI feedback!**

**Why This Grouping Makes Sense:**
- Each epic delivers measurable progress toward the complete system
- No technical layer anti-patterns (not "Database", "API", "Frontend")
- Natural workflow progression: receive → process → analyze → respond
- Configuration and logging distributed appropriately across epics
- Epic boundaries align with integration points (Resend inbound, content prep, Sparky LLM, Resend outbound)

---

## Epic 1: Service Foundation & Core Infrastructure

**Goal:** Establish the foundational service infrastructure with proper configuration, deployment, and operational capabilities.

**User Value:** Service is deployed, running, and ready to accept requests. Team has a reliable base to build upon.

**FRs Covered:** FR40-50 + logging foundation (FR33, FR37, FR38)

---

### Story 1.1: Initialize Fastify TypeScript Project

As a **developer**,
I want **a Fastify TypeScript project initialized with proper tooling**,
So that **I have a solid foundation with build tools, linting, and hot-reload for development**.

**Acceptance Criteria:**

**Given** Node.js 25.1.0 is installed on the sparky server
**When** I run the Fastify CLI generator command
**Then** a complete TypeScript project structure is created with:
- Fastify framework configured
- TypeScript compilation setup (tsconfig.json with strict mode)
- ESLint + Prettier for code quality
- Hot-reload development mode
- Build scripts in package.json

**And** the project uses pnpm as package manager (not npm)

**And** additional dependencies are installed:
- zod (schema validation)
- dotenv (environment variables)
- vitest and @types/node (testing)

**And** the project builds successfully (`pnpm build` completes without errors)

**And** development server starts successfully (`pnpm dev` runs on port 3000)

**Prerequisites:** None - this is the first story

**Technical Notes:**
- Run: `npm install --global fastify-cli` (if not already installed)
- Run: `fastify generate email-analyzer --lang=ts`
- Navigate to project: `cd email-analyzer`
- Switch to pnpm: `rm package-lock.json && pnpm install`
- Add dependencies: `pnpm add zod dotenv && pnpm add -D vitest @types/node`
- Update tsconfig.json to include:
  ```json
  {
    "compilerOptions": {
      "strict": true,
      "noUncheckedIndexedAccess": true,
      "noImplicitReturns": true
    }
  }
  ```
- Update package.json scripts to use pnpm commands
- File naming convention: kebab-case for all files and directories
- Verify starter template provides: src/app.ts, src/server.ts, routes/, plugins/

---

### Story 1.2: Implement Configuration Management System

As a **system operator**,
I want **a configuration system that loads settings from files and environment variables**,
So that **I can change configuration without code changes and support multiple environments**.

**Acceptance Criteria:**

**Given** the Fastify project is initialized
**When** the service starts
**Then** it loads environment variables from `.env` file using dotenv

**And** it loads JSON configuration from `config/` directory:
- `config/whitelist.json` (email/domain whitelist)
- `config/settings.json` (timeouts, limits, templates)

**And** configuration includes these settings:
- RESEND_API_KEY (env var)
- SPARKY_LLM_URL (env var, default: `https://sparky.tail468b81.ts.net/v1/chat/completions`)
- NODE_ENV (env var, default: `production`)
- PORT (env var, default: `3000`)
- llm_timeout_ms (settings.json, default: 25000)
- max_tokens (settings.json, default: 1000)
- max_image_size_bytes (settings.json, default: 10485760)
- resend_timeout_ms (settings.json, default: 10000)
- image_download_timeout_ms (settings.json, default: 10000)

**And** configuration validation occurs on startup using zod schemas

**And** startup fails with clear error message if required config is missing

**And** `.env.example` file documents all required environment variables

**Prerequisites:** Story 1.1 (project initialized)

**Technical Notes:**
- Create `src/services/config.ts` module
- Export typed configuration object (use zod for runtime validation)
- Create TypeScript interfaces for config structure
- Create `config/` directory with initial JSON files
- Set file permissions on config files: 600 (read/write owner only)
- Load dotenv at application startup (top of src/server.ts)
- Example whitelist.json structure:
  ```json
  {
    "allowed_emails": [],
    "allowed_domains": ["@company.com"]
  }
  ```
- Config loading pattern: env vars override file values where applicable
- Validation errors should log specific missing/invalid fields

---

### Story 1.3: Implement Health Check Endpoint

As a **system operator**,
I want **a health check endpoint that reports service status and dependencies**,
So that **I can monitor service health and integration with PM2 monitoring**.

**Acceptance Criteria:**

**Given** the service is running
**When** I send `GET /health` request
**Then** it returns HTTP 200 with JSON body:
```json
{
  "status": "ok",
  "uptime": 12345,
  "timestamp": "2025-11-17T12:34:56.789Z",
  "dependencies": {
    "sparky": "ok",
    "resend": "ok"
  }
}
```

**And** uptime is in seconds (process.uptime())

**And** timestamp is ISO 8601 format (UTC)

**And** dependency checks perform lightweight validation:
- sparky: URL is configured (not null/empty)
- resend: API key is configured (not null/empty)

**And** response time is <100ms (no network calls, just config checks)

**And** endpoint does not require authentication (public health check)

**Prerequisites:** Story 1.2 (configuration system exists)

**Technical Notes:**
- Create `src/routes/health.ts` as Fastify plugin
- Register route in `src/app.ts`
- Use Fastify route handler pattern:
  ```typescript
  export default async function healthRoute(fastify: FastifyInstance) {
    fastify.get('/health', async (request, reply) => {
      // implementation
    });
  }
  ```
- No external HTTP calls - just check if config values exist
- Consider adding Node.js version to response for debugging
- Health check should always return 200 unless service is shutting down

---

### Story 1.4: Set Up PM2 Process Management

As a **system operator**,
I want **PM2 process manager configured for auto-restart and log rotation**,
So that **the service maintains >95% uptime and logs are managed automatically**.

**Acceptance Criteria:**

**Given** PM2 is installed globally on sparky server
**When** I deploy the service
**Then** PM2 configuration file `ecosystem.config.js` exists with:
- App name: `email-analyzer`
- Script: `./dist/server.js`
- Instances: 1 (single process)
- Auto-restart: enabled
- Max memory restart: 500M
- Environment variables: NODE_ENV=production, PORT=3000
- Log files: `./logs/error.log`, `./logs/output.log`
- Log rotation: daily, 30-day retention
- Merge logs: true

**And** logs directory is created with proper permissions (755)

**And** PM2 can start the service: `pm2 start ecosystem.config.js`

**And** PM2 can reload the service: `pm2 reload email-analyzer`

**And** service automatically restarts on crash

**And** graceful shutdown is implemented (SIGTERM/SIGINT handlers)

**And** in-flight requests complete before shutdown (max 30 second wait)

**Prerequisites:** Story 1.1 (project built), Story 1.3 (health endpoint exists for verification)

**Technical Notes:**
- Install PM2 globally if needed: `npm install -g pm2`
- Create `ecosystem.config.js` in project root
- Create `logs/` directory: `mkdir -p logs`
- Implement graceful shutdown in src/server.ts:
  ```typescript
  const gracefulShutdown = async () => {
    await fastify.close();
    process.exit(0);
  };
  process.on('SIGTERM', gracefulShutdown);
  process.on('SIGINT', gracefulShutdown);
  ```
- Fastify's close() waits for in-flight requests (configure timeout: 30s)
- PM2 reload provides zero-downtime deployments
- Verify health check works after PM2 start: `curl http://localhost:3000/health`

---

### Story 1.5: Implement Structured Logging Infrastructure

As a **developer**,
I want **structured JSON logging with correlation IDs**,
So that **I can debug issues by tracing individual requests through the system**.

**Acceptance Criteria:**

**Given** Fastify is configured with pino logger
**When** a request is processed
**Then** each request gets a unique correlation ID (Fastify auto-generated request.id)

**And** all logs include:
- Timestamp (ISO 8601, UTC)
- Log level (info, warn, error, fatal)
- Correlation ID (request.id)
- Message
- Structured context (key-value pairs)

**And** log levels are used appropriately:
- `info`: Normal operations (service start, request received, response sent)
- `warn`: Recoverable issues (timeout, retry)
- `error`: Failures (API errors, validation failures)
- `fatal`: Service crash

**And** logs are written to stdout (PM2 captures to files)

**And** log format is JSON for structured parsing

**And** sensitive data is NOT logged (API keys, email content beyond metadata)

**And** example log structure:
```json
{
  "level": 30,
  "time": 1700000000000,
  "pid": 12345,
  "hostname": "sparky",
  "reqId": "req-abc123",
  "msg": "Request received",
  "sender": "user@company.com",
  "hasScreenshot": true
}
```

**Prerequisites:** Story 1.1 (Fastify initialized with pino)

**Technical Notes:**
- Pino is included with Fastify by default - configure in src/app.ts
- Configure pino options:
  ```typescript
  const app = Fastify({
    logger: {
      level: process.env.LOG_LEVEL || 'info',
      serializers: {
        req: (req) => ({
          method: req.method,
          url: req.url,
          remoteAddress: req.ip
        })
      }
    }
  });
  ```
- Access logger via `request.log.info()`, `request.log.error()`, etc.
- Correlation ID available as `request.id` (auto-generated)
- Create logging helper utilities in `src/lib/logger.ts` if needed
- PM2 handles log rotation (configured in Story 1.4)
- Never log full email content - only metadata (sender, has_text, has_image)

---

## Epic 2: Secure Email Reception

**Goal:** Enable the service to receive emails via Resend webhooks with whitelist-based security.

**User Value:** Team members can send emails to the analyzer service, and unauthorized senders are blocked. Emails are validated and queued for processing.

**FRs Covered:** FR1-3, FR7-11, FR29, FR44

---

### Story 2.1: Create Webhook Endpoint with Payload Validation

As a **team member**,
I want **the service to receive emails via Resend webhook**,
So that **I can send draft emails to the analyzer service for review**.

**Acceptance Criteria:**

**Given** the service is running with configuration loaded
**When** Resend sends a webhook POST to `/webhook/inbound-email`
**Then** the endpoint accepts the request and returns HTTP 200

**And** the webhook payload is validated using zod schema with these required fields:
- `from` (string, email format)
- `to` (string, email format)
- `subject` (string)
- `text` (string, optional)
- `html` (string, optional)
- `attachments` (array, optional, each with `url`, `filename`, `contentType`)

**And** invalid payloads return HTTP 500 with error logged

**And** the endpoint extracts and logs metadata:
- Sender email
- Recipient email
- Subject line
- Timestamp (current time in ISO 8601)
- Correlation ID (Fastify request.id)

**And** request processing is logged:
```json
{
  "level": "info",
  "reqId": "req-abc123",
  "msg": "Webhook received",
  "from": "user@company.com",
  "to": "analyzer@resend.dev",
  "subject": "Draft: Customer email"
}
```

**Prerequisites:** Epic 1 complete (Stories 1.1-1.5)

**Technical Notes:**
- Create `src/routes/webhook.ts` as Fastify plugin
- Create `src/lib/schemas.ts` for zod schemas
- Define `WebhookPayloadSchema` using zod with email validation
- Use TypeScript type inference: `type WebhookPayload = z.infer<typeof WebhookPayloadSchema>`
- Register webhook route in `src/app.ts`
- Route pattern:
  ```typescript
  export default async function webhookRoute(fastify: FastifyInstance) {
    fastify.post('/webhook/inbound-email', async (request, reply) => {
      const payload = WebhookPayloadSchema.parse(request.body);
      request.log.info({ from: payload.from, subject: payload.subject }, 'Webhook received');
      return { success: true };
    });
  }
  ```
- Zod parse errors automatically return 500 (handled by error plugin)
- For now, just acknowledge receipt - actual processing comes in later epics

---

### Story 2.2: Extract Plain Text Content from Email Body

As a **team member**,
I want **the service to extract text content from my email body**,
So that **the analyzer can review my written content for tone and brand issues**.

**Acceptance Criteria:**

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

**Prerequisites:** Story 2.1 (webhook endpoint exists)

**Technical Notes:**
- Create `src/services/email-processor.ts`
- Export function: `extractTextContent(payload: WebhookPayload): string`
- Extraction priority: `text` field first, then HTML conversion, then empty string
- For HTML to text conversion in MVP: simple regex to strip tags `text.replace(/<[^>]*>/g, '')`
  - Future enhancement: use proper HTML parser library if needed
- Don't log actual email content - only metadata (hasText, length)
- Call extraction function from webhook route handler
- Store extracted text in request context or local variable for future processing

---

### Story 2.3: Implement Whitelist Validation Service

As a **system operator**,
I want **whitelist-based security to block unauthorized senders**,
So that **only approved team members can use the service**.

**Acceptance Criteria:**

**Given** whitelist configuration is loaded from `config/whitelist.json`
**When** a sender email is checked for authorization
**Then** exact email match is checked first against `allowed_emails` array

**And** if no exact match, domain suffix is checked against `allowed_domains` array
- Example: `user@company.com` matches domain `@company.com`
- Example: `user@partners.company.com` matches domain `@company.com` (suffix match)

**And** if neither match succeeds, sender is marked as unauthorized

**And** whitelist validation function returns boolean:
```typescript
isWhitelisted(email: string): boolean
```

**And** validation logic is unit tested with these cases:
- Exact email match → true
- Domain suffix match → true
- Subdomain match (e.g., `@sub.company.com` vs `@company.com`) → true
- No match → false
- Empty whitelist arrays → false

**Prerequisites:** Story 1.2 (config system with whitelist.json)

**Technical Notes:**
- Create `src/services/whitelist.ts`
- Export function: `isWhitelisted(email: string): boolean`
- Load whitelist from config service (reference config/whitelist.json)
- Validation algorithm:
  1. Check exact match: `allowed_emails.includes(email)`
  2. Check domain match: `allowed_domains.some(domain => email.endsWith(domain))`
- Create `src/services/whitelist.test.ts` with vitest
- Test cases should cover:
  - Exact email: `["user@company.com"]` validates `"user@company.com"` → true
  - Domain: `["@company.com"]` validates `"any@company.com"` → true
  - Subdomain: `["@company.com"]` validates `"user@sub.company.com"` → true
  - No match: `["@other.com"]` validates `"user@company.com"` → false
- Case-insensitive matching recommended (normalize to lowercase)

---

### Story 2.4: Implement Whitelist Hot-Reload Capability

As a **system operator**,
I want **whitelist changes to take effect within 60 seconds without restarting the service**,
So that **I can quickly add or remove team members without downtime**.

**Acceptance Criteria:**

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

**Prerequisites:** Story 2.3 (whitelist validation service exists)

**Technical Notes:**
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

---

### Story 2.5: Integrate Whitelist Authentication into Webhook

As a **system operator**,
I want **whitelist validation enforced before any email processing**,
So that **unauthorized senders are blocked immediately with no resource consumption**.

**Acceptance Criteria:**

**Given** whitelist validation service is implemented
**When** a webhook request is received
**Then** sender email is extracted from payload

**And** whitelist validation runs BEFORE any other processing (preHandler hook)

**And** if sender is whitelisted:
- Request proceeds to route handler
- HTTP 200 returned after processing
- Request logged with sender info

**And** if sender is NOT whitelisted:
- Request is blocked immediately
- HTTP 403 Forbidden returned
- Response body: `{ "success": false, "error": "Unauthorized sender" }`
- No internal details exposed to sender
- Blocked attempt is logged:
```json
{
  "level": "warn",
  "msg": "Blocked non-whitelisted sender",
  "from": "unauthorized@external.com"
}
```

**And** whitelist validation occurs before content extraction or logging of email content

**And** HTTP status codes are returned correctly:
- 200: Success (whitelisted, processed)
- 403: Forbidden (not whitelisted)
- 500: Internal error (invalid payload, processing failure)

**Prerequisites:** Stories 2.1, 2.3, 2.4 (webhook endpoint, whitelist service, hot-reload)

**Technical Notes:**
- Create `src/plugins/auth.ts` as Fastify plugin
- Register as `preHandler` hook on webhook route:
  ```typescript
  export default async function authPlugin(fastify: FastifyInstance) {
    fastify.addHook('preHandler', async (request, reply) => {
      const payload = request.body as WebhookPayload;
      if (!isWhitelisted(payload.from)) {
        request.log.warn({ from: payload.from }, 'Blocked non-whitelisted sender');
        return reply.code(403).send({ success: false, error: 'Unauthorized sender' });
      }
    });
  }
  ```
- Register auth plugin in webhook route (route-specific, not global)
- Ensure hook runs BEFORE route handler executes
- Test with integration test:
  1. Send request from whitelisted email → 200
  2. Send request from non-whitelisted email → 403
  3. Verify 403 response contains no internal details
- Security: Never reveal which emails are whitelisted in error messages

---

## Epic 3: Content Extraction & Processing

**Goal:** Extract and prepare email content (text and images) for analysis.

**User Value:** Service can handle all email content types - text only, screenshot only, or both combined.

**FRs Covered:** FR4-6, FR18-20, FR30-32, FR39

---

### Story 3.1: Detect and Parse Image Attachments

As a **team member**,
I want **the service to detect when I include screenshots in my email**,
So that **the analyzer can review both my text and visual presentation**.

**Acceptance Criteria:**

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

**Prerequisites:** Story 2.1 (webhook endpoint with payload parsing)

**Technical Notes:**
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

---

### Story 3.2: Download Images from Resend URLs

As a **team member**,
I want **the service to download my screenshot attachments**,
So that **they can be sent to the AI for visual analysis**.

**Acceptance Criteria:**

**Given** image attachments are detected in the payload
**When** the service downloads each image
**Then** it makes an HTTP GET request to the Resend attachment URL using native fetch

**And** download includes timeout of 10 seconds (from config: `image_download_timeout_ms`)

**And** download uses AbortController for timeout enforcement:
```typescript
const controller = new AbortController();
const timeoutId = setTimeout(() => controller.abort(), timeout);
const response = await fetch(url, { signal: controller.signal });
```

**And** successful downloads return binary image data as Buffer

**And** download is logged with timing:
```json
{
  "msg": "Image downloaded",
  "filename": "screenshot.png",
  "size": 245678,
  "duration": 823
}
```

**And** if download fails (timeout, network error, 404):
- Error is caught and logged with context
- Download failure does NOT crash entire request
- Failed image is skipped, processing continues with other images/text
- Failure logged:
```json
{
  "level": "warn",
  "msg": "Image download failed",
  "filename": "screenshot.png",
  "error": "timeout after 10s"
}
```

**And** downloaded images are returned as array of buffers for encoding

**Prerequisites:** Story 3.1 (attachment detection)

**Technical Notes:**
- Create `src/services/image-processor.ts`
- Export function: `downloadImage(url: string, timeout: number): Promise<Buffer>`
- Use native fetch (Node 25 built-in)
- Timeout pattern with AbortController (see acceptance criteria)
- Error handling: wrap in try/catch, return null on failure
- Download multiple images concurrently: `Promise.allSettled()`
- Track timing: `const start = Date.now(); const duration = Date.now() - start;`
- Return type: `Promise<Array<{ filename: string; data: Buffer } | null>>`
- Filter out null results (failed downloads) before returning

---

### Story 3.3: Validate Image Formats and Size Limits

As a **system operator**,
I want **image format and size validation**,
So that **only supported formats are processed and large files don't consume excessive resources**.

**Acceptance Criteria:**

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

**Prerequisites:** Story 3.2 (image download)

**Technical Notes:**
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

---

### Story 3.4: Encode Images as Base64 for LLM API

As a **developer**,
I want **images encoded as base64 strings**,
So that **they can be embedded in JSON requests to the LLM API**.

**Acceptance Criteria:**

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

**Prerequisites:** Story 3.3 (validated images)

**Technical Notes:**
- Add to `src/services/image-processor.ts`
- Export function: `encodeImage(buffer: Buffer, contentType: string): string`
- Built-in encoding: `buffer.toString('base64')` (no external library needed)
- Data URI format: `data:${contentType};base64,${base64String}`
- Process multiple images: map over validated image array
- Return type: `EncodedImage[]`
- No need to store encoded images to disk - keep in memory only
- Calculate total size for logging: sum of buffer lengths before encoding

---

### Story 3.5: Handle Content Scenarios (Text/Screenshot/Hybrid)

As a **team member**,
I want **the service to handle my email regardless of whether I include text, screenshots, or both**,
So that **I have flexibility in how I submit drafts for review**.

**Acceptance Criteria:**

**Given** email content has been extracted and processed
**When** determining content scenario
**Then** service categorizes as one of three types:

**Scenario 1: Text-Only Email**
- Text content exists (non-empty string)
- No valid images (no attachments or all failed/invalid)
- Logged as: `{ "contentType": "text-only", "hasText": true, "hasImages": false }`

**Scenario 2: Screenshot-Only Email**
- No text content (empty or missing)
- One or more valid images
- Logged as: `{ "contentType": "screenshot-only", "hasText": false, "hasImages": true, "imageCount": 2 }`

**Scenario 3: Hybrid Email**
- Text content exists
- One or more valid images
- Logged as: `{ "contentType": "hybrid", "hasText": true, "hasImages": true, "imageCount": 1 }`

**And** content type is logged with each request for tracking

**And** service prepares content package for LLM API based on scenario:
- Text-only: `{ text: string, images: [] }`
- Screenshot-only: `{ text: "", images: EncodedImage[] }`
- Hybrid: `{ text: string, images: EncodedImage[] }`

**And** content package is validated:
- At least one of text or images must exist
- If both are empty/missing, mark as error for handling in Epic 4

**Prerequisites:** Stories 2.2 (text extraction), 3.4 (image encoding)

**Technical Notes:**
- Add to `src/services/email-processor.ts`
- Export function: `categorizeContent(text: string, images: EncodedImage[]): ContentPackage`
- Type definition:
  ```typescript
  interface ContentPackage {
    contentType: 'text-only' | 'screenshot-only' | 'hybrid' | 'empty';
    text: string;
    images: EncodedImage[];
  }
  ```
- Categorization logic:
  ```typescript
  const hasText = text.trim().length > 0;
  const hasImages = images.length > 0;
  if (!hasText && !hasImages) return 'empty';
  if (hasText && !hasImages) return 'text-only';
  if (!hasText && hasImages) return 'screenshot-only';
  return 'hybrid';
  ```
- Empty content will trigger error handling (Epic 4, Story 4.5)
- Log content type with FR39 compliance

---

### Story 3.6: Implement Error Handling for Missing/Invalid Content

As a **team member**,
I want **clear error messages when my email has missing or invalid content**,
So that **I understand what went wrong and can fix it**.

**Acceptance Criteria:**

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

**Prerequisites:** Story 3.5 (content categorization)

**Technical Notes:**
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

---

## Epic 4: AI Analysis Integration

**Goal:** Integrate with Sparky LLM API to analyze email content and generate tone/brand feedback.

**User Value:** Service produces intelligent, personalized feedback using the fine-tuned model.

**FRs Covered:** FR12-17, FR26-28, FR34, FR37-38

---

### Story 4.1: Build OpenAI-Compatible Request Formatter

As a **developer**,
I want **content formatted for OpenAI-compatible API requests**,
So that **the Sparky LLM can analyze both text and images in a single request**.

**Acceptance Criteria:**

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

**Prerequisites:** Story 3.5 (content package ready)

**Technical Notes:**
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

---

### Story 4.2: Implement LLM API Client with Timeout Handling

As a **team member**,
I want **the service to call the Sparky LLM API for analysis**,
So that **I receive AI-generated feedback on my email draft**.

**Acceptance Criteria:**

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

**Prerequisites:** Story 4.1 (request formatter)

**Technical Notes:**
- Add to `src/services/llm-client.ts`
- Export function: `callLLMAPI(request: LLMRequest, timeout: number): Promise<LLMResponse>`
- Use native fetch (Node 25 built-in)
- AbortController pattern (see acceptance criteria)
- Track timing: `const start = Date.now(); const duration = Date.now() - start;`
- Error handling: catch fetch errors, timeout errors, HTTP errors separately
- Load timeout from config (25000ms default)
- Load API URL from environment variable (SPARKY_LLM_URL)
- Return type: `Promise<LLMResponse>` where response has OpenAI-compatible structure

---

### Story 4.3: Parse and Validate LLM API Response

As a **developer**,
I want **LLM API responses validated and parsed**,
So that **I can safely extract feedback text for sending to users**.

**Acceptance Criteria:**

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

**Prerequisites:** Story 4.2 (API client)

**Technical Notes:**
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

---

### Story 4.4: Implement Comprehensive Error Handling for LLM Failures

As a **team member**,
I want **graceful handling of LLM API failures**,
So that **I receive a helpful error message even when the AI is unavailable**.

**Acceptance Criteria:**

**Given** LLM API call encounters an error
**When** handling different failure scenarios
**Then** appropriate errors are created for each case:

**Error 1: Timeout (>25 seconds)**
- AbortController aborts request
- Error code: `LLM_TIMEOUT`
- User message: "Analysis is taking longer than expected. Please try again in a moment."
- Technical details logged: duration, endpoint URL

**Error 2: Network Error (DNS, connection refused, etc.)**
- Fetch throws network error
- Error code: `LLM_NETWORK_ERROR`
- User message: "Unable to reach analysis service. Please try again shortly."
- Technical details logged: error type, endpoint URL

**Error 3: HTTP Error (non-200 status)**
- API returns 4xx or 5xx status
- Error code: `LLM_HTTP_ERROR`
- User message: "Analysis service returned an error. Please try again later."
- Technical details logged: status code, response body

**Error 4: Invalid Response Structure**
- Response doesn't match expected schema
- Error code: `LLM_INVALID_RESPONSE`
- User message: "Received unexpected response from analysis service. Please try again."
- Technical details logged: validation error, response snippet

**And** errors are structured for Epic 5 (response generation):
```typescript
class LLMError extends Error {
  constructor(
    public code: string,
    public userMessage: string,
    public details: Record<string, unknown>
  ) {
    super(userMessage);
    this.name = 'LLMError';
  }
}
```

**And** all LLM errors are logged with full context:
```json
{
  "level": "error",
  "msg": "LLM API call failed",
  "errorCode": "LLM_TIMEOUT",
  "duration": 25000,
  "from": "user@company.com",
  "contentType": "hybrid"
}
```

**And** errors do NOT crash the service - they're caught in webhook handler for email response

**Prerequisites:** Stories 4.2, 4.3 (API client, response parser)

**Technical Notes:**
- Add to `src/lib/errors.ts`
- Define `LLMError` class (extends Error)
- Error codes: `LLM_TIMEOUT`, `LLM_NETWORK_ERROR`, `LLM_HTTP_ERROR`, `LLM_INVALID_RESPONSE`
- Wrap all fetch errors in try/catch in llm-client.ts
- Re-throw as `LLMError` with appropriate code and user message
- Log technical details before re-throwing
- Webhook handler (Epic 5) will catch `LLMError` and send fallback email
- User messages should be non-technical and actionable ("try again")

---

### Story 4.5: Add Structured Logging for LLM Analysis Metrics

As a **system operator**,
I want **comprehensive metrics and logs for LLM analysis**,
So that **I can monitor performance, track usage, and debug issues**.

**Acceptance Criteria:**

**Given** LLM analysis is performed
**When** logging metrics throughout the process
**Then** the following events are logged:

**1. Analysis Started:**
```json
{
  "level": "info",
  "msg": "LLM analysis started",
  "reqId": "req-abc123",
  "from": "user@company.com",
  "contentType": "hybrid",
  "hasText": true,
  "imageCount": 2
}
```

**2. Analysis Completed (Success):**
```json
{
  "level": "info",
  "msg": "LLM analysis completed",
  "reqId": "req-abc123",
  "duration": 3245,
  "feedbackLength": 342,
  "success": true
}
```

**3. Analysis Failed:**
```json
{
  "level": "error",
  "msg": "LLM analysis failed",
  "reqId": "req-abc123",
  "duration": 25000,
  "errorCode": "LLM_TIMEOUT",
  "success": false
}
```

**And** performance metrics are tracked:
- Total analysis duration (start to completion)
- API call duration (time spent waiting for Sparky)
- Request formatting duration
- Response parsing duration

**And** metrics are logged in a summary:
```json
{
  "msg": "LLM performance metrics",
  "totalDuration": 3456,
  "apiCallDuration": 3245,
  "formattingDuration": 12,
  "parsingDuration": 8,
  "overhead": 191
}
```

**And** correlation ID (request.id) is included in all LLM-related logs

**And** logs never contain:
- Actual email content (text or images)
- Actual LLM feedback text
- Base64 encoded images
- API keys or sensitive config

**And** logs DO contain metadata useful for debugging:
- Sender email
- Content type and structure
- Timing metrics
- Error codes and types
- Request IDs for tracing

**Prerequisites:** Stories 4.1, 4.2, 4.3 (full LLM pipeline)

**Technical Notes:**
- Add comprehensive logging throughout `src/services/llm-client.ts`
- Use `request.log` for correlation (pass logger from webhook handler)
- Track timing with `Date.now()` at key points
- Calculate overhead: `totalDuration - (format + apiCall + parse)`
- Log at appropriate levels:
  - `info`: Normal operations (start, complete)
  - `warn`: Recoverable issues (timeout, retry)
  - `error`: Failures (API errors, invalid response)
- Create helper function for performance logging:
  ```typescript
  function logPerformanceMetrics(metrics: PerformanceMetrics, logger: Logger) {
    logger.info(metrics, 'LLM performance metrics');
  }
  ```
- Ensure FR34, FR37, FR38 compliance (analysis results, timing, structured logs)

---

## Epic 5: Response Delivery & User Feedback

**Goal:** Deliver AI feedback to users via email and handle errors gracefully.

**User Value:** Users receive actionable feedback within 30 seconds, or helpful error messages if something fails.

**FRs Covered:** FR21-25, FR35-36

---

### Story 5.1: Implement Resend Email Sending Client

As a **developer**,
I want **a Resend API client for sending email responses**,
So that **feedback can be delivered to users programmatically**.

**Acceptance Criteria:**

**Given** feedback text is ready to send
**When** sending an email via Resend API
**Then** HTTP POST request is made to Resend's sending endpoint

**And** request uses native fetch with these settings:
- Endpoint: Resend REST API `/emails` endpoint
- Method: POST
- Headers: `{ 'Authorization': 'Bearer <RESEND_API_KEY>', 'Content-Type': 'application/json' }`
- Body: JSON with email details
- Timeout: 10 seconds (from config: `resend_timeout_ms`)

**And** request body includes:
```json
{
  "from": "Email Analyzer <analyzer@yourdomain.com>",
  "to": "user@company.com",
  "subject": "Re: Original Subject",
  "text": "Feedback content..."
}
```

**And** successful send (HTTP 200/201) returns response with email ID

**And** send timing is tracked and logged:
```json
{
  "msg": "Email sent via Resend",
  "to": "user@company.com",
  "emailId": "abc123-def456",
  "duration": 234
}
```

**And** if send fails (timeout, network error, HTTP error):
- Error is caught and logged with details
- Error includes status code and response body
- Error is re-thrown for retry logic

**And** timeout is enforced using AbortController (10 seconds)

**And** from address is configurable (from config or environment variable)

**Prerequisites:** Story 1.2 (config with RESEND_API_KEY)

**Technical Notes:**
- Create `src/services/resend-client.ts`
- Export function: `sendEmail(to: string, subject: string, body: string): Promise<EmailResult>`
- Type definition:
  ```typescript
  interface EmailResult {
    success: boolean;
    emailId?: string;
    error?: string;
  }
  ```
- Use native fetch (Node 25 built-in)
- Load API key from environment: `process.env.RESEND_API_KEY`
- Load from address from config (default: "Email Analyzer <noreply@yourdomain.com>")
- Timeout pattern with AbortController (similar to LLM API)
- Track timing: `const start = Date.now(); const duration = Date.now() - start;`
- Handle Resend API errors (4xx, 5xx) with proper error messages
- Don't log email body content - only metadata (to, subject, result)

---

### Story 5.2: Format Success Email Responses with Feedback

As a **team member**,
I want **to receive AI feedback in a well-formatted email**,
So that **I can easily read and act on the suggestions**.

**Acceptance Criteria:**

**Given** LLM analysis completed successfully with feedback text
**When** formatting the response email
**Then** subject line follows pattern: `Re: <original_subject>`
- Example: Original = "Draft: Customer Follow-up" → Response = "Re: Draft: Customer Follow-up"

**And** email body is plain text with this structure:
```
Hi,

I've analyzed your email draft and here's my feedback:

[LLM feedback text]

---
This analysis was generated by Email Analyzer
If you have questions, contact your CMO.
```

**And** LLM feedback text is inserted verbatim (no modifications)

**And** email body length is validated:
- If total body exceeds 10,000 characters, log warning (but don't truncate)
- This helps identify unexpected LLM output

**And** formatting handles edge cases:
- Empty original subject → subject = "Re: Your email draft"
- Multi-line feedback → preserved with proper line breaks
- Special characters in feedback → properly encoded for plain text

**And** response formatting is encapsulated in dedicated function

**And** formatted email details logged (without body content):
```json
{
  "msg": "Success email formatted",
  "to": "user@company.com",
  "subject": "Re: Draft email",
  "bodyLength": 456
}
```

**Prerequisites:** Story 4.3 (LLM feedback extracted)

**Technical Notes:**
- Create `src/services/email-formatter.ts`
- Export function: `formatSuccessEmail(to: string, originalSubject: string, feedback: string): EmailContent`
- Type definition:
  ```typescript
  interface EmailContent {
    to: string;
    subject: string;
    body: string;
  }
  ```
- Subject pattern: `Re: ${originalSubject || 'Your email draft'}`
- Body template (use template literals for clean formatting)
- Preserve whitespace and line breaks in feedback
- Footer is static text (no personalization in MVP)
- Load footer text from config for easy customization (optional)
- Don't log actual feedback content - only metadata

---

### Story 5.3: Format Error Email Responses for Failures

As a **team member**,
I want **helpful error messages when analysis fails**,
So that **I understand what went wrong and know what to do next**.

**Acceptance Criteria:**

**Given** an error occurred during processing (content errors or LLM errors)
**When** formatting an error email response
**Then** subject line is: `Email Analysis Error`

**And** email body is plain text with user-friendly error message from the error object

**And** error email templates exist for each error type:

**Content Processing Errors:**
```
Hi,

I couldn't analyze your email draft:

[User-friendly error message]

Please correct the issue and try again.

---
Email Analyzer
```

**LLM Errors:**
```
Hi,

I encountered an issue while analyzing your email:

[User-friendly error message]

This is usually temporary. Please try sending your draft again in a moment.

---
Email Analyzer
```

**And** error messages are taken from error objects (ContentProcessingError or LLMError)

**And** technical details are NOT included in user-facing email (logged separately)

**And** error email formatting is logged:
```json
{
  "msg": "Error email formatted",
  "to": "user@company.com",
  "errorCode": "LLM_TIMEOUT"
}
```

**And** different templates are used based on error type:
- Content errors (NO_CONTENT, INVALID_FORMAT, etc.) → actionable fix
- LLM errors (TIMEOUT, NETWORK_ERROR, etc.) → retry suggestion

**Prerequisites:** Stories 3.6 (content errors), 4.4 (LLM errors)

**Technical Notes:**
- Add to `src/services/email-formatter.ts`
- Export function: `formatErrorEmail(to: string, error: ContentProcessingError | LLMError): EmailContent`
- Use error.userMessage for the specific error description
- Template selection based on error.code or error type
- Keep messages concise and actionable
- Avoid technical jargon (no stack traces, error codes in user email)
- Error codes are logged, not emailed
- Consider: Add support contact info in footer if available

---

### Story 5.4: Implement Retry Logic for Failed Email Sends

As a **system operator**,
I want **automatic retry for failed email sends**,
So that **temporary Resend API issues don't prevent users from receiving feedback**.

**Acceptance Criteria:**

**Given** an email send attempt fails
**When** the initial send fails
**Then** the failure is logged with details:
```json
{
  "level": "warn",
  "msg": "Email send failed, retrying",
  "to": "user@company.com",
  "attempt": 1,
  "error": "Network timeout"
}
```

**And** service waits 1 second before retry (exponential backoff)

**And** exactly ONE retry is attempted (total: 2 attempts maximum)

**And** if retry succeeds:
- Success is logged:
```json
{
  "level": "info",
  "msg": "Email sent on retry",
  "to": "user@company.com",
  "attempt": 2,
  "totalDuration": 1456
}
```
- Function returns success result

**And** if retry also fails:
- Permanent failure is logged:
```json
{
  "level": "error",
  "msg": "Email send permanently failed",
  "to": "user@company.com",
  "attempts": 2,
  "lastError": "HTTP 503 Service Unavailable"
}
```
- Function returns failure result (no exception thrown)

**And** retry logic handles these failures:
- Network timeouts
- HTTP 5xx errors (server errors)
- Connection errors

**And** retry logic does NOT retry:
- HTTP 4xx errors (client errors like bad API key)
- Invalid email addresses
- Missing configuration

**And** total retry duration does not exceed 5 seconds (1s wait + retries)

**Prerequisites:** Story 5.1 (Resend client)

**Technical Notes:**
- Add to `src/services/resend-client.ts`
- Export function: `sendEmailWithRetry(to: string, subject: string, body: string): Promise<EmailResult>`
- Retry pattern:
  ```typescript
  async function sendEmailWithRetry(...) {
    try {
      return await sendEmail(...);
    } catch (error) {
      if (isRetryable(error)) {
        await sleep(1000); // 1 second wait
        try {
          return await sendEmail(...);
        } catch (retryError) {
          // Log permanent failure
          return { success: false, error: retryError };
        }
      }
      throw error; // Non-retryable errors
    }
  }
  ```
- Retryable errors: timeouts, 5xx status codes, network errors
- Non-retryable: 4xx status codes, validation errors
- Track total duration (initial + wait + retry)
- FR25 compliance: retry once before logging permanent failure

---

### Story 5.5: Orchestrate End-to-End Request Flow in Webhook Handler

As a **team member**,
I want **the complete email analysis workflow to execute seamlessly**,
So that **I send a draft email and receive feedback without any manual steps**.

**Acceptance Criteria:**

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

**Prerequisites:** Epic 3 complete, Epic 4 complete, Stories 5.1-5.4

**Technical Notes:**
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

---

## FR Coverage Matrix

This matrix validates that EVERY functional requirement from the PRD is covered by at least one story.

| FR | Description | Epic | Story |
|----|-------------|------|-------|
| **Email Reception & Processing** |
| FR1 | System receives incoming emails via Resend webhook | Epic 2 | 2.1 |
| FR2 | System parses email metadata (sender, recipient, subject, timestamp) | Epic 2 | 2.1 |
| FR3 | System extracts plain text content from email body | Epic 2 | 2.2 |
| FR4 | System detects image attachments (screenshots) | Epic 3 | 3.1 |
| FR5 | System downloads image attachments from Resend URLs | Epic 3 | 3.2 |
| FR6 | System supports common image formats (PNG, JPG, JPEG) | Epic 3 | 3.3 |
| **Security & Access Control** |
| FR7 | System validates sender email against whitelist | Epic 2 | 2.3, 2.5 |
| FR8 | System validates sender domain against whitelist | Epic 2 | 2.3, 2.5 |
| FR9 | System blocks non-whitelisted senders (HTTP 403) | Epic 2 | 2.5 |
| FR10 | System loads whitelist from config file | Epic 2 | 2.3 |
| FR11 | System allows whitelist updates without redeployment | Epic 2 | 2.4 |
| **Content Analysis** |
| FR12 | System formats content for LLM API (OpenAI vision format) | Epic 4 | 4.1 |
| FR13 | System encodes screenshots as base64 | Epic 3 | 3.4 |
| FR14 | System sends multimodal requests to sparky LLM API | Epic 4 | 4.2 |
| FR15 | System specifies "email-analyzer" model | Epic 4 | 4.1 |
| FR16 | System configures max_tokens for LLM response | Epic 4 | 4.1 |
| FR17 | System receives tone/brand feedback from LLM | Epic 4 | 4.3 |
| FR18 | System handles screenshot-only emails | Epic 3 | 3.5 |
| FR19 | System handles text-only emails | Epic 3 | 3.5 |
| FR20 | System handles hybrid emails (text + screenshot) | Epic 3 | 3.5 |
| **Response Generation** |
| FR21 | System sends email response via Resend API | Epic 5 | 5.1 |
| FR22 | System formats response subject line | Epic 5 | 5.2 |
| FR23 | System includes LLM feedback in plain text | Epic 5 | 5.2 |
| FR24 | System sends responses within 30 seconds | Epic 5 | 5.5 |
| FR25 | System retries failed email sends once | Epic 5 | 5.4 |
| **Error Handling & Recovery** |
| FR26 | System detects LLM API timeouts (>25 seconds) | Epic 4 | 4.2, 4.4 |
| FR27 | System sends fallback error email on LLM failure | Epic 4 | 4.4; Epic 5 | 5.3, 5.5 |
| FR28 | System logs processing errors with context | Epic 4 | 4.5 |
| FR29 | System returns appropriate HTTP status codes (200/403/500) | Epic 2 | 2.5; Epic 5 | 5.5 |
| FR30 | System handles missing email content gracefully | Epic 3 | 3.6 |
| FR31 | System handles image download failures | Epic 3 | 3.2 |
| FR32 | System handles unsupported image formats | Epic 3 | 3.3, 3.6 |
| **Logging & Monitoring** |
| FR33 | System logs every inbound email request | Epic 1 | 1.5; Epic 2 | 2.1 |
| FR34 | System logs LLM analysis results | Epic 4 | 4.5 |
| FR35 | System logs response delivery status and timing | Epic 5 | 5.1, 5.5 |
| FR36 | System logs all errors with full context | Epic 3 | 3.6; Epic 4 | 4.4, 4.5 |
| FR37 | System tracks response time metrics | Epic 1 | 1.5; Epic 4 | 4.5; Epic 5 | 5.5 |
| FR38 | System provides structured logs for debugging | Epic 1 | 1.5; Epic 4 | 4.5 |
| FR39 | System logs content type (screenshot, text, or both) | Epic 3 | 3.5 |
| **Configuration Management** |
| FR40 | System reads configuration from file | Epic 1 | 1.2 |
| FR41 | System supports environment-specific configuration | Epic 1 | 1.2 |
| FR42 | System configures Resend API credentials via config | Epic 1 | 1.2 |
| FR43 | System configures sparky LLM API endpoint via config | Epic 1 | 1.2 |
| FR44 | System configures email response templates via config | Epic 1 | 1.2; Epic 5 | 5.2 |
| FR45 | System configures timeout values via config | Epic 1 | 1.2 |
| FR46 | System configures max image size limits via config | Epic 1 | 1.2; Epic 3 | 3.3 |
| **Service Operations** |
| FR47 | System maintains >95% uptime | Epic 1 | 1.4 |
| FR48 | System handles concurrent email processing | Epic 1 | 1.2, 1.4 |
| FR49 | System gracefully shuts down during maintenance | Epic 1 | 1.4 |
| FR50 | System provides health check endpoint | Epic 1 | 1.3 |

**✅ COMPLETE COVERAGE: All 50 functional requirements are mapped to specific stories.**

---

## Epic Breakdown Summary

### Overview

**Total Epics:** 5
**Total Stories:** 26
**All FRs Covered:** ✅ Yes (50/50)

### Epic-by-Epic Summary

**Epic 1: Service Foundation & Core Infrastructure**
- **Stories:** 5 (1.1 - 1.5)
- **User Value:** Service deployed, running, and ready to accept requests
- **Key Deliverables:** Fastify TypeScript project, config system, health check, PM2 deployment, structured logging
- **FRs Covered:** FR40-50 + logging foundation

**Epic 2: Secure Email Reception**
- **Stories:** 5 (2.1 - 2.5)
- **User Value:** Team can send emails securely, unauthorized users blocked
- **Key Deliverables:** Webhook endpoint, payload validation, text extraction, whitelist security with hot-reload
- **FRs Covered:** FR1-3, FR7-11, FR29, FR44

**Epic 3: Content Extraction & Processing**
- **Stories:** 6 (3.1 - 3.6)
- **User Value:** All content types supported (text/screenshot/hybrid)
- **Key Deliverables:** Image detection, download, validation, base64 encoding, content categorization, error handling
- **FRs Covered:** FR4-6, FR18-20, FR30-32, FR39

**Epic 4: AI Analysis Integration**
- **Stories:** 5 (4.1 - 4.5)
- **User Value:** Intelligent, personalized feedback from fine-tuned model
- **Key Deliverables:** OpenAI-compatible formatter, Sparky LLM client, response parser, error handling, metrics logging
- **FRs Covered:** FR12-17, FR26-28, FR34, FR37-38

**Epic 5: Response Delivery & User Feedback**
- **Stories:** 5 (5.1 - 5.5)
- **User Value:** Users receive feedback <30s or helpful error messages
- **Key Deliverables:** Resend email client, success/error email formatting, retry logic, end-to-end orchestration
- **FRs Covered:** FR21-25, FR35-36

---

## Quality Validation

### ✅ Epic Structure Validation (USER VALUE CHECK)

**Epic 1 (Foundation):**
- What can users do? Service is operational and monitorable
- Valid as foundation epic? ✅ Yes (greenfield project exception)

**Epic 2 (Secure Reception):**
- What can users do? Send emails to analyzer, unauthorized users blocked
- Delivers user value? ✅ Yes (entry point to system)

**Epic 3 (Content Processing):**
- What can users do? Service handles all content types (text, images, hybrid)
- Delivers user value? ✅ Yes (multimodal capability)

**Epic 4 (AI Analysis):**
- What can users do? Receive AI-powered tone/brand feedback
- Delivers user value? ✅ Yes (core intelligence)

**Epic 5 (Response Delivery):**
- What can users do? Get feedback via email within 30 seconds
- Delivers user value? ✅ Yes (completes feedback loop)

**No technical layer anti-patterns detected.** Each epic delivers incremental user value.

### ✅ Story Quality Validation

**All stories are vertically sliced:**
- Each story delivers complete functionality (not just one layer)
- Example: Story 2.5 integrates whitelist auth into webhook (full stack)

**No forward dependencies:**
- All story prerequisites reference only previous stories
- Sequential ordering enables incremental delivery

**Story sizing appropriate:**
- All stories completable in single dev session
- Complex stories broken down (e.g., Epic 3 has 6 stories for content processing)

**BDD acceptance criteria:**
- Every story uses Given/When/Then format
- All criteria are testable and specific

**Implementation details added:**
- Stories include specific field names, validations, timeout values
- Architecture decisions incorporated (Fastify, zod, native fetch, etc.)
- Technical notes provide clear implementation guidance

### ✅ FR Coverage Validation

**All 50 FRs mapped to stories:** ✅ Complete
**No unmapped FRs:** ✅ Confirmed
**No duplicate coverage gaps:** ✅ Verified

**Coverage distribution:**
- Epic 1: 13 FRs (Foundation + logging)
- Epic 2: 10 FRs (Reception + security)
- Epic 3: 10 FRs (Content processing)
- Epic 4: 9 FRs (LLM integration)
- Epic 5: 8 FRs (Response delivery)

### ✅ Sequencing Validation

**Epic order enables incremental value:**
1. Foundation → Service runs
2. Reception → Emails accepted
3. Processing → Content prepared
4. Analysis → Feedback generated
5. Delivery → MVP complete

**Dependencies are backward-only:**
- Epic 2 requires Epic 1 (foundation)
- Epic 3 requires Epic 2 (webhook payload)
- Epic 4 requires Epic 3 (content package)
- Epic 5 requires Epics 3 + 4 (content + feedback)

---

## Context Incorporation Summary

**Documents Used:**
- ✅ PRD (50 functional requirements, NFRs, API backend specs)
- ✅ Architecture (Fastify, TypeScript, Node 25, tech stack, patterns)
- ✅ Product Brief (vision, users, success criteria)

**Architecture Details Incorporated:**
- Technology stack: Fastify, TypeScript, pnpm, zod, native fetch, pino, vitest, PM2
- Deployment: Bare metal on sparky.tail468b81.ts.net
- Patterns: Plugin architecture, kebab-case naming, AbortController timeouts
- Integration points: Resend webhooks, Sparky LLM API, Resend sending API
- Performance targets: <30s end-to-end, 25s LLM timeout, 10s image download

**No UX Design Available:**
- API backend - no UI needed
- Email response is plain text (simple formatting)

---

## Next Steps

**Status:** ✅ EPIC BREAKDOWN COMPLETE

**Ready for Phase 4 Implementation:**
- All epics defined with clear goals
- All 26 stories specified with BDD acceptance criteria
- Complete FR coverage validated (50/50)
- Technical implementation details from architecture incorporated
- Story sequencing ensures incremental delivery

**Recommended Next Action:**
Use the `create-story` workflow to generate individual story implementation plans from this epic breakdown.

**For Implementation:**
- Start with Epic 1, Story 1.1 (Initialize Fastify project)
- Follow sequential order through all stories
- Each story is independently implementable with clear acceptance criteria
- Architecture decisions guide consistent implementation

---

_This epic breakdown was created through the BMad Method create-epics-and-stories workflow._

_Project: email_anaylyzer_
_Author: Jim_
_Date: 2025-11-17_
_Mode: CREATE (initial epic breakdown from PRD + Architecture)_

---
