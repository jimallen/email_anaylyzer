import { z } from 'zod';

/**
 * Zod validation schemas for email analyzer
 * Used for webhook payload validation and data integrity
 */

/**
 * Email attachment schema (as received from Resend)
 * Resend uses snake_case and provides base64 content inline
 */
const ResendAttachmentSchema = z.object({
  content_disposition: z.string().optional(),
  content_id: z.string().optional(),
  content_type: z.string().min(1, 'Attachment content type is required'),
  filename: z.string().min(1, 'Attachment filename is required'),
  id: z.string().optional(),
  content: z.string().optional(), // base64 encoded content
});

/**
 * Normalized attachment schema (for internal use)
 * This is what our image processor expects
 */
export const AttachmentSchema = z.object({
  url: z.string(), // For downloaded attachments, this is a data URL or download URL
  filename: z.string().min(1, 'Attachment filename is required'),
  contentType: z.string().min(1, 'Attachment content type is required'),
});

/**
 * Email data nested inside Resend webhook
 */
const EmailDataSchema = z.object({
  from: z.string().email('Invalid sender email address'),
  to: z.array(z.string().email('Invalid recipient email address')),
  subject: z.string(),
  text: z.string().optional(),
  html: z.string().optional(),
  attachments: z.array(ResendAttachmentSchema).optional().default([]),
  email_id: z.string().optional(),
  message_id: z.string().optional(),
  created_at: z.string().optional(),
  bcc: z.array(z.string()).optional(),
  cc: z.array(z.string()).optional(),
});

/**
 * Webhook payload schema for inbound emails from Resend
 * Validates the structure and content of webhook POST requests
 */
export const ResendWebhookSchema = z.object({
  type: z.string(),
  created_at: z.string(),
  data: EmailDataSchema,
});

/**
 * TypeScript type inferred from ResendWebhookSchema
 */
export type ResendWebhook = z.infer<typeof ResendWebhookSchema>;

/**
 * TypeScript type for the email data
 */
export type EmailData = z.infer<typeof EmailDataSchema>;

/**
 * TypeScript type for Resend attachment
 */
export type ResendAttachment = z.infer<typeof ResendAttachmentSchema>;

/**
 * Normalized webhook payload (flattened for compatibility)
 * Use this type for type-safe webhook payload handling
 */
export type WebhookPayload = {
  from: string;
  to: string;
  subject: string;
  text?: string;
  html?: string;
  attachments?: Attachment[];
};

// Keep old schema export for backward compatibility
export const WebhookPayloadSchema = ResendWebhookSchema;

/**
 * Attachment type inferred from AttachmentSchema
 */
export type Attachment = z.infer<typeof AttachmentSchema>;
