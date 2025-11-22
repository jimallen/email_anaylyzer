import type { FastifyBaseLogger } from 'fastify';
import type { Attachment } from '../lib/schemas';

/**
 * Image processing service
 * Handles downloading and processing of image attachments
 */

/**
 * Supported image MIME types for LLM analysis
 */
export const SUPPORTED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/jpg'] as const;

export interface DownloadedImage {
  filename: string;
  data: Buffer;
}

export interface EncodedImage {
  filename: string;
  contentType: string;
  dataUrl: string; // Full data URI with base64
}

/**
 * Downloads a single image from a URL with timeout support
 *
 * Uses AbortController for timeout enforcement and native fetch for HTTP requests.
 * Handles network errors, timeouts, and HTTP errors gracefully.
 *
 * @param url - URL to download image from
 * @param timeout - Timeout in milliseconds
 * @param logger - Optional logger for structured logging
 * @returns Buffer containing image data, or null on failure
 */
export async function downloadImage(
  url: string,
  timeout: number,
  logger?: FastifyBaseLogger
): Promise<Buffer | null> {
  const start = Date.now();

  try {
    // Set up AbortController for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      // Fetch image with timeout signal
      const response = await fetch(url, { signal: controller.signal });

      // Clear timeout on successful response
      clearTimeout(timeoutId);

      // Check HTTP status
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      // Read response as array buffer and convert to Buffer
      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      // Log successful download
      const duration = Date.now() - start;
      if (logger) {
        logger.info(
          {
            size: buffer.length,
            duration,
          },
          'Image downloaded'
        );
      }

      return buffer;
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  } catch (error) {
    // Handle different error types
    let errorMessage = 'Unknown error';

    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        errorMessage = `timeout after ${timeout}ms`;
      } else {
        errorMessage = error.message;
      }
    }

    // Log download failure
    if (logger) {
      logger.warn(
        {
          error: errorMessage,
          duration: Date.now() - start,
        },
        'Image download failed'
      );
    }

    return null;
  }
}

/**
 * Downloads multiple images concurrently from attachments
 *
 * Uses Promise.allSettled to download all images in parallel without
 * failing the entire operation if one image fails. Failed downloads
 * are filtered out from the results.
 *
 * @param attachments - Array of attachment metadata
 * @param timeout - Timeout in milliseconds for each download
 * @param logger - Optional logger for structured logging
 * @returns Array of successfully downloaded images (excluding failures)
 */
export async function downloadImages(
  attachments: Attachment[],
  timeout: number,
  logger?: FastifyBaseLogger
): Promise<DownloadedImage[]> {
  // Download all images concurrently
  const downloadPromises = attachments.map(async (attachment) => {
    if (logger) {
      logger.info({ filename: attachment.filename }, 'Downloading image');
    }

    const buffer = await downloadImage(attachment.url, timeout, logger);

    if (buffer === null) {
      return null;
    }

    return {
      filename: attachment.filename,
      data: buffer,
    };
  });

  // Wait for all downloads to complete (or fail)
  const results = await Promise.allSettled(downloadPromises);

  // Extract successful downloads, filter out failures
  const successfulDownloads: DownloadedImage[] = [];

  for (const result of results) {
    if (result.status === 'fulfilled' && result.value !== null) {
      successfulDownloads.push(result.value);
    }
  }

  return successfulDownloads;
}

/**
 * Validates an image attachment against format and size constraints
 *
 * Checks that the image has a supported MIME type (PNG, JPEG, JPG) and
 * does not exceed the configured maximum size limit. Invalid images are
 * logged but do not cause errors, allowing processing to continue with
 * valid images.
 *
 * @param attachment - Attachment metadata containing filename and contentType
 * @param data - Image data buffer to validate
 * @param maxSizeBytes - Maximum allowed image size in bytes
 * @param logger - Optional logger for structured logging
 * @returns true if image is valid (supported format AND within size limit), false otherwise
 */
export function validateImage(
  attachment: Attachment,
  data: Buffer,
  maxSizeBytes: number,
  logger?: FastifyBaseLogger
): boolean {
  // Check if MIME type is supported
  if (!SUPPORTED_IMAGE_TYPES.includes(attachment.contentType as any)) {
    if (logger) {
      logger.warn(
        {
          filename: attachment.filename,
          contentType: attachment.contentType,
        },
        'Unsupported image format'
      );
    }
    return false;
  }

  // Check if image size exceeds limit
  if (data.byteLength > maxSizeBytes) {
    if (logger) {
      logger.warn(
        {
          filename: attachment.filename,
          size: data.byteLength,
          limit: maxSizeBytes,
        },
        'Image exceeds size limit'
      );
    }
    return false;
  }

  // Image is valid
  return true;
}

/**
 * Encodes an image buffer to base64 with data URI prefix
 *
 * Converts image buffer to base64 string and prepends the appropriate
 * data URI scheme (data:image/png;base64,... or data:image/jpeg;base64,...).
 * This format is required for embedding images in LLM API requests.
 *
 * @param buffer - Image data buffer to encode
 * @param contentType - MIME type of the image (image/png, image/jpeg, image/jpg)
 * @returns Complete data URI string with base64-encoded image
 */
export function encodeImage(buffer: Buffer, contentType: string): string {
  // Convert buffer to base64
  const base64String = buffer.toString('base64');

  // Normalize contentType (image/jpg -> image/jpeg)
  const normalizedType = contentType === 'image/jpg' ? 'image/jpeg' : contentType;

  // Create data URI
  return `data:${normalizedType};base64,${base64String}`;
}

/**
 * Encodes multiple validated images to base64 data URIs
 *
 * Processes an array of downloaded images, encoding each to base64 with
 * appropriate data URI prefixes. Logs the encoding operation with metadata
 * but excludes the actual base64 strings for security/performance.
 *
 * @param images - Array of validated downloaded images with metadata
 * @param logger - Optional logger for structured logging
 * @returns Array of encoded images with data URIs ready for LLM API
 */
export function encodeImages(
  images: Array<{ filename: string; contentType: string; data: Buffer }>,
  logger?: FastifyBaseLogger
): EncodedImage[] {
  // Calculate total size before encoding
  const totalSize = images.reduce((sum, img) => sum + img.data.byteLength, 0);

  // Encode all images
  const encodedImages = images.map((image) => ({
    filename: image.filename,
    contentType: image.contentType,
    dataUrl: encodeImage(image.data, image.contentType),
  }));

  // Log encoding completion (without base64 data)
  if (logger) {
    logger.info(
      {
        imageCount: encodedImages.length,
        totalSize,
      },
      'Images encoded for LLM'
    );
  }

  return encodedImages;
}
