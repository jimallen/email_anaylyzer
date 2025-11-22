import type { FastifyBaseLogger } from 'fastify';
import type { Attachment } from '../lib/schemas';
import { writeFileSync, unlinkSync, readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { randomBytes } from 'crypto';
import { execSync } from 'child_process';

/**
 * Image processing service
 * Handles downloading and processing of image and PDF attachments
 */

/**
 * Supported image MIME types for LLM analysis
 * Includes JPEG for PDF conversions and direct image attachments
 */
export const SUPPORTED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/jpg'] as const;

/**
 * Supported PDF MIME type
 */
export const PDF_MIME_TYPE = 'application/pdf';

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
 * Handles both HTTP URLs and data URLs (base64 encoded).
 * For data URLs, decodes the base64 content directly.
 * For HTTP URLs, uses AbortController for timeout enforcement.
 *
 * @param url - URL to download image from (HTTP or data URL)
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
    // Check if it's a data URL (base64 encoded)
    if (url.startsWith('data:')) {
      logger?.info('Decoding base64 data URL');

      // Extract base64 content from data URL
      // Format: data:image/png;base64,iVBORw0KGgoAAAANS...
      const base64Match = url.match(/^data:[^;]+;base64,(.+)$/);

      if (!base64Match || !base64Match[1]) {
        throw new Error('Invalid data URL format');
      }

      const base64Content = base64Match[1];
      const buffer = Buffer.from(base64Content, 'base64');

      const duration = Date.now() - start;
      logger?.info({
        size: buffer.length,
        duration
      }, 'Decoded base64 data URL');

      return buffer;
    }

    // HTTP URL - fetch from network
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
          'Image downloaded from HTTP'
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
          urlType: url.startsWith('data:') ? 'data URL' : 'HTTP URL'
        },
        'Image download/decode failed'
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
 * Converts a PDF buffer to PNG images (one per page)
 *
 * Uses pdftoppm command-line tool to convert each PDF page to a PNG image.
 * Creates temporary files for conversion and cleans them up afterward.
 *
 * @param pdfBuffer - PDF file data as Buffer
 * @param filename - Original PDF filename
 * @param logger - Optional logger for structured logging
 * @returns Array of images (one per page) with filenames like "file-1.png", "file-2.png"
 */
async function convertPdfToImages(
  pdfBuffer: Buffer,
  filename: string,
  logger?: FastifyBaseLogger
): Promise<DownloadedImage[]> {
  const tempDir = tmpdir();
  const uniqueId = randomBytes(8).toString('hex');
  const pdfPath = join(tempDir, `${uniqueId}.pdf`);

  try {
    // Write PDF to temp file
    writeFileSync(pdfPath, pdfBuffer);
    logger?.info({
      filename,
      pdfSize: pdfBuffer.length,
      tempPath: pdfPath,
      uniqueId
    }, 'PDF written to temp file');

    logger?.info({ filename, pdfSize: pdfBuffer.length }, 'Converting PDF to images');

    // Convert PDF to JPEG images using pdftoppm command
    // Use JPEG for better compression, 96 DPI for smaller files, scale to max 1024px
    // Output format: uniqueId-1.jpg, uniqueId-2.jpg, etc.
    const outputPath = join(tempDir, uniqueId);
    const command = `pdftoppm -jpeg -r 96 -scale-to 1024 "${pdfPath}" "${outputPath}"`;

    logger?.info({ command, outputPath }, 'Executing pdftoppm command');

    try {
      const output = execSync(command, { stdio: 'pipe' });
      logger?.info({
        filename,
        commandOutput: output.toString()
      }, 'pdftoppm command completed');
    } catch (error) {
      logger?.error({
        filename,
        command,
        error: error instanceof Error ? error.message : String(error),
        stderr: error instanceof Error && 'stderr' in error ? String(error.stderr) : undefined
      }, 'pdftoppm command failed');
      throw new Error(
        `pdftoppm failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }

    // Read generated JPEG files
    const allFiles = readdirSync(tempDir);
    logger?.info({
      filename,
      uniqueId,
      allFilesInTemp: allFiles.length,
      matchingPattern: `${uniqueId}*.jpg`
    }, 'Searching for generated JPEG files');

    const files = allFiles.filter(
      (f) => f.startsWith(uniqueId) && f.endsWith('.jpg')
    );

    logger?.info({
      filename,
      foundFiles: files,
      fileCount: files.length
    }, 'Found generated JPEG files');

    const images: DownloadedImage[] = files.map((file, index) => {
      const imagePath = join(tempDir, file);
      const imageData = readFileSync(imagePath);

      logger?.info({
        filename,
        generatedFile: file,
        pageNumber: index + 1,
        imageSize: imageData.length
      }, 'Read JPEG file for page');

      // Clean up generated JPEG
      unlinkSync(imagePath);

      return {
        filename: `${filename.replace('.pdf', '')}-page-${index + 1}.jpg`,
        data: imageData,
      };
    });

    logger?.info({
      filename,
      pageCount: images.length,
      totalSize: images.reduce((sum, img) => sum + img.data.length, 0)
    }, 'PDF converted successfully');

    return images;
  } catch (error) {
    logger?.error(
      {
        filename,
        error: error instanceof Error ? error.message : String(error),
      },
      'PDF conversion failed'
    );
    return [];
  } finally {
    // Clean up temp PDF file
    try {
      unlinkSync(pdfPath);
    } catch {
      // Ignore cleanup errors
    }
  }
}

/**
 * Processes downloaded attachments, converting PDFs to images
 *
 * Detects PDF attachments and converts them to images before validation.
 * Regular images pass through unchanged.
 *
 * @param downloads - Array of downloaded attachments
 * @param attachments - Original attachment metadata for type checking
 * @param logger - Optional logger
 * @returns Array of images ready for validation
 */
export async function processAttachments(
  downloads: DownloadedImage[],
  attachments: Attachment[],
  logger?: FastifyBaseLogger
): Promise<DownloadedImage[]> {
  logger?.info({
    downloadCount: downloads.length,
    attachmentCount: attachments.length
  }, 'Starting attachment processing');

  const processed: DownloadedImage[] = [];
  let pdfCount = 0;
  let imageCount = 0;

  for (const download of downloads) {
    // Find corresponding attachment metadata
    const attachment = attachments.find((a) => a.filename === download.filename);

    if (!attachment) {
      logger?.warn({
        filename: download.filename,
        downloadSize: download.data.length
      }, 'Downloaded file has no matching attachment metadata - skipping');
      continue;
    }

    logger?.info({
      filename: download.filename,
      contentType: attachment.contentType,
      size: download.data.length
    }, 'Processing attachment');

    // Check if it's a PDF
    if (attachment.contentType === PDF_MIME_TYPE) {
      pdfCount++;
      logger?.info({
        filename: download.filename,
        size: download.data.length
      }, 'Processing PDF attachment');

      // Convert PDF to images
      const pdfImages = await convertPdfToImages(
        download.data,
        download.filename,
        logger
      );

      logger?.info({
        filename: download.filename,
        pagesConverted: pdfImages.length
      }, 'PDF conversion complete');

      processed.push(...pdfImages);
    } else {
      imageCount++;
      logger?.info({
        filename: download.filename,
        contentType: attachment.contentType
      }, 'Processing regular image attachment');

      // Regular image - pass through
      processed.push(download);
    }
  }

  logger?.info({
    totalProcessed: processed.length,
    pdfCount,
    imageCount,
    inputFiles: downloads.length,
    outputFiles: processed.length
  }, 'Attachment processing complete');

  return processed;
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
