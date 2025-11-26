/**
 * Custom error types for content processing
 */

/**
 * Error codes for content processing failures
 */
export const ERROR_CODES = {
  NO_CONTENT: 'NO_CONTENT',
  DOWNLOAD_FAILED: 'DOWNLOAD_FAILED',
  INVALID_FORMAT: 'INVALID_FORMAT',
  SIZE_EXCEEDED: 'SIZE_EXCEEDED',
  NO_PERSONA_FOUND: 'NO_PERSONA_FOUND',
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

/**
 * Custom error class for content processing failures
 * Includes user-friendly messages and technical details for logging
 */
export class ContentProcessingError extends Error {
  public readonly name = 'ContentProcessingError';

  constructor(
    public readonly code: ErrorCode,
    public readonly userMessage: string,
    public readonly details: Record<string, unknown> = {}
  ) {
    super(userMessage);
    // Maintains proper stack trace for where error was thrown (V8 engines)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ContentProcessingError);
    }
  }
}

/**
 * Helper functions to create specific error types with predefined messages
 */

/**
 * Creates an error for when no content (text or images) is found
 */
export function createNoContentError(details: Record<string, unknown> = {}): ContentProcessingError {
  return new ContentProcessingError(
    ERROR_CODES.NO_CONTENT,
    'No content found to analyze. Please include email text or screenshot.',
    details
  );
}

/**
 * Creates an error for when all image downloads fail
 */
export function createDownloadFailedError(details: Record<string, unknown> = {}): ContentProcessingError {
  return new ContentProcessingError(
    ERROR_CODES.DOWNLOAD_FAILED,
    'Unable to download screenshots. Please check file sizes and try again.',
    details
  );
}

/**
 * Creates an error for when all images have unsupported formats
 */
export function createInvalidFormatError(details: Record<string, unknown> = {}): ContentProcessingError {
  return new ContentProcessingError(
    ERROR_CODES.INVALID_FORMAT,
    'Unsupported image formats detected. Please use PNG or JPEG screenshots.',
    details
  );
}

/**
 * Creates an error for when all images exceed size limit
 */
export function createSizeExceededError(details: Record<string, unknown> = {}): ContentProcessingError {
  return new ContentProcessingError(
    ERROR_CODES.SIZE_EXCEEDED,
    'Screenshots are too large (max 10MB). Please reduce file size and try again.',
    details
  );
}

/**
 * Error codes for LLM API failures
 */
export const LLM_ERROR_CODES = {
  LLM_TIMEOUT: 'LLM_TIMEOUT',
  LLM_NETWORK_ERROR: 'LLM_NETWORK_ERROR',
  LLM_HTTP_ERROR: 'LLM_HTTP_ERROR',
  LLM_INVALID_RESPONSE: 'LLM_INVALID_RESPONSE',
} as const;

export type LLMErrorCode = (typeof LLM_ERROR_CODES)[keyof typeof LLM_ERROR_CODES];

/**
 * Custom error class for LLM API failures
 * Includes user-friendly messages and technical details for logging
 */
export class LLMError extends Error {
  public readonly name = 'LLMError';

  constructor(
    public readonly code: LLMErrorCode,
    public readonly userMessage: string,
    public readonly details: Record<string, unknown> = {}
  ) {
    super(userMessage);
    // Maintains proper stack trace for where error was thrown (V8 engines)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, LLMError);
    }
  }
}

/**
 * Helper functions to create specific LLM error types with predefined messages
 */

/**
 * Creates an error for when LLM API call times out
 */
export function createLLMTimeoutError(details: Record<string, unknown> = {}): LLMError {
  return new LLMError(
    LLM_ERROR_CODES.LLM_TIMEOUT,
    'Analysis is taking longer than expected. Please try again in a moment.',
    details
  );
}

/**
 * Creates an error for network failures (DNS, connection refused, etc.)
 */
export function createLLMNetworkError(details: Record<string, unknown> = {}): LLMError {
  return new LLMError(
    LLM_ERROR_CODES.LLM_NETWORK_ERROR,
    'Unable to reach analysis service. Please try again shortly.',
    details
  );
}

/**
 * Creates an error for HTTP errors (4xx, 5xx status codes)
 */
export function createLLMHTTPError(details: Record<string, unknown> = {}): LLMError {
  return new LLMError(
    LLM_ERROR_CODES.LLM_HTTP_ERROR,
    'Analysis service returned an error. Please try again later.',
    details
  );
}

/**
 * Creates an error for invalid/unexpected response structure
 */
export function createLLMInvalidResponseError(details: Record<string, unknown> = {}): LLMError {
  return new LLMError(
    LLM_ERROR_CODES.LLM_INVALID_RESPONSE,
    'Received unexpected response from analysis service. Please try again.',
    details
  );
}
