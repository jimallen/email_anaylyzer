import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

describe('Configuration Management', () => {
  const configDir = join(process.cwd(), 'config');
  const settingsPath = join(configDir, 'settings.json');
  const whitelistPath = join(configDir, 'whitelist.json');

  beforeAll(() => {
    // Ensure RESEND_API_KEY is set for tests
    process.env.RESEND_API_KEY = process.env.RESEND_API_KEY || 'test_api_key_12345';
  });

  describe('Configuration Files Exist', () => {
    it('should have settings.json file', () => {
      expect(() => readFileSync(settingsPath, 'utf-8')).not.toThrow();
    });

    it('should have whitelist.json file', () => {
      expect(() => readFileSync(whitelistPath, 'utf-8')).not.toThrow();
    });

    it('should have valid JSON in settings.json', () => {
      const content = readFileSync(settingsPath, 'utf-8');
      expect(() => JSON.parse(content)).not.toThrow();
    });

    it('should have valid JSON in whitelist.json', () => {
      const content = readFileSync(whitelistPath, 'utf-8');
      expect(() => JSON.parse(content)).not.toThrow();
    });
  });

  describe('Settings JSON Structure', () => {
    it('should contain all required timeout and limit settings', () => {
      const content = readFileSync(settingsPath, 'utf-8');
      const settings = JSON.parse(content);

      expect(settings).toHaveProperty('llm_timeout_ms');
      expect(settings).toHaveProperty('max_tokens');
      expect(settings).toHaveProperty('max_image_size_bytes');
      expect(settings).toHaveProperty('resend_timeout_ms');
      expect(settings).toHaveProperty('image_download_timeout_ms');
    });

    it('should have correct default values', () => {
      const content = readFileSync(settingsPath, 'utf-8');
      const settings = JSON.parse(content);

      expect(settings.llm_timeout_ms).toBe(25000);
      expect(settings.max_tokens).toBe(1000);
      expect(settings.max_image_size_bytes).toBe(10485760);
      expect(settings.resend_timeout_ms).toBe(10000);
      expect(settings.image_download_timeout_ms).toBe(10000);
    });

    it('should use snake_case naming convention', () => {
      const content = readFileSync(settingsPath, 'utf-8');
      const settings = JSON.parse(content);

      // Verify snake_case (not camelCase)
      expect(settings).toHaveProperty('llm_timeout_ms');
      expect(settings).not.toHaveProperty('llmTimeoutMs');
    });
  });

  describe('Whitelist JSON Structure', () => {
    it('should contain allowed_emails and allowed_domains arrays', () => {
      const content = readFileSync(whitelistPath, 'utf-8');
      const whitelist = JSON.parse(content);

      expect(whitelist).toHaveProperty('allowed_emails');
      expect(whitelist).toHaveProperty('allowed_domains');
      expect(Array.isArray(whitelist.allowed_emails)).toBe(true);
      expect(Array.isArray(whitelist.allowed_domains)).toBe(true);
    });
  });

  describe('Environment Variables Documentation', () => {
    it('should have .env.example file', () => {
      const envExamplePath = join(process.cwd(), '.env.example');
      expect(() => readFileSync(envExamplePath, 'utf-8')).not.toThrow();
    });

    it('.env.example should document all required variables', () => {
      const envExamplePath = join(process.cwd(), '.env.example');
      const content = readFileSync(envExamplePath, 'utf-8');

      expect(content).toContain('RESEND_API_KEY');
      expect(content).toContain('SPARKY_LLM_URL');
      expect(content).toContain('NODE_ENV');
      expect(content).toContain('PORT');
    });

    it('.env.example should include default values', () => {
      const envExamplePath = join(process.cwd(), '.env.example');
      const content = readFileSync(envExamplePath, 'utf-8');

      expect(content).toContain('https://sparky.tail468b81.ts.net/v1/chat/completions');
      expect(content).toContain('production');
      expect(content).toContain('3000');
    });
  });

  describe('Config Module Integration', () => {
    it('should export config object when RESEND_API_KEY is set', async () => {
      // This test verifies the module can be imported when env is valid
      const { config } = await import('./config.js');

      expect(config).toBeDefined();
      expect(config).toHaveProperty('resendApiKey');
      expect(config).toHaveProperty('sparkyLlmUrl');
      expect(config).toHaveProperty('nodeEnv');
      expect(config).toHaveProperty('port');
    });

    it('should have all configuration properties with correct types', async () => {
      const { config } = await import('./config.js');

      // Environment variables
      expect(typeof config.resendApiKey).toBe('string');
      expect(typeof config.sparkyLlmUrl).toBe('string');
      expect(typeof config.nodeEnv).toBe('string');
      expect(typeof config.port).toBe('number');

      // Settings
      expect(typeof config.llmTimeoutMs).toBe('number');
      expect(typeof config.maxTokens).toBe('number');
      expect(typeof config.maxImageSizeBytes).toBe('number');
      expect(typeof config.resendTimeoutMs).toBe('number');
      expect(typeof config.imageDownloadTimeoutMs).toBe('number');

      // Whitelist
      expect(config.whitelist).toBeDefined();
      expect(Array.isArray(config.whitelist.allowedEmails)).toBe(true);
      expect(Array.isArray(config.whitelist.allowedDomains)).toBe(true);
    });

    it('should use camelCase for exported config properties', async () => {
      const { config } = await import('./config.js');

      // Verify camelCase naming in exported config
      expect(config).toHaveProperty('llmTimeoutMs');
      expect(config).toHaveProperty('maxTokens');
      expect(config).toHaveProperty('maxImageSizeBytes');
      expect(config.whitelist).toHaveProperty('allowedEmails');
      expect(config.whitelist).toHaveProperty('allowedDomains');
    });

    it('should load configuration values correctly', async () => {
      const { config } = await import('./config.js');

      // Verify values match expected defaults or env vars
      expect(config.llmTimeoutMs).toBe(25000);
      expect(config.maxTokens).toBe(1000);
      expect(config.maxImageSizeBytes).toBe(10485760);
      expect(config.resendTimeoutMs).toBe(10000);
      expect(config.imageDownloadTimeoutMs).toBe(10000);
    });
  });
});
