import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import { Construct } from 'constructs';
import * as path from 'path';

export class EmailAnalyzerStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // DynamoDB table for storing email analysis data for fine-tuning
    const analysisTable = new dynamodb.Table(this, 'EmailAnalysisTable', {
      partitionKey: {
        name: 'emailId',
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'timestamp',
        type: dynamodb.AttributeType.NUMBER,
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST, // On-demand pricing
      removalPolicy: cdk.RemovalPolicy.RETAIN, // Keep data even if stack is deleted
      pointInTimeRecovery: true, // Enable backup
      tableName: 'EmailAnalysisData',
    });

    // Add GSI for querying by sender email
    analysisTable.addGlobalSecondaryIndex({
      indexName: 'SenderIndex',
      partitionKey: {
        name: 'from',
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'timestamp',
        type: dynamodb.AttributeType.NUMBER,
      },
    });

    // Lambda Layer for pdftoppm (poppler-utils)
    // TODO: Build and add poppler layer for PDF support
    // See scripts/build-poppler-layer.sh for instructions
    // const popplerLayer = lambda.LayerVersion.fromLayerVersionArn(
    //   this,
    //   'PopplerLayer',
    //   'arn:aws:lambda:eu-central-1:YOUR-ACCOUNT:layer:poppler-utils:1'
    // );

    // Create Lambda function using NodejsFunction for automatic bundling
    const emailAnalyzerFunction = new NodejsFunction(this, 'EmailAnalyzerFunction', {
      entry: path.join(__dirname, '../../src/lambda.ts'),
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_20_X,
      memorySize: 2048,
      timeout: cdk.Duration.seconds(300), // 5 minutes for LLM processing
      projectRoot: path.join(__dirname, '../..'), // Set project root to parent directory
      depsLockFilePath: path.join(__dirname, '../../pnpm-lock.yaml'), // Point to parent lock file
      bundling: {
        minify: false, // Keep false for debugging
        sourceMap: true,
        forceDockerBundling: false, // Use local bundling instead of Docker
        externalModules: [
          'aws-sdk', // Already available in Lambda
        ],
        commandHooks: {
          beforeBundling(inputDir: string, outputDir: string): string[] {
            return [];
          },
          afterBundling(inputDir: string, outputDir: string): string[] {
            // Copy config to the bundle
            return [
              `cp -r ${path.join(inputDir, 'config')} ${outputDir}/`,
            ];
          },
          beforeInstall(inputDir: string, outputDir: string): string[] {
            return [];
          },
        },
      },
      // layers: [popplerLayer], // Add poppler layer for pdftoppm when available
      environment: {
        NODE_ENV: 'production',
        LOG_LEVEL: 'info',
        RESEND_API_KEY: process.env.RESEND_API_KEY || '',
        RESEND_FROM_EMAIL: process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev',
        ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY || '',
        SPARKY_LLM_URL: process.env.SPARKY_LLM_URL || '',
        DYNAMODB_TABLE_NAME: analysisTable.tableName,
      },
      logRetention: logs.RetentionDays.ONE_WEEK,
    });

    // Grant Lambda write permissions to DynamoDB table
    analysisTable.grantWriteData(emailAnalyzerFunction);

    // Create API Gateway REST API
    const api = new apigateway.RestApi(this, 'EmailAnalyzerApi', {
      restApiName: 'Email Analyzer Service',
      description: 'API for processing inbound emails via webhook',
      deployOptions: {
        stageName: 'prod',
        loggingLevel: apigateway.MethodLoggingLevel.INFO,
        dataTraceEnabled: true,
        metricsEnabled: true,
      },
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
      },
    });

    // Create webhook resource
    const webhook = api.root.addResource('webhook');
    const inboundEmail = webhook.addResource('inbound-email');

    // Create Lambda integration
    const lambdaIntegration = new apigateway.LambdaIntegration(emailAnalyzerFunction, {
      proxy: true,
      timeout: cdk.Duration.seconds(29), // API Gateway max timeout
    });

    // Add GET method for webhook verification
    inboundEmail.addMethod('GET', lambdaIntegration);

    // Add POST method for webhook events
    inboundEmail.addMethod('POST', lambdaIntegration);

    // Output the API endpoint
    new cdk.CfnOutput(this, 'ApiEndpoint', {
      value: api.url,
      description: 'Email Analyzer API Gateway endpoint',
      exportName: 'EmailAnalyzerApiUrl',
    });

    // Output the webhook URL
    new cdk.CfnOutput(this, 'WebhookUrl', {
      value: `${api.url}webhook/inbound-email`,
      description: 'Webhook URL for Resend inbound emails',
      exportName: 'EmailAnalyzerWebhookUrl',
    });

    // Output Lambda function ARN
    new cdk.CfnOutput(this, 'LambdaFunctionArn', {
      value: emailAnalyzerFunction.functionArn,
      description: 'Email Analyzer Lambda Function ARN',
      exportName: 'EmailAnalyzerLambdaArn',
    });

    // Output DynamoDB table name
    new cdk.CfnOutput(this, 'AnalysisTableName', {
      value: analysisTable.tableName,
      description: 'DynamoDB table for email analysis data',
      exportName: 'EmailAnalysisTableName',
    });
  }
}
