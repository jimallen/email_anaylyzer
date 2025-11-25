# Email Analyzer

AI-powered email analysis system that provides copywriting feedback and marketing insights via Claude AI.

## Overview

Email Analyzer is a serverless application that receives emails via webhook, analyzes them using Claude AI, and sends back detailed copywriting feedback. The system is built for marketing professionals who want instant, expert-level analysis of their email campaigns.

**Key Features:**
- Real-time email analysis via Resend webhook integration
- Multi-language support with automatic language detection
- PDF and image attachment processing
- Structured analysis with lifecycle context, subject line evaluation, and detailed recommendations
- HTML-formatted email responses with markdown support
- Fine-tuning data collection in DynamoDB for continuous improvement

## Quick Start

### Prerequisites
- Node.js 20.x or later
- AWS Account with SSO configured
- Resend account with verified domain
- Anthropic API key for Claude

### Installation

```bash
# Clone repository
git clone https://github.com/jimallen/email_anaylyzer.git
cd email_anaylyzer

# Install dependencies
pnpm install

# Set up environment variables
cp cdk/.env.example cdk/.env
# Edit cdk/.env with your API keys and configuration
```

### Local Development

```bash
# Run development server
pnpm run dev

# Build TypeScript
pnpm run build:ts

# Run tests
pnpm test
```

### Deployment

```bash
cd cdk
./deploy.sh
```

See [DEPLOYMENT.md](DEPLOYMENT.md) for detailed deployment instructions.

## Architecture

The system consists of:
- **Fastify API** - HTTP webhook receiver
- **AWS Lambda** - Serverless compute running the Fastify app
- **API Gateway** - Public webhook endpoint
- **Claude AI** - Email analysis via Anthropic API
- **DynamoDB** - Fine-tuning data storage
- **Resend** - Email sending service

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for detailed architecture documentation.

## Project Structure

```
email_anaylyzer/
├── src/
│   ├── routes/          # API route handlers
│   │   └── webhook.ts   # Main webhook endpoint
│   ├── services/        # Business logic services
│   │   ├── llm-client.ts         # Claude AI integration
│   │   ├── resend-client.ts      # Email sending
│   │   └── dynamodb-client.ts    # Data persistence
│   ├── app.ts           # Fastify application setup
│   ├── lambda.ts        # Lambda handler
│   └── lambda-app.ts    # Lambda-specific Fastify config
├── cdk/                 # Infrastructure as Code
│   ├── lib/             # CDK stack definitions
│   ├── bin/             # CDK app entry point
│   ├── deploy.sh        # Deployment script
│   └── tail-logs.sh     # Log monitoring utility
├── config/              # Application configuration
├── docs/                # Documentation
└── test/                # Test suites
```

## Configuration

Key environment variables (see `.env.example`):

| Variable | Required | Description |
|----------|----------|-------------|
| `RESEND_API_KEY` | Yes | Resend API key for sending emails |
| `RESEND_FROM_EMAIL` | Yes | Verified sender email address |
| `ANTHROPIC_API_KEY` | Yes | Claude API key for analysis |
| `SPARKY_LLM_URL` | No | Alternative LLM endpoint (optional) |
| `AWS_REGION` | Yes | AWS region for deployment |

See [docs/CONFIGURATION.md](docs/CONFIGURATION.md) for complete configuration reference.

## Usage

### Webhook Endpoint

Once deployed, configure your Resend inbound email webhook to point to:
```
https://{api-id}.execute-api.{region}.amazonaws.com/prod/webhook/inbound-email
```

Forward an email to your configured inbound address, and receive AI analysis within 30-60 seconds.

### API Reference

See [docs/API_REFERENCE.md](docs/API_REFERENCE.md) for complete webhook API documentation.

## Documentation

- [ARCHITECTURE.md](docs/ARCHITECTURE.md) - System design and technical architecture
- [DEVELOPMENT.md](docs/DEVELOPMENT.md) - Developer setup and workflow
- [API_REFERENCE.md](docs/API_REFERENCE.md) - Webhook API specification
- [OPERATIONS.md](docs/OPERATIONS.md) - Production operations and monitoring
- [TESTING.md](docs/TESTING.md) - Testing strategy and practices
- [DEPLOYMENT.md](DEPLOYMENT.md) - Deployment procedures
- [FINE_TUNING_FORMAT.md](FINE_TUNING_FORMAT.md) - Data format for model fine-tuning

## Monitoring

```bash
# Tail CloudWatch logs
cd cdk
./tail-logs.sh --follow

# View recent logs
./tail-logs.sh --since 10m

# View logs from specific time
./tail-logs.sh --since 1h
```

See [docs/OPERATIONS.md](docs/OPERATIONS.md) for monitoring and troubleshooting guides.

## Development Workflow

1. **Make changes** to source files in `src/`
2. **Test locally** with `pnpm run dev`
3. **Build** TypeScript with `pnpm run build:ts`
4. **Deploy** to AWS with `cd cdk && ./deploy.sh`
5. **Monitor** with `./tail-logs.sh --follow`

## Technology Stack

- **Runtime**: Node.js 20.x
- **Framework**: Fastify 5.x
- **AI/LLM**: Anthropic Claude (Sonnet 4 & Haiku), Langchain
- **Infrastructure**: AWS CDK, Lambda, API Gateway, DynamoDB
- **Email**: Resend API
- **Language**: TypeScript 5.9

## Testing

```bash
# Run test suite
pnpm test

# Run tests in watch mode
pnpm run test:watch
```

See [docs/TESTING.md](docs/TESTING.md) for testing guidelines.

## Contributing

This is a personal project but feedback and suggestions are welcome. Please ensure:
- TypeScript compiles without errors
- Tests pass
- Code follows existing patterns
- Documentation is updated

## License

ISC

## Support

For issues or questions:
- Check [docs/OPERATIONS.md](docs/OPERATIONS.md) for troubleshooting
- Review CloudWatch logs with `./tail-logs.sh`
- Check Resend dashboard for email delivery status

---

**Built with Claude Code** 🤖
