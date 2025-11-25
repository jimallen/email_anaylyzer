#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { EmailAnalyzerStack } from '../lib/email-analyzer-stack';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables from .env file
dotenv.config({ path: path.join(__dirname, '../.env') });

const app = new cdk.App();

new EmailAnalyzerStack(app, 'EmailAnalyzerStack', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION || 'eu-central-1',
  },
  description: 'Email Analyzer Service with Lambda Container and API Gateway',
});

app.synth();
