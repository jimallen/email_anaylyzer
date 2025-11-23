import type { ContentPackage } from './email-processor';
import type { FastifyBaseLogger } from 'fastify';
import { z } from 'zod';
import { ChatAnthropic } from '@langchain/anthropic';
import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
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
 * System message for LLM request (OpenAI format)
 */
export interface LLMSystemMessage {
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
export type LLMMessage = LLMSystemMessage | UserMessage;

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
 * Parse sender's name using LLM via Langchain
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
    logger?.info({ email, apiUrl, model }, 'Parsing sender name with LLM via Langchain');

    // Initialize ChatOpenAI with qwen endpoint
    const llm = new ChatOpenAI({
      modelName: model,
      temperature: 0.3,
      maxTokens: 20,
      timeout: 5000,
      configuration: {
        baseURL: apiUrl.replace('/v1/chat/completions', '/v1'),
      },
    });

    const systemMessage = new SystemMessage(
      'You are a name parsing assistant. Extract and format a person\'s name from an email address. Return ONLY the first and last name separated by a space, in proper title case (e.g., "John Smith", "Jim Allen"). IMPORTANT: Always include a space between first and last name. If you cannot determine a reasonable name, return "User".'
    );

    const userMessage = new HumanMessage(
      `Extract the person's name from this email address: ${email}\n\nReturn format: FirstName LastName (with space)`
    );

    const response = await llm.invoke([systemMessage, userMessage]);
    const parsedName = response.content.toString().trim() || 'User';

