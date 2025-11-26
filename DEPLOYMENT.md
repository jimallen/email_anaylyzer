# Email Analyzer Deployment Guide

This guide covers deploying the Email Analyzer service to AWS using CDK.

## Quick Start

```bash
# 1. Configure environment variables
cd cdk
cp .env.example .env
# Edit .env with your actual API keys

# 2. Install dependencies (first time only)
pnpm install

# 3. Bootstrap CDK (first time only)
cdk bootstrap

# 4. Deploy
./deploy.sh
```

## What Gets Deployed

The CDK deployment creates:

1. **Lambda Function** (Container Image)
   - Runtime: Node.js 20 on Amazon Linux 2023
   - Memory: 2048 MB
   - Timeout: 300 seconds (5 minutes)
   - Includes: pdftoppm (poppler-utils) for PDF processing
   - Environment: Production-ready configuration

2. **API Gateway (REST API)**
   - Endpoint: `/webhook/inbound-email`
   - Methods: GET (verification), POST (webhook)
   - CORS: Enabled
   - Logging: Enabled with metrics

3. **DynamoDB Tables** ✨ UPDATED
   - **EmailAnalysisData**: Stores analysis data for fine-tuning
     - Partition key: emailId
     - Sort key: timestamp
     - GSI: SenderIndex (from + timestamp)
   - **EmailAnalysisPersonas**: Stores AI persona configurations
     - Partition key: personaId
     - GSI: EmailAddressIndex (emailAddress)
     - Encryption: AWS-managed SSE
     - Point-in-time recovery: Enabled

4. **ECR Repository**
   - Automatically created and managed by CDK
   - Stores Docker images for Lambda

5. **CloudWatch Logs**
   - Log retention: 7 days
   - Structured JSON logging

## Prerequisites

