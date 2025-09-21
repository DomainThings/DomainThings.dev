/**
 * Domain validation utilities
 * Pure functions for validating domain names and their components
 */

/**
 * Domain validation configuration
 */
const DOMAIN_CONFIG = {
  /** Maximum length for a domain label (63 chars per RFC) */
  MAX_LABEL_LENGTH: 63,
  /** Minimum length for a domain label */
  MIN_LABEL_LENGTH: 1,
  /** Maximum length for a TLD (24 chars should cover all current TLDs) */
  MAX_TLD_LENGTH: 24,
  /** Minimum length for a TLD */
  MIN_TLD_LENGTH: 2,
  /** Maximum total domain length (253 chars per RFC) */
  MAX_DOMAIN_LENGTH: 253,
  /** Minimum total domain length */
  MIN_DOMAIN_LENGTH: 4, // a.bc
} as const;

/**
 * Domain validation result
 */
interface DomainValidationResult {
  readonly isValid: boolean;
  readonly errors: readonly string[];
  readonly warnings: readonly string[];
  readonly parts?: {
    readonly label: string;
    readonly tld: string;
    readonly subdomains?: readonly string[];
  };
}

/**
 * Validates domain name format with comprehensive error reporting
 * @param domainName - Full domain name to validate
 * @returns Detailed validation result
 */
export const validateDomain = (domainName: string): DomainValidationResult => {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  // Basic type and existence check
  if (!domainName || typeof domainName !== 'string') {
    return {
      isValid: false,
      errors: ['Domain name must be a non-empty string'],
      warnings: []
    };
  }
  
  const trimmed = domainName.trim();
  
  // Check for empty or whitespace-only input
  if (!trimmed) {
    return {
      isValid: false,
      errors: ['Domain name cannot be empty or whitespace-only'],
      warnings: []
    };
  }
  
  // Check total length
  if (trimmed.length > DOMAIN_CONFIG.MAX_DOMAIN_LENGTH) {
    errors.push(`Domain name too long (${trimmed.length} > ${DOMAIN_CONFIG.MAX_DOMAIN_LENGTH} chars)`);
  }
  
  if (trimmed.length < DOMAIN_CONFIG.MIN_DOMAIN_LENGTH) {
    errors.push(`Domain name too short (${trimmed.length} < ${DOMAIN_CONFIG.MIN_DOMAIN_LENGTH} chars)`);
  }
  
  // Check for invalid characters at domain level
  if (/[^a-zA-Z0-9.-]/.test(trimmed)) {
    errors.push('Domain name contains invalid characters (only letters, numbers, dots, and hyphens allowed)');
  }
  
  // Check for consecutive dots
  if (trimmed.includes('..')) {
    errors.push('Domain name cannot contain consecutive dots');
  }
  
  // Check for leading/trailing dots or hyphens
  if (trimmed.startsWith('.') || trimmed.endsWith('.')) {
    errors.push('Domain name cannot start or end with a dot');
  }
  
  if (trimmed.startsWith('-') || trimmed.endsWith('-')) {
    errors.push('Domain name cannot start or end with a hyphen');
  }
  
  // Split domain into parts
  const parts = trimmed.split('.');
  
  // Must have at least label.tld
  if (parts.length < 2) {
    errors.push('Domain name must contain at least one dot (label.tld format)');
    return {
      isValid: false,
      errors,
      warnings
    };
  }
  
  // Extract main components
  const tld = parts[parts.length - 1];
  const label = parts[parts.length - 2];
  const subdomains = parts.length > 2 ? parts.slice(0, -2) : undefined;
  
  // Ensure we have both TLD and label
  if (!tld || !label) {
    errors.push('Domain name must have both a label and TLD');
    return {
      isValid: false,
      errors,
      warnings
    };
  }
  
  // Validate TLD
  const tldValidation = validateTld(tld);
  if (!tldValidation.isValid) {
    errors.push(...tldValidation.errors);
  }
  warnings.push(...tldValidation.warnings);
  
  // Validate label (SLD)
  const labelValidation = validateLabel(label, 'second-level domain');
  if (!labelValidation.isValid) {
    errors.push(...labelValidation.errors);
  }
  warnings.push(...labelValidation.warnings);
  
  // Validate subdomains if present
  if (subdomains) {
    subdomains.forEach((subdomain, index) => {
      const subdomainValidation = validateLabel(subdomain, `subdomain ${index + 1}`);
      if (!subdomainValidation.isValid) {
        errors.push(...subdomainValidation.errors);
      }
      warnings.push(...subdomainValidation.warnings);
    });
  }
  
  // Additional warnings for potentially problematic domains
  if (trimmed.length > 50) {
    warnings.push('Domain name is quite long, may cause issues with some systems');
  }
  
  if (parts.length > 5) {
    warnings.push('Domain has many subdomains, may indicate complex structure');
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    parts: {
      label,
      tld,
      subdomains
    }
  };
};

