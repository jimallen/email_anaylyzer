# Architecture

## Executive Summary

Email analyzer is a TypeScript-based Fastify backend service that receives email webhooks from Resend, processes content (text + images) through a vision-capable LLM API, and responds with tone/brand feedback. Built with type safety and performance in mind, the architecture uses Fastify's plugin system for modular webhook handling and maintains strict response time requirements (<30 seconds end-to-end).

## Project Initialization

**First implementation story must execute:**

```bash
# Install Fastify CLI globally
npm install --global fastify-cli

# Generate project with TypeScript
fastify generate email-analyzer --lang=ts

# Navigate to project
cd email-analyzer

# Install dependencies
npm install
```

**Starter Template Provides:**
- ✅ **Fastify Framework** - Fast, low-overhead web framework ideal for webhook processing
- ✅ **TypeScript** - Type safety for API integrations (Resend, Sparky LLM)
- ✅ **ESLint + Prettier** - Code quality and formatting
- ✅ **Hot Reload** - Fast development iteration
- ✅ **Plugin Architecture** - Modular structure for webhook handlers
- ✅ **Build Tooling** - TypeScript compilation configured

## Decision Summary

| Category | Decision | Version | Affects FR Categories | Rationale |
|----------|----------|---------|----------------------|-----------|
| Runtime | Node.js | 25.1.0 | All | Currently installed on sparky, latest features |
| Package Manager | pnpm | latest | All FRs | Fast, efficient, strict dependency resolution |
| Framework | Fastify | latest | All FRs | Fast, low-overhead, perfect for webhooks |
| Language | TypeScript | latest | All FRs | Type safety for API integrations (Starter) |
| HTTP Client | Native fetch | Node 25 built-in | FR12-20 (LLM/Resend API) | Zero dependencies, clean async/await |
| Image Processing | Native Buffer | Node built-in | FR4-6, FR13 (base64 encoding) | Simple base64 encoding, no extra deps |
| Configuration | dotenv + fs.watch | latest | FR40-46 (Config management) | Env vars for secrets, hot-reload for whitelist |
| Logging | pino | Fastify default | FR33-39 (Logging) | Fast, structured JSON, correlation IDs built-in |
| Schema Validation | zod | latest | FR2, FR9 (Webhook/config validation) | TypeScript-first, excellent type inference |
| Testing | vitest | latest | All (testing strategy) | Fast, modern, excellent TypeScript support |
| Process Manager | PM2 | latest | FR47, NFR-R3 (Uptime/restart) | Auto-restart, zero-downtime deploys |
| Deployment | Bare metal + PM2 | N/A | NFR-M7 (Deployment) | Simple, direct, less overhead on sparky |
| Config Format | JSON | Native | FR40-46 | Native parsing, fast hot-reload, type-safe |
| Rate Limiting | None (MVP) | N/A | N/A | Whitelist sufficient for 3-person team |
| Linting | ESLint + Prettier | Starter | All | Code quality and formatting (Starter) |
| Build Tooling | TypeScript compiler | Starter | All | TS compilation configured (Starter) |

## Project Structure

```
email-analyzer/
├── src/
│   ├── app.ts                      # Fastify app setup
│   ├── server.ts                   # Server entry point
│   ├── routes/
│   │   ├── webhook.ts              # POST /webhook/inbound-email (FR1)
│   │   └── health.ts               # GET /health (FR50)
│   ├── services/
│   │   ├── whitelist.ts            # Whitelist validation (FR7-11)
│   │   ├── email-processor.ts      # Main email processing logic (FR1-6)
│   │   ├── llm-client.ts           # Sparky LLM API integration (FR12-20)
│   │   ├── resend-client.ts        # Resend API for sending emails (FR21-25)
│   │   ├── image-processor.ts      # Image download & base64 encoding (FR4-6, FR13)
│   │   └── config.ts               # Config loading & hot-reload (FR40-46)
│   ├── plugins/
│   │   ├── auth.ts                 # Whitelist preHandler hook (FR7-9)
│   │   └── error-handler.ts        # Global error handling (FR26-32)
│   ├── lib/
│   │   ├── schemas.ts              # Zod validation schemas (FR2)
│   │   └── types.ts                # TypeScript type definitions
│   └── __tests__/
│       ├── webhook.test.ts         # Webhook route tests
│       ├── whitelist.test.ts       # Whitelist logic tests
│       ├── llm-client.test.ts      # LLM integration tests
│       └── image-processor.test.ts # Image processing tests
├── config/
│   ├── whitelist.json              # Email/domain whitelist (FR10-11)
│   └── settings.json               # Timeouts, max tokens, etc. (FR44-46)
├── logs/                           # PM2 log output (FR33-39)
├── dist/                           # TypeScript build output
├── .env                            # Environment variables (Resend API key)
├── .env.example                    # Example env file
├── package.json
├── pnpm-lock.yaml
├── tsconfig.json
├── vitest.config.ts
├── .eslintrc.js
├── .prettierrc
├── ecosystem.config.js             # PM2 configuration
└── README.md
```

