# Email Analyzer - Agent Context Guide

> **For AI Agents**: This document provides a complete index of project documentation. Read relevant sections before making changes.

## Project Summary

**Email Analyzer** is a serverless AI-powered email analysis system that:
- Receives marketing emails via Resend webhook
- Analyzes them with Claude AI (Sonnet 4 for analysis, Haiku for utilities)
- Returns detailed copywriting feedback via email
- Stores analysis data in DynamoDB for fine-tuning

**Tech Stack**: Node.js 20, TypeScript, Fastify, AWS Lambda, API Gateway, DynamoDB, Claude API, Resend API, AWS CDK

## Quick Reference

| What You Need | Read This |
|---------------|-----------|
| Project overview | [README.md](README.md) |
| System architecture | [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) |
| How to develop | [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) |
| API specifications | [docs/API_REFERENCE.md](docs/API_REFERENCE.md) |
| Operations & debugging | [docs/OPERATIONS.md](docs/OPERATIONS.md) |
| Testing approach | [docs/TESTING.md](docs/TESTING.md) |
| Deployment steps | [DEPLOYMENT.md](DEPLOYMENT.md) |
| Fine-tuning data format | [FINE_TUNING_FORMAT.md](FINE_TUNING_FORMAT.md) |

## Documentation Index

### Core Documentation

| File | Description | When to Read |
|------|-------------|--------------|
| [README.md](README.md) | Project overview, quick start, structure | First time working on project |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | System design, components, data flow, design decisions | Understanding system design, making architectural changes |
| [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) | Setup, code organization, debugging, IDE config | Setting up dev environment, understanding code structure |
| [docs/API_REFERENCE.md](docs/API_REFERENCE.md) | Webhook API, request/response schemas, examples | Working with webhook, understanding data formats |
| [docs/OPERATIONS.md](docs/OPERATIONS.md) | Monitoring, troubleshooting, maintenance, incidents | Debugging issues, understanding logs, operations tasks |
| [docs/TESTING.md](docs/TESTING.md) | Test strategy, mocking, coverage, CI/CD | Writing tests, understanding test approach |

### Deployment & Configuration

| File | Description | When to Read |
|------|-------------|--------------|
| [DEPLOYMENT.md](DEPLOYMENT.md) | AWS deployment procedures | Deploying changes to AWS |
| [FINE_TUNING_FORMAT.md](FINE_TUNING_FORMAT.md) | DynamoDB data format for LLM fine-tuning | Working with stored analysis data |
| [cdk/README.md](cdk/README.md) | CDK infrastructure details | Modifying AWS infrastructure |
| [cdk/.env.example](cdk/.env.example) | Environment variable template | Configuring deployment |

### Legacy/Reference Documentation

| File | Description |
|------|-------------|
| [docs/prd.md](docs/prd.md) | Original product requirements document |
| [docs/architecture.md](docs/architecture.md) | Original architecture planning |
| [docs/epics.md](docs/epics.md) | Development epics and stories |
| [docs/llm-api-integration.md](docs/llm-api-integration.md) | LLM integration specifications |

## Project Structure

```
email_anaylyzer/
├── src/                          # Source code
│   ├── routes/webhook.ts         # Main webhook handler (~700 lines)
│   ├── services/
│   │   ├── llm-client.ts         # Claude AI integration
│   │   ├── resend-client.ts      # Email sending
│   │   └── dynamodb-client.ts    # Data persistence
│   ├── app.ts                    # Fastify app setup
│   ├── lambda.ts                 # Lambda entry point
│   └── lambda-app.ts             # Lambda-specific config
├── cdk/                          # AWS CDK infrastructure
│   ├── lib/email-analyzer-stack.ts  # Main stack definition
│   ├── deploy.sh                 # Deployment script
│   └── tail-logs.sh              # Log monitoring utility
├── config/                       # Runtime configuration
├── docs/                         # Documentation
└── test/                         # Test files
```

## Key Files by Task

### Modifying Email Analysis Logic
1. Read: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) - Data Flow section
2. Edit: `src/services/llm-client.ts` - `callClaudeForAnalysis()`
3. Test: Send test email, check logs with `./tail-logs.sh --follow`

### Changing Email Response Format
1. Read: [docs/API_REFERENCE.md](docs/API_REFERENCE.md) - Email Analysis Response section
2. Edit: `src/services/llm-client.ts` - `formatAnalysisToText()`
3. Edit: `src/services/resend-client.ts` - if changing HTML/structure

