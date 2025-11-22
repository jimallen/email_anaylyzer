import { describe, it, expect, vi } from 'vitest';
import {
  redactSensitiveData,
  extractEmailMetadata,
  logEmailReceived,
  logError,
  logWarning,
  type EmailMetadata,
} from './logger';
import type { FastifyBaseLogger } from 'fastify';

describe('Logger Utilities', () => {
  describe('redactSensitiveData', () => {
    it('should redact API keys', () => {
      const data = {
        api_key: 'secret123',
        apiKey: 'secret456',
        name: 'test',
      };

      const redacted = redactSensitiveData(data);

      expect(redacted.api_key).toBe('[REDACTED]');
      expect(redacted.apiKey).toBe('[REDACTED]');
      expect(redacted.name).toBe('test');
    });

    it('should redact passwords', () => {
      const data = {
        password: 'secret123',
        user_password: 'secret456',
        username: 'john',
      };

      const redacted = redactSensitiveData(data);

      expect(redacted.password).toBe('[REDACTED]');
      expect(redacted.user_password).toBe('[REDACTED]');
      expect(redacted.username).toBe('john');
    });

    it('should redact tokens', () => {
      const data = {
        token: 'abc123',
        access_token: 'xyz789',
        bearer_token: 'def456',
      };

      const redacted = redactSensitiveData(data);

      expect(redacted.token).toBe('[REDACTED]');
      expect(redacted.access_token).toBe('[REDACTED]');
      expect(redacted.bearer_token).toBe('[REDACTED]');
    });

    it('should redact auth headers', () => {
      const data = {
        authorization: 'Bearer token123',
        auth: 'Basic abc123',
      };

      const redacted = redactSensitiveData(data);

      expect(redacted.authorization).toBe('[REDACTED]');
      expect(redacted.auth).toBe('[REDACTED]');
    });

    it('should redact secrets', () => {
      const data = {
        secret: 'my-secret',
        client_secret: 'oauth-secret',
      };

      const redacted = redactSensitiveData(data);

      expect(redacted.secret).toBe('[REDACTED]');
      expect(redacted.client_secret).toBe('[REDACTED]');
    });

    it('should handle nested objects', () => {
      const data = {
        user: {
          name: 'john',
          password: 'secret123',
        },
        api_key: 'key123',
      };

      const redacted = redactSensitiveData(data);

      expect((redacted.user as Record<string, unknown>).name).toBe('john');
      expect((redacted.user as Record<string, unknown>).password).toBe('[REDACTED]');
      expect(redacted.api_key).toBe('[REDACTED]');
    });

    it('should preserve non-sensitive data', () => {
      const data = {
        sender: 'user@example.com',
        hasText: true,
        textLength: 100,
      };

      const redacted = redactSensitiveData(data);

      expect(redacted.sender).toBe('user@example.com');
      expect(redacted.hasText).toBe(true);
      expect(redacted.textLength).toBe(100);
    });
  });

  describe('extractEmailMetadata', () => {
    it('should extract metadata from email with text', () => {
      const email = {
        from: 'user@example.com',
        text: 'Hello world',
        attachments: [],
        subject: 'Test email',
      };

      const metadata = extractEmailMetadata(email);

      expect(metadata.sender).toBe('user@example.com');
      expect(metadata.hasText).toBe(true);
      expect(metadata.hasImage).toBe(false);
      expect(metadata.textLength).toBe(11);
      expect(metadata.imageCount).toBe(0);
      expect(metadata.subject).toBe('Test email');
    });

    it('should extract metadata from email with HTML', () => {
      const email = {
        from: 'user@example.com',
        html: '<p>Hello world</p>',
        attachments: [],
      };

      const metadata = extractEmailMetadata(email);

      expect(metadata.sender).toBe('user@example.com');
      expect(metadata.hasText).toBe(true);
      expect(metadata.hasImage).toBe(false);
      expect(metadata.textLength).toBe(18);
    });

    it('should extract metadata from email with attachments', () => {
      const email = {
        from: 'user@example.com',
        text: 'See attached',
        attachments: [{ filename: 'image.png' }, { filename: 'doc.pdf' }],
      };

      const metadata = extractEmailMetadata(email);

      expect(metadata.sender).toBe('user@example.com');
      expect(metadata.hasText).toBe(true);
      expect(metadata.hasImage).toBe(true);
      expect(metadata.imageCount).toBe(2);
    });

    it('should handle email without sender', () => {
      const email = {
        text: 'Hello',
      };

      const metadata = extractEmailMetadata(email);

      expect(metadata.sender).toBe('unknown');
      expect(metadata.hasText).toBe(true);
    });

    it('should handle email without text or HTML', () => {
      const email = {
        from: 'user@example.com',
        attachments: [{ filename: 'image.png' }],
      };

      const metadata = extractEmailMetadata(email);

      expect(metadata.hasText).toBe(false);
      expect(metadata.hasImage).toBe(true);
      expect(metadata.textLength).toBe(0);
    });

    it('should never include full email content', () => {
      const email = {
        from: 'user@example.com',
        text: 'This is private email content that should not be logged',
        html: '<p>Private HTML content</p>',
        attachments: [{ filename: 'image.png', content: 'base64data...' }],
      };

      const metadata = extractEmailMetadata(email);

      // Verify that no full content is included
      expect(Object.values(metadata)).not.toContain(email.text);
      expect(Object.values(metadata)).not.toContain(email.html);
      expect(metadata).not.toHaveProperty('content');
      expect(metadata).not.toHaveProperty('html');
      expect(metadata).not.toHaveProperty('text');
    });
  });

  describe('logEmailReceived', () => {
    it('should log email metadata with info level', () => {
      const mockLogger = {
        info: vi.fn(),
      } as unknown as FastifyBaseLogger;

      const metadata: EmailMetadata = {
        sender: 'user@example.com',
        hasText: true,
        hasImage: false,
        textLength: 100,
        imageCount: 0,
        subject: 'Test',
      };

      logEmailReceived(mockLogger, metadata);

      expect(mockLogger.info).toHaveBeenCalledWith(
        {
          sender: 'user@example.com',
          hasText: true,
          hasImage: false,
          textLength: 100,
          imageCount: 0,
          subject: 'Test',
        },
        'Email received'
      );
    });
  });

  describe('logError', () => {
    it('should log error with sanitized context', () => {
      const mockLogger = {
        error: vi.fn(),
      } as unknown as FastifyBaseLogger;

      const error = new Error('Test error');
      const context = {
        sender: 'user@example.com',
        api_key: 'secret123',
      };

      logError(mockLogger, error, context);

      expect(mockLogger.error).toHaveBeenCalled();
      const [[loggedData]] = (mockLogger.error as ReturnType<typeof vi.fn>).mock.calls;
      expect(loggedData.err.message).toBe('Test error');
      expect(loggedData.sender).toBe('user@example.com');
      expect(loggedData.api_key).toBe('[REDACTED]');
    });

    it('should include error stack trace', () => {
      const mockLogger = {
        error: vi.fn(),
      } as unknown as FastifyBaseLogger;

      const error = new Error('Test error');
      const context = {};

      logError(mockLogger, error, context);

      const [[loggedData]] = (mockLogger.error as ReturnType<typeof vi.fn>).mock.calls;
      expect(loggedData.err.stack).toBeDefined();
      expect(loggedData.err.name).toBe('Error');
    });
  });

  describe('logWarning', () => {
    it('should log warning with message only', () => {
      const mockLogger = {
        warn: vi.fn(),
      } as unknown as FastifyBaseLogger;

      logWarning(mockLogger, 'Warning message');

      expect(mockLogger.warn).toHaveBeenCalledWith('Warning message');
    });

    it('should log warning with sanitized context', () => {
      const mockLogger = {
        warn: vi.fn(),
      } as unknown as FastifyBaseLogger;

      const context = {
        sender: 'user@example.com',
        token: 'abc123',
      };

      logWarning(mockLogger, 'Warning message', context);

      expect(mockLogger.warn).toHaveBeenCalled();
      const [[loggedContext, message]] = (mockLogger.warn as ReturnType<typeof vi.fn>).mock.calls;
      expect(loggedContext.sender).toBe('user@example.com');
      expect(loggedContext.token).toBe('[REDACTED]');
      expect(message).toBe('Warning message');
    });
  });
});
