import type { ContentPackage } from './email-processor';
import type { FastifyBaseLogger } from 'fastify';
import { z } from 'zod';
import {
  createLLMTimeoutError,
  createLLMNetworkError,
  createLLMHTTPError,
  createLLMInvalidResponseError,
} from '../lib/errors';

/**
 * LLM API client service
 * Handles formatting and sending requests to OpenAI-compatible LLM API
 */

/**
 * Text content item for LLM request
 */
export interface TextContent {
  type: 'text';
  text: string;
}

/**
 * Image content item for LLM request
 */
export interface ImageContent {
  type: 'image_url';
  image_url: {
    url: string; // data URI with base64
  };
}

/**
 * Content item (text or image)
 */
export type ContentItem = TextContent | ImageContent;

/**
 * LLM API request message
 */
export interface LLMMessage {
  role: 'user';
  content: ContentItem[];
}

/**
 * LLM API request body
 */
export interface LLMRequest {
  model: string;
  messages: LLMMessage[];
  max_tokens: number;
}

/**
 * LLM configuration subset
 */
export interface LLMConfig {
  model: string;
  maxTokens: number;
}

/**
 * LLM API response choice
 */
export interface LLMChoice {
  index: number;
  message: {
    role: 'assistant';
    content: string;
  };
  finish_reason: string;
}

/**
 * LLM API response (OpenAI-compatible)
 */
export interface LLMResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: LLMChoice[];
}

/**
 * Formats content package into OpenAI-compatible LLM API request
 *
 * Builds request body with:
 * - Model name from config
 * - User message with content array (text first, then images)
 * - Max tokens from config
 *
 * Content array format:
 * - Text-only: [{ type: 'text', text: '...' }]
 * - Screenshot-only: [{ type: 'image_url', image_url: { url: '...' } }, ...]
 * - Hybrid: [{ type: 'text', text: '...' }, { type: 'image_url', ... }, ...]
 *
 * @param contentPackage - Categorized content from email processing
 * @param config - LLM configuration (model name, max tokens)
 * @param logger - Optional Fastify logger for request metadata
 * @returns Formatted LLM API request ready to send
 */
export function formatLLMRequest(
  contentPackage: ContentPackage,
  config: LLMConfig,
  logger?: FastifyBaseLogger
): LLMRequest {
  // Build content array: text first (if exists), then all images
  const content: ContentItem[] = [];

  // Add text content if present
  if (contentPackage.text && contentPackage.text.trim().length > 0) {
    content.push({
      type: 'text',
      text: contentPackage.text,
    });
  }

  // Add all image content
  for (const image of contentPackage.images) {
    content.push({
      type: 'image_url',
      image_url: {
        url: image.dataUrl, // Full data URI with base64
      },
    });
  }

  // Log request metadata (without actual content/base64)
  logger?.info(
    {
      model: config.model,
      contentItems: content.length,
      hasText: contentPackage.text.trim().length > 0,
      imageCount: contentPackage.images.length,
    },
    'LLM request formatted'
  );

  // Return formatted request
  return {
    model: config.model,
    messages: [
      {
        role: 'user',
        content,
      },
    ],
    max_tokens: config.maxTokens,
  };
}

/**
 * Calls LLM API with timeout handling
 *
 * Makes HTTP POST request to LLM API endpoint with AbortController-based timeout.
 * Tracks request timing and handles errors appropriately.
 *
 * Error handling:
 * - Timeout (>25s): Logs warning and throws error
 * - HTTP non-200: Logs error details and throws
 * - Network errors: Logs and re-throws
 *
 * @param request - Formatted LLM API request
 * @param apiUrl - API endpoint URL
 * @param timeoutMs - Timeout in milliseconds
 * @param logger - Optional Fastify logger
 * @returns LLM API response
 * @throws {Error} On timeout, HTTP error, or network failure
 */