## FR Category to Architecture Mapping

| FR Category | Primary Components | Supporting Components |
|-------------|-------------------|----------------------|
| **Email Reception & Processing** (FR1-6) | `routes/webhook.ts`<br>`services/email-processor.ts` | `lib/schemas.ts` (webhook validation) |
| **Security & Access Control** (FR7-11) | `services/whitelist.ts`<br>`plugins/auth.ts` | `config/whitelist.json`<br>`services/config.ts` (hot-reload) |
| **Content Analysis** (FR12-20) | `services/llm-client.ts`<br>`services/image-processor.ts` | Native fetch (HTTP)<br>Native Buffer (base64) |
| **Response Generation** (FR21-25) | `services/resend-client.ts` | Native fetch (HTTP) |
| **Error Handling & Recovery** (FR26-32) | `plugins/error-handler.ts` | All services (error propagation) |
| **Logging & Monitoring** (FR33-39) | pino (Fastify default) | PM2 log rotation<br>`logs/` directory |
| **Configuration Management** (FR40-46) | `services/config.ts` | `config/*.json`<br>`.env` file<br>fs.watch (hot-reload) |
| **Service Operations** (FR47-50) | `routes/health.ts`<br>`server.ts` | PM2 process manager<br>`ecosystem.config.js` |

## Technology Stack Details

### Core Technologies

**Runtime & Language:**
- Node.js 25.1.0 (current on sparky)
- TypeScript (latest) - Type safety throughout
- pnpm - Package management

**Framework & Server:**
- Fastify (latest) - Fast, low-overhead web framework
- HTTP server on port 3000 (configurable via .env)

**Key Libraries:**
- **zod** - Schema validation (webhooks, config)
- **dotenv** - Environment variable loading
- **vitest** - Testing framework
- **pino** - Structured logging (Fastify default)

**Built-in Node.js Features (Zero Dependencies):**
- **Native fetch** - HTTP client for Sparky LLM + Resend APIs
- **Native Buffer** - Base64 image encoding
- **fs.watch** - Config file hot-reload

**Process Management:**
- PM2 - Auto-restart, zero-downtime deploys, log rotation

### Integration Points

**1. Resend Webhook (Inbound):**
- **Endpoint:** `POST /webhook/inbound-email`
- **Format:** JSON webhook payload
- **Authentication:** Whitelist validation (email/domain)
- **Payload:** Email metadata + text + attachment URLs
- **Response:** HTTP 200/403/500

**2. Sparky LLM API (Outbound):**
- **Endpoint:** `https://sparky.tail468b81.ts.net/v1/chat/completions`
- **Method:** POST
- **Format:** OpenAI-compatible chat completion
- **Authentication:** None (internal network)
- **Timeout:** 25 seconds (AbortController)
- **Payload:** Multimodal (text + base64 images)
- **Response:** JSON with `choices[0].message.content`

**3. Resend Sending API (Outbound):**
- **Endpoint:** Resend REST API
- **Method:** POST /emails
- **Authentication:** API key (RESEND_API_KEY env var)
- **Timeout:** 10 seconds
- **Payload:** From, to, subject, text body
- **Response:** JSON with email ID
- **Retry:** Once on failure (1 second delay)

