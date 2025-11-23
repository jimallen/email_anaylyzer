import type { FastifyInstance } from 'fastify';
import { WebhookPayloadSchema, type WebhookPayload, type ResendWebhook, type Attachment } from '../lib/schemas';
import {
  extractTextContent,
  detectAttachments,
  categorizeContent,
  validateContentPackage,
  type ProcessingContext,
} from '../services/email-processor';
import {
  downloadImages,
  processAttachments,
  validateImage,
  encodeImages,
} from '../services/image-processor';
import {
  parseSenderNameWithLLM,
  detectLanguageWithLLM,
  callClaudeForAnalysis,
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
 * Fetch all attachments for an inbound email from Resend API
 * Uses the /emails/receiving/{email_id}/attachments endpoint
 * Returns array of attachments with download URLs
 */
async function fetchAttachmentsFromResend(
  emailId: string,
  apiKey: string,
  logger?: any
): Promise<Attachment[]> {
  try {
    const url = `https://api.resend.com/emails/receiving/${emailId}/attachments`;

    logger?.info({ emailId, url }, 'Fetching attachments from Resend API (inbound emails)');

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger?.error({
        statusCode: response.status,
        error: errorText,
        emailId,
        url
      }, 'Resend API error fetching attachments');
      return [];
    }

    const result = await response.json() as { object: string; data: any[] };

    if (!result.data || !Array.isArray(result.data)) {
      logger?.error({
        emailId,
        resultType: typeof result,
        hasData: Boolean(result.data),
        isArray: Array.isArray(result.data)
      }, 'Unexpected response format from Resend');
      return [];
    }

    logger?.info({
      emailId,
      attachmentCount: result.data.length,
      attachments: result.data.map(a => ({
        filename: a.filename,
        contentType: a.content_type,
        size: a.size,
        hasDownloadUrl: Boolean(a.download_url)
      }))
    }, 'Fetched attachments from Resend');

    // Map to our Attachment format
    return result.data.map(a => ({
      url: a.download_url || '',
      filename: a.filename,
      contentType: a.content_type,
    }));
  } catch (error) {
    logger?.error({
      error: error instanceof Error ? error.message : String(error),
      emailId
    }, 'Failed to fetch attachments from Resend');
    return [];
  }
}

/**
 * Webhook endpoint for receiving inbound emails from Resend
 * Orchestrates end-to-end email analysis workflow
 */