### Required Tools
- AWS CLI 2.x ([Installation Guide](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html))
- Node.js 18+ ([Download](https://nodejs.org/))
- pnpm 8+ (`npm install -g pnpm`)
- Docker Desktop ([Download](https://www.docker.com/products/docker-desktop/))
- AWS CDK CLI (`npm install -g aws-cdk`)

### AWS Configuration

1. Configure AWS credentials:
   ```bash
   aws configure
   ```

2. Ensure your IAM user/role has permissions for:
   - Lambda
   - API Gateway
   - ECR
   - CloudFormation
   - IAM (for Lambda execution role)
   - CloudWatch Logs

## Environment Variables

### Required

| Variable | Description | Example |
|----------|-------------|---------|
| `RESEND_API_KEY` | Resend API key for sending emails | `re_...` |
| `ANTHROPIC_API_KEY` | Claude API key for language detection and analysis | `sk-ant-api03-...` |

### Optional

| Variable | Description | Default | Notes |
|----------|-------------|---------|-------|
| `RESEND_FROM_EMAIL` | From email address | `onboarding@resend.dev` | ✨ Set to persona email (e.g., jenny-bot@allennet.me) for persona-branded responses |
| `SPARKY_LLM_URL` | Custom LLM endpoint URL | (none) | Optional custom LLM endpoint |
| `AWS_REGION` | AWS region for deployment | `us-east-1` | AWS deployment region |

### Auto-Injected (CDK)

| Variable | Description | Source |
|----------|-------------|--------|
| `DYNAMODB_TABLE_NAME` | Analysis data table name | CDK stack output |
| `PERSONA_TABLE_NAME` | ✨ Persona configurations table | CDK stack output |

## Deployment Process

### First-Time Deployment

1. **Clone and install**:
   ```bash
   git clone <repository>
   cd email_anaylyzer
   pnpm install
   ```

2. **Configure environment**:
   ```bash
   cd cdk
   cp .env.example .env
   # Edit .env and add your actual API keys
   nano .env  # or use your preferred editor
   ```

3. **Bootstrap CDK** (one-time per AWS account/region):
   ```bash
   cd cdk
   cdk bootstrap
   ```

4. **Deploy**:
   ```bash
   ./deploy.sh
   ```

### Updating Existing Deployment

After making code changes:

```bash
cd cdk
./deploy.sh
```

CDK automatically:
- Rebuilds the Docker image
- Pushes to ECR
- Updates Lambda with new image
- No downtime during update

## Post-Deployment Configuration

### 1. Seed AI Personas ✨ NEW (CRITICAL)

**This step is required for the system to function properly.**

After first-time deployment, populate the persona table:

```bash
# From project root
AWS_PROFILE=your-profile AWS_REGION=eu-central-1 npx tsx scripts/seed-personas.ts
```

This creates 3 AI personas:
- **jenny-bot@allennet.me** - Brand & Marketing Expert
- **christoph-bot@allennet.me** - Conversion & Performance Expert
- **icp-bot@allennet.me** - Ideal Customer Profile Expert

**Notes:**
- Script is **idempotent** - safe to run multiple times
- Updates existing personas if they exist
- Required before any email analysis can work
- Logs persona creation/update to console

**Verification:**
```bash
# Check DynamoDB table has personas
aws dynamodb scan --table-name EmailAnalysisPersonas --region eu-central-1
```

### 2. Get Webhook URL

After deployment, CDK outputs the webhook URL:

```
Outputs:
EmailAnalyzerStack.WebhookUrl = https://xxxxx.execute-api.us-east-1.amazonaws.com/prod/webhook/inbound-email
EmailAnalyzerStack.PersonaTableName = EmailAnalysisPersonas
```

### 3. Configure Resend Inbound Routing ✨ UPDATED

Configure **separate inbound routes** for each persona:

1. Go to [Resend Dashboard](https://resend.com/emails/inbound)
2. For **each persona**, add an inbound route:
   - **Domain**: allennet.me (or your domain)
   - **Email**: jenny-bot@ (or christoph-bot@, icp-bot@)
   - **Forward to**: The webhook URL from CDK output
3. Save all routes

**Important**: Each persona needs its own inbound route so Resend forwards emails to the correct recipient address.

### 4. Test the Webhook

Send test emails to each persona address:
```bash
# Test each persona
echo "Email draft content" | mail -s "Test Email" jenny-bot@allennet.me
echo "Email draft content" | mail -s "Test Email" christoph-bot@allennet.me
echo "Email draft content" | mail -s "Test Email" icp-bot@allennet.me
```

Check:
- CloudWatch Logs for processing (use `./tail-logs.sh --follow`)
- Your email inbox for persona-specific analysis responses
- Response subject should show `[Persona Name Analysis] Re: Test Email`

## Monitoring and Logs

### View Logs

**Using AWS Console:**
1. Go to CloudWatch → Log Groups
2. Find `/aws/lambda/EmailAnalyzerStack-EmailAnalyzerFunction...`
3. View log streams

**Using AWS CLI:**
```bash
# Tail logs in real-time
aws logs tail /aws/lambda/EmailAnalyzerStack-EmailAnalyzerFunction --follow

# View recent logs
aws logs tail /aws/lambda/EmailAnalyzerStack-EmailAnalyzerFunction --since 1h
```

### Metrics

View in CloudWatch:
- Invocations
- Duration
- Errors
- Throttles

API Gateway metrics:
- Request count
- Latency
- 4XX/5XX errors

## Troubleshooting

### Docker Build Issues

**Error**: "Cannot connect to Docker daemon"
```bash
# Ensure Docker is running
docker ps

# Restart Docker Desktop if needed
```

**Error**: "No space left on device"
```bash
# Clean up Docker
docker system prune -a
```

### Lambda Issues

**Error**: Lambda timeout
- Check CloudWatch logs for slow operations
- Increase timeout in `cdk/lib/email-analyzer-stack.ts`
- Redeploy

**Error**: Out of memory
- Increase memory in `cdk/lib/email-analyzer-stack.ts`
- Redeploy

### API Gateway Issues

**Error**: "Missing Authentication Token"
- Check the URL is correct (includes `/webhook/inbound-email`)
- Verify method is POST or GET

## Cost Optimization

### Lambda
- **Compute**: ~$0.0000166667/GB-second
- **Requests**: $0.20 per 1M requests
- With 2GB memory, 30-second average duration: ~$0.001 per request

### API Gateway
- $1.00 per 1M requests
- $0.09/GB for data transfer out

### ECR
- $0.10/GB/month storage
- Docker image size: ~500MB = $0.05/month

### Estimated Monthly Cost
- Low traffic (100 emails/day): ~$5-10/month
- Medium traffic (1000 emails/day): ~$20-30/month

## Cleanup

To remove all resources:

```bash
cd cdk
pnpm run destroy
```

This will:
- Delete Lambda function
- Delete API Gateway
- Delete CloudWatch logs
- Delete ECR images (optional)

**Note**: ECR repository may need manual deletion if it contains images.

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Deploy to AWS

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Configure AWS Credentials
        uses: aws-actions/configure-aws-credentials@v2
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: us-east-1

      - name: Install pnpm
        uses: pnpm/action-setup@v2
        with:
          version: 8

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '20'
          cache: 'pnpm'

      - name: Install dependencies
        run: |
          pnpm install
          cd cdk && pnpm install

      - name: Create .env file
        run: |
          cd cdk
          echo "RESEND_API_KEY=${{ secrets.RESEND_API_KEY }}" >> .env
          echo "ANTHROPIC_API_KEY=${{ secrets.ANTHROPIC_API_KEY }}" >> .env
          echo "RESEND_FROM_EMAIL=${{ secrets.RESEND_FROM_EMAIL }}" >> .env

      - name: Deploy CDK
        run: |
          cd cdk
          pnpm run deploy
```

## Security Best Practices

1. **API Keys**: Store in AWS Secrets Manager (not environment variables)
2. **API Gateway**: Add API key or custom authorizer
3. **Lambda**: Use least-privilege IAM roles
4. **Logs**: Don't log sensitive data (email content, API keys)
5. **VPC**: Deploy Lambda in VPC if accessing private resources

## Support

For issues or questions:
1. Check CloudWatch logs first
2. Review this guide
3. Open an issue in the repository