**4. Resend Attachment Download (Outbound):**
- **Source:** Attachment URLs from webhook payload
- **Method:** GET via native fetch
- **Timeout:** 10 seconds
- **Format:** Binary image data (PNG/JPG/JPEG)
- **Processing:** Convert to base64 for LLM API

**5. Configuration Files (Local FS):**
- **Location:** `config/whitelist.json`, `config/settings.json`
- **Hot-reload:** fs.watch monitors changes (60s max delay)
- **Format:** JSON with zod validation

**6. Health Check (Inbound):**
- **Endpoint:** `GET /health`
- **Response:** `{ status: 'ok', uptime: 12345, dependencies: { sparky: 'ok', resend: 'ok' } }`
- **Use:** PM2 monitoring, load balancer checks

## Implementation Patterns

These patterns ensure consistent implementation across all AI agents:

### Naming Patterns

**Files & Directories:**
- **kebab-case** for files: `email-processor.ts`, `llm-client.ts`
- **kebab-case** for directories: `services/`, `routes/`
- **Test files:** `*.test.ts` (e.g., `webhook.test.ts`)
- **Type files:** `*.types.ts` if needed (prefer `types.ts` in lib/)

**Code:**
- **PascalCase** for types/interfaces: `WebhookPayload`, `LLMRequest`
- **camelCase** for variables/functions: `processEmail`, `isWhitelisted`
- **SCREAMING_SNAKE_CASE** for constants: `MAX_IMAGE_SIZE`, `LLM_TIMEOUT_MS`
- **Enums:** PascalCase name, SCREAMING_SNAKE_CASE values
  ```typescript
  enum LogLevel {
    INFO = 'INFO',
    WARN = 'WARN',
    ERROR = 'ERROR'
  }
  ```

**HTTP Endpoints:**
- **kebab-case** with leading slash: `/webhook/inbound-email`, `/health`
- **No trailing slashes**

**Config Keys:**
- **snake_case** in JSON: `allowed_emails`, `max_tokens`, `llm_timeout_ms`

### File Organization Patterns

**Route Files:**
- One route per file in `routes/`
- Export Fastify plugin: `export default async function webhookRoute(fastify: FastifyInstance) {}`
- Register in `app.ts`

**Service Files:**
- One service class or module per file in `services/`
- Export functions or class: `export async function validateWhitelist(email: string): Promise<boolean>`
- No default exports for services (named exports only)

**Test Files:**
- Co-located with source: `src/services/whitelist.test.ts` next to `whitelist.ts`
- Test file structure:
  ```typescript
  import { describe, it, expect } from 'vitest';

  describe('Service Name', () => {
    describe('function name', () => {
      it('should handle specific case', () => {
        // test
      });
    });
  });
  ```

**Import Order:**
1. Node built-ins (`fs`, `path`)
2. External packages (`fastify`, `zod`)
3. Internal modules (`@/services/*`, `@/lib/*`)
4. Types (`./types`)

### Data Format Patterns

**API Requests (Sparky LLM):**
```typescript
{
  model: "email-analyzer",
  messages: [
    {
      role: "user",
      content: [
        { type: "text", text: "..." },
        { type: "image_url", image_url: { url: "data:image/png;base64,..." } }
      ]
    }
  ],
  max_tokens: 1000
}
```

**API Requests (Resend Sending):**
```typescript
{
  from: "analyzer@company.com",
  to: "sender@company.com",
  subject: "Re: Original Subject",
  text: "Feedback content..."
}
```

**Config Files (JSON):**
```json
{
  "allowed_emails": ["user@company.com"],
  "allowed_domains": ["@company.com"],
  "llm_timeout_ms": 25000,
  "max_tokens": 1000,
  "max_image_size_bytes": 10485760
}
```

**Environment Variables (.env):**
```
RESEND_API_KEY=re_xxxxx
SPARKY_LLM_URL=https://sparky.tail468b81.ts.net/v1/chat/completions
NODE_ENV=production
PORT=3000
```

### Error Format Patterns

