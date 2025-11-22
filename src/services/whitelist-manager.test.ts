import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { WhitelistManager } from './whitelist-manager';
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'fs';
import { join } from 'path';

describe('WhitelistManager', () => {
  const testDir = join(process.cwd(), 'test-temp-whitelist');
  const testWhitelistPath = join(testDir, 'whitelist.json');
  let manager: WhitelistManager;

  beforeEach(() => {
    // Create test directory
    if (!existsSync(testDir)) {
      mkdirSync(testDir, { recursive: true });
    }

    // Create initial test whitelist file
    writeFileSync(
      testWhitelistPath,
      JSON.stringify({
        allowed_emails: ['test@example.com'],
        allowed_domains: ['@test.com'],
      })
    );

    // Create manager with test file path
    manager = new WhitelistManager(testWhitelistPath);
  });

  afterEach(() => {
    // Stop watching to clean up file handles
    manager.stopWatching();

    // Clean up test directory
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe('loadWhitelistSync', () => {
    it('should load whitelist from file on construction', () => {
      const whitelist = manager.getWhitelist();

      expect(whitelist.allowedEmails).toEqual(['test@example.com']);
      expect(whitelist.allowedDomains).toEqual(['@test.com']);
    });

    it('should throw error if file does not exist', () => {
      const nonExistentPath = join(testDir, 'nonexistent.json');

      expect(() => new WhitelistManager(nonExistentPath)).toThrow(
        `Whitelist file not found: ${nonExistentPath}`
      );
    });

    it('should throw error on invalid JSON', () => {
      const invalidPath = join(testDir, 'invalid.json');
      writeFileSync(invalidPath, 'invalid json{');

      expect(() => new WhitelistManager(invalidPath)).toThrow('Whitelist JSON parsing failed');
    });

    it('should throw error on schema validation failure', () => {
      const invalidPath = join(testDir, 'invalid-schema.json');
      writeFileSync(invalidPath, JSON.stringify({ invalid: 'schema' }));

      expect(() => new WhitelistManager(invalidPath)).toThrow('Whitelist validation failed');
    });

    it('should throw error on invalid email format', () => {
      const invalidPath = join(testDir, 'invalid-email.json');
      writeFileSync(
        invalidPath,
        JSON.stringify({
          allowed_emails: ['not-an-email'],
          allowed_domains: [],
        })
      );

      expect(() => new WhitelistManager(invalidPath)).toThrow('Whitelist validation failed');
    });
  });

  describe('getWhitelist', () => {
    it('should return current whitelist configuration', () => {
      const whitelist = manager.getWhitelist();

      expect(whitelist).toEqual({
        allowedEmails: ['test@example.com'],
        allowedDomains: ['@test.com'],
      });
    });
  });

  describe('setWhitelist', () => {
    it('should update whitelist configuration', () => {
      manager.setWhitelist({
        allowedEmails: ['new@example.com'],
        allowedDomains: ['@new.com'],
      });

      const whitelist = manager.getWhitelist();
      expect(whitelist.allowedEmails).toEqual(['new@example.com']);
      expect(whitelist.allowedDomains).toEqual(['@new.com']);
    });
  });

  describe('file watching', () => {
    it('should start file watcher', () => {
      // Mock logger
      const mockLogger = {
        info: vi.fn(),
        error: vi.fn(),
      } as any;

      manager.startWatching(mockLogger);

      expect(mockLogger.info).toHaveBeenCalledWith(
        { path: testWhitelistPath },
        'Whitelist file watcher started'
      );
    });

    it('should not start watcher twice', () => {
      const mockLogger = {
        info: vi.fn(),
        error: vi.fn(),
      } as any;

      manager.startWatching(mockLogger);
      manager.startWatching(mockLogger);

      // Should only be called once
      expect(mockLogger.info).toHaveBeenCalledTimes(1);
    });

    it('should stop file watcher', () => {
      manager.startWatching();
      manager.stopWatching();

      // No error should be thrown
      expect(true).toBe(true);
    });

    it('should reload whitelist when file changes', async () => {
      const mockLogger = {
        info: vi.fn(),
        error: vi.fn(),
      } as any;

      manager.startWatching(mockLogger);

      // Wait a bit for watcher to be ready
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Update whitelist file
      writeFileSync(
        testWhitelistPath,
        JSON.stringify({
          allowed_emails: ['updated@example.com', 'another@example.com'],
          allowed_domains: ['@updated.com'],
        })
      );

      // Wait for debounce (1 second) + processing time
      await new Promise((resolve) => setTimeout(resolve, 1500));

      // Check that whitelist was reloaded
      const whitelist = manager.getWhitelist();
      expect(whitelist.allowedEmails).toContain('updated@example.com');
      expect(whitelist.allowedEmails).toContain('another@example.com');
      expect(whitelist.allowedDomains).toContain('@updated.com');

      // Check that reload was logged
      expect(mockLogger.info).toHaveBeenCalledWith(
        {
          allowed_emails_count: 2,
          allowed_domains_count: 1,
        },
        'Whitelist configuration reloaded'
      );
    });

    it('should keep old config if new config is invalid JSON', async () => {
      const mockLogger = {
        info: vi.fn(),
        error: vi.fn(),
      } as any;

      manager.startWatching(mockLogger);

      // Wait a bit for watcher to be ready
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Save current whitelist
      const originalWhitelist = manager.getWhitelist();

      // Update file with invalid JSON
      writeFileSync(testWhitelistPath, 'invalid json{');

      // Wait for debounce + processing
      await new Promise((resolve) => setTimeout(resolve, 1500));

      // Check that old whitelist is still active
      const whitelist = manager.getWhitelist();
      expect(whitelist).toEqual(originalWhitelist);

      // Check that error was logged
      expect(mockLogger.error).toHaveBeenCalled();
      const errorCall = mockLogger.error.mock.calls[0];
      expect(errorCall[1]).toBe(
        'Failed to reload whitelist configuration - keeping previous configuration'
      );
    });

    it('should keep old config if new config has invalid schema', async () => {
      const mockLogger = {
        info: vi.fn(),
        error: vi.fn(),
      } as any;

      manager.startWatching(mockLogger);

      // Wait a bit for watcher to be ready
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Save current whitelist
      const originalWhitelist = manager.getWhitelist();

      // Update file with invalid schema
      writeFileSync(testWhitelistPath, JSON.stringify({ invalid: 'schema' }));

      // Wait for debounce + processing
      await new Promise((resolve) => setTimeout(resolve, 1500));

      // Check that old whitelist is still active
      const whitelist = manager.getWhitelist();
      expect(whitelist).toEqual(originalWhitelist);

      // Check that error was logged
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });
});
