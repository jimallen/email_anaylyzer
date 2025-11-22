import { z } from 'zod';
import { readFileSync } from 'fs';
import { join } from 'path';

// Environment variable schema
const EnvSchema = z.object({
  RESEND_API_KEY: z.string().min(1, 'RESEND_API_KEY is required'),
  SPARKY_LLM_URL: z.string().url('SPARKY_LLM_URL must be a valid URL').default('http://localhost:8001/v1/chat/completions'),
  NODE_ENV: z.enum(['development', 'staging', 'production', 'test']).default('production'),
  PORT: z.coerce.number().positive('PORT must be a positive number').default(3000),
});

// Settings JSON schema
const SettingsSchema = z.object({
  llm_model: z.string().min(1, 'llm_model cannot be empty').default('qwen2vl-email-analyzer'),
  llm_timeout_ms: z.number().positive('llm_timeout_ms must be positive').default(25000),
  max_tokens: z.number().positive('max_tokens must be positive').default(1000),
  max_image_size_bytes: z.number().positive('max_image_size_bytes must be positive').default(10485760),
  resend_timeout_ms: z.number().positive('resend_timeout_ms must be positive').default(10000),
  image_download_timeout_ms: z.number().positive('image_download_timeout_ms must be positive').default(10000),
});

// Whitelist JSON schema
const WhitelistSchema = z.object({
  allowed_emails: z.array(z.string().email('Invalid email format in allowed_emails')).default([]),
  allowed_domains: z.array(z.string().min(1, 'Domain cannot be empty')).default([]),
});

// Configuration type (inferred from schemas)
export type Config = {
  resendApiKey: string;
  sparkyLlmUrl: string;
  nodeEnv: 'development' | 'staging' | 'production' | 'test';
  port: number;
  llmModel: string;
  llmTimeoutMs: number;
  maxTokens: number;
  maxImageSizeBytes: number;
  resendTimeoutMs: number;
  imageDownloadTimeoutMs: number;
  whitelist: {
    allowedEmails: string[];
    allowedDomains: string[];
  };
};

/**
 * Load and validate configuration from environment variables and JSON files
 * @throws {Error} If configuration is invalid or required fields are missing
 */
function loadConfig(): Config {
  try {
    // Validate environment variables
    const envResult = EnvSchema.safeParse(process.env);
    if (!envResult.success) {
      const errors = envResult.error.issues.map((e) => `${e.path.join('.')}: ${e.message}`).join('; ');
      throw new Error(`Environment variable validation failed: ${errors}`);
    }
    const env = envResult.data;

    // Load and validate settings.json
    const settingsPath = join(process.cwd(), 'config', 'settings.json');
    let settings;
    try {
      const settingsRaw = readFileSync(settingsPath, 'utf-8');
      const settingsParsed = JSON.parse(settingsRaw);
      const settingsResult = SettingsSchema.safeParse(settingsParsed);
      if (!settingsResult.success) {
        const errors = settingsResult.error.issues.map((e) => `${e.path.join('.')}: ${e.message}`).join('; ');
        throw new Error(`Settings validation failed: ${errors}`);
      }
      settings = settingsResult.data;
    } catch (error) {
      if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
        throw new Error(`Configuration file not found: ${settingsPath}`);
      }
      throw error;
    }

    // Load and validate whitelist.json
    const whitelistPath = join(process.cwd(), 'config', 'whitelist.json');
    let whitelist;
    try {
      const whitelistRaw = readFileSync(whitelistPath, 'utf-8');
      const whitelistParsed = JSON.parse(whitelistRaw);
      const whitelistResult = WhitelistSchema.safeParse(whitelistParsed);
      if (!whitelistResult.success) {
        const errors = whitelistResult.error.issues.map((e) => `${e.path.join('.')}: ${e.message}`).join('; ');
        throw new Error(`Whitelist validation failed: ${errors}`);
      }
      whitelist = whitelistResult.data;
    } catch (error) {
      if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
        throw new Error(`Configuration file not found: ${whitelistPath}`);
      }
      throw error;
    }

    // Return unified configuration object with camelCase keys
    return {
      resendApiKey: env.RESEND_API_KEY,
      sparkyLlmUrl: env.SPARKY_LLM_URL,
      nodeEnv: env.NODE_ENV,
      port: env.PORT,
      llmModel: settings.llm_model,
      llmTimeoutMs: settings.llm_timeout_ms,
      maxTokens: settings.max_tokens,
      maxImageSizeBytes: settings.max_image_size_bytes,
      resendTimeoutMs: settings.resend_timeout_ms,
      imageDownloadTimeoutMs: settings.image_download_timeout_ms,
      whitelist: {
        allowedEmails: whitelist.allowed_emails,
        allowedDomains: whitelist.allowed_domains,
      },
    };
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Configuration loading failed: ${error.message}`);
    }
    throw error;
  }
}

// Load configuration on module import (fails fast if config is invalid)
export const config = loadConfig();
