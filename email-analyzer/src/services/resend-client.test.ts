import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { sendEmail, sendEmailWithRetry, type EmailConfig } from './resend-client';

describe('Resend Email Client', () => {
  const defaultConfig: EmailConfig = {
    apiKey: 'test-api-key-123',
    timeoutMs: 10000,
    fromAddress: 'Test Sender <test@example.com>',
  };

  const testRecipient = 'user@company.com';
  const testSubject = 'Re: Test Subject';
  const testBody = 'This is test feedback content.';

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe('Successful email sending', () => {
    it('should send email successfully and return email ID', async () => {
      const mockEmailId = 'email-abc123-def456';
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ id: mockEmailId }),
      });

      const promise = sendEmail(testRecipient, testSubject, testBody, defaultConfig);
      await vi.runAllTimersAsync();
      const result = await promise;

      expect(result.success).toBe(true);
      expect(result.emailId).toBe(mockEmailId);
      expect(result.error).toBeUndefined();
    });

    it('should make POST request to Resend API with correct headers', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 201,
        json: async () => ({ id: 'test-id' }),
      });

      const promise = sendEmail(testRecipient, testSubject, testBody, defaultConfig);
      await vi.runAllTimersAsync();
      await promise;

      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.resend.com/emails',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Authorization': 'Bearer test-api-key-123',
            'Content-Type': 'application/json',
          },
        })
      );
    });

    it('should include correct fields in request body', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ id: 'test-id' }),
      });

      const promise = sendEmail(testRecipient, testSubject, testBody, defaultConfig);
      await vi.runAllTimersAsync();
      await promise;

      const callArgs = (global.fetch as any).mock.calls[0]!;
      const requestBody = JSON.parse(callArgs[1].body);

      expect(requestBody).toEqual({
        from: 'Test Sender <test@example.com>',
        to: testRecipient,
        subject: testSubject,
        text: testBody,
      });
    });

    it('should use default from address if not provided in config', async () => {
      const configWithoutFrom: EmailConfig = {
        apiKey: 'test-key',
        timeoutMs: 10000,
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ id: 'test-id' }),
      });

      const promise = sendEmail(testRecipient, testSubject, testBody, configWithoutFrom);
      await vi.runAllTimersAsync();
      await promise;

      const callArgs = (global.fetch as any).mock.calls[0]!;
      const requestBody = JSON.parse(callArgs[1].body);

      expect(requestBody.from).toBe('Email Analyzer <noreply@yourdomain.com>');
    });

    it('should log success metadata without email body', async () => {
      const mockLogger = {
        info: vi.fn(),
      } as any;

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ id: 'email-123' }),
      });

      const promise = sendEmail(testRecipient, testSubject, testBody, defaultConfig, mockLogger);
      await vi.runAllTimersAsync();
      await promise;

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          to: testRecipient,
          subject: testSubject,
          emailId: 'email-123',
          duration: expect.any(Number),
        }),
        'Email sent via Resend'
      );

      // Verify body content is NOT logged
      const logCall = mockLogger.info.mock.calls[0]!;
      expect(logCall[0]!.text).toBeUndefined();
      expect(logCall[0]!.body).toBeUndefined();
    });
  });

  describe('HTTP error handling', () => {
    it('should handle 400 Bad Request error', async () => {
      const mockLogger = {
        error: vi.fn(),
      } as any;

      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        text: async () => 'Invalid email format',
      });

      const promise = sendEmail(testRecipient, testSubject, testBody, defaultConfig, mockLogger);
      await vi.runAllTimersAsync();
      const result = await promise;

      expect(result.success).toBe(false);
      expect(result.error).toContain('400');
      expect(result.error).toContain('Invalid email format');
      expect(result.emailId).toBeUndefined();
    });

    it('should handle 401 Unauthorized error', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        text: async () => 'Invalid API key',
      });

      const promise = sendEmail(testRecipient, testSubject, testBody, defaultConfig);
      await vi.runAllTimersAsync();
      const result = await promise;

      expect(result.success).toBe(false);
      expect(result.error).toContain('401');
      expect(result.error).toContain('Invalid API key');
    });

    it('should handle 500 Internal Server Error', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        text: async () => 'Internal server error',
      });

      const promise = sendEmail(testRecipient, testSubject, testBody, defaultConfig);
      await vi.runAllTimersAsync();
      const result = await promise;

      expect(result.success).toBe(false);
      expect(result.error).toContain('500');
    });

    it('should log HTTP error details', async () => {
      const mockLogger = {
        error: vi.fn(),
      } as any;

      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
        text: async () => 'Forbidden',
      });

      const promise = sendEmail(testRecipient, testSubject, testBody, defaultConfig, mockLogger);
      await vi.runAllTimersAsync();
      await promise;

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          to: testRecipient,
          subject: testSubject,
          statusCode: 403,
          errorBody: 'Forbidden',
          duration: expect.any(Number),
        }),
        'Email send failed'
      );
    });
  });

  describe('Timeout handling', () => {
    it('should handle abort errors as timeout', async () => {
      const mockLogger = {
        warn: vi.fn(),
      } as any;

      const abortError = new Error('The operation was aborted');
      abortError.name = 'AbortError';

      global.fetch = vi.fn().mockRejectedValue(abortError);

      const promise = sendEmail(testRecipient, testSubject, testBody, defaultConfig, mockLogger);
      await vi.runAllTimersAsync();
      const result = await promise;

      expect(result.success).toBe(false);
      expect(result.error).toContain('timeout');
      expect(result.error).toContain('10000ms');
      expect(result.emailId).toBeUndefined();
    });

    it('should log timeout warning with details', async () => {
      const mockLogger = {
        warn: vi.fn(),
      } as any;

      const abortError = new Error('The operation was aborted');
      abortError.name = 'AbortError';

      global.fetch = vi.fn().mockRejectedValue(abortError);

      const promise = sendEmail(testRecipient, testSubject, testBody, defaultConfig, mockLogger);
      await vi.runAllTimersAsync();
      await promise;

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.objectContaining({
          to: testRecipient,
          subject: testSubject,
          duration: expect.any(Number),
          timeoutMs: 10000,
        }),
        expect.stringContaining('timeout')
      );
    });

    it('should use custom timeout from config', async () => {
      const customConfig: EmailConfig = {
        ...defaultConfig,
        timeoutMs: 5000,
      };

      const abortError = new Error('The operation was aborted');
      abortError.name = 'AbortError';

      global.fetch = vi.fn().mockRejectedValue(abortError);

      const promise = sendEmail(testRecipient, testSubject, testBody, customConfig);
      await vi.runAllTimersAsync();
      const result = await promise;

      expect(result.success).toBe(false);
      expect(result.error).toContain('5000ms');
    });
  });

  describe('Network error handling', () => {
    it('should handle network errors', async () => {
      const mockLogger = {
        error: vi.fn(),
      } as any;

      global.fetch = vi.fn().mockRejectedValue(new Error('Network connection failed'));

      const promise = sendEmail(testRecipient, testSubject, testBody, defaultConfig, mockLogger);
      await vi.runAllTimersAsync();
      const result = await promise;

      expect(result.success).toBe(false);
      expect(result.error).toContain('Network connection failed');
      expect(result.emailId).toBeUndefined();
    });

    it('should log network error details', async () => {
      const mockLogger = {
        error: vi.fn(),
      } as any;

      global.fetch = vi.fn().mockRejectedValue(new Error('DNS lookup failed'));

      const promise = sendEmail(testRecipient, testSubject, testBody, defaultConfig, mockLogger);
      await vi.runAllTimersAsync();
      await promise;

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          to: testRecipient,
          subject: testSubject,
          duration: expect.any(Number),
          error: 'DNS lookup failed',
        }),
        'Email send failed'
      );
    });

    it('should handle non-Error exceptions', async () => {
      global.fetch = vi.fn().mockRejectedValue('String error');

      const promise = sendEmail(testRecipient, testSubject, testBody, defaultConfig);
      await vi.runAllTimersAsync();
      const result = await promise;

      expect(result.success).toBe(false);
      expect(result.error).toBe('String error');
    });
  });

  describe('Timing tracking', () => {
    it('should track duration of successful sends', async () => {
      const mockLogger = {
        info: vi.fn(),
      } as any;

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ id: 'test-id' }),
      });

      const promise = sendEmail(testRecipient, testSubject, testBody, defaultConfig, mockLogger);
      await vi.runAllTimersAsync();
      await promise;

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          duration: expect.any(Number),
        }),
        'Email sent via Resend'
      );

      const duration = mockLogger.info.mock.calls[0]![0]!.duration;
      expect(duration).toBeGreaterThanOrEqual(0);
    });

    it('should track duration of failed sends', async () => {
      const mockLogger = {
        error: vi.fn(),
      } as any;

      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        text: async () => 'Server error',
      });

      const promise = sendEmail(testRecipient, testSubject, testBody, defaultConfig, mockLogger);
      await vi.runAllTimersAsync();
      await promise;

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          duration: expect.any(Number),
        }),
        'Email send failed'
      );
    });
  });

  describe('Logging behavior', () => {
    it('should work without logger (no errors)', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ id: 'test-id' }),
      });

      const promise = sendEmail(testRecipient, testSubject, testBody, defaultConfig);
      await vi.runAllTimersAsync();

      // Should not throw
      await expect(promise).resolves.toMatchObject({
        success: true,
      });
    });

    it('should not log email body content in any scenario', async () => {
      const mockLogger = {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      } as any;

      // Test success case
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ id: 'test-id' }),
      });

      const promise1 = sendEmail(testRecipient, testSubject, testBody, defaultConfig, mockLogger);
      await vi.runAllTimersAsync();
      await promise1;

      // Check all log calls
      const allCalls = [
        ...mockLogger.info.mock.calls,
        ...mockLogger.warn.mock.calls,
        ...mockLogger.error.mock.calls,
      ];

      allCalls.forEach((call) => {
        const logData = call[0];
        expect(logData).not.toHaveProperty('text');
        expect(logData).not.toHaveProperty('body');
        // Check that the actual body content is not anywhere in the logged data
        if (typeof logData === 'object') {
          const stringified = JSON.stringify(logData);
          expect(stringified).not.toContain(testBody);
        }
      });
    });
  });

  describe('sendEmailWithRetry', () => {
    describe('Success on first attempt', () => {
      it('should send successfully without retry', async () => {
        const mockLogger = {
          info: vi.fn(),
          warn: vi.fn(),
          error: vi.fn(),
        } as any;

        global.fetch = vi.fn().mockResolvedValue({
          ok: true,
          status: 200,
          json: async () => ({ id: 'email-123' }),
        });

        const promise = sendEmailWithRetry(testRecipient, testSubject, testBody, defaultConfig, mockLogger);
        await vi.runAllTimersAsync();
        const result = await promise;

        expect(result.success).toBe(true);
        expect(result.emailId).toBe('email-123');
        expect(mockLogger.warn).not.toHaveBeenCalled();
        expect(mockLogger.error).not.toHaveBeenCalled();
      });

      it('should not call sendEmail twice on success', async () => {
        global.fetch = vi.fn().mockResolvedValue({
          ok: true,
          status: 200,
          json: async () => ({ id: 'test-id' }),
        });

        const promise = sendEmailWithRetry(testRecipient, testSubject, testBody, defaultConfig);
        await vi.runAllTimersAsync();
        await promise;

        // Should only be called once
        expect(global.fetch).toHaveBeenCalledTimes(1);
      });
    });

    describe('Retry on retryable errors', () => {
      it('should retry on timeout error', async () => {
        const mockLogger = {
          info: vi.fn(),
          warn: vi.fn(),
          error: vi.fn(),
        } as any;

        const abortError = new Error('The operation was aborted');
        abortError.name = 'AbortError';

        // First attempt: timeout
        global.fetch = vi.fn()
          .mockRejectedValueOnce(abortError)
          .mockResolvedValueOnce({
            ok: true,
            status: 200,
            json: async () => ({ id: 'retry-success-123' }),
          });

        const promise = sendEmailWithRetry(testRecipient, testSubject, testBody, defaultConfig, mockLogger);
        await vi.runAllTimersAsync();
        const result = await promise;

        expect(result.success).toBe(true);
        expect(result.emailId).toBe('retry-success-123');
        expect(global.fetch).toHaveBeenCalledTimes(2);
      });

      it('should retry on 5xx server error', async () => {
        const mockLogger = {
          info: vi.fn(),
          warn: vi.fn(),
          error: vi.fn(),
        } as any;

        // First attempt: 500 error, Second attempt: success
        global.fetch = vi.fn()
          .mockResolvedValueOnce({
            ok: false,
            status: 500,
            text: async () => 'Internal server error',
          })
          .mockResolvedValueOnce({
            ok: true,
            status: 200,
            json: async () => ({ id: 'retry-success-500' }),
          });

        const promise = sendEmailWithRetry(testRecipient, testSubject, testBody, defaultConfig, mockLogger);
        await vi.runAllTimersAsync();
        const result = await promise;

        expect(result.success).toBe(true);
        expect(result.emailId).toBe('retry-success-500');
        expect(global.fetch).toHaveBeenCalledTimes(2);
      });

      it('should retry on 503 service unavailable', async () => {
        const mockLogger = {
          info: vi.fn(),
          warn: vi.fn(),
          error: vi.fn(),
        } as any;

        global.fetch = vi.fn()
          .mockResolvedValueOnce({
            ok: false,
            status: 503,
            text: async () => 'Service unavailable',
          })
          .mockResolvedValueOnce({
            ok: true,
            status: 200,
            json: async () => ({ id: 'retry-success-503' }),
          });

        const promise = sendEmailWithRetry(testRecipient, testSubject, testBody, defaultConfig, mockLogger);
        await vi.runAllTimersAsync();
        const result = await promise;

        expect(result.success).toBe(true);
        expect(global.fetch).toHaveBeenCalledTimes(2);
      });

      it('should retry on network error', async () => {
        const mockLogger = {
          info: vi.fn(),
          warn: vi.fn(),
          error: vi.fn(),
        } as any;

        global.fetch = vi.fn()
          .mockRejectedValueOnce(new Error('Network connection failed'))
          .mockResolvedValueOnce({
            ok: true,
            status: 200,
            json: async () => ({ id: 'retry-success-network' }),
          });

        const promise = sendEmailWithRetry(testRecipient, testSubject, testBody, defaultConfig, mockLogger);
        await vi.runAllTimersAsync();
        const result = await promise;

        expect(result.success).toBe(true);
        expect(global.fetch).toHaveBeenCalledTimes(2);
      });

      it('should log retry warning on first failure', async () => {
        const mockLogger = {
          info: vi.fn(),
          warn: vi.fn(),
          error: vi.fn(),
        } as any;

        global.fetch = vi.fn()
          .mockResolvedValueOnce({
            ok: false,
            status: 500,
            text: async () => 'Server error',
          })
          .mockResolvedValueOnce({
            ok: true,
            status: 200,
            json: async () => ({ id: 'test-id' }),
          });

        const promise = sendEmailWithRetry(testRecipient, testSubject, testBody, defaultConfig, mockLogger);
        await vi.runAllTimersAsync();
        await promise;

        expect(mockLogger.warn).toHaveBeenCalledWith(
          {
            to: testRecipient,
            attempt: 1,
            error: expect.stringContaining('500'),
          },
          'Email send failed, retrying'
        );
      });

      it('should log success on retry', async () => {
        const mockLogger = {
          info: vi.fn(),
          warn: vi.fn(),
          error: vi.fn(),
        } as any;

        global.fetch = vi.fn()
          .mockResolvedValueOnce({
            ok: false,
            status: 503,
            text: async () => 'Service unavailable',
          })
          .mockResolvedValueOnce({
            ok: true,
            status: 200,
            json: async () => ({ id: 'retry-id' }),
          });

        const promise = sendEmailWithRetry(testRecipient, testSubject, testBody, defaultConfig, mockLogger);
        await vi.runAllTimersAsync();
        await promise;

        expect(mockLogger.info).toHaveBeenCalledWith(
          {
            to: testRecipient,
            attempt: 2,
            totalDuration: expect.any(Number),
          },
          'Email sent on retry'
        );
      });

      it('should wait 1 second before retry', async () => {
        const sleepSpy = vi.spyOn(global, 'setTimeout');

        global.fetch = vi.fn()
          .mockResolvedValueOnce({
            ok: false,
            status: 500,
            text: async () => 'Error',
          })
          .mockResolvedValueOnce({
            ok: true,
            status: 200,
            json: async () => ({ id: 'test-id' }),
          });

        const promise = sendEmailWithRetry(testRecipient, testSubject, testBody, defaultConfig);
        await vi.runAllTimersAsync();
        await promise;

        // Check that setTimeout was called with 1000ms
        const sleepCalls = sleepSpy.mock.calls.filter(call => call[1] === 1000);
        expect(sleepCalls.length).toBeGreaterThan(0);
      });
    });

    describe('No retry on non-retryable errors', () => {
      it('should not retry on 400 bad request', async () => {
        const mockLogger = {
          info: vi.fn(),
          warn: vi.fn(),
          error: vi.fn(),
        } as any;

        global.fetch = vi.fn().mockResolvedValue({
          ok: false,
          status: 400,
          text: async () => 'Bad request',
        });

        const promise = sendEmailWithRetry(testRecipient, testSubject, testBody, defaultConfig, mockLogger);
        await vi.runAllTimersAsync();
        const result = await promise;

        expect(result.success).toBe(false);
        expect(global.fetch).toHaveBeenCalledTimes(1);
        // No retry warning should be logged
        expect(mockLogger.warn).not.toHaveBeenCalled();
        // No permanent failure error should be logged (only the initial sendEmail error)
        const permanentFailureCalls = mockLogger.error.mock.calls.filter(
          (call: any) => call[1] === 'Email send permanently failed'
        );
        expect(permanentFailureCalls.length).toBe(0);
      });

      it('should not retry on 401 unauthorized', async () => {
        const mockLogger = {
          info: vi.fn(),
          warn: vi.fn(),
          error: vi.fn(),
        } as any;

        global.fetch = vi.fn().mockResolvedValue({
          ok: false,
          status: 401,
          text: async () => 'Invalid API key',
        });

        const promise = sendEmailWithRetry(testRecipient, testSubject, testBody, defaultConfig, mockLogger);
        await vi.runAllTimersAsync();
        const result = await promise;

        expect(result.success).toBe(false);
        expect(global.fetch).toHaveBeenCalledTimes(1);
      });

      it('should not retry on 403 forbidden', async () => {
        global.fetch = vi.fn().mockResolvedValue({
          ok: false,
          status: 403,
          text: async () => 'Forbidden',
        });

        const promise = sendEmailWithRetry(testRecipient, testSubject, testBody, defaultConfig);
        await vi.runAllTimersAsync();
        const result = await promise;

        expect(result.success).toBe(false);
        expect(global.fetch).toHaveBeenCalledTimes(1);
      });

      it('should return error immediately for 4xx', async () => {
        const mockLogger = {
          info: vi.fn(),
          warn: vi.fn(),
          error: vi.fn(),
        } as any;

        global.fetch = vi.fn().mockResolvedValue({
          ok: false,
          status: 422,
          text: async () => 'Unprocessable entity',
        });

        const promise = sendEmailWithRetry(testRecipient, testSubject, testBody, defaultConfig, mockLogger);
        await vi.runAllTimersAsync();
        const result = await promise;

        expect(result.success).toBe(false);
        expect(result.error).toContain('422');
        expect(mockLogger.warn).not.toHaveBeenCalled();
      });
    });

    describe('Both attempts fail', () => {
      it('should return failure when both attempts fail', async () => {
        const mockLogger = {
          info: vi.fn(),
          warn: vi.fn(),
          error: vi.fn(),
        } as any;

        global.fetch = vi.fn()
          .mockResolvedValueOnce({
            ok: false,
            status: 500,
            text: async () => 'First error',
          })
          .mockResolvedValueOnce({
            ok: false,
            status: 503,
            text: async () => 'Second error',
          });

        const promise = sendEmailWithRetry(testRecipient, testSubject, testBody, defaultConfig, mockLogger);
        await vi.runAllTimersAsync();
        const result = await promise;

        expect(result.success).toBe(false);
        expect(result.error).toContain('503');
        expect(global.fetch).toHaveBeenCalledTimes(2);
      });

      it('should log permanent failure after both attempts', async () => {
        const mockLogger = {
          info: vi.fn(),
          warn: vi.fn(),
          error: vi.fn(),
        } as any;

        global.fetch = vi.fn()
          .mockResolvedValueOnce({
            ok: false,
            status: 500,
            text: async () => 'Error 1',
          })
          .mockResolvedValueOnce({
            ok: false,
            status: 500,
            text: async () => 'Error 2',
          });

        const promise = sendEmailWithRetry(testRecipient, testSubject, testBody, defaultConfig, mockLogger);
        await vi.runAllTimersAsync();
        await promise;

        expect(mockLogger.error).toHaveBeenCalledWith(
          {
            to: testRecipient,
            attempts: 2,
            lastError: expect.stringContaining('500'),
            totalDuration: expect.any(Number),
          },
          'Email send permanently failed'
        );
      });

      it('should log both warning and error when both fail', async () => {
        const mockLogger = {
          info: vi.fn(),
          warn: vi.fn(),
          error: vi.fn(),
        } as any;

        global.fetch = vi.fn().mockResolvedValue({
          ok: false,
          status: 500,
          text: async () => 'Server error',
        });

        const promise = sendEmailWithRetry(testRecipient, testSubject, testBody, defaultConfig, mockLogger);
        await vi.runAllTimersAsync();
        await promise;

        expect(mockLogger.warn).toHaveBeenCalledWith(
          expect.objectContaining({
            to: testRecipient,
            attempt: 1,
          }),
          'Email send failed, retrying'
        );

        expect(mockLogger.error).toHaveBeenCalledWith(
          expect.objectContaining({
            to: testRecipient,
            attempts: 2,
          }),
          'Email send permanently failed'
        );
      });
    });

    describe('Total duration tracking', () => {
      it('should track total duration including retry delay', async () => {
        const mockLogger = {
          info: vi.fn(),
          warn: vi.fn(),
          error: vi.fn(),
        } as any;

        global.fetch = vi.fn()
          .mockResolvedValueOnce({
            ok: false,
            status: 500,
            text: async () => 'Error',
          })
          .mockResolvedValueOnce({
            ok: true,
            status: 200,
            json: async () => ({ id: 'test-id' }),
          });

        const promise = sendEmailWithRetry(testRecipient, testSubject, testBody, defaultConfig, mockLogger);
        await vi.runAllTimersAsync();
        await promise;

        const logCall = mockLogger.info.mock.calls.find((call: any) =>
          call[1] === 'Email sent on retry'
        );
        expect(logCall).toBeDefined();
        expect(logCall![0]!.totalDuration).toBeGreaterThan(0);
      });

      it('should track total duration when both attempts fail', async () => {
        const mockLogger = {
          info: vi.fn(),
          warn: vi.fn(),
          error: vi.fn(),
        } as any;

        global.fetch = vi.fn().mockResolvedValue({
          ok: false,
          status: 500,
          text: async () => 'Error',
        });

        const promise = sendEmailWithRetry(testRecipient, testSubject, testBody, defaultConfig, mockLogger);
        await vi.runAllTimersAsync();
        await promise;

        expect(mockLogger.error).toHaveBeenCalledWith(
          expect.objectContaining({
            totalDuration: expect.any(Number),
          }),
          'Email send permanently failed'
        );
      });
    });

    describe('Edge cases', () => {
      it('should work without logger', async () => {
        global.fetch = vi.fn()
          .mockResolvedValueOnce({
            ok: false,
            status: 500,
            text: async () => 'Error',
          })
          .mockResolvedValueOnce({
            ok: true,
            status: 200,
            json: async () => ({ id: 'test-id' }),
          });

        const promise = sendEmailWithRetry(testRecipient, testSubject, testBody, defaultConfig);
        await vi.runAllTimersAsync();

        // Should not throw
        await expect(promise).resolves.toMatchObject({
          success: true,
        });
      });

      it('should handle timeout on first attempt, success on second', async () => {
        const abortError = new Error('The operation was aborted');
        abortError.name = 'AbortError';

        global.fetch = vi.fn()
          .mockRejectedValueOnce(abortError)
          .mockResolvedValueOnce({
            ok: true,
            status: 200,
            json: async () => ({ id: 'timeout-retry-success' }),
          });

        const promise = sendEmailWithRetry(testRecipient, testSubject, testBody, defaultConfig);
        await vi.runAllTimersAsync();
        const result = await promise;

        expect(result.success).toBe(true);
        expect(result.emailId).toBe('timeout-retry-success');
      });

      it('should handle timeout on both attempts', async () => {
        const abortError = new Error('The operation was aborted');
        abortError.name = 'AbortError';

        global.fetch = vi.fn().mockRejectedValue(abortError);

        const promise = sendEmailWithRetry(testRecipient, testSubject, testBody, defaultConfig);
        await vi.runAllTimersAsync();
        const result = await promise;

        expect(result.success).toBe(false);
        expect(result.error).toContain('timeout');
        expect(global.fetch).toHaveBeenCalledTimes(2);
      });
    });
  });
});