export async function callLLMAPI(
  request: LLMRequest,
  apiUrl: string,
  timeoutMs: number,
  logger?: FastifyBaseLogger
): Promise<LLMResponse> {
  // Track timing
  const startTime = Date.now();

  // Create AbortController for timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    // Make fetch request with timeout signal
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
      signal: controller.signal,
    });

    // Clear timeout on successful response
    clearTimeout(timeoutId);

    // Calculate duration
    const duration = Date.now() - startTime;

    // Check HTTP status
    if (!response.ok) {
      // Non-200 status
      const errorBody = await response.text();
      const errorDetails = {
        statusCode: response.status,
        duration,
        url: apiUrl,
        errorBody,
      };

      logger?.error(errorDetails, 'LLM API returned non-200 status');
      throw createLLMHTTPError(errorDetails);
    }

    // Parse JSON response
    const data = (await response.json()) as LLMResponse;

    // Log successful completion with response metadata
    logger?.info(
      {
        duration,
        statusCode: response.status,
        responseId: data.id,
        model: data.model,
        timestamp: data.created,
        choicesCount: data.choices.length,
      },
      'LLM API call completed'
    );

    return data;
  } catch (error) {
    // Clear timeout in error cases
    clearTimeout(timeoutId);

    const duration = Date.now() - startTime;

    // Handle abort (timeout)
    if (error instanceof Error && error.name === 'AbortError') {
      const timeoutDetails = {
        duration,
        url: apiUrl,
        timeoutMs,
      };

      logger?.warn(timeoutDetails, 'LLM API timeout');
      throw createLLMTimeoutError(timeoutDetails);
    }

    // Handle other errors (network, etc.)
    const networkDetails = {
      duration,
      url: apiUrl,
      error: error instanceof Error ? error.message : String(error),
    };

    logger?.error(networkDetails, 'LLM API call failed');
    throw createLLMNetworkError(networkDetails);
  }
}

/**
 * Zod schema for LLM API response validation
 */
const LLMResponseSchema = z.object({
  choices: z.array(
    z.object({
      message: z.object({
        content: z.string(),
      }),
      finish_reason: z.string().optional(),
    })
  ),
});

/**
 * Parses and validates LLM API response
 *
 * Validates response structure using Zod schema and extracts feedback content.
 * Handles edge cases like empty choices array, empty content, and long content.
 *
 * @param response - Raw response from LLM API (unknown type)
 * @param logger - Optional Fastify logger
 * @returns Extracted feedback content string
 * @throws {Error} If response structure is invalid or content is missing
 */
export function parseLLMResponse(
  response: unknown,
  logger?: FastifyBaseLogger
): string {
  // Validate response structure with Zod
  const parseResult = LLMResponseSchema.safeParse(response);

  if (!parseResult.success) {
    const errorDetails = {
      error: parseResult.error.message,
      issues: parseResult.error.issues,
    };

    logger?.error(errorDetails, 'LLM response validation failed');
    throw createLLMInvalidResponseError(errorDetails);
  }

  const validatedResponse = parseResult.data;

  // Check for empty choices array
  if (validatedResponse.choices.length === 0) {
    const errorDetails = { choicesLength: 0 };
    logger?.error(errorDetails, 'LLM response has empty choices array');
    throw createLLMInvalidResponseError(errorDetails);
  }

  // Extract content from first choice (safe after length check)
  const feedback = validatedResponse.choices[0]!.message.content;

  // Check for empty content
  if (feedback.trim().length === 0) {
    const errorDetails = { feedbackLength: 0 };
    logger?.error(errorDetails, 'LLM response has empty content string');
    throw createLLMInvalidResponseError(errorDetails);
  }

  // Log metadata (not actual content)
  logger?.info(
    {
      feedbackLength: feedback.length,
      choicesCount: validatedResponse.choices.length,
      finishReason: validatedResponse.choices[0]!.finish_reason,
    },
    'LLM response parsed successfully'
  );

  // Warn if content is unusually long
  if (feedback.length > 5000) {
    logger?.warn(
      { feedbackLength: feedback.length },
      'LLM response content is unusually long'
    );
  }

  return feedback;
}
