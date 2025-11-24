import type { FastifyBaseLogger } from 'fastify';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';

/**
 * DynamoDB service for storing email analysis data
 * Used for collecting training data for future fine-tuning
 */

// Initialize DynamoDB client
const client = new DynamoDBClient({ region: process.env.AWS_REGION || 'eu-central-1' });
const docClient = DynamoDBDocumentClient.from(client);

const TABLE_NAME = process.env.DYNAMODB_TABLE_NAME || 'EmailAnalysisData';

/**
 * Email analysis record structure for DynamoDB
 */
export interface EmailAnalysisRecord {
  emailId: string; // Partition key
  timestamp: number; // Sort key (epoch milliseconds)
  from: string; // Sender email (GSI partition key)
  subject: string;
  emailContent: string; // Text content of email
  detectedLanguage: string;
  claudeAnalysis: string; // The feedback/analysis from Claude
  tokensUsed?: number;
  processingTimeMs: number;
  contentType: 'text-only' | 'screenshot-only' | 'hybrid' | 'empty';
  hasAttachments: boolean;
  attachmentCount: number;
  imageCount: number;
  pdfCount: number;
}

/**
 * Saves email analysis data to DynamoDB for fine-tuning
 *
 * @param record - Email analysis record to save
 * @param logger - Optional Fastify logger
 * @returns Success boolean
 */
export async function saveAnalysisData(
  record: EmailAnalysisRecord,
  logger?: FastifyBaseLogger
): Promise<boolean> {
  try {
    logger?.info({
      emailId: record.emailId,
      from: record.from,
      subject: record.subject,
      tableName: TABLE_NAME
    }, 'Saving analysis data to DynamoDB');

    const command = new PutCommand({
      TableName: TABLE_NAME,
      Item: record,
    });

    await docClient.send(command);

    logger?.info({
      emailId: record.emailId,
      timestamp: record.timestamp
    }, 'Successfully saved analysis data to DynamoDB');

    return true;
  } catch (error) {
    logger?.error({
      emailId: record.emailId,
      error: error instanceof Error ? error.message : String(error),
      tableName: TABLE_NAME
    }, 'Failed to save analysis data to DynamoDB');

    return false;
  }
}

/**
 * Helper function to create training data record from webhook processing
 *
 * @param params - Parameters from email processing
 * @returns Email analysis record ready for DynamoDB
 */
export function createAnalysisRecord(params: {
  emailId: string;
  from: string;
  subject: string;
  emailContent: string;
  detectedLanguage: string;
  claudeAnalysis: string;
  tokensUsed?: number;
  processingTimeMs: number;
  contentType: 'text-only' | 'screenshot-only' | 'hybrid' | 'empty';
  imageCount: number;
  pdfCount: number;
}): EmailAnalysisRecord {
  return {
    emailId: params.emailId,
    timestamp: Date.now(),
    from: params.from,
    subject: params.subject,
    emailContent: params.emailContent,
    detectedLanguage: params.detectedLanguage,
    claudeAnalysis: params.claudeAnalysis,
    tokensUsed: params.tokensUsed,
    processingTimeMs: params.processingTimeMs,
    contentType: params.contentType,
    hasAttachments: params.imageCount > 0 || params.pdfCount > 0,
    attachmentCount: params.imageCount + params.pdfCount,
    imageCount: params.imageCount,
    pdfCount: params.pdfCount,
  };
}
