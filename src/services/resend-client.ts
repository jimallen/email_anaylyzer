import type { FastifyBaseLogger } from 'fastify';
import { marked } from 'marked';

/**
 * Resend Email Sending Client
 * Handles sending email responses via Resend API
 */

/**
 * Result of email send operation
 */
export interface EmailResult {
  success: boolean;
  emailId?: string;
  error?: string;
}

/**
 * Configuration for email sending
 */
export interface EmailConfig {
  apiKey: string;
  timeoutMs: number;
  fromAddress?: string;
}

/**
 * Email attachment for Resend API
 */
interface ResendAttachment {
  filename: string;
  content: string; // base64 encoded
}

/**
 * Resend API request body
 */
interface ResendEmailRequest {
  from: string;
  to: string;
  subject: string;
  text: string;
  html?: string;
  attachments?: ResendAttachment[];
}

/**
 * Resend API success response
 */
interface ResendSuccessResponse {
  id: string;
}

/**
 * Send email via Resend API
 *
 * Makes HTTP POST request to Resend's /emails endpoint with timeout handling.
 * Tracks timing and logs metadata (not email body content).
 *
 * @param to - Recipient email address
 * @param subject - Email subject line
 * @param body - Email body text content
 * @param config - Email configuration (API key, timeout, from address)
 * @param attachments - Optional email attachments (base64 encoded)
 * @param logger - Optional Fastify logger for tracking
 * @returns Promise resolving to EmailResult with success status and email ID or error
 */
/**
 * Determine if an error is retryable (temporary failure)
 *
 * Retryable: timeouts, 5xx server errors, network errors
 * Non-retryable: 4xx client errors (bad request, auth, etc.)
 *
 * @param result - EmailResult from failed send attempt
 * @returns true if error should be retried
 */
function isRetryableError(result: EmailResult): boolean {
  if (result.success || !result.error) {
    return false;
  }

  const error = result.error;

  // Timeout errors are retryable
  if (error.includes('timeout')) {
    return true;
  }

  // 5xx server errors are retryable
  if (error.includes('Resend API returned 5')) {
    return true;
  }

  // 4xx client errors are NOT retryable
  if (error.includes('Resend API returned 4')) {
    return false;
  }

  // Other network errors are retryable
  return true;
}

/**
 * Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function sendEmail(
  to: string,
  subject: string,
  body: string,
  config: EmailConfig,
  attachments?: ResendAttachment[],
  logger?: FastifyBaseLogger
): Promise<EmailResult> {
  // Track timing
  const startTime = Date.now();

  // Default from address if not provided
  const fromAddress = config.fromAddress || 'Email Analyzer <noreply@yourdomain.com>';

  // Convert markdown to HTML
  const htmlBody = await marked(body);

  // Build request body with both text and HTML versions
  const requestBody: ResendEmailRequest = {
    from: fromAddress,
    to,
    subject,
    text: body, // Plain text version (fallback)
    html: htmlBody, // HTML version (preferred)
  };

  // Add attachments if provided
  if (attachments && attachments.length > 0) {
    requestBody.attachments = attachments;
  }

  // Create AbortController for timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), config.timeoutMs);

  try {
    // Make fetch request to Resend API
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    });

    // Clear timeout on response
    clearTimeout(timeoutId);

    // Calculate duration
    const duration = Date.now() - startTime;

    // Check HTTP status
    if (!response.ok) {
      // Non-2xx status - email send failed
      const errorBody = await response.text();
      const errorMessage = `Resend API returned ${response.status}: ${errorBody}`;

      logger?.error(
        {
          to,
          subject,
          statusCode: response.status,
          errorBody,
          duration,
        },
        'Email send failed'
      );

      return {
        success: false,
        error: errorMessage,
      };
    }

    // Parse success response
    const data = (await response.json()) as ResendSuccessResponse;

    // Log success metadata (no body content)
    logger?.info(
      {
        to,
        subject,
        emailId: data.id,
        duration,
      },
      'Email sent via Resend'
    );

    return {
      success: true,
      emailId: data.id,
    };
  } catch (error) {
    // Clear timeout in error cases
    clearTimeout(timeoutId);

    const duration = Date.now() - startTime;

    // Handle abort (timeout)
    if (error instanceof Error && error.name === 'AbortError') {
      const errorMessage = `Email send timeout after ${config.timeoutMs}ms`;

      logger?.warn(
        {
          to,
          subject,
          duration,
          timeoutMs: config.timeoutMs,
        },
        errorMessage
      );

      return {
        success: false,
        error: errorMessage,
      };
    }

    // Handle other errors (network, etc.)
    const errorMessage = error instanceof Error ? error.message : String(error);

    logger?.error(
      {
        to,
        subject,
        duration,
        error: errorMessage,
      },
      'Email send failed'
    );

    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * Send email with automatic retry on transient failures
 *
 * Attempts to send email, retrying once after 1 second if initial attempt
 * fails with a retryable error (timeout, 5xx, network). Non-retryable errors
 * (4xx client errors) return immediately without retry.
 *
 * @param to - Recipient email address
 * @param subject - Email subject line
 * @param body - Email body text content
 * @param config - Email configuration (API key, timeout, from address)
 * @param attachments - Optional email attachments (base64 encoded)
 * @param logger - Optional Fastify logger for tracking
 * @returns Promise resolving to EmailResult with success status
 */
export async function sendEmailWithRetry(
  to: string,
  subject: string,
  body: string,
  config: EmailConfig,
  attachments?: ResendAttachment[],
  logger?: FastifyBaseLogger
): Promise<EmailResult> {
  const overallStartTime = Date.now();

  // Attempt 1: Initial send
  const firstResult = await sendEmail(to, subject, body, config, attachments, logger);

  if (firstResult.success) {
    return firstResult;
  }

  // Check if error is retryable
  if (!isRetryableError(firstResult)) {
    // Non-retryable error - return immediately
    return firstResult;
  }

  // Retryable error - log and retry
  logger?.warn(
    {
      to,
      attempt: 1,
      error: firstResult.error,
    },
    'Email send failed, retrying'
  );

  // Wait 1 second before retry
  await sleep(1000);

  // Attempt 2: Retry
  const retryResult = await sendEmail(to, subject, body, config, attachments, logger);

  if (retryResult.success) {
    // Retry succeeded
    const totalDuration = Date.now() - overallStartTime;
    logger?.info(
      {
        to,
        attempt: 2,
        totalDuration,
      },
      'Email sent on retry'
    );
    return retryResult;
  }

  // Both attempts failed - log permanent failure
  const totalDuration = Date.now() - overallStartTime;
  logger?.error(
    {
      to,
      attempts: 2,
      lastError: retryResult.error,
      totalDuration,
    },
    'Email send permanently failed'
  );

  return retryResult;
}
