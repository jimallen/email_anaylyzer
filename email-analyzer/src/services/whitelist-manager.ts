import { z } from 'zod';
import { readFileSync, watch, type FSWatcher } from 'fs';
import { join } from 'path';
import type { FastifyBaseLogger } from 'fastify';

/**
 * Whitelist Manager - Hot-reload capability for whitelist configuration
 *
 * Monitors config/whitelist.json for changes and reloads configuration
 * without service restart. Debounces file changes and validates before applying.
 */

// Whitelist schema (stricter than config.ts - rejects unknown keys)
const WhitelistSchema = z.object({
  allowed_emails: z.array(z.string().email('Invalid email format in allowed_emails')),
  allowed_domains: z.array(z.string().min(1, 'Domain cannot be empty')),
}).strict();

export type Whitelist = {
  allowedEmails: string[];
  allowedDomains: string[];
};

export class WhitelistManager {
  private whitelist: Whitelist;
  private whitelistPath: string;
  private watcher: FSWatcher | null = null;
  private debounceTimer: NodeJS.Timeout | null = null;
  private logger: FastifyBaseLogger | null = null;

  constructor(whitelistPath?: string) {
    this.whitelistPath = whitelistPath || join(process.cwd(), 'config', 'whitelist.json');
    this.whitelist = this.loadWhitelistSync();
  }

  /**
   * Get current whitelist configuration
   */
  getWhitelist(): Whitelist {
    return this.whitelist;
  }

  /**
   * Set whitelist directly (for testing purposes)
   * @param whitelist - Whitelist configuration to set
   */
  setWhitelist(whitelist: Whitelist): void {
    this.whitelist = whitelist;
  }

  /**
   * Start watching whitelist file for changes
   * Changes are debounced by 1 second to handle multiple rapid file events
   */
  startWatching(logger?: FastifyBaseLogger): void {
    if (this.watcher) {
      return; // Already watching
    }

    this.logger = logger || null;

    try {
      this.watcher = watch(this.whitelistPath, (eventType) => {
        if (eventType === 'change') {
          // Debounce: wait 1 second after last change before reloading
          if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
          }

          this.debounceTimer = setTimeout(() => {
            this.reloadWhitelist();
          }, 1000);
        }
      });

      if (this.logger) {
        this.logger.info({ path: this.whitelistPath }, 'Whitelist file watcher started');
      }
    } catch (error) {
      if (this.logger) {
        this.logger.error({ err: error, path: this.whitelistPath }, 'Failed to start whitelist watcher');
      }
      throw error;
    }
  }

  /**
   * Stop watching whitelist file
   */
  stopWatching(): void {
    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
    }

    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
  }

  /**
   * Reload whitelist from disk
   * Validates new configuration before applying
   * On error, keeps previous valid configuration
   */
  private reloadWhitelist(): void {
    try {
      const newWhitelist = this.loadWhitelistSync();

      // Update in-memory whitelist
      this.whitelist = newWhitelist;

      // Log successful reload
      if (this.logger) {
        this.logger.info(
          {
            allowed_emails_count: newWhitelist.allowedEmails.length,
            allowed_domains_count: newWhitelist.allowedDomains.length,
          },
          'Whitelist configuration reloaded'
        );
      }
    } catch (error) {
      // Log error but keep old configuration
      if (this.logger) {
        this.logger.error(
          {
            err: error,
            path: this.whitelistPath,
          },
          'Failed to reload whitelist configuration - keeping previous configuration'
        );
      }
    }
  }

  /**
   * Load whitelist from disk synchronously
   * Validates with zod schema
   */
  private loadWhitelistSync(): Whitelist {
    try {
      const raw = readFileSync(this.whitelistPath, 'utf-8');
      const parsed = JSON.parse(raw);
      const validated = WhitelistSchema.parse(parsed);

      return {
        allowedEmails: validated.allowed_emails,
        allowedDomains: validated.allowed_domains,
      };
    } catch (error) {
      if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
        throw new Error(`Whitelist file not found: ${this.whitelistPath}`);
      }

      if (error instanceof z.ZodError) {
        const errors = error.issues.map((e) => `${e.path.join('.')}: ${e.message}`).join('; ');
        throw new Error(`Whitelist validation failed: ${errors}`);
      }

      if (error instanceof SyntaxError) {
        throw new Error(`Whitelist JSON parsing failed: ${error.message}`);
      }

      throw error;
    }
  }
}

// Global whitelist manager instance
export const whitelistManager = new WhitelistManager();