    logger?.info({ email, parsedName }, 'LLM parsed sender name via Langchain');

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
 * @param detectedLanguage - Language detected by LLM (German, French, or English)
 * @returns Personalized system prompt
 */
function buildSystemPrompt(context: EmailContext, detectedLanguage: string): string {
  return `role: email marketing analyst (retail e-commerce)

=================================================================
CRITICAL LANGUAGE REQUIREMENT - READ THIS FIRST
=================================================================

EMAIL LANGUAGE: ${detectedLanguage}
OUTPUT LANGUAGE FOR SUGGESTIONS: ${detectedLanguage}

YOU MUST WRITE ALL SUGGESTIONS IN ${detectedLanguage.toUpperCase()}:
* Subject line alternatives -> ${detectedLanguage}
* CTA button text -> ${detectedLanguage}
* Body copy examples -> ${detectedLanguage}
* Any text the sender would copy -> ${detectedLanguage}

KEEP IN ENGLISH:
* Section headers (e.g., "SUBJECT LINE", "CTA")
* Your analysis and explanations
* Metrics and percentages

WRONG vs RIGHT examples for ${detectedLanguage}:
${detectedLanguage === 'French' ? `
[x] WRONG (English): "Shop now", "Follow us", "Get 20% off"
[*] CORRECT (French): "Acheter maintenant", "Nous suivre", "Obtenez 20% de reduction"
` : detectedLanguage === 'German' ? `
[x] WRONG (English): "Shop now", "Follow us", "Get 20% off"
[*] CORRECT (German): "Jetzt kaufen", "Folgen Sie uns", "Erhalten Sie 20% Rabatt"
` : `
[*] CORRECT (English): "Shop now", "Follow us", "Get 20% off"
`}
=================================================================

context:
  sender: ${context.senderName} (${context.senderEmail})
  subject: "${context.subject}"
  detected_language: ${detectedLanguage}

formatting_rules:
  forbidden: [Unicode symbols like checkmarks, arrows]
  use_ascii: ["[x]", "*", "->", "1."]

output_format: |
  **Hi ${context.senderName},**

  **DETECTED EMAIL LANGUAGE:** ${detectedLanguage}
  **ALL SUGGESTIONS BELOW ARE IN:** ${detectedLanguage}

  **LIFECYCLE CONTEXT:**
  Identify stage (Welcome/Abandoned Cart/Re-engagement/Post-Purchase), journey fit, benchmarks.

  **SUBJECT LINE (X/10):**
  Score the actual subject content (IGNORE email client prefixes like "Fwd:", "Re:", "Fw:" - these are technical and should NOT be mentioned in analysis or recommendations).

  Analyze: open rates, personalization, urgency, mobile preview.

  Alternative Subject Lines (MUST BE IN ${detectedLanguage}):
  1. [${detectedLanguage} text here - NOT English]
  2. [${detectedLanguage} text here - NOT English]
  3. [${detectedLanguage} text here - NOT English]

  **BODY CONTENT (X/10):**
  Score messaging, tone, structure, hierarchy, subject alignment.

  Body Copy Examples (MUST BE IN ${detectedLanguage}):
  - "[example in ${detectedLanguage}]" -> +X% engagement
  - "[example in ${detectedLanguage}]" -> reasoning

  **CALL-TO-ACTION (X/10):**
  Score placement, design, copy, clarity, urgency.

  CTA Button Text (MUST BE IN ${detectedLanguage}):
  - [CTA in ${detectedLanguage}]
  - [CTA in ${detectedLanguage}]
  - [CTA in ${detectedLanguage}]

  **TECHNICAL/GDPR (X/10):**
  Evaluate: mobile, images, load time, accessibility, GDPR compliance.

  **CONVERSION IMPACT:**
  Data-driven estimates with percentages and reasoning.

  **RECOMMENDED ACTIONS:**
  1. [action description in English] -> Example: "[${detectedLanguage} copy here]"
  2. [action description in English] -> Example: "[${detectedLanguage} copy here]"
  3. [action description in English] -> Example: "[${detectedLanguage} copy here]"
  4-5. [more actions with ${detectedLanguage} examples]

  **TRANSFERABLE LESSONS:**
  2-3 psychology principles for other campaigns (explanation in English).

FINAL VERIFICATION CHECKLIST (check before submitting):
- All subject line alternatives are in ${detectedLanguage}
- All CTA button text is in ${detectedLanguage}
- All body copy examples are in ${detectedLanguage}
- All sender-facing text is in ${detectedLanguage}
- Section headers and analysis remain in English
- No English suggestions if email is ${detectedLanguage}

Remember: The sender will copy-paste your suggestions directly into their ${detectedLanguage} email campaign!`;
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
  detectedLanguage: string,
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

  // Add ultra-clear language requirement at the very start of user prompt
  const languageInstruction = `
=================================================================
CRITICAL: EMAIL LANGUAGE IS ${detectedLanguage.toUpperCase()}
=================================================================

YOU MUST FOLLOW THIS RULE WITHOUT EXCEPTION:

Email Language Detected: ${detectedLanguage}
Your Suggestions Must Be In: ${detectedLanguage}

WHAT TO WRITE IN ${detectedLanguage}:
-> All alternative subject lines
-> All CTA button text suggestions
-> All body copy examples
-> Any text the sender would copy into their campaign

WHAT TO KEEP IN ENGLISH:
-> Section headers ("SUBJECT LINE", "CTA", etc.)
-> Your analysis and explanations
-> Performance metrics

${detectedLanguage !== 'English' ? `
WARNING: Do NOT write suggestions in English!
The email is in ${detectedLanguage}, so suggestions must be ${detectedLanguage}.

Example of WRONG output (DO NOT DO THIS):
Subject alternatives:
1. "Shop our new collection" <- [x] This is English, NOT ${detectedLanguage}!

Example of CORRECT output:
Subject alternatives:
${detectedLanguage === 'French' ? `1. "Decouvrez notre nouvelle collection" <- [*] This is French!` :
  detectedLanguage === 'German' ? `1. "Entdecken Sie unsere neue Kollektion" <- [*] This is German!` :
  `1. "Check language-appropriate translation" <- [*] Correct language!`}
` : ''}

The sender will copy-paste your suggestions directly. They MUST be in ${detectedLanguage}!

=================================================================

`;

  if (contentPackage.images.length > 0) {
    // Has images - ask to analyze the screenshot
    userPrompt = languageInstruction + 'Analyze this email marketing campaign screenshot and provide detailed feedback following the structure specified in the system prompt.';

    // If there's also text content, append it as context
    if (contentPackage.text && contentPackage.text.trim().length > 0) {
      userPrompt += `\n\nEmail text content:\n${contentPackage.text}`;
    }
  } else {
    // Text-only - analyze the text
    userPrompt = languageInstruction + `Analyze this email marketing campaign text and provide detailed feedback following the structure specified in the system prompt.\n\nEmail content:\n${contentPackage.text}`;
  }

  // Add text prompt
  content.push({
    type: 'text',
    text: userPrompt,
  });

  // Build personalized system prompt with detected language
  const systemPrompt = buildSystemPrompt(emailContext, detectedLanguage);

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
 * Calls Claude via Langchain for email analysis with vision support
 *
 * @param contentPackage - Email content (text + images)
 * @param emailContext - Email context for personalization
 * @param detectedLanguage - Detected language of email
 * @param maxTokens - Maximum tokens for response
 * @param logger - Optional Fastify logger
 * @returns LLM analysis result
 */
export async function callClaudeForAnalysis(
  contentPackage: ContentPackage,
  emailContext: EmailContext,
  detectedLanguage: string,
  maxTokens: number,
  logger?: FastifyBaseLogger
): Promise<LLMAnalysisResult> {
  const startTime = Date.now();

  try {
    logger?.info({
      model: 'claude-sonnet-4-20250514',
      imageCount: contentPackage.images.length,
      hasText: contentPackage.text.length > 0,
      detectedLanguage
    }, 'Starting Claude analysis via Langchain');

    // Initialize Claude with Langchain
    const model = new ChatAnthropic({
      model: 'claude-sonnet-4-20250514',
      temperature: 0.7,
      maxTokens,
    });

    // Build system prompt
    const systemPrompt = buildSystemPrompt(emailContext, detectedLanguage);

    // Build user message content with language instruction
    const languageInstruction = `
=================================================================
CRITICAL: EMAIL LANGUAGE IS ${detectedLanguage.toUpperCase()}
=================================================================

YOU MUST FOLLOW THIS RULE WITHOUT EXCEPTION:

Email Language Detected: ${detectedLanguage}
Your Suggestions Must Be In: ${detectedLanguage}

WHAT TO WRITE IN ${detectedLanguage}:
-> All alternative subject lines
-> All CTA button text suggestions
-> All body copy examples
-> Any text the sender would copy into their campaign

WHAT TO KEEP IN ENGLISH:
-> Section headers ("SUBJECT LINE", "CTA", etc.)
-> Your analysis and explanations
-> Performance metrics

${detectedLanguage !== 'English' ? `
WARNING: Do NOT write suggestions in English!
The email is in ${detectedLanguage}, so suggestions must be ${detectedLanguage}.

Example of WRONG output (DO NOT DO THIS):
Subject alternatives:
1. "Shop our new collection" <- [x] This is English, NOT ${detectedLanguage}!

Example of CORRECT output:
Subject alternatives:
${detectedLanguage === 'French' ? `1. "Decouvrez notre nouvelle collection" <- [*] This is French!` :
  detectedLanguage === 'German' ? `1. "Entdecken Sie unsere neue Kollektion" <- [*] This is German!` :
  `1. "Check language-appropriate translation" <- [*] Correct language!`}
` : ''}

The sender will copy-paste your suggestions directly. They MUST be in ${detectedLanguage}!

IMPORTANT: DO NOT recommend removing email client prefixes (Fwd:, Re:, Fw:, etc.) from subject lines. These are technical forwarding/reply indicators and not part of the actual marketing content.

=================================================================

`;

    let userPrompt: string;
    if (contentPackage.images.length > 0) {
      userPrompt = languageInstruction + 'Analyze this email marketing campaign screenshot and provide detailed feedback following the structure specified in the system prompt.';
      if (contentPackage.text && contentPackage.text.trim().length > 0) {
        userPrompt += `\n\nEmail text content:\n${contentPackage.text}`;
      }
    } else {
      userPrompt = languageInstruction + `Analyze this email marketing campaign text and provide detailed feedback following the structure specified in the system prompt.\n\nEmail content:\n${contentPackage.text}`;
    }

    // Build message content for langchain (text + images)
    const messageContent: any[] = [];

    // Add text first
    messageContent.push({
      type: 'text',
      text: userPrompt
    });

    // Add images
    for (const image of contentPackage.images) {
      messageContent.push({
        type: 'image_url',
        image_url: {
          url: image.dataUrl
        }
      });
    }

    // Invoke Claude with system prompt and multimodal content
    const response = await model.invoke([
      new SystemMessage(systemPrompt),
      new HumanMessage({
        content: messageContent
      })
    ]);

    const duration = Date.now() - startTime;

    const feedback = response.content.toString().trim();

    logger?.info({
      feedbackLength: feedback.length,
      duration,
      model: 'claude-sonnet-4-20250514'
    }, 'Claude analysis completed via Langchain');

    return {
      feedback,
      processingTimeMs: duration
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    logger?.error({
      error: error instanceof Error ? error.message : String(error),
      duration
    }, 'Claude analysis failed');
    throw error;
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

  // Log actual feedback content for evaluation
  logger?.info(
    {
      feedback: feedback,
      feedbackLength: feedback.length,
    },
    'LLM feedback content'
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

/**
 * Detects the language of an email using Claude via Langchain
 * @param subject - Email subject line
 * @param textContent - Email body text (optional, not used since emails are forwarded)
 * @param llmUrl - LLM API URL (not used, kept for compatibility)
 * @param config - LLM configuration (not used, kept for compatibility)
 * @param timeoutMs - Request timeout in milliseconds
 * @param logger - Optional Fastify logger
 * @returns Detected language (German, French, or English)
 */
export async function detectLanguageWithLLM(
  subject: string,
  textContent: string,
  llmUrl: string,
  config: LLMConfig,
  timeoutMs: number,
  logger?: FastifyBaseLogger
): Promise<string> {
  // Strip common email prefixes before detection
  const cleanSubject = subject
    .replace(/^(Fwd?:|Re:|FW:|RE:)\s*/i, '')
    .trim();

  try {
    const startTime = Date.now();

    logger?.info(
      {
        subject: cleanSubject,
        originalSubject: subject,
      },
      'Detecting language with Claude'
    );

    // Initialize Claude with Langchain
    const model = new ChatAnthropic({
      model: 'claude-sonnet-4-20250514',
      temperature: 0,
      maxTokens: 10,
    });

    // Create language detection prompt
    const prompt = `Detect the language of this email subject line. Return ONLY one word: German, French, or English. Default to German if unclear.

Subject: "${cleanSubject}"

Language:`;

    const response = await model.invoke(prompt);
    const duration = Date.now() - startTime;

    const detectedLanguage = response.content.toString().trim();

    logger?.info(
      {
        detectedLanguage,
        duration,
        cleanSubject,
      },
      'Language detected with Claude'
    );

    // Validate and normalize
    if (detectedLanguage.toLowerCase().includes('french')) {
      return 'French';
    } else if (detectedLanguage.toLowerCase().includes('english')) {
      return 'English';
    } else {
      return 'German'; // Default
    }
  } catch (error) {
    logger?.warn({ error, subject: cleanSubject }, 'Language detection failed, defaulting to German');
    return 'German';
  }
}

/**
 * Translates suggestions in the feedback to the detected language
 * @param feedback - Original feedback with English suggestions
 * @param detectedLanguage - Target language (French, German, Spanish, etc.)
 * @param llmUrl - LLM API URL
 * @param config - LLM configuration
 * @param logger - Optional Fastify logger
 * @returns Translated feedback
 */
export async function translateSuggestions(
  feedback: string,
  detectedLanguage: string,
  llmUrl: string,
  config: LLMConfig,
  timeoutMs: number,
  logger?: FastifyBaseLogger
): Promise<string> {
  // Skip translation if language is English
  if (detectedLanguage === 'English') {
    return feedback;
  }

  logger?.info({ detectedLanguage }, 'Starting suggestion translation');

  const translationPrompt = `role: professional translator

task: translate marketing suggestions to ${detectedLanguage}

rules:
  translate_only:
    - subject line alternatives (in quotes)
    - CTA button text (in quotes)
    - body copy examples (in quotes)
    - sender-copyable text

  keep_english:
    - section headers (LIFECYCLE CONTEXT, SUBJECT LINE, CTA, etc.)
    - analysis/explanations
    - metrics/percentages/benchmarks
    - citations

  preserve: exact format and structure

input:
${feedback}

output: complete feedback with suggestions in ${detectedLanguage}`;

  const translationRequest = {
    model: config.model,
    messages: [
      {
        role: 'user' as const,
        content: translationPrompt,
      },
    ],
    max_tokens: config.maxTokens * 2, // Allow more tokens for translation
    temperature: 0.3, // Lower temperature for more accurate translation
  };

  try {
    const startTime = Date.now();

    logger?.info(
      {
        url: llmUrl,
        targetLanguage: detectedLanguage,
      },
      'Sending translation request to LLM'
    );

    // Create AbortController for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    const response = await fetch(llmUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(translationRequest),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    const duration = Date.now() - startTime;

    logger?.info(
      {
        statusCode: response.status,
        statusText: response.statusText,
        duration,
      },
      'Received translation response from LLM'
    );

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    const parsedResponse = parseLLMResponse(data, duration, logger);

    logger?.info({ translatedLength: parsedResponse.feedback.length }, 'Translation completed');

    return parsedResponse.feedback;
  } catch (error) {
    logger?.error(
      {
        error: error instanceof Error ? error.message : 'Unknown error',
        detectedLanguage,
      },
      'Translation failed, returning original feedback'
    );
    // If translation fails, return original feedback
    return feedback;
  }
}