### Adding New Webhook Endpoints
1. Read: [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) - Route Handlers section
2. Read: [docs/API_REFERENCE.md](docs/API_REFERENCE.md) - for API conventions
3. Edit: `src/routes/` - add new route file
4. Update: [docs/API_REFERENCE.md](docs/API_REFERENCE.md) - document new endpoint

### Debugging Production Issues
1. Read: [docs/OPERATIONS.md](docs/OPERATIONS.md) - Troubleshooting section
2. Run: `cd cdk && ./tail-logs.sh --since 30m`
3. Check: CloudWatch Insights queries in Operations doc

### Deploying Changes
1. Read: [DEPLOYMENT.md](DEPLOYMENT.md)
2. Run: `cd cdk && ./deploy.sh`
3. Verify: `./tail-logs.sh --follow`

### Modifying Infrastructure
1. Read: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) - Infrastructure Layer section
2. Read: [cdk/README.md](cdk/README.md)
3. Edit: `cdk/lib/email-analyzer-stack.ts`
4. Deploy: `cd cdk && ./deploy.sh`

## Environment & Configuration

### Required Environment Variables
```bash
RESEND_API_KEY          # Resend API key
RESEND_FROM_EMAIL       # Verified sender (response@allennet.me)
ANTHROPIC_API_KEY       # Claude API key
AWS_REGION              # AWS region (eu-central-1)
DYNAMODB_TABLE_NAME     # DynamoDB table (EmailAnalysisData)
```

### Current Production Config
- **Region**: eu-central-1
- **Lambda**: 2048MB, 300s timeout
- **API Gateway**: https://v38sym2f82.execute-api.eu-central-1.amazonaws.com/prod
- **Webhook**: /webhook/inbound-email
- **FROM Email**: response@allennet.me
- **DynamoDB Table**: EmailAnalysisData

## Common Commands

```bash
# Development
pnpm install              # Install dependencies
pnpm run dev              # Start dev server
pnpm run build:ts         # Build TypeScript
pnpm test                 # Run tests

# Deployment
cd cdk && ./deploy.sh     # Deploy to AWS

# Monitoring
cd cdk
./tail-logs.sh --follow   # Real-time logs
./tail-logs.sh --since 10m # Last 10 minutes
```

## Architecture Overview

```
┌─────────────┐     ┌──────────────┐     ┌────────────────┐
│   Resend    │────>│  API Gateway │────>│  AWS Lambda    │
│  (Webhook)  │     │              │     │   (Fastify)    │
└─────────────┘     └──────────────┘     └────────────────┘
                                                  │
                    ┌─────────────────────────────┼─────────────────────────────┐
                    │                             │                             │
                    ▼                             ▼                             ▼
             ┌──────────────┐            ┌──────────────┐            ┌──────────────┐
             │   Resend     │            │  Claude AI   │            │  DynamoDB    │
             │ (Send Email) │            │  (Analysis)  │            │(Fine-tuning) │
             └──────────────┘            └──────────────┘            └──────────────┘
```

## Processing Flow

1. **Receive** - Resend webhook → API Gateway → Lambda
2. **Fetch** - Get full email content from Resend API
3. **Extract** - Parse text, download attachments
4. **Analyze** - Claude Haiku (name), Claude Sonnet 4 (analysis)
5. **Format** - Convert analysis to HTML email
6. **Send** - Deliver via Resend
7. **Store** - Save to DynamoDB (async)

## Agent Guidelines

### Before Making Changes
1. Read relevant documentation sections
2. Understand existing patterns in the codebase
3. Check for similar implementations to follow

### Code Style
- TypeScript with strict mode
- Structured logging with context (`reqId`, `emailId`)
- Error handling with appropriate log levels
- Zod schemas for runtime validation

### After Making Changes
1. Ensure TypeScript compiles: `pnpm run build:ts`
2. Run tests: `pnpm test`
3. Update documentation if API/behavior changes
4. Deploy and verify: `cd cdk && ./deploy.sh`

### Logging Conventions
```typescript
logger?.info({ emailId, duration, tokensUsed }, 'Operation completed');
logger?.error({ error: error.message, context }, 'Operation failed');
```

Log levels: 30=INFO, 40=WARN, 50=ERROR

---

**Last Updated**: 2025-11-24
**Version**: 1.0
