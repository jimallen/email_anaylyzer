import type { WebhookPayload, Attachment } from '../lib/schemas';
import type { EncodedImage } from './image-processor';
import type { FastifyBaseLogger } from 'fastify';
import {
  createNoContentError,
  createDownloadFailedError,
  createInvalidFormatError,
  createSizeExceededError,
} from '../lib/errors';

/**
 * Email processing service
 * Handles content extraction and processing from webhook payloads
 */

/**
 * PDF document for LLM API
 */
export interface PDFDocument {
  filename: string;
  data: Buffer; // Raw PDF data
  base64: string; // Base64-encoded PDF
}

/**
 * Content package for LLM API
 * Represents processed email content ready for analysis
 */
export interface ContentPackage {
  contentType: 'text-only' | 'screenshot-only' | 'hybrid' | 'empty';
  text: string;
  images: EncodedImage[];
  pdfs: PDFDocument[];
}

/**
 * Processing context for error reporting
 * Tracks what was attempted during content processing
 */
export interface ProcessingContext {
  attachmentCount: number; // Total attachments detected
  downloadedCount: number; // Successfully downloaded images
  validatedCount: number; // Images that passed validation
  downloadFailures?: number; // Images that failed to download
  formatFailures?: number; // Images with unsupported formats
  sizeFailures?: number; // Images exceeding size limit
}

/**
 * Extracts plain text content from webhook payload
 * Priority: text field first, then HTML conversion, then empty string
 *
 * @param payload - Webhook payload from Resend
 * @returns Extracted plain text content
 */
export function extractTextContent(payload: WebhookPayload): string {
  // Priority 1: Use text field if available
  if (payload.text && payload.text.trim().length > 0) {
    return payload.text.trim();
  }

  // Priority 2: Convert HTML to plain text if available
  if (payload.html && payload.html.trim().length > 0) {
    return htmlToPlainText(payload.html);
  }

  // Priority 3: Return empty string if no content
  return '';
}

/**
 * Converts HTML to plain text by stripping tags
 * Simple implementation for MVP - uses regex to remove HTML tags
 *
 * Future enhancement: Use proper HTML parser library like 'html-to-text' if needed
 *
 * @param html - HTML content
 * @returns Plain text with HTML tags removed
 */
export function htmlToPlainText(html: string): string {
  // Remove HTML tags and replace with space to preserve word boundaries
  let text = html.replace(/<[^>]*>/g, ' ');

  // Decode common HTML entities
  text = text
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");

  // Normalize whitespace (multiple spaces, newlines, tabs to single space)
  text = text.replace(/\s+/g, ' ');

  // Trim leading/trailing whitespace
  return text.trim();
}

/**
 * Detects and extracts attachment metadata from webhook payload
 *
 * Extracts attachment information for download processing:
 * - url: Download URL from Resend
 * - filename: Original filename
 * - contentType: MIME type
 *
 * @param payload - Webhook payload from Resend
 * @returns Array of attachment metadata (empty array if no attachments)
 */
export function detectAttachments(payload: WebhookPayload): Attachment[] {
  // Handle missing attachments field
  if (!payload.attachments) {
    return [];
  }

  // Handle empty attachments array
  if (payload.attachments.length === 0) {
    return [];
  }

  // Return all attachments (already validated by zod schema)
  return payload.attachments;
}

/**
 * Categorizes email content based on text and images presence
 *
 * Determines the type of email content received and prepares a content
 * package for LLM API processing. Handles four scenarios:
 * - text-only: Has text but no images
 * - screenshot-only: Has images but no text
 * - hybrid: Has both text and images
 * - empty: Has neither (error case)
 *
 * @param text - Extracted plain text content
 * @param images - Array of encoded images
 * @returns Content package with categorization and prepared content
 */
export function categorizeContent(
  text: string,
  images: EncodedImage[],
  pdfs: PDFDocument[] = []
): ContentPackage {
  // Determine what content is available
  const hasText = text.trim().length > 0;
  const hasImages = images.length > 0;
  const hasPDFs = pdfs.length > 0;

  // Categorize based on content availability
  let contentType: ContentPackage['contentType'];

  if (!hasText && !hasImages && !hasPDFs) {
    contentType = 'empty';
  } else if (hasText && !hasImages && !hasPDFs) {
    contentType = 'text-only';
  } else if (!hasText && (hasImages || hasPDFs)) {
    contentType = 'screenshot-only';
  } else {
    contentType = 'hybrid';
  }

  // Return content package
  return {
    contentType,
    text,
    images,
    pdfs,
  };
}

/**
 * Validates content package and throws error if invalid
 *
 * Ensures that email has processable content (text or images).
 * Provides detailed error messages based on what was attempted and what failed.
 * Throws ContentProcessingError with user-friendly message if validation fails.
 *
 * @param contentPackage - Categorized content package
 * @param context - Processing context with attempt counts
 * @param logger - Optional Fastify logger for error logging
 * @throws {ContentProcessingError} When content validation fails
 */
export function validateContentPackage(
  contentPackage: ContentPackage,
  context: ProcessingContext,
  logger?: FastifyBaseLogger
): void {
  const hasText = contentPackage.text.trim().length > 0;
  const hasImages = contentPackage.images.length > 0;

  // If we have valid content, no error
  if (hasText || hasImages) {
    return;
  }

  // No text and no images - determine the specific error
  const errorDetails = {
    contentType: contentPackage.contentType,
    hasText,
    hasImages,
    ...context,
  };

  // Priority 1: All images failed to download (attachments existed but downloads failed)
  if (context.attachmentCount > 0 && context.downloadedCount === 0) {
    logger?.error(errorDetails, 'Content processing failed: All image downloads failed');
    throw createDownloadFailedError(errorDetails);
  }

  // Priority 2: All images failed format validation (downloaded but invalid formats)
  if (
    context.downloadedCount > 0 &&
    context.validatedCount === 0 &&
    (context.formatFailures ?? 0) > 0
  ) {
    logger?.error(errorDetails, 'Content processing failed: Invalid image formats');
    throw createInvalidFormatError(errorDetails);
  }

  // Priority 3: All images failed size validation (downloaded but too large)
  if (
    context.downloadedCount > 0 &&
    context.validatedCount === 0 &&
    (context.sizeFailures ?? 0) > 0
  ) {
    logger?.error(errorDetails, 'Content processing failed: Images too large');
    throw createSizeExceededError(errorDetails);
  }

  // Priority 4: No content at all (no text, no attachments)
  logger?.error(errorDetails, 'Content processing failed: No content found');
  throw createNoContentError(errorDetails);
}
