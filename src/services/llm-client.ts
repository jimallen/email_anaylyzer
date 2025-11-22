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
 * System message for LLM request
 */
export interface SystemMessage {
  role: 'system';
  content: string;
}

/**
 * User message for LLM request
 */
export interface UserMessage {
  role: 'user';
  content: ContentItem[];
}

/**
 * LLM API request message (system or user)
 */
export type LLMMessage = SystemMessage | UserMessage;

/**
 * LLM API request body
 */
export interface LLMRequest {
  model: string;
  messages: LLMMessage[];
  max_tokens: number;
  temperature?: number;
}

/**
 * LLM configuration subset
 */
export interface LLMConfig {
  model: string;
  maxTokens: number;
}

/**
 * System prompt for email analysis
 * Defines the structure and format for LLM feedback
 */
const SYSTEM_PROMPT = `You are an expert email marketing analyst specializing in retail e-commerce campaigns.
Analyze the email screenshot provided and give detailed, actionable feedback following this structure:

**LIFECYCLE CONTEXT:** Identify the campaign stage (Welcome, Abandoned Cart, Re-engagement, etc.) and relevant industry benchmarks.
**SUBJECT (X/10):** Score and analyze the subject line effectiveness.
**BODY (X/10):** Score and analyze the email body content and messaging.
**CTA (X/10):** Score and analyze the call-to-action placement and effectiveness.
**TECHNICAL/GDPR (X/10):** Score technical implementation and compliance.
**CONVERSION IMPACT:** Estimate conversion rate improvements with specific metrics.
**ACTIONS:** Provide numbered, specific recommendations with quantified impact.
**TRANSFERABLE LESSONS:** Extract behavioral psychology principles that apply across campaigns.

Base your analysis on visual elements, design choices, and overall email effectiveness.`;

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
  // Build content array: images first, then text prompt
  const content: ContentItem[] = [];

  // Add all image content first (if any)
  for (const image of contentPackage.images) {
    content.push({
      type: 'image_url',
      image_url: {
        url: image.dataUrl, // Full data URI with base64
      },
    });
  }

  // Build user prompt based on content type
  let userPrompt: string;

  if (contentPackage.images.length > 0) {
    // Has images - ask to analyze the screenshot
    userPrompt = 'Analyze this email marketing campaign screenshot and provide detailed feedback following the structure specified in the system prompt.';

    // If there's also text content, append it as context
    if (contentPackage.text && contentPackage.text.trim().length > 0) {
      userPrompt += `\n\nEmail text content:\n${contentPackage.text}`;
    }
  } else {
    // Text-only - analyze the text
    userPrompt = `Analyze this email marketing campaign text and provide detailed feedback following the structure specified in the system prompt.\n\nEmail content:\n${contentPackage.text}`;
  }

  // Add text prompt
  content.push({
    type: 'text',
    text: userPrompt,
  });

  // Log request metadata (without actual content/base64)
  logger?.info(
    {
      model: config.model,
      contentItems: content.length,
      hasText: contentPackage.text.trim().length > 0,
      imageCount: contentPackage.images.length,
      maxTokens: config.maxTokens,
      temperature: 0.7,
      messageCount: 2, // system + user
      systemPromptLength: SYSTEM_PROMPT.length,
      userPromptLength: userPrompt.length,
      contentBreakdown: content.map(c => ({
        type: c.type,
        hasData: c.type === 'image_url' ? 'yes' : 'yes'
      }))
    },
    'LLM request formatted'
  );

  // Return formatted request with system prompt
  return {
    model: config.model,
    messages: [
      {
        role: 'system',
        content: SYSTEM_PROMPT,
      },
      {
        role: 'user',
        content,
      },
    ],
    max_tokens: config.maxTokens,
    temperature: 0.7,
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

  logger?.info({
    url: apiUrl,
    model: request.model,
    maxTokens: request.max_tokens,
    timeoutMs,
    messageCount: request.messages.length
  }, 'Starting LLM API call');

  // Create AbortController for timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    logger?.info({
      url: apiUrl,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, 'Sending HTTP request to LLM');

    // Make fetch request with timeout signal
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
      signal: controller.signal,
    });

    logger?.info({
      statusCode: response.status,
      statusText: response.statusText,
      duration: Date.now() - startTime
    }, 'Received HTTP response from LLM');

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
