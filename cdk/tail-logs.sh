#!/bin/bash

# Tail CloudWatch logs for Email Analyzer Lambda
# Usage: ./tail-logs.sh [--follow] [--since 10m] [other aws logs tail options]
export AWS_PROFILE=AdministratorAccess-123567778292
export AWS_REGION=eu-central-1

aws logs tail /aws/lambda/EmailAnalyzerStack-EmailAnalyzerFunction6AFF08ED-kZiiqZsM6qL9 \
  --format short \
  --region eu-central-1 \
  "$@"
