import { describe, it, expect } from 'vitest';
import {
  ContentProcessingError,
  ERROR_CODES,
  createNoContentError,
  createDownloadFailedError,
  createInvalidFormatError,
  createSizeExceededError,
  LLMError,
  LLM_ERROR_CODES,
  createLLMTimeoutError,
  createLLMNetworkError,
  createLLMHTTPError,
  createLLMInvalidResponseError,
} from './errors';

describe('Content Processing Errors', () => {
  describe('ContentProcessingError', () => {
    it('should create error with code, message, and details', () => {
      const error = new ContentProcessingError(
        ERROR_CODES.NO_CONTENT,
        'Test message',
        { foo: 'bar' }
      );

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(ContentProcessingError);
      expect(error.name).toBe('ContentProcessingError');
      expect(error.code).toBe(ERROR_CODES.NO_CONTENT);
      expect(error.userMessage).toBe('Test message');
      expect(error.message).toBe('Test message');
      expect(error.details).toEqual({ foo: 'bar' });
    });

    it('should create error with empty details if not provided', () => {
      const error = new ContentProcessingError(
        ERROR_CODES.NO_CONTENT,
        'Test message'
      );

      expect(error.details).toEqual({});
    });

    it('should have proper stack trace', () => {
      const error = new ContentProcessingError(
        ERROR_CODES.NO_CONTENT,
        'Test message'
      );

      expect(error.stack).toBeDefined();
      expect(error.stack).toContain('ContentProcessingError');
    });

    it('should support all error codes', () => {
      const codes = [
        ERROR_CODES.NO_CONTENT,
        ERROR_CODES.DOWNLOAD_FAILED,
        ERROR_CODES.INVALID_FORMAT,
        ERROR_CODES.SIZE_EXCEEDED,
      ];

      codes.forEach((code) => {
        const error = new ContentProcessingError(code, 'Test', {});
        expect(error.code).toBe(code);
      });
    });
  });

  describe('createNoContentError', () => {
    it('should create NO_CONTENT error with correct message', () => {
      const error = createNoContentError();

      expect(error.code).toBe(ERROR_CODES.NO_CONTENT);
      expect(error.userMessage).toBe(
        'No content found to analyze. Please include email text or screenshot.'
      );
      expect(error.details).toEqual({});
    });

    it('should include provided details', () => {
      const details = { hasText: false, hasImages: false };
      const error = createNoContentError(details);

      expect(error.details).toEqual(details);
    });
  });

  describe('createDownloadFailedError', () => {
    it('should create DOWNLOAD_FAILED error with correct message', () => {
      const error = createDownloadFailedError();

      expect(error.code).toBe(ERROR_CODES.DOWNLOAD_FAILED);
      expect(error.userMessage).toBe(
        'Unable to download screenshots. Please check file sizes and try again.'
      );
      expect(error.details).toEqual({});
    });

    it('should include provided details', () => {
      const details = { attachmentCount: 2, downloadedCount: 0 };
      const error = createDownloadFailedError(details);

      expect(error.details).toEqual(details);
    });
  });

  describe('createInvalidFormatError', () => {
    it('should create INVALID_FORMAT error with correct message', () => {
      const error = createInvalidFormatError();

      expect(error.code).toBe(ERROR_CODES.INVALID_FORMAT);
      expect(error.userMessage).toBe(
        'Unsupported image formats detected. Please use PNG or JPEG screenshots.'
      );
      expect(error.details).toEqual({});
    });

    it('should include provided details', () => {
      const details = { formatFailures: 3, detectedTypes: ['image/gif', 'image/bmp'] };
      const error = createInvalidFormatError(details);

      expect(error.details).toEqual(details);
    });
  });

  describe('createSizeExceededError', () => {
    it('should create SIZE_EXCEEDED error with correct message', () => {
      const error = createSizeExceededError();

      expect(error.code).toBe(ERROR_CODES.SIZE_EXCEEDED);
      expect(error.userMessage).toBe(
        'Screenshots are too large (max 10MB). Please reduce file size and try again.'
      );
      expect(error.details).toEqual({});
    });

    it('should include provided details', () => {
      const details = { sizeFailures: 2, totalSize: 25000000 };
      const error = createSizeExceededError(details);

      expect(error.details).toEqual(details);
    });
  });

  describe('Error message quality', () => {
    it('should have user-friendly messages without technical jargon', () => {
      const errors = [
        createNoContentError(),
        createDownloadFailedError(),
        createInvalidFormatError(),
        createSizeExceededError(),
      ];

      errors.forEach((error) => {
        // Messages should be clear and actionable
        expect(error.userMessage.length).toBeGreaterThan(20);
        expect(error.userMessage).toMatch(/Please/);
        // Should not contain technical terms
        expect(error.userMessage.toLowerCase()).not.toContain('buffer');
        expect(error.userMessage.toLowerCase()).not.toContain('validation');
        expect(error.userMessage.toLowerCase()).not.toContain('processing');
      });
    });

    it('should provide specific guidance in error messages', () => {
      expect(createNoContentError().userMessage).toContain('include email text or screenshot');
      expect(createDownloadFailedError().userMessage).toContain('check file sizes');
      expect(createInvalidFormatError().userMessage).toContain('PNG or JPEG');
      expect(createSizeExceededError().userMessage).toContain('10MB');
    });
  });
});

