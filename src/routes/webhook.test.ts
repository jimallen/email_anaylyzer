import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import webhookRoute from './webhook';
import { whitelistManager } from '../services/whitelist-manager';

describe('Webhook Endpoint', () => {
  let app: FastifyInstance;
  let originalWhitelist: ReturnType<typeof whitelistManager.getWhitelist>;

  beforeAll(async () => {
    // Save original whitelist
    originalWhitelist = whitelistManager.getWhitelist();

    // Configure whitelist for tests - allow test emails
    whitelistManager.setWhitelist({
      allowedEmails: ['sender@example.com', 'recipient@example.com'],
      allowedDomains: ['@example.com'],
    });

    app = Fastify();
    await app.register(webhookRoute);
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
    // Restore original whitelist
    whitelistManager.setWhitelist(originalWhitelist);
  });

  describe('POST /webhook/inbound-email', () => {
    it('should accept valid webhook payload', async () => {
      const payload = {
        from: 'sender@example.com',
        to: 'recipient@example.com',
        subject: 'Test email',
        text: 'Hello world',
      };

      const response = await app.inject({
        method: 'POST',
        url: '/webhook/inbound-email',
        payload,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
    });

    it('should accept payload with HTML content', async () => {
      const payload = {
        from: 'sender@example.com',
        to: 'recipient@example.com',
        subject: 'Test email',
        html: '<p>Hello world</p>',
      };

      const response = await app.inject({
        method: 'POST',
        url: '/webhook/inbound-email',
        payload,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
    });

    it('should accept payload with attachments', async () => {
      const payload = {
        from: 'sender@example.com',
        to: 'recipient@example.com',
        subject: 'Test email with attachment',
        text: 'See attached',
        attachments: [
          {
            url: 'https://example.com/file.pdf',
            filename: 'file.pdf',
            contentType: 'application/pdf',
          },
        ],
      };

      const response = await app.inject({
        method: 'POST',
        url: '/webhook/inbound-email',
        payload,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
    });

    it('should accept payload with multiple attachments', async () => {
      const payload = {
        from: 'sender@example.com',
        to: 'recipient@example.com',
        subject: 'Test email',
        attachments: [
          {
            url: 'https://example.com/image1.png',
            filename: 'image1.png',
            contentType: 'image/png',
          },
          {
            url: 'https://example.com/image2.jpg',
            filename: 'image2.jpg',
            contentType: 'image/jpeg',
          },
        ],
      };

      const response = await app.inject({
        method: 'POST',
        url: '/webhook/inbound-email',
        payload,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
    });

    it('should accept payload with both text and HTML', async () => {
      const payload = {
        from: 'sender@example.com',
        to: 'recipient@example.com',
        subject: 'Test email',
        text: 'Plain text version',
        html: '<p>HTML version</p>',
      };

      const response = await app.inject({
        method: 'POST',
        url: '/webhook/inbound-email',
        payload,
      });

      expect(response.statusCode).toBe(200);
    });

    it('should reject payload with invalid sender email', async () => {
      const payload = {
        from: 'not-an-email',
        to: 'recipient@example.com',
        subject: 'Test email',
      };

      const response = await app.inject({
        method: 'POST',
        url: '/webhook/inbound-email',
        payload,
      });

      expect(response.statusCode).toBe(500);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
      expect(body.error).toBeDefined();
    });

    it('should reject payload with invalid recipient email', async () => {
      const payload = {
        from: 'sender@example.com',
        to: 'not-an-email',
        subject: 'Test email',
      };

      const response = await app.inject({
        method: 'POST',
        url: '/webhook/inbound-email',
        payload,
      });

      expect(response.statusCode).toBe(500);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
    });

    it('should reject payload missing required fields', async () => {
      const payload = {
        from: 'sender@example.com',
        // Missing 'to' and 'subject'
      };

      const response = await app.inject({
        method: 'POST',
        url: '/webhook/inbound-email',
        payload,
      });

      expect(response.statusCode).toBe(500);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
    });

    it('should reject payload with invalid attachment URL', async () => {
      const payload = {
        from: 'sender@example.com',
        to: 'recipient@example.com',
        subject: 'Test email',
        attachments: [
          {
            url: 'not-a-url',
            filename: 'file.pdf',
            contentType: 'application/pdf',
          },
        ],
      };

      const response = await app.inject({
        method: 'POST',
        url: '/webhook/inbound-email',
        payload,
      });

      expect(response.statusCode).toBe(500);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
    });

    it('should reject payload with empty attachment filename', async () => {
      const payload = {
        from: 'sender@example.com',
        to: 'recipient@example.com',
        subject: 'Test email',
        attachments: [
          {
            url: 'https://example.com/file.pdf',
            filename: '',
            contentType: 'application/pdf',
          },
        ],
      };

      const response = await app.inject({
        method: 'POST',
        url: '/webhook/inbound-email',
        payload,
      });

      expect(response.statusCode).toBe(500);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
    });

    it('should reject payload with empty attachment content type', async () => {
      const payload = {
        from: 'sender@example.com',
        to: 'recipient@example.com',
        subject: 'Test email',
        attachments: [
          {
            url: 'https://example.com/file.pdf',
            filename: 'file.pdf',
            contentType: '',
          },
        ],
      };

      const response = await app.inject({
        method: 'POST',
        url: '/webhook/inbound-email',
        payload,
      });

      expect(response.statusCode).toBe(500);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
    });

    it('should accept payload with empty subject', async () => {
      const payload = {
        from: 'sender@example.com',
        to: 'recipient@example.com',
        subject: '',
        text: 'Email without subject',
      };

      const response = await app.inject({
        method: 'POST',
        url: '/webhook/inbound-email',
        payload,
      });

      expect(response.statusCode).toBe(200);
    });

    it('should accept payload without text or HTML', async () => {
      const payload = {
        from: 'sender@example.com',
        to: 'recipient@example.com',
        subject: 'Test email',
        // No text or HTML - might just have attachments
      };

      const response = await app.inject({
        method: 'POST',
        url: '/webhook/inbound-email',
        payload,
      });

      expect(response.statusCode).toBe(200);
    });

    it('should return JSON response', async () => {
      const payload = {
        from: 'sender@example.com',
        to: 'recipient@example.com',
        subject: 'Test email',
      };

      const response = await app.inject({
        method: 'POST',
        url: '/webhook/inbound-email',
        payload,
      });

      expect(response.headers['content-type']).toContain('application/json');
    });

    it('should handle complex email with all fields', async () => {
      const payload = {
        from: 'sender@example.com',
        to: 'recipient@example.com',
        subject: 'Complex email test',
        text: 'Plain text version of the email',
        html: '<html><body><h1>HTML version</h1><p>With formatting</p></body></html>',
        attachments: [
          {
            url: 'https://example.com/doc.pdf',
            filename: 'document.pdf',
            contentType: 'application/pdf',
          },
          {
            url: 'https://example.com/image.png',
            filename: 'screenshot.png',
            contentType: 'image/png',
          },
        ],
      };

      const response = await app.inject({
        method: 'POST',
        url: '/webhook/inbound-email',
        payload,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
    });
  });

  describe('Whitelist Authentication', () => {
    it('should accept request from whitelisted email', async () => {
      const payload = {
        from: 'sender@example.com', // Whitelisted in beforeAll
        to: 'recipient@example.com',
        subject: 'Test from whitelisted sender',
        text: 'This should succeed',
      };

      const response = await app.inject({
        method: 'POST',
        url: '/webhook/inbound-email',
        payload,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
    });

    it('should accept request from whitelisted domain', async () => {
      const payload = {
        from: 'anyone@example.com', // @example.com is whitelisted
        to: 'recipient@example.com',
        subject: 'Test from whitelisted domain',
        text: 'This should succeed',
      };

      const response = await app.inject({
        method: 'POST',
        url: '/webhook/inbound-email',
        payload,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
    });

    it('should reject request from non-whitelisted sender with 403', async () => {
      const payload = {
        from: 'unauthorized@external.com', // NOT whitelisted
        to: 'recipient@example.com',
        subject: 'Test from unauthorized sender',
        text: 'This should be blocked',
      };

      const response = await app.inject({
        method: 'POST',
        url: '/webhook/inbound-email',
        payload,
      });

      expect(response.statusCode).toBe(403);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
      expect(body.error).toBe('Unauthorized sender');
    });

    it('should not expose internal details in 403 response', async () => {
      const payload = {
        from: 'blocked@attacker.com',
        to: 'recipient@example.com',
        subject: 'Probing for info',
        text: 'Trying to get details',
      };

      const response = await app.inject({
        method: 'POST',
        url: '/webhook/inbound-email',
        payload,
      });

      expect(response.statusCode).toBe(403);
      const body = JSON.parse(response.body);

      // Should not reveal which emails are whitelisted
      expect(body.error).toBe('Unauthorized sender');
      expect(body.error).not.toContain('example.com');
      expect(body.error).not.toContain('whitelist');

      // Should only contain generic error message
      expect(Object.keys(body)).toEqual(['success', 'error']);
    });

    it('should block before processing email content', async () => {
      const payload = {
        from: 'malicious@spam.com',
        to: 'recipient@example.com',
        subject: 'Spam email',
        text: 'This content should never be processed',
        html: '<script>alert("xss")</script>',
        attachments: [
          {
            url: 'https://malicious.com/virus.exe',
            filename: 'virus.exe',
            contentType: 'application/x-executable',
          },
        ],
      };

      const response = await app.inject({
        method: 'POST',
        url: '/webhook/inbound-email',
        payload,
      });

      // Should be blocked before any content processing
      expect(response.statusCode).toBe(403);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
      expect(body.error).toBe('Unauthorized sender');
    });
  });
});
