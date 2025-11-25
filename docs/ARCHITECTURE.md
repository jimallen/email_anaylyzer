# Email Analyzer Architecture

Comprehensive technical architecture documentation for the Email Analyzer system.

## Overview

Email Analyzer is a serverless, event-driven system that processes inbound emails through AI analysis and delivers structured feedback. The architecture prioritizes:
- **Reliability**: Automatic retries, error handling, idempotency
- **Scalability**: Serverless auto-scaling via AWS Lambda
- **Observability**: Structured logging, CloudWatch integration
- **Cost Efficiency**: Pay-per-use model, no idle costs

## System Architecture

### High-Level Architecture

```
┌─────────────┐         ┌──────────────┐         ┌────────────────┐
│   Resend    │────────>│  API Gateway │────────>│  AWS Lambda    │
│  (Webhook)  │         │              │         │   (Fastify)    │
└─────────────┘         └──────────────┘         └────────────────┘
                                                          │
                               ┌──────────────────────────┼──────────────────────────┐
                               │                          │                          │
                               ▼                          ▼                          ▼
                        ┌──────────────┐          ┌──────────────┐          ┌──────────────┐
                        │   Resend     │          │  Claude AI   │          │  DynamoDB    │
                        │  (Send Email)│          │  (Analysis)  │          │ (Fine-tuning)│
                        └──────────────┘          └──────────────┘          └──────────────┘
```

### Component Architecture

#### 1. API Layer
- **Framework**: Fastify 5.x
- **Purpose**: HTTP webhook receiver, request validation, routing
- **Entry Point**: `src/lambda.ts` → `src/lambda-app.ts` → `src/app.ts`
- **Key Features**:
  - Request logging with correlation IDs
  - Error handling middleware
  - Health check endpoints
  - AWS Lambda adapter via `@fastify/aws-lambda`

#### 2. Service Layer
Three core services handle business logic:

**a) LLM Client (`services/llm-client.ts`)**
- Integrates with Claude AI via Langchain
- Functions:
  - `callClaudeForAnalysis()` - Main analysis using Claude Sonnet 4
  - `parseSenderNameWithLLM()` - Name extraction using Claude Haiku
  - `detectLanguageWithClaude()` - Language detection
- Features:
  - Structured output with Zod schema validation
  - Token usage tracking
  - Timeout handling (120s)
  - PDF and image processing

**b) Resend Client (`services/resend-client.ts`)**
- Handles email delivery via Resend API
- Functions:
  - `sendEmail()` - Single send attempt
  - `sendEmailWithRetry()` - Retry wrapper for transient failures
- Features:
  - Markdown to HTML conversion (via `marked`)
  - Base64 attachment support
  - Automatic retry on 5xx errors (1 retry, 1s delay)
  - No retry on 4xx errors (immediate failure)
  - Timeout handling (30s default)

**c) DynamoDB Client (`services/dynamodb-client.ts`)**
- Persists analysis data for fine-tuning
- Functions:
  - `createAnalysisRecord()` - Stores complete analysis with metadata
- Features:
  - Fine-tuning format with system/user/assistant messages
  - Removes undefined values automatically
  - Secondary index on sender email
  - Point-in-time recovery enabled

#### 3. Infrastructure Layer (AWS CDK)

**CDK Stack** (`cdk/lib/email-analyzer-stack.ts`)
- **Lambda Function**:
  - Runtime: Node.js 20.x
  - Memory: 2048 MB
  - Timeout: 300 seconds (5 minutes)
  - Bundling: esbuild (local, no Docker)
  - Environment variables injected from `.env`

- **API Gateway**:
  - REST API
  - Stage: `prod`
  - Logging: INFO level
  - Data trace enabled
  - CORS: All origins (development)

