#!/bin/bash

# Tail CloudWatch logs for Email Analyzer Lambda
# Usage: ./tail-logs.sh [--follow] [--since 10m] [other aws logs tail options]
export AWS_PROFILE=jim-stage
export AWS_REGION=eu-central-1

aws logs tail /aws/lambda/EmailAnalyzerStack-EmailAnalyzerFunction6AFF08ED-M5Pkw3jHto1N \
  --format short \
  --region eu-central-1 \
  "$@"
