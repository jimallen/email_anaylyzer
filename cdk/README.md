# Email Analyzer CDK Deployment

This directory contains AWS CDK infrastructure code for deploying the Email Analyzer service.

## Architecture

The deployment creates:
- **Lambda Function**: Node.js 20 Lambda function running the Fastify application (bundled as zip)
- **Lambda Layer**: Poppler-utils layer for PDF processing (pdftoppm)
- **API Gateway**: REST API with `/webhook/inbound-email` endpoint
- **CloudWatch Logs**: Log retention for 7 days

## Prerequisites

1. AWS CLI configured with appropriate credentials
2. Node.js 18+ and pnpm installed
3. AWS CDK CLI installed globally:
   ```bash
   npm install -g aws-cdk
   ```

**Note**: This deployment uses a Lambda Layer for PDF processing. The layer ARN in the stack may need to be updated for your region or you can build your own layer - see Troubleshooting section below.

## Environment Variables

Configure environment variables in the `.env` file:

```bash
# Copy the example file
cp .env.example .env

# Edit with your actual values
nano .env  # or use your preferred editor
```

Required variables in `.env`:
- `RESEND_API_KEY` - Your Resend API key
- `ANTHROPIC_API_KEY` - Your Claude API key
- `RESEND_FROM_EMAIL` - From email address (optional, defaults to onboarding@resend.dev)
- `SPARKY_LLM_URL` - Custom LLM endpoint (optional)

## Deployment Steps

1. **Install CDK dependencies**:
   ```bash
   cd cdk
   pnpm install
   ```

2. **Bootstrap CDK** (first time only):
   ```bash
   cdk bootstrap
   ```

3. **Build and synthesize**:
   ```bash
   pnpm run build
   pnpm run synth
   ```

4. **Deploy**:
   ```bash
   pnpm run deploy
   ```

   Or use the deployment script:
   ```bash
   chmod +x deploy.sh
   ./deploy.sh
   ```

## Outputs

After deployment, the stack will output:
- **ApiEndpoint**: Base API Gateway URL
- **WebhookUrl**: Full webhook URL to configure in Resend
- **LambdaFunctionArn**: ARN of the Lambda function

## Configuration in Resend

After deployment, configure the webhook in Resend:
1. Go to Resend Dashboard > Inbound Emails
2. Add a new webhook
3. Use the `WebhookUrl` from CDK output
4. Select "email.received" event type

## Updating

To update the deployment after code changes:

```bash
cd cdk
pnpm run deploy
```

CDK will automatically:
- Rebuild the Docker image
- Push to ECR
- Update the Lambda function

## Monitoring

View logs in CloudWatch:
```bash
aws logs tail /aws/lambda/EmailAnalyzerStack-EmailAnalyzerFunction --follow
```

## Cleanup

To destroy all resources:

```bash
cd cdk
pnpm run destroy
```

## Troubleshooting

### Lambda Layer ARN issues
The stack uses a public Lambda Layer for poppler-utils (pdftoppm). If you encounter issues:

1. **Update the Layer ARN for your region**:
   - Open `lib/email-analyzer-stack.ts`
   - Find the `popplerLayer` definition
   - Update the ARN to match your AWS region

2. **Build your own Lambda Layer** (requires Docker once):
   ```bash
   # See scripts/build-poppler-layer.sh for instructions
   # This creates a layer zip that you can upload manually
   ```

3. **Temporarily disable PDF support**:
   - Comment out the `layers: [popplerLayer]` line in the stack
   - PDFs won't be processed, but text-only emails will work

### Lambda timeout
- Default timeout is 300 seconds (5 minutes)
- Adjust in `lib/email-analyzer-stack.ts` if needed

### Environment variables not set
- Ensure `.env` file exists in cdk directory
- Copy from `.env.example` if needed: `cp .env.example .env`
- Verify values are set correctly in `.env` file

### esbuild bundling errors
- Ensure all dependencies are listed in package.json
- Check that node_modules are properly installed: `pnpm install`

## Cost Estimation

Typical costs (assuming moderate usage):
- Lambda: ~$0.20 per 1M requests + compute time
- API Gateway: ~$1.00 per 1M requests
- ECR storage: ~$0.10/GB/month
- CloudWatch Logs: ~$0.50/GB ingested

Total estimated: ~$5-10/month for low-moderate traffic