**Thrown Errors:**
```typescript
class WhitelistError extends Error {
  constructor(email: string) {
    super(`Email not whitelisted: ${email}`);
    this.name = 'WhitelistError';
  }
}
```

**Log Errors:**
```typescript
request.log.error({
  err: error,
  sender: email.from,
  correlationId: request.id
}, 'Failed to process email');
```

**Email Error Messages:**
- Clear, user-friendly language
- Specific reason when possible
- No technical stack traces to users

### Communication Patterns

**Service-to-Service:**
- Services call each other via exported functions
- Pass request logger for correlation: `processEmail(emailData, request.log)`
- Return typed results: `Promise<{ success: boolean; data?: T; error?: string }>`

**HTTP Timeouts:**
- LLM API: 25 seconds (AbortController with setTimeout)
- Resend API: 10 seconds
- Image download: 10 seconds

**Retry Logic:**
- Email send failure: Retry once after 1 second
- LLM API failure: No retry, send fallback email
- Image download failure: No retry, process text-only

### Lifecycle Patterns

**Request Lifecycle:**
1. Webhook received → Fastify route
2. `preHandler` → Whitelist validation (plugins/auth.ts)
3. Route handler → Parse payload (zod validation)
4. Email processor → Download images, format content
5. LLM client → Call Sparky API
6. Resend client → Send response email
7. Return HTTP 200 to Resend

**Error Recovery:**
- Catch at route level
- Log with context
- Send error email to user
- Return appropriate HTTP status to Resend
- Continue processing other requests (no cascading failures)

**Graceful Shutdown (PM2):**
- On SIGTERM/SIGINT → Stop accepting new requests
- Wait for in-flight requests (max 30s)
- Close Fastify server
- Exit process

### TypeScript Patterns

**Strict Mode:** Enabled in tsconfig.json
```json
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitReturns": true
  }
}
```

**Type Imports:**
```typescript
import type { FastifyInstance, FastifyRequest } from 'fastify';
```

**Avoid `any`:**
- Use `unknown` for truly unknown types
- Use generics for flexible types
- Define interfaces for all external API responses

**Zod for Runtime Validation:**
```typescript
import { z } from 'zod';

const WebhookPayloadSchema = z.object({
  from: z.string().email(),
  to: z.string().email(),
  subject: z.string(),
  text: z.string().optional(),
  attachments: z.array(z.object({
    url: z.string().url(),
    filename: z.string()
  })).optional()
});

type WebhookPayload = z.infer<typeof WebhookPayloadSchema>;
```

## Consistency Rules

### Error Handling Strategy

**Webhook Error Responses:**
- **403 Forbidden** - Sender not whitelisted (FR9)
- **500 Internal Error** - Processing failure (FR29)
- **200 OK** - Success (email queued for analysis)

**Error Email to Sender:**
```
Subject: "Email Analysis Failed"
Body: "We encountered an error analyzing your email. [Specific reason]. Please try again or contact support."
```

**LLM API Failures (FR26-27):**
- Timeout (>25s) → Send fallback email with retry instructions
- API down → Send fallback email: "Analysis service temporarily unavailable"
- Continue processing other requests (NFR-R5)

**Validation Errors:**
- Invalid webhook payload → HTTP 500 + log error
- Unsupported image format → Email user with supported formats (FR32)
- Missing content → Email user: "No content found to analyze" (FR30)

**Unexpected Errors:**
- Catch all exceptions at route level
- Log with full context (sender, timestamp, stack trace)
- Return HTTP 500 to Resend
- Send generic error email to user

### Logging Strategy

**Log Levels (pino):**
- `info` - Normal operations (email received, processed, sent)
- `warn` - Recoverable issues (LLM timeout, image download failure)
- `error` - Failures (blocked sender, API errors)
- `fatal` - Service crash

**Structured Log Format (NFR-M4):**
```typescript
log.info({
  correlationId: request.id,  // Fastify auto-generated
  sender: email.from,
  recipient: email.to,
  hasScreenshot: !!attachments.length,
  hasText: !!email.text,
  llmDuration: 1250,
  totalDuration: 2100,
  success: true
}, 'Email processed successfully');
```

