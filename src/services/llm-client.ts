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
 * Email context for personalized analysis
 */
export interface EmailContext {
  senderName: string;
  senderEmail: string;
  subject: string;
}

/**
 * Simple LLM request for name parsing (text-only, no images)
 */
interface NameParsingRequest {
  model: string;
  messages: Array<{
    role: 'system' | 'user';
    content: string;
  }>;
  max_tokens: number;
  temperature: number;
}

/**
 * Parse sender's name using LLM API
 *
 * Makes a quick LLM API call to intelligently extract a person's name
 * from an email address. Falls back to simple parsing on error.
 *
 * @param email - Email address to parse
 * @param apiUrl - LLM API endpoint URL
 * @param model - LLM model name
 * @param logger - Optional Fastify logger
 * @returns Parsed name in proper case
 */
export async function parseSenderNameWithLLM(
  email: string,
  apiUrl: string,
  model: string,
  logger?: FastifyBaseLogger
): Promise<string> {
  try {
    const request: NameParsingRequest = {
      model,
      messages: [
        {
          role: 'system',
          content: 'You are a name parsing assistant. Extract and format a person\'s name from an email address. Return ONLY the first and last name separated by a space, in proper title case (e.g., "John Smith", "Jim Allen"). IMPORTANT: Always include a space between first and last name. If you cannot determine a reasonable name, return "User".'
        },
        {
          role: 'user',
          content: `Extract the person's name from this email address: ${email}\n\nReturn format: FirstName LastName (with space)`
        }
      ],
      max_tokens: 20,
      temperature: 0.3
    };

    logger?.info({ email, apiUrl }, 'Parsing sender name with LLM');

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
      signal: AbortSignal.timeout(5000), // 5 second timeout
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = (await response.json()) as LLMResponse;
    const parsedName = data.choices[0]?.message?.content?.trim() || 'User';

    logger?.info({ email, parsedName }, 'LLM parsed sender name');

    return parsedName;
  } catch (error) {
    // Fallback to simple parsing on any error
    logger?.warn(
      {
        email,
        error: error instanceof Error ? error.message : String(error)
      },
      'LLM name parsing failed, using fallback'
    );
    return parseSenderName(email);
  }
}

/**
 * Parse sender's name from email address
 * Extracts the local part before @ and converts to Title Case
 * Splits camelCase names intelligently
 *
 * Examples:
 * - john.doe@example.com → John Doe
 * - jim_allen@gmail.com → Jim Allen
 * - jimallen@gmail.com → Jim Allen
 * - support@company.com → Support
 *
 * @param email - Email address
 * @returns Parsed name in Title Case
 */
export function parseSenderName(email: string): string {
  // Extract local part (before @)
  let localPart = email.split('@')[0] || 'User';

  // Split by common separators (., _, -, +) first
  let parts = localPart.split(/[._\-+]/);

  // If only one part, try to split camelCase (e.g., jimAllen → jim allen)
  if (parts.length === 1 && parts[0]!.length > 3) {
    const original = parts[0]!;

    // Insert space before capitals (but not at the start)
    const withSpaces = original.replace(/([a-z])([A-Z])/g, '$1 $2');

    // If we found camelCase patterns, use those
    if (withSpaces.includes(' ')) {
      parts = withSpaces.split(' ');
    } else if (withSpaces.length > 6) {
      // No camelCase found, but string is long enough to likely be two names
      // Try to find a vowel-consonant boundary for a more natural split
      // Common patterns: jimallen → jim allen, johnsmith → john smith

      // Look for good split points (after common name endings)
      const splitPatterns = [
        /^(jim|john|jack|jake|joe|josh|jason|james|jeff)/i,
        /^(tom|tim|ted|tony|tyler)/i,
        /^(sam|sean|seth|steve|scott)/i,
        /^(dan|dave|david|doug|dean)/i,
        /^(bob|bill|brad|brian|blake)/i,
        /^(mike|mark|matt|max|martin)/i,
        /^(paul|pete|peter|patrick)/i,
        /^(ryan|rick|rob|roger|ron)/i,
        /^(chris|carl|craig|connor)/i,
        /^(nick|neil|nathan)/i,
        /^(alex|adam|andy|aaron|austin)/i,
        /^(ben|brad|brandon)/i,
      ];

      let matched = false;
      for (const pattern of splitPatterns) {
        const match = withSpaces.match(pattern);
        if (match) {
          const firstName = match[0];
          const lastName = withSpaces.slice(firstName.length);
          if (lastName.length > 0) {
            parts = [firstName, lastName];
            matched = true;
            break;
          }
        }
      }

      // Fallback: if no pattern matched, just use the whole string as one name
      if (!matched) {
        parts = [withSpaces];
      }
    } else {
      parts = [withSpaces];
    }
  }

  // Convert to Title Case
  const titleCase = parts
    .map(part => {
      if (part.length === 0) return '';
      return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
    })
    .filter(part => part.length > 0)
    .join(' ');

  return titleCase || 'User';
}

