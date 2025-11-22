import { whitelistManager } from './whitelist-manager';

/**
 * Whitelist validation service
 * Checks if sender email is authorized based on whitelist configuration
 * Uses WhitelistManager for hot-reload capability
 */

/**
 * Validates if an email address is whitelisted
 *
 * Validation rules:
 * 1. Check exact email match against allowed_emails array
 * 2. If no exact match, check domain suffix against allowed_domains array
 * 3. Return false if neither match succeeds
 *
 * Matching is case-insensitive for reliability
 *
 * Examples:
 * - "user@company.com" matches allowed_emails: ["user@company.com"]
 * - "any@company.com" matches allowed_domains: ["@company.com"]
 * - "user@sub.company.com" matches allowed_domains: ["@company.com"] (suffix match)
 *
 * @param email - Email address to validate
 * @returns true if whitelisted, false otherwise
 */
export function isWhitelisted(email: string): boolean {
  // Normalize email to lowercase for case-insensitive matching
  const normalizedEmail = email.toLowerCase().trim();

  // Get current whitelist from manager (supports hot-reload)
  const whitelist = whitelistManager.getWhitelist();

  // Check exact email match first
  const allowedEmails = whitelist.allowedEmails.map(e => e.toLowerCase());
  if (allowedEmails.includes(normalizedEmail)) {
    return true;
  }

  // Check domain suffix match
  const allowedDomains = whitelist.allowedDomains.map(d => d.toLowerCase());
  for (const domain of allowedDomains) {
    // Direct match: user@company.com matches @company.com
    if (normalizedEmail.endsWith(domain)) {
      return true;
    }

    // Subdomain match: user@sub.company.com matches @company.com
    // Convert @company.com to .company.com for subdomain matching
    if (domain.startsWith('@')) {
      const subdomainPattern = '.' + domain.slice(1); // @company.com -> .company.com
      if (normalizedEmail.endsWith(subdomainPattern)) {
        return true;
      }
    }
  }

  // No match found
  return false;
}