**Correlation IDs (NFR-M4):**
- Fastify automatically generates `request.id` for each webhook request
- Pass through all log calls: `request.log.info()`
- Include in error responses for debugging

**Log Rotation:**
- Pino writes to stdout
- PM2 handles log rotation (daily, 30-day retention per NFR-S1)

### Date/Time Handling

**Standard:** ISO 8601 format everywhere
- Internal processing: `new Date().toISOString()` → `"2025-11-17T12:34:56.789Z"`
- Logs: Pino default (ISO timestamps)
- Database/files: ISO strings
- Email responses: Human-readable if needed: `new Date().toLocaleString()`

**No timezone conversion needed** - All internal, UTC timestamps sufficient

### Authentication Pattern

**Whitelist Validation (NFR-S5):**
- Runs in Fastify `preHandler` hook BEFORE route handler
- Executes before any content processing or logging
- Order: Exact email match first → Domain suffix match → Reject

**Implementation:**
```typescript
fastify.addHook('preHandler', async (request, reply) => {
  const sender = request.body.from;
  if (!isWhitelisted(sender)) {
    reply.code(403).send({ success: false, error: 'Unauthorized sender' });
  }
});
```

**No session/token management for MVP**

### API Response Format

**Webhook Response (to Resend):**
- HTTP status code only (200/403/500)
- No JSON body required (Resend ignores it)
- Fast acknowledgment (NFR-P3: <5 seconds)

**Email Response (to user):**
- Plain text format (FR23)
- Subject: `Re: [Original Subject]`
- Body: LLM feedback or error message

### Testing Strategy

**Unit Tests (vitest):**
- Whitelist validation logic
- Base64 image encoding
- Schema validation (zod)
- Config file parsing
- Error handling helpers

**Integration Tests:**
- Full webhook flow (mock Resend + Sparky APIs)
- Whitelist enforcement
- LLM timeout handling
- Email response generation

**Coverage Target:** 80%+ for critical paths

**Test Location:** Co-located with source (`*.test.ts` alongside `*.ts`)

### Naming Conventions

**See Implementation Patterns section below**

### Code Organization

**See Project Structure section below**

## Data Architecture

**No Persistent Database for MVP** - All data is transient (processed in-memory, logged to files).

**Data Models:**

```typescript
// Webhook payload from Resend
interface WebhookPayload {
  from: string;          // Sender email
  to: string;            // Analyzer service email
  subject: string;       // Email subject
  text?: string;         // Plain text body
  html?: string;         // HTML body (unused for MVP)
  attachments?: Array<{
    url: string;         // Download URL
    filename: string;    // Original filename
    contentType: string; // MIME type
  }>;
}

// LLM API request
interface LLMRequest {
  model: string;         // "email-analyzer"
  messages: Array<{
    role: "user";
    content: Array<
      | { type: "text"; text: string }
      | { type: "image_url"; image_url: { url: string } }
    >;
  }>;
  max_tokens: number;
}

// LLM API response
interface LLMResponse {
  choices: Array<{
    message: {
      content: string;   // Feedback text
    };
  }>;
}

// Whitelist config
interface WhitelistConfig {
  allowed_emails: string[];
  allowed_domains: string[];
}

// Settings config
interface SettingsConfig {
  llm_timeout_ms: number;
  max_tokens: number;
  max_image_size_bytes: number;
  resend_timeout_ms: number;
  image_download_timeout_ms: number;
}
```

**Data Flow:**
1. Webhook payload → Validate with zod
2. Download images → Binary to base64
3. Format LLM request → Multimodal content array
4. LLM response → Extract feedback text
5. Format email response → Plain text
6. Log all transactions → JSON structured logs

## API Contracts

**POST /webhook/inbound-email**

Request (from Resend):
```json
{
  "from": "user@company.com",
  "to": "analyzer@resend.dev",
  "subject": "Draft: Customer Follow-up",
  "text": "Hi Customer, ...",
  "attachments": [
    {
      "url": "https://resend.com/attachments/abc123",
      "filename": "email-screenshot.png",
      "contentType": "image/png"
    }
  ]
}
```

