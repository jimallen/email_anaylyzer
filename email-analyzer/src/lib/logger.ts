import type { FastifyBaseLogger } from 'fastify';

/**
 * Logging utilities for structured, secure logging
 * Ensures sensitive data is never logged
 */

/**
 * Sensitive field patterns that should be redacted
 */
const SENSITIVE_PATTERNS = [
  /api[_-]?key/i,
  /secret/i,
  /password/i,
  /token/i,
  /auth/i,
  /bearer/i,
];

/**
 * Email metadata for safe logging
 * Excludes full email content and images
 */
export interface EmailMetadata {
  sender: string;
  hasText: boolean;
  hasImage: boolean;
  textLength?: number;
  imageCount?: number;
  subject?: string;
}

/**
 * Redacts sensitive fields from an object
 * Used to sanitize data before logging
 */
export function redactSensitiveData(data: Record<string, unknown>): Record<string, unknown> {
  const redacted: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(data)) {
    const isSensitive = SENSITIVE_PATTERNS.some((pattern) => pattern.test(key));

    if (isSensitive) {
      redacted[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      redacted[key] = redactSensitiveData(value as Record<string, unknown>);
    } else {
      redacted[key] = value;
    }
  }

  return redacted;
}

/**
 * Extracts safe metadata from email for logging
 * Never logs full email content or images
 */
export function extractEmailMetadata(email: {
  from?: string;
  text?: string;
  html?: string;
  attachments?: unknown[];
  subject?: string;
}): EmailMetadata {
  return {
    sender: email.from || 'unknown',
    hasText: Boolean(email.text || email.html),
    hasImage: Boolean(email.attachments && Array.isArray(email.attachments) && email.attachments.length > 0),
    textLength: email.text ? email.text.length : email.html ? email.html.length : 0,
    imageCount: email.attachments && Array.isArray(email.attachments) ? email.attachments.length : 0,
    subject: email.subject,
  };
}

/**
 * Logs email processing event with safe metadata
 */
export function logEmailReceived(logger: FastifyBaseLogger, metadata: EmailMetadata): void {
  logger.info(
    {
      sender: metadata.sender,
      hasText: metadata.hasText,
      hasImage: metadata.hasImage,
      textLength: metadata.textLength,
      imageCount: metadata.imageCount,
      subject: metadata.subject,
    },
    'Email received'
  );
}

/**
 * Logs error with sanitized context
 */
export function logError(
  logger: FastifyBaseLogger,
  error: Error,
  context: Record<string, unknown>
): void {
  const sanitizedContext = redactSensitiveData(context);

  logger.error(
    {
      err: {
        message: error.message,
        stack: error.stack,
        name: error.name,
      },
      ...sanitizedContext,
    },
    'Error occurred'
  );
}

/**
 * Logs warning with sanitized context
 */
export function logWarning(
  logger: FastifyBaseLogger,
  message: string,
  context?: Record<string, unknown>
): void {
  if (context) {
    const sanitizedContext = redactSensitiveData(context);
    logger.warn(sanitizedContext, message);
  } else {
    logger.warn(message);
  }
}