- **DynamoDB Table**:
  - Name: `EmailAnalysisData`
  - Partition key: `emailId` (String)
  - Sort key: `timestamp` (Number)
  - Billing: Pay-per-request
  - GSI: `SenderIndex` (partition: `from`, sort: `timestamp`)
  - Retention: RETAIN (data preserved on stack delete)

## Data Flow

### Email Reception Flow

```
1. User forwards email to inbound address
     ↓
2. Resend receives email, triggers webhook
     ↓
3. API Gateway invokes Lambda
     ↓
4. Fastify routes to /webhook/inbound-email
     ↓
5. webhook.ts handler processes request:
   a. Fetch full email content from Resend API
   b. Extract text/attachments
   c. Download and encode images/PDFs
   d. Parse sender name with Claude Haiku
   e. Detect email language with Claude
     ↓
6. Call Claude Sonnet 4 for analysis
   - Structured output with Zod schema
   - Extract token usage from response metadata
     ↓
7. Format response email (markdown → HTML)
     ↓
8. Send analysis email via Resend (with retry)
     ↓
9. Save to DynamoDB (fire-and-forget)
     ↓
10. Return 200 OK to Resend
```

### Error Handling Flow

```
Error occurs
     ↓
Is it retryable? (timeout, 5xx, network)
     ├─ Yes: Retry once after 1s delay
     │        ├─ Success: Log + continue
     │        └─ Fail: Log permanent failure
     └─ No: (4xx client errors)
              Log error + return failure
```

## Key Design Decisions

### 1. Boring Technology Choices
- **Fastify over Express**: Performance + TypeScript support
- **Claude over custom models**: Proven quality, maintained by Anthropic
- **DynamoDB over RDS**: Serverless, auto-scaling, no cold starts
- **CDK over Terraform**: Type-safe IaC, native AWS integration

### 2. Serverless Architecture
- **Why**: Zero idle costs, auto-scaling, managed infrastructure
- **Trade-off**: Cold starts (~2s), 5-minute timeout limit
- **Mitigation**: Adequate memory (2GB) reduces cold start duration

### 3. Asynchronous DynamoDB Writes
- **Why**: Don't block email response on database writes
- **Implementation**: Fire-and-forget pattern after email sent
- **Risk**: Rare data loss if Lambda times out
- **Acceptable**: Fine-tuning data is nice-to-have, not critical

### 4. Retry Strategy
- **Philosophy**: Retry transient failures, fail fast on client errors
- **Implementation**:
  - 5xx errors: 1 retry after 1s
  - 4xx errors: No retry (immediate failure)
  - Timeouts: 1 retry after 1s
- **Why**: Balance reliability with response time

### 5. Structured Logging
- **Format**: JSON with correlation IDs (`reqId`)
- **Levels**: Error, Warn, Info
- **Metadata**: Operation context, timing, counts
- **Why**: CloudWatch Insights queries, troubleshooting

## Security Considerations

### Authentication & Authorization
- **Webhook Security**: None currently (rely on obscure URL)
  - **Future**: Add Resend webhook signature verification
- **AWS Permissions**: Lambda has minimal IAM permissions
  - DynamoDB: Write-only to single table
  - CloudWatch: Log writes only

### Secrets Management
- **API Keys**: Stored in environment variables
  - Injected via CDK from `.env` file
  - **Never** committed to git (`.env` in `.gitignore`)
- **Future**: Migrate to AWS Secrets Manager for production

### Data Privacy
- **Email Content**: Stored in DynamoDB for fine-tuning
  - Contains full email text and analysis
  - No PII filtering currently
- **Resend API**: Email content transits through Resend
- **Claude API**: Email content sent to Anthropic for analysis

## Performance Characteristics

### Latency Breakdown
- Webhook reception: < 100ms
- Email content fetch: 200-500ms
- Name parsing (Haiku): 500-1000ms
- Language detection (Claude): 1-2s
- Main analysis (Sonnet 4): 25-35s
- Email send (Resend): 200-500ms
- DynamoDB write: ~100ms (async)
- **Total end-to-end**: 30-40s

