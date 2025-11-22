import type { FastifyInstance } from 'fastify';
import { WebhookPayloadSchema, type WebhookPayload } from '../lib/schemas';
import {
  extractTextContent,
  detectAttachments,
  categorizeContent,
  validateContentPackage,
  type ProcessingContext,
} from '../services/email-processor';
import {
  downloadImages,
  validateImage,
  encodeImages,
} from '../services/image-processor';
import {
  formatLLMRequest,
  callLLMAPI,
  parseLLMResponse,
} from '../services/llm-client';
import {
  formatSuccessEmail,
  formatErrorEmail,
} from '../services/email-formatter';
import {
  sendEmailWithRetry,
} from '../services/resend-client';
import { isWhitelisted } from '../services/whitelist';
import { ContentProcessingError, LLMError } from '../lib/errors';
import { config } from '../services/config';

/**
 * Webhook endpoint for receiving inbound emails from Resend
 * Orchestrates end-to-end email analysis workflow
 */
export default async function webhookRoute(fastify: FastifyInstance): Promise<void> {
  fastify.post('/webhook/inbound-email', {
    // Whitelist authentication preHandler - runs BEFORE route handler
    preHandler: async (request, reply) => {
      try {
        // Validate payload first to ensure 'from' field exists
        const payload: WebhookPayload = WebhookPayloadSchema.parse(request.body);

        // Check if sender is whitelisted
        if (!isWhitelisted(payload.from)) {
          request.log.warn({ from: payload.from }, 'Blocked non-whitelisted sender');
          return reply.code(403).send({
            success: false,
            error: 'Unauthorized sender'
          });
        }
      } catch (error) {
        // Validation error - let main handler deal with it
        // Don't block here, as we want consistent error handling
      }
    }
  }, async (request, reply) => {
    const startTime = Date.now();

    try {
      // Validate webhook payload using zod schema
      const payload: WebhookPayload = WebhookPayloadSchema.parse(request.body);

      // Log webhook receipt
      request.log.info(
        {
          from: payload.from,
          to: payload.to,
          subject: payload.subject,
          hasText: Boolean(payload.text || payload.html),
          hasAttachments: payload.attachments?.length || 0,
        },
        'Webhook received'
      );

      // ===== Epic 3: Content Extraction & Processing =====

      // Step 1: Extract text content
      const textContent = extractTextContent(payload);

      // Step 2: Detect attachments
      const attachments = detectAttachments(payload);

      // Step 3: Download images
      const downloadedImages = await downloadImages(
        attachments,
        config.imageDownloadTimeoutMs,
        request.log
      );

      // Step 4: Validate and filter images
      const validatedImages: Array<{ filename: string; contentType: string; data: Buffer }> = [];
      let formatFailures = 0;
      let sizeFailures = 0;

      for (const image of downloadedImages) {
        // Find attachment metadata for this image
        const attachment = attachments.find(att => att.filename === image.filename);
        if (!attachment) continue;

        if (validateImage(attachment, image.data, config.maxImageSizeBytes, request.log)) {
          validatedImages.push({
            filename: image.filename,
            contentType: attachment.contentType,
            data: image.data,
          });
        } else {
          // Track failure reason
          if (!['image/png', 'image/jpeg', 'image/jpg'].includes(attachment.contentType)) {
            formatFailures++;
          } else {
            sizeFailures++;
          }
        }
      }

      // Step 5: Encode images to base64
      const encodedImages = encodeImages(validatedImages, request.log);

      // Step 6: Categorize content
      const contentPackage = categorizeContent(textContent, encodedImages);

      // Step 7: Validate content package (throws ContentProcessingError if invalid)
      const processingContext: ProcessingContext = {
        attachmentCount: attachments.length,
        downloadedCount: downloadedImages.length,
        validatedCount: validatedImages.length,
        downloadFailures: attachments.length - downloadedImages.length,
        formatFailures,
        sizeFailures,
      };

      validateContentPackage(contentPackage, processingContext, request.log);

      request.log.info(
        {
          contentType: contentPackage.contentType,
          hasText: contentPackage.text.length > 0,
          imageCount: contentPackage.images.length,
        },
        'Content extracted and validated'
      );

      // ===== Epic 4: LLM Analysis =====

      // Step 1: Configure LLM
      const llmConfig = {
        apiUrl: config.sparkyLlmUrl,
        model: config.llmModel,
        maxTokens: config.maxTokens,
        timeoutMs: config.llmTimeoutMs,
      };

      // Step 2: Format LLM request
      const llmRequest = formatLLMRequest(
        contentPackage,
        llmConfig,
        request.log
      );

      // Step 3: Call LLM API
      const llmResponse = await callLLMAPI(llmRequest, config.sparkyLlmUrl, config.llmTimeoutMs, request.log);

      // Step 4: Parse LLM response
      const feedback = parseLLMResponse(llmResponse, request.log);

      request.log.info(
        {
          feedbackLength: feedback.length,
        },
        'LLM analysis completed'
      );

      // ===== Epic 5: Response Delivery =====

      // Step 1: Format success email
      const emailContent = formatSuccessEmail(
        payload.from,
        payload.subject,
        feedback,
        request.log
      );

      // Step 2: Send email with retry
      const emailConfig = {
        apiKey: config.resendApiKey,
        timeoutMs: config.resendTimeoutMs,
      };

      const emailResult = await sendEmailWithRetry(
        emailContent.to,
        emailContent.subject,
        emailContent.body,
        emailConfig,
        request.log
      );

      if (!emailResult.success) {
        request.log.error(
          {
            error: emailResult.error,
          },
          'Failed to send success email after retry'
        );
      }

      // Calculate total duration
      const totalDuration = Date.now() - startTime;

      // Warn if exceeding 30-second target
      if (totalDuration > 30000) {
        request.log.warn(
          {
            totalDuration,
            target: 30000,
          },
          'Request processing exceeded 30-second target'
        );
      }

      // Log completion
      request.log.info(
        {
          reqId: request.id,
          from: payload.from,
          totalDuration,
          success: true,
          emailSent: emailResult.success,
        },
        'Request processing completed'
      );

      // Return success
      return reply.code(200).send({ success: true });

    } catch (error) {
      const totalDuration = Date.now() - startTime;

      // Handle known errors (ContentProcessingError or LLMError)
      if (error instanceof ContentProcessingError || error instanceof LLMError) {
        request.log.warn(
          {
            errorType: error.name,
            errorCode: error.code,
            totalDuration,
          },
          'Request failed with known error'
        );

        // Try to get payload (might fail if payload validation failed)
        let fromAddress: string;
        try {
          const payload: WebhookPayload = WebhookPayloadSchema.parse(request.body);
          fromAddress = payload.from;
        } catch {
          // Can't parse payload - can't send error email
          request.log.error(
            {
              err: error,
              totalDuration,
            },
            'Failed to parse payload for error email'
          );
          return reply.code(500).send({ success: false, error: 'Invalid payload' });
        }

        // Format and send error email
        const errorEmail = formatErrorEmail(fromAddress, error, request.log);

        const emailConfig = {
          apiKey: config.resendApiKey,
          timeoutMs: config.resendTimeoutMs,
        };

        const emailResult = await sendEmailWithRetry(
          errorEmail.to,
          errorEmail.subject,
          errorEmail.body,
          emailConfig,
          request.log
        );

        if (!emailResult.success) {
          request.log.error(
            {
              error: emailResult.error,
            },
            'Failed to send error email after retry'
          );
        }

        // Log completion with error
        request.log.info(
          {
            reqId: request.id,
            from: fromAddress,
            totalDuration,
            success: false,
            errorCode: error.code,
            emailSent: emailResult.success,
          },
          'Request processing completed with error'
        );

        // Return 200 - we processed the request even though analysis failed
        return reply.code(200).send({ success: true, message: 'Error email sent' });
      }

      // Handle unexpected errors
      request.log.error(
        {
          err: error,
          body: request.body,
          totalDuration,
        },
        'Unexpected error during request processing'
      );

      // Return 500 for unexpected errors
      return reply.code(500).send({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });
}
