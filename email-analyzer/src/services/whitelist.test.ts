import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { whitelistManager } from './whitelist-manager';
import { isWhitelisted } from './whitelist';

describe('Whitelist Service', () => {
  // Save original whitelist to restore after tests
  let originalWhitelist: ReturnType<typeof whitelistManager.getWhitelist>;

  beforeEach(() => {
    // Save original whitelist
    originalWhitelist = whitelistManager.getWhitelist();
  });

  afterEach(() => {
    // Restore original whitelist
    whitelistManager.setWhitelist(originalWhitelist);
  });

  describe('isWhitelisted - exact email matching', () => {
    it('should return true for exact email match', () => {
      whitelistManager.setWhitelist({
        allowedEmails: ['user@company.com'],
        allowedDomains: [],
      });

      const result = isWhitelisted('user@company.com');
      expect(result).toBe(true);
    });

    it('should return true for exact email match with different case', () => {
      whitelistManager.setWhitelist({
        allowedEmails: ['user@company.com'],
        allowedDomains: [],
      });

      const result = isWhitelisted('USER@COMPANY.COM');
      expect(result).toBe(true);
    });

    it('should return true for exact email match with mixed case in whitelist', () => {
      whitelistManager.setWhitelist({
        allowedEmails: ['User@Company.Com'],
        allowedDomains: [],
      });

      const result = isWhitelisted('user@company.com');
      expect(result).toBe(true);
    });

    it('should handle whitespace in email input', () => {
      whitelistManager.setWhitelist({
        allowedEmails: ['user@company.com'],
        allowedDomains: [],
      });

      const result = isWhitelisted('  user@company.com  ');
      expect(result).toBe(true);
    });
  });

  describe('isWhitelisted - domain matching', () => {
    it('should return true for domain match', () => {
      whitelistManager.setWhitelist({
        allowedEmails: [],
        allowedDomains: ['@company.com'],
      });

      const result = isWhitelisted('any@company.com');
      expect(result).toBe(true);
    });

    it('should return true for subdomain match (suffix matching)', () => {
      whitelistManager.setWhitelist({
        allowedEmails: [],
        allowedDomains: ['@company.com'],
      });

      const result = isWhitelisted('user@sub.company.com');
      expect(result).toBe(true);
    });

    it('should return true for deeply nested subdomain match', () => {
      whitelistManager.setWhitelist({
        allowedEmails: [],
        allowedDomains: ['@company.com'],
      });

      const result = isWhitelisted('user@team.sub.company.com');
      expect(result).toBe(true);
    });

    it('should return true for domain match with different case', () => {
      whitelistManager.setWhitelist({
        allowedEmails: [],
        allowedDomains: ['@company.com'],
      });

      const result = isWhitelisted('user@COMPANY.COM');
      expect(result).toBe(true);
    });
  });

  describe('isWhitelisted - no match scenarios', () => {
    it('should return false when email not in whitelist', () => {
      whitelistManager.setWhitelist({
        allowedEmails: ['user@company.com'],
        allowedDomains: [],
      });

      const result = isWhitelisted('other@company.com');
      expect(result).toBe(false);
    });

    it('should return false when domain not in whitelist', () => {
      whitelistManager.setWhitelist({
        allowedEmails: [],
        allowedDomains: ['@other.com'],
      });

      const result = isWhitelisted('user@company.com');
      expect(result).toBe(false);
    });

    it('should return false when whitelist is empty', () => {
      whitelistManager.setWhitelist({
        allowedEmails: [],
        allowedDomains: [],
      });

      const result = isWhitelisted('user@company.com');
      expect(result).toBe(false);
    });

    it('should not match partial domain (must be suffix)', () => {
      whitelistManager.setWhitelist({
        allowedEmails: [],
        allowedDomains: ['@company.com'],
      });

      const result = isWhitelisted('user@mycompany.com');
      expect(result).toBe(false);
    });
  });

  describe('isWhitelisted - priority and multiple entries', () => {
    it('should prioritize exact email match over domain match', () => {
      whitelistManager.setWhitelist({
        allowedEmails: ['user@company.com'],
        allowedDomains: ['@other.com'],
      });

      const result = isWhitelisted('user@company.com');
      expect(result).toBe(true);
    });

    it('should match against multiple allowed emails', () => {
      whitelistManager.setWhitelist({
        allowedEmails: ['user1@company.com', 'user2@company.com', 'admin@other.com'],
        allowedDomains: [],
      });

      expect(isWhitelisted('user1@company.com')).toBe(true);
      expect(isWhitelisted('user2@company.com')).toBe(true);
      expect(isWhitelisted('admin@other.com')).toBe(true);
      expect(isWhitelisted('user3@company.com')).toBe(false);
    });

    it('should match against multiple allowed domains', () => {
      whitelistManager.setWhitelist({
        allowedEmails: [],
        allowedDomains: ['@company.com', '@partner.com', '@vendor.net'],
      });

      expect(isWhitelisted('anyone@company.com')).toBe(true);
      expect(isWhitelisted('anyone@partner.com')).toBe(true);
      expect(isWhitelisted('anyone@vendor.net')).toBe(true);
      expect(isWhitelisted('anyone@external.com')).toBe(false);
    });
  });
});