/**
 * Builds personalized system prompt for email analysis
 * @param context - Email context with sender name, email, and subject
 * @returns Personalized system prompt
 */
function buildSystemPrompt(context: EmailContext): string {
  return `You are an expert email marketing analyst specializing in retail e-commerce campaigns.

You are analyzing an email submitted by ${context.senderName} (${context.senderEmail}).
Subject: "${context.subject}"

=== CRITICAL RULES - FOLLOW EXACTLY ===

RULE 1: CHARACTER FORMATTING
- NEVER use Unicode symbols: ✓ ✗ † → ∗ ™ © ® ° • ◦ ▪ ▫ ■ □ ● ○ ◆ ◇ ★ ☆
- ONLY use basic ASCII: [x] [+] [-] * -> <- 1. 2. 3.
- Use standard numbers: 1. 2. 3. (NOT １ ２ ３)

RULE 2: LANGUAGE FOR SUGGESTIONS
The original email language determines suggestion language:
- German email → German suggestions ("Jetzt kaufen", "Hier klicken", "Angebot ansehen")
- English email → English suggestions ("Shop now", "Click here", "View offer")
- French email → French suggestions
- Spanish email → Spanish suggestions

EXAMPLES:
Subject: "Ihr Kalender 2026" (German)
✗ WRONG: "Try: Your Exclusive 2026 Calendar"
[x] CORRECT: "Try: Ihr exklusiver Kalender 2026 - Jetzt sichern!"

CTA in German email:
✗ WRONG: Suggest "Shop Now"
[x] CORRECT: Suggest "Jetzt kaufen"

Body copy in German email:
✗ WRONG: "Replace with: Save 20% today"
[x] CORRECT: "Replace with: Sparen Sie heute 20%"

RULE 3: WHAT TO WRITE IN ENGLISH
- Section headers: LIFECYCLE CONTEXT, SUBJECT LINE, etc.
- Your analysis and explanations
- Recommendations and reasoning

RULE 4: WHAT TO WRITE IN ORIGINAL EMAIL LANGUAGE
- Alternative subject lines
- CTA button text
- Email body copy examples
- Any text the user would actually write

=== RESPONSE FORMAT ===

**Hi ${context.senderName},**

**LIFECYCLE CONTEXT:**
Identify the campaign stage (Welcome, Abandoned Cart, Re-engagement, Post-Purchase, etc.) and explain how this email fits into the customer journey. Reference relevant industry benchmarks.

**SUBJECT LINE (X/10):**
Score and analyze "${context.subject}". Discuss effectiveness for open rates, personalization, urgency, and mobile preview.

Alternative subject lines to test (in original email language):
1. [first alternative in same language as original email]
2. [second alternative in same language as original email]
3. [third alternative in same language as original email]

**BODY CONTENT (X/10):**
Score and analyze the email body's messaging, tone, structure, and visual hierarchy. Comment on alignment with subject line promise.

When suggesting body copy changes, write examples in the original email's language.

**CALL-TO-ACTION (X/10):**
Score the CTA placement, design, copy, and clarity. Analyze urgency and guidance toward desired action.

Suggested CTA text (in original email language):
- [suggestion 1 in same language]
- [suggestion 2 in same language]

**TECHNICAL/GDPR (X/10):**
Evaluate technical implementation (mobile responsiveness, image optimization, load time), accessibility, and GDPR compliance (unsubscribe link, privacy policy, data handling).

**CONVERSION IMPACT:**
Provide data-driven estimates of potential conversion rate improvements. Use specific percentages and explain reasoning.

**RECOMMENDED ACTIONS:**
Provide 3-5 numbered, prioritized recommendations:

1. [Action description in English] -> Example: "[example text in original email language]"
2. [Action description in English] -> Example: "[example text in original email language]"
3. [Action description in English] -> Example: "[example text in original email language]"

**TRANSFERABLE LESSONS:**
Extract 2-3 behavioral psychology principles that ${context.senderName} can apply across other campaigns.

Remember: Analysis in English, suggestions/examples in original email language, ASCII characters only.`;
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
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

/**
 * Formats content package into OpenAI-compatible LLM API request
 *
 * Builds request body with:
 * - Model name from config
 * - Personalized system prompt with email context
 * - User message with content array (text first, then images)
 * - Max tokens from config
 *
 * Content array format:
 * - Text-only: [{ type: 'text', text: '...' }]
 * - Screenshot-only: [{ type: 'image_url', image_url: { url: '...' } }, ...]
 * - Hybrid: [{ type: 'text', text: '...' }, { type: 'image_url', ... }, ...]
 *
 * @param contentPackage - Categorized content from email processing
 * @param emailContext - Email context for personalization (sender, subject)
 * @param config - LLM configuration (model name, max tokens)
 * @param logger - Optional Fastify logger for request metadata
 * @returns Formatted LLM API request ready to send
 */
export function formatLLMRequest(
  contentPackage: ContentPackage,
  emailContext: EmailContext,
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

  // Build personalized system prompt
  const systemPrompt = buildSystemPrompt(emailContext);

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
      systemPromptLength: systemPrompt.length,
      userPromptLength: userPrompt.length,
      senderName: emailContext.senderName,
      subject: emailContext.subject,
      contentBreakdown: content.map(c => ({
        type: c.type,
        hasData: c.type === 'image_url' ? 'yes' : 'yes'
      }))
    },
    'LLM request formatted'
  );

  // Return formatted request with personalized system prompt
  return {
    model: config.model,
    messages: [
      {
        role: 'system',
        content: systemPrompt,
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
 * LLM analysis result with feedback and metadata
 */
export interface LLMAnalysisResult {
  feedback: string;
  tokensUsed?: number;
  processingTimeMs?: number;
}

/**
 * Parses and validates LLM API response
 *
 * Validates response structure using Zod schema and extracts feedback content.
 * Handles edge cases like empty choices array, empty content, and long content.
 *
 * @param response - Raw response from LLM API (unknown type)
 * @param processingTimeMs - Time taken for LLM processing
 * @param logger - Optional Fastify logger
 * @returns LLM analysis result with feedback and metadata
 * @throws {Error} If response structure is invalid or content is missing
 */
export function parseLLMResponse(
  response: unknown,
  processingTimeMs: number,
  logger?: FastifyBaseLogger
): LLMAnalysisResult {
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

  // Extract token usage if available (safely cast to LLMResponse)
  const llmResponse = response as LLMResponse;
  const tokensUsed = llmResponse.usage?.total_tokens;

  // Log metadata (not actual content)
  logger?.info(
    {
      feedbackLength: feedback.length,
      choicesCount: validatedResponse.choices.length,
      finishReason: validatedResponse.choices[0]!.finish_reason,
      tokensUsed,
      processingTimeMs,
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

  return {
    feedback,
    tokensUsed,
    processingTimeMs,
  };
}
