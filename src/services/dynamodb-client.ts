import type { FastifyBaseLogger } from 'fastify';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';
import type { EmailAnalysisJSON } from './llm-client';

/**
 * DynamoDB service for storing email analysis data
 * Used for collecting training data for future fine-tuning
 */

// Initialize DynamoDB client
const client = new DynamoDBClient({ region: process.env.AWS_REGION || 'eu-central-1' });
const docClient = DynamoDBDocumentClient.from(client, {
  marshallOptions: {
    removeUndefinedValues: true, // Remove undefined values from objects
  },
});

const TABLE_NAME = process.env.DYNAMODB_TABLE_NAME || 'EmailAnalysisData';

/**
 * Fine-tuning training example structure
 * Compatible with OpenAI/Anthropic fine-tuning format
 */
export interface FineTuningTrainingExample {
  messages: Array<{
    role: 'system' | 'user' | 'assistant';
    content: string | EmailAnalysisJSON;
  }>;
  metadata: {
    language: string;
    contentType: 'text-only' | 'screenshot-only' | 'hybrid' | 'empty';
    hasImages: boolean;
    hasPDFs: boolean;
    imageCount: number;
    pdfCount: number;
    tokensUsed?: number;
    processingTimeMs: number;
  };
}

/**
 * Email analysis record structure for DynamoDB
 */
export interface EmailAnalysisRecord {
  emailId: string; // Partition key
  timestamp: number; // Sort key (epoch milliseconds)
  from: string; // Sender email (GSI partition key)
  subject: string;

  // Persona fields
  personaId: string; // ID of persona that analyzed this email
  personaName: string; // Name of persona for easy reference

  // Legacy fields for backward compatibility
  emailContent: string; // Text content of email
  detectedLanguage: string;
  claudeAnalysis: string; // The feedback/analysis from Claude (formatted text)
  claudeAnalysisJson?: EmailAnalysisJSON; // Structured JSON for parsing

  // Fine-tuning optimized format
  fineTuningData: FineTuningTrainingExample;

  // Metadata
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
  personaId: string;
  personaName: string;
  emailContent: string;
  detectedLanguage: string;
  claudeAnalysis: string;
  claudeAnalysisJson?: EmailAnalysisJSON;
  tokensUsed?: number;
  processingTimeMs: number;
  contentType: 'text-only' | 'screenshot-only' | 'hybrid' | 'empty';
  imageCount: number;
  pdfCount: number;
}): EmailAnalysisRecord {
  // Build system prompt for fine-tuning
  const systemPrompt = `You are an email marketing analyst specializing in retail e-commerce.

Analyze the provided email marketing campaign and provide comprehensive feedback.

CRITICAL LANGUAGE REQUIREMENT:
- Email Language: ${params.detectedLanguage}
- ALL suggestions (subject lines, CTA text, body copy examples) MUST be in ${params.detectedLanguage}
- Analysis and explanations should be in English
- DO NOT suggest removing email client prefixes (Fwd:, Re:, Fw:) from subject lines

Provide scores out of 10 for each section and specific, actionable recommendations.
Remember: the sender will copy-paste your suggestions directly into their ${params.detectedLanguage} campaign.`;

  // Build user prompt with email content
  const userPrompt = `Analyze this email marketing campaign:

Subject: ${params.subject}

Content:
${params.emailContent}

Provide detailed structured feedback following the email marketing analysis framework.`;

  // Create fine-tuning format
  const fineTuningData: FineTuningTrainingExample = {
    messages: [
      {
        role: 'system',
        content: systemPrompt,
      },
      {
        role: 'user',
        content: userPrompt,
      },
      {
        role: 'assistant',
        content: params.claudeAnalysisJson || params.claudeAnalysis,
      },
    ],
    metadata: {
      language: params.detectedLanguage,
      contentType: params.contentType,
      hasImages: params.imageCount > 0,
      hasPDFs: params.pdfCount > 0,
      imageCount: params.imageCount,
      pdfCount: params.pdfCount,
      tokensUsed: params.tokensUsed,
      processingTimeMs: params.processingTimeMs,
    },
  };

  return {
    emailId: params.emailId,
    timestamp: Date.now(),
    from: params.from,
    subject: params.subject,

    // Persona fields
    personaId: params.personaId,
    personaName: params.personaName,

    // Legacy fields for backward compatibility
    emailContent: params.emailContent,
    detectedLanguage: params.detectedLanguage,
    claudeAnalysis: params.claudeAnalysis,
    claudeAnalysisJson: params.claudeAnalysisJson,

    // Fine-tuning optimized format
    fineTuningData,

    // Metadata
    tokensUsed: params.tokensUsed,
    processingTimeMs: params.processingTimeMs,
    contentType: params.contentType,
    hasAttachments: params.imageCount > 0 || params.pdfCount > 0,
    attachmentCount: params.imageCount + params.pdfCount,
    imageCount: params.imageCount,
    pdfCount: params.pdfCount,
  };
}