/**
 * Simple domain validation for backward compatibility
 * @param domainName - Domain name to validate
 * @returns true if domain format is valid
 */
export const isDomainValid = (domainName: string): boolean => {
  const result = validateDomain(domainName);
  return result.isValid;
};

/**
 * Label validation result
 */
interface LabelValidationResult {
  readonly isValid: boolean;
  readonly errors: readonly string[];
  readonly warnings: readonly string[];
}

/**
 * Validates a domain label with detailed error reporting
 * @param label - Label to validate
 * @param context - Context for error messages (e.g., "subdomain", "second-level domain")
 * @returns Detailed validation result
 */
export const validateLabel = (label: string, context: string = 'label'): LabelValidationResult => {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  // Basic checks
  if (!label || typeof label !== 'string') {
    return {
      isValid: false,
      errors: [`${context} must be a non-empty string`],
      warnings: []
    };
  }
  
  // Length checks
  if (label.length > DOMAIN_CONFIG.MAX_LABEL_LENGTH) {
    errors.push(`${context} too long (${label.length} > ${DOMAIN_CONFIG.MAX_LABEL_LENGTH} chars)`);
  }
  
  if (label.length < DOMAIN_CONFIG.MIN_LABEL_LENGTH) {
    errors.push(`${context} too short (${label.length} < ${DOMAIN_CONFIG.MIN_LABEL_LENGTH} chars)`);
  }
  
  // Character validation
  if (!/^[a-zA-Z0-9-]+$/.test(label)) {
    errors.push(`${context} contains invalid characters (only letters, numbers, and hyphens allowed)`);
  }
  
  // Position-specific checks
  if (label.startsWith('-') || label.endsWith('-')) {
    errors.push(`${context} cannot start or end with a hyphen`);
  }
  
  // Additional checks for potential issues
  if (label.includes('--')) {
    warnings.push(`${context} contains consecutive hyphens, which may indicate punycode or special encoding`);
  }
  
  if (/^\d+$/.test(label)) {
    warnings.push(`${context} is all numeric, which may cause confusion`);
  }
  
  if (label.length === 1) {
    warnings.push(`${context} is very short (single character)`);
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
};

/**
 * Simple label validation for backward compatibility
 * @param label - Label to validate
 * @returns true if label format is valid
 */
export const isLabelValid = (label: string): boolean => {
  const result = validateLabel(label);
  return result.isValid;
};

/**
 * TLD validation result
 */
interface TldValidationResult {
  readonly isValid: boolean;
  readonly errors: readonly string[];
  readonly warnings: readonly string[];
  readonly metadata?: {
    readonly type: 'likely-country' | 'likely-generic' | 'unknown';
    readonly isCommon: boolean;
  };
}

/**
 * Common TLDs for validation hints
 */
const COMMON_TLDS = new Set([
  'com', 'org', 'net', 'edu', 'gov', 'mil', 'info', 'biz', 'name',
  'uk', 'de', 'fr', 'it', 'nl', 'jp', 'cn', 'au', 'ca', 'us'
]);

/**
 * Validates a TLD with detailed error reporting
 * @param tld - TLD to validate
 * @returns Detailed validation result
 */
export const validateTld = (tld: string): TldValidationResult => {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  // Basic checks
  if (!tld || typeof tld !== 'string') {
    return {
      isValid: false,
      errors: ['TLD must be a non-empty string'],
      warnings: []
    };
  }
  
  // Length checks
  if (tld.length > DOMAIN_CONFIG.MAX_TLD_LENGTH) {
    errors.push(`TLD too long (${tld.length} > ${DOMAIN_CONFIG.MAX_TLD_LENGTH} chars)`);
  }
  
  if (tld.length < DOMAIN_CONFIG.MIN_TLD_LENGTH) {
    errors.push(`TLD too short (${tld.length} < ${DOMAIN_CONFIG.MIN_TLD_LENGTH} chars)`);
  }
  
  // Character validation - TLDs should only contain letters
  if (!/^[a-zA-Z]+$/.test(tld)) {
    errors.push('TLD contains invalid characters (only letters allowed)');
  }
  
  // Determine TLD type and commonality
  const lowerTld = tld.toLowerCase();
  const isCommon = COMMON_TLDS.has(lowerTld);
  
  let type: 'likely-country' | 'likely-generic' | 'unknown' = 'unknown';
  if (tld.length === 2) {
    type = 'likely-country';
  } else if (tld.length >= 3) {
    type = 'likely-generic';
  }
  
  // Warnings for unusual TLDs
  if (!isCommon && tld.length > 4) {
    warnings.push('TLD is longer than typical, verify it exists');
  }
  
  if (!isCommon && type === 'likely-generic') {
    warnings.push('TLD appears to be a generic TLD, verify it is registered');
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    metadata: {
      type,
      isCommon
    }
  };
};

/**
 * Simple TLD validation for backward compatibility
 * @param tld - TLD to validate
 * @returns true if TLD format is valid
 */
export const isTldValid = (tld: string): boolean => {
  const result = validateTld(tld);
  return result.isValid;
};

/**
 * Extracts and validates domain parts
 * @param domainName - Full domain name
 * @returns Object with validated domain parts or null if invalid
 */
export const parseDomain = (domainName: string): {
  readonly label: string;
  readonly tld: string;
  readonly subdomains: readonly string[];
  readonly fullDomain: string;
  readonly isValid: boolean;
} | null => {
  const validation = validateDomain(domainName);
  
  if (!validation.isValid || !validation.parts) {
    return null;
  }
  
  const parts = domainName.trim().split('.');
  
  return {
    label: validation.parts.label,
    tld: validation.parts.tld,
    subdomains: validation.parts.subdomains || [],
    fullDomain: domainName.trim(),
    isValid: true
  };
};

/**
 * Normalizes a domain name by trimming and converting to lowercase
 * @param domainName - Domain name to normalize
 * @returns Normalized domain name or null if invalid
 */
export const normalizeDomain = (domainName: string): string | null => {
  if (!domainName || typeof domainName !== 'string') {
    return null;
  }
  
  const trimmed = domainName.trim().toLowerCase();
  
  if (!isDomainValid(trimmed)) {
    return null;
  }
  
  return trimmed;
};

/**
 * Checks if a domain is a subdomain of another domain
 * @param subdomain - Potential subdomain
 * @param parentDomain - Potential parent domain
 * @returns true if subdomain is a subdomain of parentDomain
 */
export const isSubdomainOf = (subdomain: string, parentDomain: string): boolean => {
  const normalizedSub = normalizeDomain(subdomain);
  const normalizedParent = normalizeDomain(parentDomain);
  
  if (!normalizedSub || !normalizedParent) {
    return false;
  }
  
  if (normalizedSub === normalizedParent) {
    return false; // Same domain, not a subdomain
  }
  
  return normalizedSub.endsWith(`.${normalizedParent}`);
};

/**
 * Gets the root domain (label.tld) from a potentially complex domain
 * @param domainName - Full domain name
 * @returns Root domain or null if invalid
 */
export const getRootDomain = (domainName: string): string | null => {
  const parsed = parseDomain(domainName);
  
  if (!parsed) {
    return null;
  }
  
  return `${parsed.label}.${parsed.tld}`;
};

/**
 * Generates domain suggestions based on a base domain
 * @param baseDomain - Base domain to generate suggestions from
 * @param maxSuggestions - Maximum number of suggestions to generate
 * @returns Array of suggested domain variations
 */
export const generateDomainSuggestions = (
  baseDomain: string, 
  maxSuggestions: number = 5
): string[] => {
  const parsed = parseDomain(baseDomain);
  
  if (!parsed) {
    return [];
  }
  
  const suggestions: string[] = [];
  const commonTlds = ['com', 'org', 'net', 'info', 'biz'];
  const prefixes = ['my', 'the', 'get', 'try'];
  const suffixes = ['app', 'site', 'web', 'online', 'digital'];
  
  // Different TLD variations
  commonTlds.forEach(tld => {
    if (tld !== parsed.tld && suggestions.length < maxSuggestions) {
      suggestions.push(`${parsed.label}.${tld}`);
    }
  });
  
  // Prefix variations
  prefixes.forEach(prefix => {
    if (suggestions.length < maxSuggestions) {
      suggestions.push(`${prefix}${parsed.label}.${parsed.tld}`);
    }
  });
  
  // Suffix variations
  suffixes.forEach(suffix => {
    if (suggestions.length < maxSuggestions) {
      suggestions.push(`${parsed.label}${suffix}.${parsed.tld}`);
    }
  });
  
  return suggestions.slice(0, maxSuggestions);
};

// Export types for external use
export type { 
  DomainValidationResult, 
  LabelValidationResult, 
  TldValidationResult 
};