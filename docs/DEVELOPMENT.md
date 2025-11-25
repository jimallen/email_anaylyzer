# Email Analyzer Development Guide

Complete guide for setting up your development environment and contributing to the Email Analyzer project.

## Prerequisites

### Required Software
- **Node.js**: 20.x or later ([download](https://nodejs.org/))
- **pnpm**: 8.x or later (`npm install -g pnpm`)
- **AWS CLI v2**: Configured with SSO ([install](https://aws.amazon.com/cli/))
- **Git**: Latest stable version

### Required Accounts
- **AWS Account**: With AdministratorAccess SSO role
- **Resend Account**: With verified domain ([resend.com](https://resend.com))
- **Anthropic Account**: With API key ([console.anthropic.com](https://console.anthropic.com))

## Initial Setup

### 1. Clone Repository

```bash
git clone https://github.com/jimallen/email_anaylyzer.git
cd email_anaylyzer
```

### 2. Install Dependencies

```bash
# Root project
pnpm install

# CDK project
cd cdk
pnpm install
cd ..
```

### 3. Configure Environment

```bash
# Copy environment template
cp cdk/.env.example cdk/.env
```

Edit `cdk/.env` with your values:

```bash
# AWS Account Configuration
CDK_DEFAULT_ACCOUNT=your-aws-account-id
CDK_DEFAULT_REGION=eu-central-1

# Required: Resend API key
RESEND_API_KEY=re_your_api_key_here

# Required: Verified sender address
RESEND_FROM_EMAIL=response@your-verified-domain.com

# Required: Anthropic API key
ANTHROPIC_API_KEY=sk-ant-your_key_here

# Optional: Alternative LLM endpoint
SPARKY_LLM_URL=
```

### 4. Configure AWS SSO

```bash
# Login to AWS SSO
aws sso login --profile AdministratorAccess-YOUR-ACCOUNT-ID

# Verify credentials
aws sts get-caller-identity --profile AdministratorAccess-YOUR-ACCOUNT-ID
```

### 5. Verify Setup

```bash
# Build TypeScript
pnpm run build:ts

# Run tests
pnpm test
```

## Project Structure

```
email_anaylyzer/
├── src/                     # Application source code
│   ├── routes/              # HTTP route handlers
│   │   └── webhook.ts       # Main webhook endpoint (~700 lines)
│   ├── services/            # Business logic services
│   │   ├── llm-client.ts    # Claude AI integration
│   │   ├── resend-client.ts # Email sending via Resend
│   │   └── dynamodb-client.ts # DynamoDB persistence
│   ├── plugins/             # Fastify plugins
│   ├── app.ts               # Fastify application setup
│   ├── lambda.ts            # AWS Lambda handler
│   └── lambda-app.ts        # Lambda-specific Fastify config
├── cdk/                     # AWS CDK infrastructure
│   ├── lib/                 # Stack definitions
│   │   └── email-analyzer-stack.ts
│   ├── bin/                 # CDK app entry
│   │   └── app.ts
│   ├── deploy.sh            # Deployment script
│   ├── tail-logs.sh         # Log monitoring utility
│   └── .env                 # Environment config (not committed)
├── config/                  # Application configuration
│   ├── settings.json        # Runtime settings
│   └── whitelist.json       # Allowed senders
├── test/                    # Test files
├── docs/                    # Documentation
├── dist/                    # Compiled JavaScript (generated)
└── package.json             # Project manifest
```

## Development Workflow

### Local Development Server

```bash
# Start development server with hot reload
pnpm run dev

# Server runs at http://localhost:3000
```

The dev server watches for file changes and automatically recompiles TypeScript.

### Build Commands

```bash
# Build TypeScript once
pnpm run build:ts

# Watch mode (continuous build)
pnpm run watch:ts

# Full development mode (watch + server)
pnpm run dev
```

### Testing Locally

Since this is a webhook-based system, local testing requires:

1. **Unit Tests**: Run with `pnpm test`
2. **Integration Tests**: Deploy to AWS and use real emails
3. **Local Webhook Testing**: Use tools like ngrok to expose localhost

```bash
# Run unit tests
pnpm test

# Run tests with coverage
pnpm run test:coverage
```

## Code Organization

### Route Handlers (`src/routes/`)

Routes follow Fastify conventions:
- Files export a default async function
- Function receives Fastify instance
- Register routes with `fastify.get()`, `fastify.post()`, etc.

```typescript
// src/routes/webhook.ts
import { FastifyPluginAsync } from 'fastify';

const webhookRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post('/webhook/inbound-email', async (request, reply) => {
    // Handler implementation
  });
};

export default webhookRoutes;
```

### Services (`src/services/`)

Services are pure functions or classes that encapsulate business logic:

```typescript
// Example service function signature
export async function callClaudeForAnalysis(
  emailText: string,
  imageAttachments: EncodedImage[],
  pdfAttachments: EncodedPDF[],
  emailContext: EmailContext,
  detectedLanguage: string,
  logger?: FastifyBaseLogger
): Promise<{ feedback: string; tokensUsed: number; processingTimeMs: number; analysisJson?: EmailAnalysisJSON }>
```

### Type Safety

The project uses TypeScript with strict mode. Key types:

```typescript
// Email analysis result (Zod schema)
const EmailAnalysisSchema = z.object({
  subjectLineAnalysis: z.object({...}),
  lifecycleContext: z.object({...}),
  recommendations: z.array(z.object({...})),
  summary: z.string(),
});

// Inferred TypeScript type
type EmailAnalysisJSON = z.infer<typeof EmailAnalysisSchema>;
```

## Key Modules Deep Dive

### LLM Client (`services/llm-client.ts`)

Handles all Claude AI interactions:

```typescript
// Main analysis function
callClaudeForAnalysis(emailText, images, pdfs, context, language, logger)

// Name parsing (uses Claude Haiku for speed)
parseSenderNameWithLLM(email, apiUrl, model, logger)

// Language detection
detectLanguageWithClaude(subject, text, logger)
```

**Key Implementation Details:**
- Uses Langchain `ChatAnthropic` class
- Structured output via `model.invoke()` with JSON parsing
- Token usage extracted from `response.usage_metadata.total_tokens`
- 120-second timeout for main analysis

### Resend Client (`services/resend-client.ts`)

Email sending with retry logic:

```typescript
// Primary function with retry
sendEmailWithRetry(to, subject, body, config, attachments, logger)

// Single send attempt
sendEmail(to, subject, body, config, attachments, logger)
```

**Key Implementation Details:**
- Markdown → HTML conversion via `marked` library
- Sends both `text` and `html` versions
- Retry on 5xx errors (1 retry, 1s delay)
- No retry on 4xx client errors
- 30-second default timeout

### DynamoDB Client (`services/dynamodb-client.ts`)

Persistence for fine-tuning data:

```typescript
// Store analysis record
createAnalysisRecord(params: AnalysisRecordParams)
```

**Key Implementation Details:**
- Uses `@aws-sdk/lib-dynamodb` DocumentClient
- `removeUndefinedValues: true` in marshallOptions
- Stores fine-tuning format: `{messages: [{role, content}...]}`
- Includes metadata: language, content type, token count, timing

## Environment Variables

### Runtime Variables (Lambda)

| Variable | Purpose |
|----------|---------|
| `RESEND_API_KEY` | Resend API authentication |
| `RESEND_FROM_EMAIL` | Sender email address |
| `ANTHROPIC_API_KEY` | Claude API authentication |
| `SPARKY_LLM_URL` | Alternative LLM endpoint |
| `DYNAMODB_TABLE_NAME` | DynamoDB table name |
| `LOG_LEVEL` | Logging verbosity |
| `NODE_ENV` | Environment identifier |

### CDK Variables (Deployment)

| Variable | Purpose |
|----------|---------|
| `CDK_DEFAULT_ACCOUNT` | AWS account ID |
| `CDK_DEFAULT_REGION` | AWS region |
| `AWS_PROFILE` | SSO profile name |

## Debugging

### Local Debugging

```bash
# Enable verbose logging
LOG_LEVEL=debug pnpm run dev

# Use Node.js inspector
node --inspect dist/app.js
```

### Remote Debugging (Lambda)

```bash
# Tail CloudWatch logs
cd cdk
./tail-logs.sh --follow --since 5m

# Filter for errors
./tail-logs.sh --since 1h | grep '"level":50'
```

### Common Issues

| Issue | Solution |
|-------|----------|
| `ANTHROPIC_API_KEY not set` | Check `.env` file and CDK deployment |
| `Resend 403 error` | Verify domain in Resend dashboard |
| `DynamoDB undefined values` | Already fixed with `removeUndefinedValues` |
| `TypeScript errors` | Run `pnpm run build:ts` to see all errors |

## Deployment

### Quick Deploy

```bash
cd cdk
./deploy.sh
```

### Manual Steps

```bash
# 1. Login to AWS
aws sso login --profile AdministratorAccess-YOUR-ACCOUNT

# 2. Build and synthesize
cd cdk
pnpm run build
pnpm run synth

# 3. Deploy
npx cdk deploy --profile AdministratorAccess-YOUR-ACCOUNT
```

### Verify Deployment

```bash
# Check Lambda function
aws lambda get-function --function-name EmailAnalyzerStack-EmailAnalyzerFunction* \
  --profile AdministratorAccess-YOUR-ACCOUNT

# Check API Gateway endpoint
aws apigateway get-rest-apis --profile AdministratorAccess-YOUR-ACCOUNT
```

## Code Style Guidelines

### TypeScript
- Use strict mode (`strict: true` in tsconfig)
- Prefer `const` over `let`
- Use explicit types for function parameters and returns
- Use Zod for runtime validation

### Logging
- Use structured logging with context
- Include correlation IDs (`reqId`)
- Log at appropriate levels (info, warn, error)

```typescript
logger?.info({
  emailId,
  duration,
  tokensUsed,
  success: true
}, 'Analysis completed');
```

### Error Handling
- Catch specific errors where possible
- Log errors with full context
- Return appropriate HTTP status codes

```typescript
try {
  // operation
} catch (error) {
  logger?.error({ error: error.message, context }, 'Operation failed');
  throw error;
}
```

## IDE Setup

### VS Code (Recommended)

Extensions:
- ESLint
- Prettier
- TypeScript and JavaScript Language Features
- AWS Toolkit

Settings (`.vscode/settings.json`):
```json
{
  "typescript.preferences.importModuleSpecifier": "relative",
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode"
}
```

### Cursor

Same extensions as VS Code, plus:
- Claude integration for AI assistance

## Contributing

### Before Submitting

1. **Build passes**: `pnpm run build:ts`
2. **Tests pass**: `pnpm test`
3. **No lint errors**: `pnpm run lint`
4. **Documentation updated** if needed

### Commit Messages

Follow conventional commits:
```
feat: Add new feature
fix: Fix bug
docs: Update documentation
refactor: Code refactoring
test: Add tests
chore: Maintenance tasks
```

### Pull Request Process

1. Create feature branch from `master`
2. Make changes with clear commits
3. Update documentation
4. Submit PR with description
5. Address review feedback

---

**Document Version**: 1.0
**Last Updated**: 2025-11-24
**Authors**: Amelia (Developer), Winston (Architect)
