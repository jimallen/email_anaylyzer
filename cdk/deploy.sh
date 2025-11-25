#!/bin/bash

# Email Analyzer CDK Deployment Script

set -e

echo "==================================="
echo "Email Analyzer CDK Deployment"
echo "==================================="
echo ""

# Load environment variables from .env file
if [ -f ".env" ]; then
    echo "Loading environment variables from .env file..."
    export $(cat .env | grep -v '^#' | xargs)
    echo ""
fi

# Check required environment variables
REQUIRED_VARS=("RESEND_API_KEY" "ANTHROPIC_API_KEY")
MISSING_VARS=()

for var in "${REQUIRED_VARS[@]}"; do
    if [ -z "${!var}" ]; then
        MISSING_VARS+=("$var")
    fi
done

if [ ${#MISSING_VARS[@]} -ne 0 ]; then
    echo "ERROR: Missing required environment variables in .env file:"
    for var in "${MISSING_VARS[@]}"; do
        echo "  - $var"
    done
    echo ""
    echo "Please add them to cdk/.env file or export them:"
    echo "  export RESEND_API_KEY=\"your-key\""
    echo "  export ANTHROPIC_API_KEY=\"your-key\""
    echo "  export RESEND_FROM_EMAIL=\"onboarding@resend.dev\"  # optional"
    echo "  export SPARKY_LLM_URL=\"http://...\"  # optional"
    exit 1
fi

# Set AWS profile and region
export AWS_PROFILE=AdministratorAccess-123567778292
export AWS_REGION=eu-central-1
export CDK_DEFAULT_REGION=eu-central-1

# Check if AWS CLI is configured
if ! aws sts get-caller-identity > /dev/null 2>&1; then
    echo "ERROR: AWS CLI is not configured. Please run 'aws sso login --profile $AWS_PROFILE' first."
    exit 1
fi

# Get AWS account and region
AWS_ACCOUNT=$(aws sts get-caller-identity --query Account --output text)
AWS_REGION=$(aws configure get region --profile $AWS_PROFILE || echo "eu-central-1")

# Export CDK_DEFAULT_ACCOUNT for CDK
export CDK_DEFAULT_ACCOUNT=$AWS_ACCOUNT

echo "✓ Environment variables set"
echo "✓ AWS CLI configured (using profile: $AWS_PROFILE)"
echo ""

echo "Deploying to AWS Account: $AWS_ACCOUNT"
echo "Region: $AWS_REGION"
echo ""

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "Installing CDK dependencies..."
    pnpm install
    echo ""
fi

# Build TypeScript
echo "Building CDK TypeScript..."
pnpm run build
echo ""

# Synthesize CloudFormation template
echo "Synthesizing CloudFormation template..."
pnpm run synth
echo ""

# Deploy
echo "Deploying stack..."
npx cdk deploy --profile $AWS_PROFILE --require-approval never

echo ""
echo "==================================="
echo "Deployment Complete!"
echo "==================================="
echo ""
echo "Next steps:"
echo "1. Copy the WebhookUrl from the outputs above"
echo "2. Configure it in your Resend dashboard"
echo "3. Test by sending an email to your inbound address"
echo ""