export default async function webhookRoute(fastify: FastifyInstance): Promise<void> {
  // GET endpoint for webhook verification (Resend sends this when adding webhook)
  fastify.get('/webhook/inbound-email', async (request, reply) => {
    return reply.code(200).send({ status: 'ok', message: 'Webhook endpoint is ready' });
  });

  fastify.post('/webhook/inbound-email', {
    // Whitelist authentication preHandler - runs BEFORE route handler
    preHandler: async (request, reply) => {
      try {
        // Parse Resend webhook format
        const webhook: ResendWebhook = WebhookPayloadSchema.parse(request.body);

        // Check if sender is whitelisted
        if (!isWhitelisted(webhook.data.from)) {
          request.log.warn({ from: webhook.data.from }, 'Blocked non-whitelisted sender');
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
      // Parse Resend webhook format
      const webhook: ResendWebhook = WebhookPayloadSchema.parse(request.body);

      // Log raw webhook data
      request.log.info({
        webhookType: webhook.type,
        createdAt: webhook.created_at,
        from: webhook.data.from,
        to: webhook.data.to,
        subject: webhook.data.subject,
        hasText: Boolean(webhook.data.text),
        hasHtml: Boolean(webhook.data.html),
        textLength: webhook.data.text?.length || 0,
        htmlLength: webhook.data.html?.length || 0,
        attachmentCount: webhook.data.attachments?.length || 0,
        attachments: webhook.data.attachments?.map(a => ({
          filename: a.filename,
          content_type: a.content_type,
          hasContent: Boolean(a.content),
          contentLength: a.content?.length || 0
        })) || []
      }, 'Raw webhook received from Resend');

      // Fetch attachments from Resend API using /emails/receiving/{email_id}/attachments
      const emailId = webhook.data.email_id;
      const webhookAttachments = webhook.data.attachments || [];

      let normalizedAttachments: Attachment[] = [];

      if (!emailId) {
        request.log.warn('No email_id in webhook data - cannot fetch attachments');
      } else if (webhookAttachments.length === 0) {
        request.log.info({ emailId }, 'No attachments in webhook payload');
      } else {
        // Fetch all attachments in one API call
        normalizedAttachments = await fetchAttachmentsFromResend(
          emailId,
          config.resendApiKey,
          request.log
        );

        request.log.info({
          emailId,
          webhookAttachmentCount: webhookAttachments.length,
          fetchedAttachmentCount: normalizedAttachments.length,
          attachments: normalizedAttachments.map(a => ({
            filename: a.filename,
            contentType: a.contentType,
            hasUrl: Boolean(a.url),
            urlPreview: a.url.substring(0, 100)
          }))
        }, 'Fetched attachments from Resend API');
      }

      // Normalize to flat structure (take first "to" address)
      const payload: WebhookPayload = {
        from: webhook.data.from,
        to: webhook.data.to[0] || '', // Take first recipient or empty string
        subject: webhook.data.subject,
        text: webhook.data.text,
        html: webhook.data.html,
        attachments: normalizedAttachments,
      };

      // Log normalized webhook data
      request.log.info(
        {
          from: payload.from,
          to: payload.to,
          subject: payload.subject,
          hasText: Boolean(payload.text),
          hasHtml: Boolean(payload.html),
          textPreview: payload.text ? payload.text.substring(0, 100) : undefined,
          htmlPreview: payload.html ? payload.html.substring(0, 100) : undefined,
          hasAttachments: payload.attachments?.length || 0,
          attachmentDetails: payload.attachments?.map(a => ({
            filename: a.filename,
            type: a.contentType,
            hasUrl: Boolean(a.url)
          })) || []
        },
        'Webhook normalized and ready for processing'
      );

      // ===== Epic 3: Content Extraction & Processing =====

      // Step 1: Extract text content
      request.log.info('Extracting text content from email');
      const textContent = extractTextContent(payload);
      request.log.info({
        textLength: textContent.length,
        textPreview: textContent.substring(0, 200),
        hasContent: textContent.length > 0
      }, 'Text content extracted');

      // Step 2: Detect attachments
      request.log.info('Detecting attachments');
      const attachments = detectAttachments(payload);
      request.log.info({
        attachmentCount: attachments.length,
        attachments: attachments.map(a => ({
          filename: a.filename,
          contentType: a.contentType,
          urlLength: a.url.length
        }))
      }, 'Attachments detected');

      // Step 3: Download images and PDFs
      request.log.info({
        attachmentCount: attachments.length,
        attachments: attachments.map(a => ({ filename: a.filename, contentType: a.contentType }))
      }, 'Starting image/PDF download');

      const downloadedImages = await downloadImages(
        attachments,
        config.imageDownloadTimeoutMs,
        request.log
      );

      request.log.info({
        downloadedCount: downloadedImages.length,
        totalAttachments: attachments.length,
        successRate: `${Math.round((downloadedImages.length / attachments.length) * 100)}%`
      }, 'Image/PDF download complete');

      // Step 3.4: Keep original PDFs for response attachment (if enabled)
      const pdfAttachments = config.includePdfAttachment
        ? downloadedImages
            .filter(img => {
              const attachment = attachments.find(a => a.filename === img.filename);
              return attachment?.contentType === 'application/pdf';
            })
            .map(pdf => ({
              filename: pdf.filename,
              content: pdf.data.toString('base64')
            }))
        : [];

      request.log.info({
        includePdfAttachment: config.includePdfAttachment,
        pdfCount: pdfAttachments.length,
        pdfFilenames: pdfAttachments.map(p => p.filename)
      }, 'Captured PDFs for response attachment');

      // Step 3.5: Process attachments (convert PDFs to images)
      request.log.info({
        downloadedCount: downloadedImages.length
      }, 'Starting attachment processing (PDF conversion)');

      const processedImages = await processAttachments(
        downloadedImages,
        attachments,
        request.log
      );

      request.log.info({
        processedCount: processedImages.length,
        downloadedCount: downloadedImages.length,
        expansionRatio: downloadedImages.length > 0 ? (processedImages.length / downloadedImages.length).toFixed(2) : 'N/A'
      }, 'Attachment processing complete');

      // Step 4: Validate and filter images
      request.log.info({
        imagesToValidate: processedImages.length
      }, 'Starting image validation');

      const validatedImages: Array<{ filename: string; contentType: string; data: Buffer }> = [];
      let formatFailures = 0;
      let sizeFailures = 0;

      for (const image of processedImages) {
        // For PDF-converted images, use JPEG as content type
        // For regular images, find original attachment metadata
        let contentType = 'image/jpeg'; // Default for PDF conversions (now using JPEG)

        const attachment = attachments.find(att => att.filename === image.filename);
        if (attachment) {
          contentType = attachment.contentType;
        } else if (image.filename.includes('-page-')) {
          // This is a PDF-converted page, keep JPEG
          request.log.info({
            filename: image.filename,
            inferredType: 'PDF page conversion'
          }, 'Using JPEG content type for PDF-converted page');
        }

        // Create synthetic attachment for validation
        const syntheticAttachment = {
          filename: image.filename,
          contentType,
          url: '', // Not needed for validation
        };

        request.log.info({
          filename: image.filename,
          contentType,
          size: image.data.length,
          maxSize: config.maxImageSizeBytes
        }, 'Validating image');

        if (validateImage(syntheticAttachment, image.data, config.maxImageSizeBytes, request.log)) {
          validatedImages.push({
            filename: image.filename,
            contentType,
            data: image.data,
          });
          request.log.info({
            filename: image.filename,
            contentType
          }, 'Image validation passed');
        } else {
          // Track failure reason
          if (!['image/png', 'image/jpeg', 'image/jpg'].includes(contentType)) {
            formatFailures++;
            request.log.warn({
              filename: image.filename,
              contentType,
              reason: 'unsupported format'
            }, 'Image validation failed');
          } else {
            sizeFailures++;
            request.log.warn({
              filename: image.filename,
              size: image.data.length,
              maxSize: config.maxImageSizeBytes,
              reason: 'exceeds size limit'
            }, 'Image validation failed');
          }
        }
      }

      request.log.info({
        validatedCount: validatedImages.length,
        totalImages: processedImages.length,
        formatFailures,
        sizeFailures,
        successRate: processedImages.length > 0 ? `${Math.round((validatedImages.length / processedImages.length) * 100)}%` : 'N/A'
      }, 'Image validation complete');

      // Step 5: Encode images to base64
      const encodedImages = encodeImages(validatedImages, request.log);

      // Step 6: Categorize content
      request.log.info({
        textLength: textContent.length,
        encodedImageCount: encodedImages.length
      }, 'Categorizing content');

      const contentPackage = categorizeContent(textContent, encodedImages);

      request.log.info({
        contentType: contentPackage.contentType,
        textLength: contentPackage.text.length,
        imageCount: contentPackage.images.length,
        images: contentPackage.images.map(img => ({
          filename: img.filename,
          contentType: img.contentType,
          dataUrlLength: img.dataUrl.length
        }))
      }, 'Content categorized');

      // Step 7: Validate content package (throws ContentProcessingError if invalid)
      const processingContext: ProcessingContext = {
        attachmentCount: attachments.length,
        downloadedCount: downloadedImages.length,
        validatedCount: validatedImages.length,
        downloadFailures: attachments.length - downloadedImages.length,
        formatFailures,
        sizeFailures,
      };

      request.log.info({
        processingContext,
        contentPackage: {
          type: contentPackage.contentType,
          textLength: contentPackage.text.length,
          imageCount: contentPackage.images.length
        }
      }, 'Validating content package');

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

      // Step 1: Build email context for personalization
      // Use LLM to intelligently parse sender's name
      const senderName = await parseSenderNameWithLLM(
        payload.from,
        config.sparkyLlmUrl,
        config.llmModel,
        request.log
      );

      const emailContext = {
        senderName,
        senderEmail: payload.from,
        subject: payload.subject || 'Email Campaign'
      };

      request.log.info({
        senderEmail: payload.from,
        parsedName: senderName,
        subject: payload.subject
      }, 'Built email context for personalized analysis');

      // Step 2: Configure LLM
      const llmConfig = {
        apiUrl: config.sparkyLlmUrl,
        model: config.llmModel,
        maxTokens: config.maxTokens,
        timeoutMs: config.llmTimeoutMs,
      };

      // Step 3: Detect language with LLM
      const detectedLanguage = await detectLanguageWithLLM(
        payload.subject,
        contentPackage.text,
        config.sparkyLlmUrl,
        llmConfig,
        config.llmTimeoutMs,
        request.log
      );

      request.log.info({ detectedLanguage, subject: payload.subject }, 'Language detected with LLM');

      // Step 4: Call Claude via Langchain for email analysis
      const llmResult = await callClaudeForAnalysis(
        contentPackage,
        emailContext,
        detectedLanguage,
        llmConfig.maxTokens,
        request.log
      );

      request.log.info(
        {
          feedbackLength: llmResult.feedback.length,
          feedbackPreview: llmResult.feedback.substring(0, 200),
          processingTimeMs: llmResult.processingTimeMs,
          model: 'claude-sonnet-4-20250514'
        },
        'Claude analysis completed via Langchain'
      );

      // ===== Epic 5: Response Delivery =====

      // Step 1: Format success email
      request.log.info({
        recipientEmail: payload.from,
        originalSubject: payload.subject,
        feedbackLength: llmResult.feedback.length,
        processingTimeMs: llmResult.processingTimeMs,
        tokensUsed: llmResult.tokensUsed
      }, 'Formatting success email');

      const emailContent = formatSuccessEmail(
        payload.from,
        payload.subject,
        llmResult.feedback,
        senderName,
        pdfAttachments,
        llmResult.processingTimeMs,
        llmResult.tokensUsed,
        request.log
      );

      request.log.info({
        to: emailContent.to,
        subject: emailContent.subject,
        bodyLength: emailContent.body.length
      }, 'Success email formatted');

      // Step 2: Send email with retry
      const emailConfig = {
        apiKey: config.resendApiKey,
        timeoutMs: config.resendTimeoutMs,
        fromAddress: config.resendFromEmail,
      };

      request.log.info({
        to: emailContent.to,
        subject: emailContent.subject,
        from: emailConfig.fromAddress,
        timeout: emailConfig.timeoutMs
      }, 'Sending success email via Resend');

      const emailResult = await sendEmailWithRetry(
        emailContent.to,
        emailContent.subject,
        emailContent.body,
        emailConfig,
        emailContent.attachments,
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
          const webhook: ResendWebhook = WebhookPayloadSchema.parse(request.body);
          fromAddress = webhook.data.from;
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
          fromAddress: config.resendFromEmail,
        };

        const emailResult = await sendEmailWithRetry(
          errorEmail.to,
          errorEmail.subject,
          errorEmail.body,
          emailConfig,
          undefined, // No attachments for error emails
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