Response:
```
HTTP 200 OK (success)
HTTP 403 Forbidden (not whitelisted)
HTTP 500 Internal Server Error (processing failure)
```

**GET /health**

Response:
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

**Sparky LLM API (External)**

Request:
```json
{
  "model": "email-analyzer",
  "messages": [
    {
      "role": "user",
      "content": [
        {
          "type": "text",
          "text": "Analyze this email for tone and brand issues..."
        },
        {
          "type": "image_url",
          "image_url": {
            "url": "data:image/png;base64,iVBORw0KG..."
          }
        }
      ]
    }
  ],
  "max_tokens": 1000
}
```

Response:
```json
{
  "choices": [
    {
      "message": {
        "content": "Feedback: The tone is too casual..."
      }
    }
  ]
}
```

## Security Architecture

**Whitelist-Based Access Control (NFR-S5):**
- Enforcement: Fastify `preHandler` hook on webhook route
- Validation order: Exact email match → Domain suffix match → Block
- Response: HTTP 403 + no internal details exposed
- Hot-reload: Config changes detected within 60 seconds (NFR-M2)

**Data Protection (NFR-S1, NFR-S2):**
- Email content: Not persisted beyond logs (30-day retention)
- Logs: Stored in `logs/` with restricted file permissions (600)
- Secrets: Environment variables only (never in code/logs)
- Internal network: Sparky LLM API not publicly exposed

**API Security:**
- Resend API key: Stored in `.env`, loaded via dotenv
- Sparky LLM: No authentication (internal network trust)
- No session management or cookies

**Audit Logging (NFR-S8, NFR-S9):**
- All email processing events logged with sender identity + timestamp
- Pino writes to stdout → PM2 captures → Append-only log files
- Correlation IDs trace individual requests

**Image Handling:**
- Validate MIME types (PNG/JPG/JPEG only)
- Max size limit (10MB configurable)
- Download timeout (10s prevents DoS)
- Base64 encoding in-memory (not saved to disk)

## Performance Considerations

**Response Time (NFR-P1, NFR-P2):**
- Target: <30 seconds end-to-end (95% of requests)
- LLM API timeout: 25 seconds (AbortController)
- Webhook acknowledgment: <5 seconds (immediate HTTP response)
- Image download: <10 seconds timeout

**Throughput (NFR-P5, NFR-P6):**
- Concurrency: Up to 10 simultaneous requests
- Per-sender sequential processing (avoid race conditions)
- Fastify async handlers (non-blocking I/O)

