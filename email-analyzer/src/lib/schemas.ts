import { z } from 'zod';

/**
 * Zod validation schemas for email analyzer
 * Used for webhook payload validation and data integrity
 */

/**
 * Email attachment schema
 * Represents a file attachment from Resend webhook
 */
const AttachmentSchema = z.object({
  url: z.string().url('Attachment URL must be a valid URL'),
  filename: z.string().min(1, 'Attachment filename is required'),
  contentType: z.string().min(1, 'Attachment content type is required'),
});

/**
 * Webhook payload schema for inbound emails from Resend
 * Validates the structure and content of webhook POST requests
 */
export const WebhookPayloadSchema = z.object({
  from: z.string().email('Invalid sender email address'),
  to: z.string().email('Invalid recipient email address'),
  subject: z.string(),
  text: z.string().optional(),
  html: z.string().optional(),
  attachments: z.array(AttachmentSchema).optional(),
});

/**
 * TypeScript type inferred from WebhookPayloadSchema
 * Use this type for type-safe webhook payload handling
 */
export type WebhookPayload = z.infer<typeof WebhookPayloadSchema>;

/**
 * Attachment type inferred from AttachmentSchema
 */
export type Attachment = z.infer<typeof AttachmentSchema>;