### Throughput
- **Current**: Designed for ~10 emails/hour
- **Scalability**: Lambda auto-scales to 1000 concurrent executions
- **Bottleneck**: Claude API rate limits (tier-dependent)

### Cost Structure (Estimated)
- Lambda: ~$0.001 per email (2GB, 35s execution)
- API Gateway: ~$0.000003 per request
- DynamoDB: ~$0.0000025 per write
- Claude API: ~$0.015 per email (11K tokens @ $3/$15 per 1M tokens)
- Resend: Included in plan
- **Total per email**: ~$0.016

## Monitoring & Observability

### CloudWatch Logs
- Log Group: `/aws/lambda/EmailAnalyzerStack-EmailAnalyzerFunction*`
- Retention: 7 days
- Access: `./tail-logs.sh` utility

### Key Metrics to Monitor
- Lambda invocation count
- Lambda duration (p50, p95, p99)
- Lambda errors and throttles
- DynamoDB write capacity
- API Gateway 4xx/5xx errors

### Structured Log Events
```json
{
  "reqId": "req-123",
  "emailId": "abc-def-ghi",
  "from": "sender@example.com",
  "subject": "Email subject",
  "duration": 32500,
  "tokensUsed": 11500,
  "success": true,
  "emailSent": true
}
```

## Failure Modes & Recovery

| Failure | Impact | Recovery |
|---------|--------|----------|
| Claude API timeout | Email not analyzed | Logged, manual retry possible |
| Resend send failure (5xx) | Analysis not delivered | Automatic 1 retry, then logged |
| Resend send failure (4xx) | Analysis not delivered | Logged immediately, no retry |
| DynamoDB write failure | No fine-tuning data | Logged, non-critical |
| Lambda timeout (5min) | Request fails | Resend retries webhook |
| Lambda memory exhausted | Request fails | Increase memory in CDK |

## Scalability Considerations

### Current Limitations
1. **Lambda timeout**: 5 minutes (hard AWS limit for API Gateway)
2. **Memory**: 2GB (sufficient for current workload)
3. **Concurrency**: 1000 (AWS default, can be increased)
4. **Claude rate limits**: Depends on Anthropic tier

### Scaling Strategy
1. **Horizontal**: Lambda auto-scales automatically
2. **Vertical**: Increase memory if needed (impacts CPU allocation)
3. **Rate limiting**: Implement at API Gateway if needed
4. **Async processing**: Consider SQS + async Lambda for >1000 emails/hour

## Future Architecture Improvements

### Short Term
1. Add Resend webhook signature verification
2. Migrate secrets to AWS Secrets Manager
3. Add CloudWatch alarms for errors and latency
4. Implement request ID in response headers

### Medium Term
1. Add caching layer (ElastiCache) for repeated analyses
2. Implement circuit breaker for Claude API
3. Add distributed tracing (X-Ray)
4. Create separate DynamoDB tables for staging/prod

### Long Term
1. Multi-region deployment for HA
2. Custom fine-tuned model to reduce cost
3. Real-time analysis dashboard
4. Batch processing mode for bulk analysis

## Technology Decisions Log

| Decision | Alternative Considered | Rationale |
|----------|------------------------|-----------|
| Fastify | Express, Koa | Performance, TypeScript support |
| AWS Lambda | ECS, EC2 | Serverless, zero idle cost |
| DynamoDB | PostgreSQL RDS | Serverless, auto-scaling |
| Claude API | OpenAI, Local Model | Quality, maintained, production-ready |
| Langchain | Direct API calls | Structured output, abstractions |
| CDK | Terraform, CloudFormation | Type-safe, native AWS support |
| Resend | SendGrid, AWS SES | Developer experience, webhooks |

---

**Document Version**: 1.0
**Last Updated**: 2025-11-24
**Authors**: Winston (Architect), Amelia (Developer), Mary (Analyst)
