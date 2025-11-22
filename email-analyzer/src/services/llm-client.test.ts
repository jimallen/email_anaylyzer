import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  formatLLMRequest,
  callLLMAPI,
  parseLLMResponse,
  type LLMConfig,
  type LLMRequest,
  type LLMResponse,
} from './llm-client';
import type { ContentPackage } from './email-processor';
import type { EncodedImage } from './image-processor';
import { LLMError, LLM_ERROR_CODES } from '../lib/errors';

describe('LLM Client Service', () => {
  const defaultConfig: LLMConfig = {
    model: 'qwen2vl-email-analyzer',
    maxTokens: 1000,
  };

  describe('formatLLMRequest', () => {
    describe('Text-only scenarios', () => {
      it('should format text-only content correctly', () => {
        const contentPackage: ContentPackage = {
          contentType: 'text-only',
          text: 'This is my email draft',
          images: [],
        };

        const result = formatLLMRequest(contentPackage, defaultConfig);

        expect(result.model).toBe('qwen2vl-email-analyzer');
        expect(result.max_tokens).toBe(1000);
        expect(result.messages).toHaveLength(1);
        expect(result.messages[0]!.role).toBe('user');
        expect(result.messages[0]!.content).toHaveLength(1);
        expect(result.messages[0]!.content[0]!).toEqual({
          type: 'text',
          text: 'This is my email draft',
        });
      });

      it('should handle long text content', () => {
        const longText = 'A'.repeat(5000);
        const contentPackage: ContentPackage = {
          contentType: 'text-only',
          text: longText,
          images: [],
        };

        const result = formatLLMRequest(contentPackage, defaultConfig);

        expect(result.messages[0]!.content).toHaveLength(1);
        expect(result.messages[0]!.content[0]!).toEqual({
          type: 'text',
          text: longText,
        });
      });

      it('should trim whitespace but preserve text content', () => {
        const contentPackage: ContentPackage = {
          contentType: 'text-only',
          text: '  Hello world  ',
          images: [],
        };

        const result = formatLLMRequest(contentPackage, defaultConfig);

        expect(result.messages[0]!.content).toHaveLength(1);
        expect(result.messages[0]!.content[0]!).toEqual({
          type: 'text',
          text: '  Hello world  ', // Original text preserved
        });
      });

      it('should handle text with newlines', () => {
        const contentPackage: ContentPackage = {
          contentType: 'text-only',
          text: 'Line 1\nLine 2\nLine 3',
          images: [],
        };

        const result = formatLLMRequest(contentPackage, defaultConfig);

        expect(result.messages[0]!.content[0]!).toEqual({
          type: 'text',
          text: 'Line 1\nLine 2\nLine 3',
        });
      });
    });

    describe('Screenshot-only scenarios', () => {
      it('should format single image correctly', () => {
        const images: EncodedImage[] = [
          {
            filename: 'screenshot.png',
            contentType: 'image/png',
            dataUrl: 'data:image/png;base64,abc123',
          },
        ];
        const contentPackage: ContentPackage = {
          contentType: 'screenshot-only',
          text: '',
          images,
        };

        const result = formatLLMRequest(contentPackage, defaultConfig);

        expect(result.messages[0]!.content).toHaveLength(1);
        expect(result.messages[0]!.content[0]!).toEqual({
          type: 'image_url',
          image_url: {
            url: 'data:image/png;base64,abc123',
          },
        });
      });

      it('should format multiple images correctly', () => {
        const images: EncodedImage[] = [
          {
            filename: 'screenshot1.png',
            contentType: 'image/png',
            dataUrl: 'data:image/png;base64,abc123',
          },
          {
            filename: 'screenshot2.jpeg',
            contentType: 'image/jpeg',
            dataUrl: 'data:image/jpeg;base64,def456',
          },
          {
            filename: 'screenshot3.png',
            contentType: 'image/png',
            dataUrl: 'data:image/png;base64,ghi789',
          },
        ];
        const contentPackage: ContentPackage = {
          contentType: 'screenshot-only',
          text: '',
          images,
        };

        const result = formatLLMRequest(contentPackage, defaultConfig);

        expect(result.messages[0]!.content).toHaveLength(3);
        expect(result.messages[0]!.content[0]!).toEqual({
          type: 'image_url',
          image_url: { url: 'data:image/png;base64,abc123' },
        });
        expect(result.messages[0]!.content[1]!).toEqual({
          type: 'image_url',
          image_url: { url: 'data:image/jpeg;base64,def456' },
        });
        expect(result.messages[0]!.content[2]!).toEqual({
          type: 'image_url',
          image_url: { url: 'data:image/png;base64,ghi789' },
        });
      });

      it('should handle whitespace-only text as screenshot-only', () => {
        const images: EncodedImage[] = [
          {
            filename: 'screenshot.png',
            contentType: 'image/png',
            dataUrl: 'data:image/png;base64,abc123',
          },
        ];
        const contentPackage: ContentPackage = {
          contentType: 'screenshot-only',
          text: '   \n\t  ',
          images,
        };

        const result = formatLLMRequest(contentPackage, defaultConfig);

        // Whitespace-only text should not be included
        expect(result.messages[0]!.content).toHaveLength(1);
        expect(result.messages[0]!.content[0]!.type).toBe('image_url');
      });
    });

    describe('Hybrid scenarios', () => {
      it('should format hybrid content with text first, then images', () => {
        const images: EncodedImage[] = [
          {
            filename: 'screenshot.png',
            contentType: 'image/png',
            dataUrl: 'data:image/png;base64,abc123',
          },
        ];
        const contentPackage: ContentPackage = {
          contentType: 'hybrid',
          text: 'Check out this draft',
          images,
        };

        const result = formatLLMRequest(contentPackage, defaultConfig);

        expect(result.messages[0]!.content).toHaveLength(2);
        // Text comes first
        expect(result.messages[0]!.content[0]!).toEqual({
          type: 'text',
          text: 'Check out this draft',
        });
        // Images follow
        expect(result.messages[0]!.content[1]!).toEqual({
          type: 'image_url',
          image_url: { url: 'data:image/png;base64,abc123' },
        });
      });

      it('should format hybrid content with multiple images', () => {
        const images: EncodedImage[] = [
          {
            filename: 'screenshot1.png',
            contentType: 'image/png',
            dataUrl: 'data:image/png;base64,abc123',
          },
          {
            filename: 'screenshot2.jpeg',
            contentType: 'image/jpeg',
            dataUrl: 'data:image/jpeg;base64,def456',
          },
        ];
        const contentPackage: ContentPackage = {
          contentType: 'hybrid',
          text: 'Here are my drafts',
          images,
        };

        const result = formatLLMRequest(contentPackage, defaultConfig);

        expect(result.messages[0]!.content).toHaveLength(3);
        expect(result.messages[0]!.content[0]!).toEqual({
          type: 'text',
          text: 'Here are my drafts',
        });
        expect(result.messages[0]!.content[1]!.type).toBe('image_url');
        expect(result.messages[0]!.content[2]!.type).toBe('image_url');
      });

      it('should maintain order of images', () => {
        const images: EncodedImage[] = [
          {
            filename: 'first.png',
            contentType: 'image/png',
            dataUrl: 'data:image/png;base64,111',
          },
          {
            filename: 'second.png',
            contentType: 'image/png',
            dataUrl: 'data:image/png;base64,222',
          },
          {
            filename: 'third.png',
            contentType: 'image/png',
            dataUrl: 'data:image/png;base64,333',
          },
        ];
        const contentPackage: ContentPackage = {
          contentType: 'hybrid',
          text: 'Ordered images',
          images,
        };

        const result = formatLLMRequest(contentPackage, defaultConfig);

        expect(result.messages[0]!.content[1]!).toEqual({
          type: 'image_url',
          image_url: { url: 'data:image/png;base64,111' },
        });
        expect(result.messages[0]!.content[2]!).toEqual({
          type: 'image_url',
          image_url: { url: 'data:image/png;base64,222' },
        });
        expect(result.messages[0]!.content[3]!).toEqual({
          type: 'image_url',
          image_url: { url: 'data:image/png;base64,333' },
        });
      });
    });

    describe('Configuration options', () => {
      it('should use custom model name from config', () => {
        const customConfig: LLMConfig = {
          model: 'custom-model-v2',
          maxTokens: 1000,
        };
        const contentPackage: ContentPackage = {
          contentType: 'text-only',
          text: 'Test',
          images: [],
        };

        const result = formatLLMRequest(contentPackage, customConfig);

        expect(result.model).toBe('custom-model-v2');
      });

      it('should use custom max_tokens from config', () => {
        const customConfig: LLMConfig = {
          model: 'qwen2vl-email-analyzer',
          maxTokens: 2500,
        };
        const contentPackage: ContentPackage = {
          contentType: 'text-only',
          text: 'Test',
          images: [],
        };

        const result = formatLLMRequest(contentPackage, customConfig);

        expect(result.max_tokens).toBe(2500);
      });

      it('should use both custom model and max_tokens', () => {
        const customConfig: LLMConfig = {
          model: 'gpt-4-vision',
          maxTokens: 500,
        };
        const contentPackage: ContentPackage = {
          contentType: 'text-only',
          text: 'Test',
          images: [],
        };

        const result = formatLLMRequest(contentPackage, customConfig);

        expect(result.model).toBe('gpt-4-vision');
        expect(result.max_tokens).toBe(500);
      });
    });

    describe('Request structure', () => {
      it('should have correct top-level structure', () => {
        const contentPackage: ContentPackage = {
          contentType: 'text-only',
          text: 'Test',
          images: [],
        };

        const result = formatLLMRequest(contentPackage, defaultConfig);

        expect(result).toHaveProperty('model');
        expect(result).toHaveProperty('messages');
        expect(result).toHaveProperty('max_tokens');
        expect(Object.keys(result)).toHaveLength(3);
      });

      it('should have exactly one user message', () => {
        const contentPackage: ContentPackage = {
          contentType: 'text-only',
          text: 'Test',
          images: [],
        };

        const result = formatLLMRequest(contentPackage, defaultConfig);

        expect(result.messages).toHaveLength(1);
        expect(result.messages[0]!.role).toBe('user');
      });

      it('should have content array in message', () => {
        const contentPackage: ContentPackage = {
          contentType: 'text-only',
          text: 'Test',
          images: [],
        };

        const result = formatLLMRequest(contentPackage, defaultConfig);

        expect(Array.isArray(result.messages[0]!.content)).toBe(true);
        expect(result.messages[0]!.content.length).toBeGreaterThan(0);
      });
    });

    describe('Logging', () => {
      it('should log request metadata when logger provided', () => {
        const mockLogger = {
          info: vi.fn(),
        } as any;

        const contentPackage: ContentPackage = {
          contentType: 'hybrid',
          text: 'Test text',
          images: [
            {
              filename: 'test.png',
              contentType: 'image/png',
              dataUrl: 'data:image/png;base64,abc',
            },
          ],
        };

        formatLLMRequest(contentPackage, defaultConfig, mockLogger);

        expect(mockLogger.info).toHaveBeenCalledWith(
          {
            model: 'qwen2vl-email-analyzer',
            contentItems: 2,
            hasText: true,
            imageCount: 1,
          },
          'LLM request formatted'
        );
      });

      it('should not crash when logger not provided', () => {
        const contentPackage: ContentPackage = {
          contentType: 'text-only',
          text: 'Test',
          images: [],
        };

        expect(() => {
          formatLLMRequest(contentPackage, defaultConfig);
        }).not.toThrow();
      });

      it('should log correct metadata for text-only', () => {
        const mockLogger = {
          info: vi.fn(),
        } as any;

        const contentPackage: ContentPackage = {
          contentType: 'text-only',
          text: 'Just text',
          images: [],
        };

        formatLLMRequest(contentPackage, defaultConfig, mockLogger);

        expect(mockLogger.info).toHaveBeenCalledWith(
          expect.objectContaining({
            contentItems: 1,
            hasText: true,
            imageCount: 0,
          }),
          'LLM request formatted'
        );
      });

      it('should log correct metadata for screenshot-only', () => {
        const mockLogger = {
          info: vi.fn(),
        } as any;

        const contentPackage: ContentPackage = {
          contentType: 'screenshot-only',
          text: '',
          images: [
            { filename: 'a.png', contentType: 'image/png', dataUrl: 'data:image/png;base64,a' },
            { filename: 'b.png', contentType: 'image/png', dataUrl: 'data:image/png;base64,b' },
          ],
        };

        formatLLMRequest(contentPackage, defaultConfig, mockLogger);

        expect(mockLogger.info).toHaveBeenCalledWith(
          expect.objectContaining({
            contentItems: 2,
            hasText: false,
            imageCount: 2,
          }),
          'LLM request formatted'
        );
      });
    });
  });

  describe('callLLMAPI', () => {
    const mockRequest: LLMRequest = {
      model: 'qwen2vl-email-analyzer',
      messages: [
        {
          role: 'user',
          content: [{ type: 'text', text: 'Test' }],
        },
      ],
      max_tokens: 1000,
    };

    const mockResponse: LLMResponse = {
      id: 'chat-completion',
      object: 'chat.completion',
      created: 0,
      model: 'qwen2vl-email-analyzer',
      choices: [
        {
          index: 0,
          message: {
            role: 'assistant',
            content: 'Analysis result here',
          },
          finish_reason: 'stop',
        },
      ],
    };

    const apiUrl = 'http://localhost:8001/v1/chat/completions';
    const timeoutMs = 5000;

    let originalFetch: typeof global.fetch;

    beforeEach(() => {
      originalFetch = global.fetch;
      vi.clearAllTimers();
      vi.useFakeTimers();
    });

    afterEach(() => {
      global.fetch = originalFetch;
      vi.useRealTimers();
    });

    describe('Successful API calls', () => {
      it('should successfully call LLM API and return response', async () => {
        global.fetch = vi.fn().mockResolvedValue({
          ok: true,
          status: 200,
          json: async () => mockResponse,
        });

        const result = await callLLMAPI(mockRequest, apiUrl, timeoutMs);

        expect(result).toEqual(mockResponse);
        expect(global.fetch).toHaveBeenCalledWith(apiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(mockRequest),
          signal: expect.any(AbortSignal),
        });
      });

      it('should log successful completion with timing', async () => {
        const mockLogger = {
          info: vi.fn(),
        } as any;

        global.fetch = vi.fn().mockResolvedValue({
          ok: true,
          status: 200,
          json: async () => mockResponse,
        });

        await callLLMAPI(mockRequest, apiUrl, timeoutMs, mockLogger);

        expect(mockLogger.info).toHaveBeenCalledWith(
          expect.objectContaining({
            duration: expect.any(Number),
            statusCode: 200,
            responseId: expect.any(String),
            model: expect.any(String),
            timestamp: expect.any(Number),
            choicesCount: expect.any(Number),
          }),
          'LLM API call completed'
        );
      });

      it('should work without logger', async () => {
        global.fetch = vi.fn().mockResolvedValue({
          ok: true,
          status: 200,
          json: async () => mockResponse,
        });

        const result = await callLLMAPI(mockRequest, apiUrl, timeoutMs);

        expect(result).toEqual(mockResponse);
      });

      it('should parse JSON response correctly', async () => {
        const customResponse = {
          ...mockResponse,
          choices: [
            {
              index: 0,
              message: {
                role: 'assistant' as const,
                content: 'Custom analysis',
              },
              finish_reason: 'stop',
            },
          ],
        };

        global.fetch = vi.fn().mockResolvedValue({
          ok: true,
          status: 200,
          json: async () => customResponse,
        });

        const result = await callLLMAPI(mockRequest, apiUrl, timeoutMs);

        expect(result.choices[0]!.message.content).toBe('Custom analysis');
      });
    });

    describe('HTTP error handling', () => {
      it('should log error details on non-200 status', async () => {
        const mockLogger = {
          error: vi.fn(),
        } as any;

        global.fetch = vi.fn().mockResolvedValue({
          ok: false,
          status: 404,
          text: async () => 'Not Found',
        });

        await expect(
          callLLMAPI(mockRequest, apiUrl, timeoutMs, mockLogger)
        ).rejects.toThrow();

        expect(mockLogger.error).toHaveBeenCalledWith(
          expect.objectContaining({
            statusCode: 404,
            duration: expect.any(Number),
            url: apiUrl,
            errorBody: 'Not Found',
          }),
          'LLM API returned non-200 status'
        );
      });
    });

    describe('Timeout handling', () => {
      it('should timeout after specified duration', { timeout: 5000 }, async () => {
        // Use real timers for timeout test
        vi.useRealTimers();

        const mockLogger = {
          warn: vi.fn(),
        } as any;

        // Use very short timeout for test
        const shortTimeout = 50;

        // Mock fetch that responds to abort signal
        global.fetch = vi.fn().mockImplementation(
          (_url, options) =>
            new Promise((_resolve, reject) => {
              // Listen to abort signal
              if (options?.signal) {
                options.signal.addEventListener('abort', () => {
                  const error = new Error('The operation was aborted');
                  error.name = 'AbortError';
                  reject(error);
                });
              }
              // Never resolve normally
            })
        );

        try {
          await callLLMAPI(mockRequest, apiUrl, shortTimeout, mockLogger);
          expect.fail('Should have thrown LLMError');
        } catch (error) {
          expect(error).toBeInstanceOf(LLMError);
          expect((error as LLMError).code).toBe(LLM_ERROR_CODES.LLM_TIMEOUT);
          expect((error as LLMError).userMessage).toContain('Analysis is taking longer');
        }

        // Restore fake timers
        vi.useFakeTimers();
      });

      it('should log timeout warning', { timeout: 5000 }, async () => {
        // Use real timers for timeout test
        vi.useRealTimers();

        const mockLogger = {
          warn: vi.fn(),
        } as any;

        // Use very short timeout for test
        const shortTimeout = 50;

        // Mock fetch that responds to abort signal
        global.fetch = vi.fn().mockImplementation(
          (_url, options) =>
            new Promise((_resolve, reject) => {
              // Listen to abort signal
              if (options?.signal) {
                options.signal.addEventListener('abort', () => {
                  const error = new Error('The operation was aborted');
                  error.name = 'AbortError';
                  reject(error);
                });
              }
              // Never resolve normally
            })
        );

        await expect(
          callLLMAPI(mockRequest, apiUrl, shortTimeout, mockLogger)
        ).rejects.toThrow();

        expect(mockLogger.warn).toHaveBeenCalledWith(
          expect.objectContaining({
            duration: expect.any(Number),
            url: apiUrl,
          }),
          'LLM API timeout'
        );

        // Restore fake timers
        vi.useFakeTimers();
      });

      it('should clear timeout on successful response', async () => {
        const clearTimeoutSpy = vi.spyOn(global, 'clearTimeout');

        global.fetch = vi.fn().mockResolvedValue({
          ok: true,
          status: 200,
          json: async () => mockResponse,
        });

        await callLLMAPI(mockRequest, apiUrl, timeoutMs);

        expect(clearTimeoutSpy).toHaveBeenCalled();
      });

      it('should clear timeout on error', async () => {
        const clearTimeoutSpy = vi.spyOn(global, 'clearTimeout');

        global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

        await expect(
          callLLMAPI(mockRequest, apiUrl, timeoutMs)
        ).rejects.toThrow();

        expect(clearTimeoutSpy).toHaveBeenCalled();
      });
    });

    describe('Network error handling', () => {
      it('should handle network errors', async () => {
        const networkError = new Error('Failed to fetch');
        global.fetch = vi.fn().mockRejectedValue(networkError);

        try {
          await callLLMAPI(mockRequest, apiUrl, timeoutMs);
          expect.fail('Should have thrown LLMError');
        } catch (error) {
          expect(error).toBeInstanceOf(LLMError);
          expect((error as LLMError).code).toBe(LLM_ERROR_CODES.LLM_NETWORK_ERROR);
          expect((error as LLMError).userMessage).toContain('Unable to reach analysis service');
        }
      });

      it('should log network errors', async () => {
        const mockLogger = {
          error: vi.fn(),
        } as any;

        const networkError = new Error('Connection refused');
        global.fetch = vi.fn().mockRejectedValue(networkError);

        await expect(
          callLLMAPI(mockRequest, apiUrl, timeoutMs, mockLogger)
        ).rejects.toThrow();

        expect(mockLogger.error).toHaveBeenCalledWith(
          expect.objectContaining({
            duration: expect.any(Number),
            url: apiUrl,
            error: 'Connection refused',
          }),
          'LLM API call failed'
        );
      });

      it('should handle DNS resolution errors', async () => {
        const dnsError = new Error('getaddrinfo ENOTFOUND');
        global.fetch = vi.fn().mockRejectedValue(dnsError);

        try {
          await callLLMAPI(mockRequest, apiUrl, timeoutMs);
          expect.fail('Should have thrown LLMError');
        } catch (error) {
          expect(error).toBeInstanceOf(LLMError);
          expect((error as LLMError).code).toBe(LLM_ERROR_CODES.LLM_NETWORK_ERROR);
        }
      });

      it('should handle connection timeout errors', async () => {
        const timeoutError = new Error('ETIMEDOUT');
        global.fetch = vi.fn().mockRejectedValue(timeoutError);

        try {
          await callLLMAPI(mockRequest, apiUrl, timeoutMs);
          expect.fail('Should have thrown LLMError');
        } catch (error) {
          expect(error).toBeInstanceOf(LLMError);
          expect((error as LLMError).code).toBe(LLM_ERROR_CODES.LLM_NETWORK_ERROR);
        }
      });
    });

    describe('Request validation', () => {
      it('should send correct headers', async () => {
        global.fetch = vi.fn().mockResolvedValue({
          ok: true,
          status: 200,
          json: async () => mockResponse,
        });

        await callLLMAPI(mockRequest, apiUrl, timeoutMs);

        expect(global.fetch).toHaveBeenCalledWith(
          apiUrl,
          expect.objectContaining({
            headers: {
              'Content-Type': 'application/json',
            },
          })
        );
      });

      it('should use POST method', async () => {
        global.fetch = vi.fn().mockResolvedValue({
          ok: true,
          status: 200,
          json: async () => mockResponse,
        });

        await callLLMAPI(mockRequest, apiUrl, timeoutMs);

        expect(global.fetch).toHaveBeenCalledWith(
          apiUrl,
          expect.objectContaining({
            method: 'POST',
          })
        );
      });

      it('should send request body as JSON string', async () => {
        global.fetch = vi.fn().mockResolvedValue({
          ok: true,
          status: 200,
          json: async () => mockResponse,
        });

        await callLLMAPI(mockRequest, apiUrl, timeoutMs);

        expect(global.fetch).toHaveBeenCalledWith(
          apiUrl,
          expect.objectContaining({
            body: JSON.stringify(mockRequest),
          })
        );
      });
    });

    describe('Timing tracking', () => {
      it('should track request duration', async () => {
        const mockLogger = {
          info: vi.fn(),
        } as any;

        global.fetch = vi.fn().mockImplementation(async () => {
          // Simulate 100ms delay
          await vi.advanceTimersByTimeAsync(100);
          return {
            ok: true,
            status: 200,
            json: async () => mockResponse,
          };
        });

        await callLLMAPI(mockRequest, apiUrl, timeoutMs, mockLogger);

        expect(mockLogger.info).toHaveBeenCalledWith(
          expect.objectContaining({
            duration: expect.any(Number),
          }),
          'LLM API call completed'
        );
      });

      it('should include duration in error logs', async () => {
        const mockLogger = {
          error: vi.fn(),
        } as any;

        global.fetch = vi.fn().mockRejectedValue(new Error('Test error'));

        await expect(
          callLLMAPI(mockRequest, apiUrl, timeoutMs, mockLogger)
        ).rejects.toThrow();

        expect(mockLogger.error).toHaveBeenCalledWith(
          expect.objectContaining({
            duration: expect.any(Number),
          }),
          'LLM API call failed'
        );
      });
    });
  });

  describe('parseLLMResponse', () => {
    describe('Successful parsing', () => {
      it('should extract feedback from valid response', () => {
        const mockLogger = {
          info: vi.fn(),
        } as any;

        const response = {
          id: 'chatcmpl-123',
          object: 'chat.completion',
          created: 1234567890,
          model: 'email-analyzer',
          choices: [
            {
              index: 0,
              message: {
                role: 'assistant',
                content: 'This is great feedback!',
              },
              finish_reason: 'stop',
            },
          ],
        };

        const result = parseLLMResponse(response, mockLogger);

        expect(result).toBe('This is great feedback!');
        expect(mockLogger.info).toHaveBeenCalledWith(
          {
            feedbackLength: 23,
            choicesCount: 1,
            finishReason: 'stop',
          },
          'LLM response parsed successfully'
        );
      });

      it('should work without logger', () => {
        const response = {
          choices: [
            {
              message: {
                content: 'Feedback without logger',
              },
              finish_reason: 'stop',
            },
          ],
        };

        const result = parseLLMResponse(response);

        expect(result).toBe('Feedback without logger');
      });

      it('should use first choice when multiple choices exist', () => {
        const mockLogger = {
          info: vi.fn(),
        } as any;

        const response = {
          choices: [
            {
              message: {
                content: 'First choice feedback',
              },
              finish_reason: 'stop',
            },
            {
              message: {
                content: 'Second choice feedback',
              },
              finish_reason: 'stop',
            },
          ],
        };

        const result = parseLLMResponse(response, mockLogger);

        expect(result).toBe('First choice feedback');
        expect(mockLogger.info).toHaveBeenCalledWith(
          {
            feedbackLength: 21,
            choicesCount: 2,
            finishReason: 'stop',
          },
          'LLM response parsed successfully'
        );
      });

      it('should preserve whitespace in content', () => {
        const response = {
          choices: [
            {
              message: {
                content: '  Feedback with   spaces\n\nand newlines  ',
              },
              finish_reason: 'stop',
            },
          ],
        };

        const result = parseLLMResponse(response);

        expect(result).toBe('  Feedback with   spaces\n\nand newlines  ');
      });
    });

    describe('Long content handling', () => {
      it('should warn when content exceeds 5000 characters', () => {
        const mockLogger = {
          info: vi.fn(),
          warn: vi.fn(),
        } as any;

        const longContent = 'a'.repeat(6000);
        const response = {
          choices: [
            {
              message: {
                content: longContent,
              },
              finish_reason: 'stop',
            },
          ],
        };

        const result = parseLLMResponse(response, mockLogger);

        expect(result).toBe(longContent);
        expect(mockLogger.warn).toHaveBeenCalledWith(
          { feedbackLength: 6000 },
          'LLM response content is unusually long'
        );
      });

      it('should not warn when content is exactly 5000 characters', () => {
        const mockLogger = {
          info: vi.fn(),
          warn: vi.fn(),
        } as any;

        const content = 'a'.repeat(5000);
        const response = {
          choices: [
            {
              message: {
                content,
              },
            },
          ],
        };

        parseLLMResponse(response, mockLogger);

        expect(mockLogger.warn).not.toHaveBeenCalled();
      });

      it('should not warn when content is under 5000 characters', () => {
        const mockLogger = {
          info: vi.fn(),
          warn: vi.fn(),
        } as any;

        const response = {
          choices: [
            {
              message: {
                content: 'Short feedback',
              },
              finish_reason: 'stop',
            },
          ],
        };

        parseLLMResponse(response, mockLogger);

        expect(mockLogger.warn).not.toHaveBeenCalled();
      });
    });

    describe('Error handling - Invalid structure', () => {
      it('should throw error for missing choices field', () => {
        const mockLogger = {
          error: vi.fn(),
        } as any;

        const response = {
          id: 'chatcmpl-123',
          object: 'chat.completion',
        };

        expect(() => parseLLMResponse(response, mockLogger)).toThrow(
          LLMError
        );
        expect(mockLogger.error).toHaveBeenCalledWith(
          expect.objectContaining({
            error: expect.any(String),
            issues: expect.any(Array),
          }),
          'LLM response validation failed'
        );
      });

      it('should throw error for non-array choices', () => {
        const mockLogger = {
          error: vi.fn(),
        } as any;

        const response = {
          choices: 'not-an-array',
        };

        expect(() => parseLLMResponse(response, mockLogger)).toThrow(
          LLMError
        );
        expect(mockLogger.error).toHaveBeenCalled();
      });

      it('should throw error for missing message field', () => {
        const mockLogger = {
          error: vi.fn(),
        } as any;

        const response = {
          choices: [
            {
              index: 0,
            },
          ],
        };

        expect(() => parseLLMResponse(response, mockLogger)).toThrow(
          LLMError
        );
        expect(mockLogger.error).toHaveBeenCalled();
      });

      it('should throw error for missing content field', () => {
        const mockLogger = {
          error: vi.fn(),
        } as any;

        const response = {
          choices: [
            {
              message: {
                role: 'assistant',
              },
            },
          ],
        };

        expect(() => parseLLMResponse(response, mockLogger)).toThrow(
          LLMError
        );
        expect(mockLogger.error).toHaveBeenCalled();
      });

      it('should throw error for non-string content', () => {
        const mockLogger = {
          error: vi.fn(),
        } as any;

        const response = {
          choices: [
            {
              message: {
                content: 12345,
                            },
              finish_reason: 'stop',
            },
          ],
        };

        expect(() => parseLLMResponse(response, mockLogger)).toThrow(
          LLMError
        );
        expect(mockLogger.error).toHaveBeenCalled();
      });

      it('should throw error for null response', () => {
        const mockLogger = {
          error: vi.fn(),
        } as any;

        expect(() => parseLLMResponse(null, mockLogger)).toThrow(
          LLMError
        );
        expect(mockLogger.error).toHaveBeenCalled();
      });

      it('should throw error for undefined response', () => {
        const mockLogger = {
          error: vi.fn(),
        } as any;

        expect(() => parseLLMResponse(undefined, mockLogger)).toThrow(
          LLMError
        );
        expect(mockLogger.error).toHaveBeenCalled();
      });
    });

    describe('Error handling - Empty content', () => {
      it('should throw error for empty choices array', () => {
        const mockLogger = {
          error: vi.fn(),
        } as any;

        const response = {
          choices: [],
        };

        expect(() => parseLLMResponse(response, mockLogger)).toThrow(
          LLMError
        );
        expect(mockLogger.error).toHaveBeenCalledWith(
          { choicesLength: 0 },
          'LLM response has empty choices array'
        );
      });

      it('should throw error for empty content string', () => {
        const mockLogger = {
          error: vi.fn(),
        } as any;

        const response = {
          choices: [
            {
              message: {
                content: '',
                            },
              finish_reason: 'stop',
            },
          ],
        };

        expect(() => parseLLMResponse(response, mockLogger)).toThrow(
          LLMError
        );
        expect(mockLogger.error).toHaveBeenCalledWith(
          { feedbackLength: 0 },
          'LLM response has empty content string'
        );
      });

      it('should throw error for whitespace-only content', () => {
        const mockLogger = {
          error: vi.fn(),
        } as any;

        const response = {
          choices: [
            {
              message: {
                content: '   \n\t  ',
                            },
              finish_reason: 'stop',
            },
          ],
        };

        expect(() => parseLLMResponse(response, mockLogger)).toThrow(
          LLMError
        );
        expect(mockLogger.error).toHaveBeenCalledWith(
          { feedbackLength: 0 },
          'LLM response has empty content string'
        );
      });
    });

    describe('Logging', () => {
      it('should log metadata without actual content', () => {
        const mockLogger = {
          info: vi.fn(),
        } as any;

        const response = {
          choices: [
            {
              message: {
                content: 'Secret feedback content',
                            },
              finish_reason: 'stop',
                          },
          ],
        };

        parseLLMResponse(response, mockLogger);

        // Verify info log was called
        expect(mockLogger.info).toHaveBeenCalled();

        // Get the logged data
        const loggedData = mockLogger.info.mock.calls[0][0];

        // Verify it contains metadata but not content
        expect(loggedData).toHaveProperty('feedbackLength');
        expect(loggedData).toHaveProperty('choicesCount');
        expect(loggedData).toHaveProperty('finishReason');
        expect(loggedData).not.toHaveProperty('content');
        expect(loggedData).not.toHaveProperty('feedback');

        // Verify the actual content is not in the log call
        const logCallString = JSON.stringify(mockLogger.info.mock.calls);
        expect(logCallString).not.toContain('Secret feedback content');
      });

      it('should include correct metadata values', () => {
        const mockLogger = {
          info: vi.fn(),
        } as any;

        const response = {
          choices: [
            {
              message: {
                content: 'Test',
              },
              finish_reason: 'stop',
            },
            {
              message: {
                content: 'Unused',
              },
              finish_reason: 'length',
            },
          ],
        };

        parseLLMResponse(response, mockLogger);

        expect(mockLogger.info).toHaveBeenCalledWith(
          {
            feedbackLength: 4,
            choicesCount: 2,
            finishReason: 'stop',
          },
          'LLM response parsed successfully'
        );
      });
    });
  });
});