**Optimization Strategies:**
- Native fetch (zero dependency overhead)
- Streaming image downloads (avoid buffering entire file)
- Lazy config loading (only when needed)
- Pino async logging (doesn't block request handling)

**Bottleneck Mitigation:**
- LLM API is the primary bottleneck (25s timeout)
- Concurrent request limit prevents resource exhaustion
- Image size validation prevents memory issues
- Request timeouts prevent hanging connections

## Deployment Architecture

**Infrastructure:**
- **Host:** sparky.tail468b81.ts.net (bare metal)
- **Operating System:** Linux (current installation)
- **Node.js:** v25.1.0 (already installed)
- **Process Manager:** PM2
- **Network:** Internal (LLM API), external (Resend webhooks)

**Deployment Process:**
1. SSH to sparky server
2. Pull latest code: `git pull origin main`
3. Install dependencies: `pnpm install`
4. Build TypeScript: `pnpm build`
5. Reload PM2: `pm2 reload email-analyzer --update-env`
6. Verify health: `curl http://localhost:3000/health`

**PM2 Configuration (`ecosystem.config.js`):**
```javascript
module.exports = {
  apps: [{
    name: 'email-analyzer',
    script: './dist/server.js',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '500M',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    error_file: './logs/error.log',
    out_file: './logs/output.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true
  }]
};
```

**Zero-Downtime Deployment (NFR-M8):**
- `pm2 reload` gracefully shuts down old process
- New process starts before old process terminates
- In-flight requests complete before shutdown (30s max)

**Monitoring:**
- PM2 built-in monitoring: `pm2 monit`
- Health check endpoint: `/health`
- Log monitoring: `pm2 logs email-analyzer`

## Development Environment

### Prerequisites

**System Requirements:**
- Node.js 25.1.0 or higher
- pnpm (install: `npm install -g pnpm`)
- Git

**Services:**
- Resend account with API key
- Access to Sparky LLM API (https://sparky.tail468b81.ts.net/)

### Setup Commands

```bash
# Clone repository (or initialize from starter)
fastify generate email-analyzer --lang=ts
cd email-analyzer

# Install dependencies
pnpm install

# Install additional dependencies
pnpm add zod dotenv
pnpm add -D vitest @types/node

# Copy environment template
cp .env.example .env

# Edit .env with your credentials
# RESEND_API_KEY=re_xxxxx
# SPARKY_LLM_URL=https://sparky.tail468b81.ts.net/v1/chat/completions

# Create config directory and files
mkdir -p config
echo '{"allowed_emails":[],"allowed_domains":["@company.com"]}' > config/whitelist.json
echo '{"llm_timeout_ms":25000,"max_tokens":1000,"max_image_size_bytes":10485760}' > config/settings.json

# Build TypeScript
pnpm build

# Run tests
pnpm test

# Start development server (with hot reload)
pnpm dev

# Start production server
pnpm start
```

**Development Scripts (package.json):**
```json
{
  "scripts": {
    "dev": "fastify start -w -l info -P src/app.ts",
    "build": "tsc",
    "start": "node dist/server.js",
    "test": "vitest run",
    "test:watch": "vitest",
    "lint": "eslint src --ext .ts",
    "format": "prettier --write 'src/**/*.ts'"
  }
}
```

## Architecture Decision Records (ADRs)

### ADR-001: Use Fastify over Express
**Decision:** Fastify framework
**Rationale:** Faster, lower overhead, built-in TypeScript support, perfect for webhook handling. Plugin architecture enables modular design.
**Alternatives Considered:** Express (too heavy), NestJS (overkill for simple webhook service)

### ADR-002: Native Fetch over HTTP Libraries
**Decision:** Use Node.js native fetch
**Rationale:** Zero dependencies, built-in to Node 25, clean async/await, sufficient for simple API calls to Resend and Sparky.
**Alternatives Considered:** axios (extra dependency), undici (native fetch uses undici internally)

### ADR-003: No Database for MVP
**Decision:** Stateless, no persistent database
**Rationale:** All data is transient (processed and logged). No storage requirements. Keeps MVP simple and fast.
**Future:** May add database for analytics/tracking in post-MVP

### ADR-004: Whitelist in Config File (Not Database)
**Decision:** JSON file with fs.watch hot-reload
**Rationale:** Simple for 3-person team, instant updates without restart, version-controlled, no DB overhead.
**Alternatives Considered:** Environment variables (no hot-reload), database (overkill)

### ADR-005: Bare Metal Deployment over Docker
**Decision:** Deploy directly on sparky with PM2
**Rationale:** Less overhead, simpler debugging on same host as LLM, direct network access. Docker adds complexity without benefit for single-host deployment.
**Alternatives Considered:** Docker (adds isolation but not needed)

### ADR-006: zod for Runtime Validation
**Decision:** Use zod for schema validation
**Rationale:** TypeScript-first, excellent type inference, validates webhook payloads at runtime, generates types from schemas.
**Alternatives Considered:** joi (not TypeScript-native), ajv (lower-level)

### ADR-007: Co-located Tests
**Decision:** Test files next to source (`*.test.ts`)
**Rationale:** Easier to find and maintain tests, clearer which code is tested, follows modern conventions.
**Alternatives Considered:** Separate `test/` directory (harder to navigate)

### ADR-008: pino Logging (Fastify Default)
**Decision:** Keep pino as logging library
**Rationale:** Already integrated with Fastify, extremely fast async logging, structured JSON, automatic correlation IDs.
**Alternatives Considered:** winston (slower), bunyan (less maintained)

---

_Generated by BMAD Decision Architecture Workflow v1.0_
_Date: 2025-11-17_
_For: Jim_

---

_Generated by BMAD Decision Architecture Workflow v1.0_
_Date: {{date}}_
_For: {{user_name}}_