describe('LLM API Errors', () => {
  describe('LLMError', () => {
    it('should create error with code, message, and details', () => {
      const error = new LLMError(
        LLM_ERROR_CODES.LLM_TIMEOUT,
        'Test message',
        { foo: 'bar' }
      );

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(LLMError);
      expect(error.name).toBe('LLMError');
      expect(error.code).toBe(LLM_ERROR_CODES.LLM_TIMEOUT);
      expect(error.userMessage).toBe('Test message');
      expect(error.message).toBe('Test message');
      expect(error.details).toEqual({ foo: 'bar' });
    });

    it('should create error with empty details if not provided', () => {
      const error = new LLMError(
        LLM_ERROR_CODES.LLM_NETWORK_ERROR,
        'Test message'
      );

      expect(error.details).toEqual({});
    });

    it('should have proper stack trace', () => {
      const error = new LLMError(
        LLM_ERROR_CODES.LLM_HTTP_ERROR,
        'Test message'
      );

      expect(error.stack).toBeDefined();
      expect(error.stack).toContain('LLMError');
    });

    it('should support all error codes', () => {
      const codes = [
        LLM_ERROR_CODES.LLM_TIMEOUT,
        LLM_ERROR_CODES.LLM_NETWORK_ERROR,
        LLM_ERROR_CODES.LLM_HTTP_ERROR,
        LLM_ERROR_CODES.LLM_INVALID_RESPONSE,
      ];

      codes.forEach((code) => {
        const error = new LLMError(code, 'Test', {});
        expect(error.code).toBe(code);
      });
    });
  });

  describe('createLLMTimeoutError', () => {
    it('should create LLM_TIMEOUT error with correct message', () => {
      const error = createLLMTimeoutError();

      expect(error.code).toBe(LLM_ERROR_CODES.LLM_TIMEOUT);
      expect(error.userMessage).toBe(
        'Analysis is taking longer than expected. Please try again in a moment.'
      );
      expect(error.details).toEqual({});
    });

    it('should include provided details', () => {
      const details = { duration: 25000, url: 'http://api.example.com' };
      const error = createLLMTimeoutError(details);

      expect(error.details).toEqual(details);
    });
  });

  describe('createLLMNetworkError', () => {
    it('should create LLM_NETWORK_ERROR error with correct message', () => {
      const error = createLLMNetworkError();

      expect(error.code).toBe(LLM_ERROR_CODES.LLM_NETWORK_ERROR);
      expect(error.userMessage).toBe(
        'Unable to reach analysis service. Please try again shortly.'
      );
      expect(error.details).toEqual({});
    });

    it('should include provided details', () => {
      const details = { error: 'ECONNREFUSED', url: 'http://api.example.com' };
      const error = createLLMNetworkError(details);

      expect(error.details).toEqual(details);
    });
  });

  describe('createLLMHTTPError', () => {
    it('should create LLM_HTTP_ERROR error with correct message', () => {
      const error = createLLMHTTPError();

      expect(error.code).toBe(LLM_ERROR_CODES.LLM_HTTP_ERROR);
      expect(error.userMessage).toBe(
        'Analysis service returned an error. Please try again later.'
      );
      expect(error.details).toEqual({});
    });

    it('should include provided details', () => {
      const details = { statusCode: 500, errorBody: 'Internal server error' };
      const error = createLLMHTTPError(details);

      expect(error.details).toEqual(details);
    });
  });

  describe('createLLMInvalidResponseError', () => {
    it('should create LLM_INVALID_RESPONSE error with correct message', () => {
      const error = createLLMInvalidResponseError();

      expect(error.code).toBe(LLM_ERROR_CODES.LLM_INVALID_RESPONSE);
      expect(error.userMessage).toBe(
        'Received unexpected response from analysis service. Please try again.'
      );
      expect(error.details).toEqual({});
    });

    it('should include provided details', () => {
      const details = { error: 'Invalid schema', response: { invalid: true } };
      const error = createLLMInvalidResponseError(details);

      expect(error.details).toEqual(details);
    });
  });

  describe('Error message quality', () => {
    it('should have user-friendly messages without technical jargon', () => {
      const errors = [
        createLLMTimeoutError(),
        createLLMNetworkError(),
        createLLMHTTPError(),
        createLLMInvalidResponseError(),
      ];

      errors.forEach((error) => {
        // Messages should be clear and actionable
        expect(error.userMessage.length).toBeGreaterThan(20);
        expect(error.userMessage).toMatch(/Please|try again/i);
        // Should not contain highly technical terms
        expect(error.userMessage.toLowerCase()).not.toContain('abort');
        expect(error.userMessage.toLowerCase()).not.toContain('fetch');
        expect(error.userMessage.toLowerCase()).not.toContain('api');
      });
    });

    it('should provide actionable guidance in error messages', () => {
      expect(createLLMTimeoutError().userMessage).toContain('try again');
      expect(createLLMNetworkError().userMessage).toContain('try again');
      expect(createLLMHTTPError().userMessage).toContain('try again');
      expect(createLLMInvalidResponseError().userMessage).toContain('try again');
    });

    it('should mention "analysis" to clarify what failed', () => {
      expect(createLLMTimeoutError().userMessage.toLowerCase()).toContain('analysis');
      expect(createLLMNetworkError().userMessage.toLowerCase()).toContain('analysis');
      expect(createLLMHTTPError().userMessage.toLowerCase()).toContain('analysis');
      expect(createLLMInvalidResponseError().userMessage.toLowerCase()).toContain('analysis');
    });
  });
});
