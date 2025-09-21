import { DomainAvailabilityStatus } from '@/types';
import { 
  DnsRecordType, 
  DnsResponseStatus,
  type DnsJsonResponse,
  type DomainDnsInfo 
} from '@/types/dns';

/**
 * DNS Service Configuration
 * @see https://developers.cloudflare.com/1.1.1.1/encryption/dns-over-https/
 */
const DNS_CONFIG = {
  /** Cloudflare DNS over HTTPS endpoint */
  ENDPOINT: 'https://cloudflare-dns.com/dns-query',
  /** Default timeout for DNS queries in milliseconds */
  TIMEOUT: 10000,
  /** Maximum domain name length per RFC */
  MAX_DOMAIN_LENGTH: 253,
  /** Cache TTL for DNS responses in milliseconds */
  CACHE_TTL: 300000, // 5 minutes
} as const;

/**
 * DNS record types that indicate an active web presence
 * These records suggest the domain is actively being used
 */
const WEB_RECORD_TYPES = [
  DnsRecordType.A,      // IPv4 address
  DnsRecordType.AAAA,   // IPv6 address
  DnsRecordType.CNAME,  // Canonical name
  DnsRecordType.MX      // Mail exchange
] as const;

/**
 * Simple in-memory cache for DNS responses
 */
interface DnsCacheEntry {
  readonly response: DnsJsonResponse;
  readonly timestamp: number;
  readonly ttl: number;
}

const dnsCache = new Map<string, DnsCacheEntry>();

/**
 * Result type for DNS operations
 */
interface DnsResult<T> {
  readonly success: boolean;
  readonly data?: T;
  readonly error?: string;
  readonly fromCache?: boolean;
}

/**
 * Validates a domain name format according to RFC standards
 * @param domain - Domain to validate
 * @returns true if domain format is valid
 */
const isValidDomain = (domain: string): boolean => {
  if (!domain || typeof domain !== 'string') return false;
  if (domain.length > DNS_CONFIG.MAX_DOMAIN_LENGTH) return false;
  
  // Basic domain validation - contains at least one dot and valid characters
  const domainRegex = /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
  
  // Additional checks
  if (!domainRegex.test(domain)) return false;
  if (domain.startsWith('-') || domain.endsWith('-')) return false;
  if (domain.includes('..')) return false; // No consecutive dots
  
  return true;
};

/**
 * Creates a timeout promise for fetch operations
 * @param timeoutMs - Timeout in milliseconds
 * @returns Promise that rejects after timeout
 */
const createTimeoutPromise = (timeoutMs: number): Promise<never> => {
  return new Promise((_, reject) => {
    setTimeout(() => {
      reject(new Error(`DNS query timeout after ${timeoutMs}ms`));
    }, timeoutMs);
  });
};

/**
 * Creates a cache key for DNS queries
 * @param domain - Domain name
 * @param type - DNS record type
 * @returns Cache key string
 */
const createCacheKey = (domain: string, type: DnsRecordType): string => {
  return `${domain.toLowerCase()}:${type}`;
};

/**
 * Checks if a cached entry is still valid
 * @param entry - Cache entry to check
 * @returns true if entry is still valid
 */
const isCacheEntryValid = (entry: DnsCacheEntry): boolean => {
  return Date.now() - entry.timestamp < entry.ttl;
};

/**
 * Gets a cached DNS response if available and valid
 * @param domain - Domain name
 * @param type - DNS record type
 * @returns Cached response or undefined
 */
const getCachedResponse = (domain: string, type: DnsRecordType): DnsJsonResponse | undefined => {
  const key = createCacheKey(domain, type);
  const entry = dnsCache.get(key);
  
  if (entry && isCacheEntryValid(entry)) {
    return entry.response;
  }
  
  // Clean up expired entry
  if (entry) {
    dnsCache.delete(key);
  }
  
  return undefined;
};

/**
 * Caches a DNS response
 * @param domain - Domain name
 * @param type - DNS record type
 * @param response - DNS response to cache
 */
const cacheResponse = (domain: string, type: DnsRecordType, response: DnsJsonResponse): void => {
  const key = createCacheKey(domain, type);
  const entry: DnsCacheEntry = {
    response,
    timestamp: Date.now(),
    ttl: DNS_CONFIG.CACHE_TTL
  };
  
  dnsCache.set(key, entry);
  
  // Prevent cache from growing too large
  if (dnsCache.size > 1000) {
    const oldestKey = dnsCache.keys().next().value;
    if (oldestKey) {
      dnsCache.delete(oldestKey);
    }
  }
};

/**
 * Checks if a DNS response contains web records in the Answer section
 * @param dnsResponse - DNS response to analyze
 * @returns true if web records are found
 */
const hasWebRecordsInAnswer = (dnsResponse: DnsJsonResponse): boolean => {
  return dnsResponse.Answer?.some(record => 
    (WEB_RECORD_TYPES as readonly number[]).includes(record.type)
  ) ?? false;
};

/**
 * Checks if a domain has its own SOA record in the Authority section
 * @param dnsResponse - DNS response to analyze
 * @param domain - Domain name to check
 * @returns true if domain has its own SOA record
 */
const hasOwnSOARecord = (dnsResponse: DnsJsonResponse, domain: string): boolean => {
  return dnsResponse.Authority?.some(record => 
    record.type === DnsRecordType.SOA && 
    record.name.toLowerCase() === domain.toLowerCase()
  ) ?? false;
};

/**
 * Checks if a domain has parent zone SOA record in the Authority section
 * @param dnsResponse - DNS response to analyze
 * @param domain - Domain name to check
 * @returns true if domain has parent SOA record
 */
const hasParentSOARecord = (dnsResponse: DnsJsonResponse, domain: string): boolean => {
  return dnsResponse.Authority?.some(record => 
    record.type === DnsRecordType.SOA && 
    domain.toLowerCase().endsWith(record.name.toLowerCase()) &&
    record.name.toLowerCase() !== domain.toLowerCase()
  ) ?? false;
};

/**
 * Executes a DNS query using Cloudflare's DNS over HTTPS service
 * @param domain - The domain name to query
 * @param type - DNS record type to query for (defaults to A record)
 * @returns Promise resolving to the DNS result
 */
export const fetchDns = async (domain: string, type: DnsRecordType = DnsRecordType.A): Promise<DnsResult<DnsJsonResponse>> => {
  // Validate domain format before making the request
  if (!isValidDomain(domain)) {
    return {
      success: false,
      error: `Invalid domain format: ${domain}`
    };
  }

  // Check cache first
  const cachedResponse = getCachedResponse(domain, type);
  if (cachedResponse) {
    return {
      success: true,
      data: cachedResponse,
      fromCache: true
    };
  }

  try {
    const fetchPromise = fetch(`${DNS_CONFIG.ENDPOINT}?name=${encodeURIComponent(domain)}&type=${type}`, {
      headers: {
        'accept': 'application/dns-json',
        'user-agent': 'DomainCheck/1.0'
      },
      // Add request mode for better error handling
      mode: 'cors',
      cache: 'no-cache'
    });
    
    // Race between fetch and timeout
    const response: Response = await Promise.race([
      fetchPromise,
      createTimeoutPromise(DNS_CONFIG.TIMEOUT)
    ]);
    
    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      return {
        success: false,
        error: `DNS query failed with status ${response.status}: ${errorText}`
      };
    }
    
    const dnsResponse: DnsJsonResponse = await response.json();
    
    // Cache successful response
    cacheResponse(domain, type, dnsResponse);
    
    return {
      success: true,
      data: dnsResponse,
      fromCache: false
    };
    
  } catch (error: any) {
    const errorMessage = error?.message ?? String(error);
    
    // Provide more specific error messages
    if (errorMessage.includes('timeout')) {
      return {
        success: false,
        error: `DNS query timeout for ${domain}`
      };
    }
    
    if (errorMessage.includes('network') || errorMessage.includes('fetch')) {
      return {
        success: false,
        error: `Network error during DNS lookup for ${domain}`
      };
    }
    
    return {
      success: false,
      error: `DNS lookup error: ${errorMessage}`
    };
  }
};

/**
 * Performs additional SOA record check for edge cases
 * Used when initial query shows parent SOA but no direct domain records
 * 
 * @param domain - The domain to check
 * @returns Promise resolving to availability status
 */
const performSOACheck = async (domain: string): Promise<DomainAvailabilityStatus> => {
  const soaResult = await fetchDns(domain, DnsRecordType.SOA);
  
  if (!soaResult.success || !soaResult.data) {
    return DomainAvailabilityStatus.UNKNOWN;
  }
  
  const soaResponse = soaResult.data;
  
  if (soaResponse.Status === DnsResponseStatus.NOERROR && 
      soaResponse.Answer && 
      soaResponse.Answer.length > 0) {
    return DomainAvailabilityStatus.NOTAVAILABLE; // Domain has direct SOA
  }
  
  return DomainAvailabilityStatus.AVAILABLE; // No direct SOA, likely available
};

/**
 * Determines if a domain is available for registration based on DNS analysis
 * 
 * This function uses a multi-step approach:
 * 1. Check for NXDOMAIN (clear availability indicator)
 * 2. Analyze Answer section for active web records
 * 3. Check Authority section for SOA records indicating registration
 * 4. Perform additional SOA lookup for edge cases
 * 
 * @param domain - The domain name to check
 * @returns Promise resolving to domain availability status
 */
export const getDomainAvailabilityStatus = async (domain: string): Promise<DomainAvailabilityStatus> => {
  const dnsResult = await fetchDns(domain, DnsRecordType.A);
  
  if (!dnsResult.success || !dnsResult.data) {
    return DomainAvailabilityStatus.UNKNOWN;
  }
  
  const dnsResponse = dnsResult.data;
  
  // NXDOMAIN clearly indicates domain doesn't exist = AVAILABLE
  if (dnsResponse.Status === DnsResponseStatus.NXDOMAIN) {
    return DomainAvailabilityStatus.AVAILABLE;
  }
  
  // DNS errors (SERVFAIL, REFUSED, etc.) = UNKNOWN status
  if (dnsResponse.Status !== DnsResponseStatus.NOERROR) {
    return DomainAvailabilityStatus.UNKNOWN;
  }
  
  // NOERROR status requires deeper analysis
  if (dnsResponse.Status === DnsResponseStatus.NOERROR) {
    // Check Answer section for active web records
    if (dnsResponse.Answer && dnsResponse.Answer.length > 0) {
      if (hasWebRecordsInAnswer(dnsResponse)) {
        return DomainAvailabilityStatus.NOTAVAILABLE; // Domain has active records
      }
    }
    
    // No Answer section - check Authority for SOA records
    if (dnsResponse.Authority && dnsResponse.Authority.length > 0) {
      // Check if domain has its own SOA record
      if (hasOwnSOARecord(dnsResponse, domain)) {
        // Domain has own zone but no active records - still registered
        return DomainAvailabilityStatus.NOTAVAILABLE;
      }
      
      // Check for parent zone SOA only
      if (hasParentSOARecord(dnsResponse, domain)) {
        // Perform additional SOA query to confirm domain registration
        return await performSOACheck(domain);
      }
    }
    
    // NOERROR without clear indicators = ambiguous case
    return DomainAvailabilityStatus.UNKNOWN;
  }
  
  return DomainAvailabilityStatus.UNKNOWN;
};

/**
 * Provides detailed DNS information for a domain
 * Useful for debugging and fine-grained analysis of domain status
 * 
 * @param domain - The domain name to analyze
 * @returns Promise resolving to detailed DNS information
 */
export const getDomainDnsInfo = async (domain: string): Promise<DomainDnsInfo> => {
  const info: DomainDnsInfo = {
    status: DomainAvailabilityStatus.UNKNOWN,
    dnsStatus: DnsResponseStatus.SERVFAIL,
    hasWebRecords: false,
    hasSOA: false,
    hasParentSOA: false,
    recordTypes: [],
    confidence: 'low'
  };

  const dnsResult = await fetchDns(domain, DnsRecordType.A);
  
  if (!dnsResult.success || !dnsResult.data) {
    return info;
  }
  
  const dnsResponse = dnsResult.data;
  info.dnsStatus = dnsResponse.Status;
  
  // NXDOMAIN = domain clearly available
  if (dnsResponse.Status === DnsResponseStatus.NXDOMAIN) {
    info.status = DomainAvailabilityStatus.AVAILABLE;
    info.confidence = 'high';
    return info;
  }
  
  // DNS errors indicate uncertain status
  if (dnsResponse.Status !== DnsResponseStatus.NOERROR) {
    info.status = DomainAvailabilityStatus.UNKNOWN;
    info.confidence = 'low';
    return info;
  }
  
  // Analyze Answer section records
  if (dnsResponse.Answer && dnsResponse.Answer.length > 0) {
    info.recordTypes = dnsResponse.Answer.map(record => record.type);
    info.hasWebRecords = hasWebRecordsInAnswer(dnsResponse);
    
    if (info.hasWebRecords) {
      info.status = DomainAvailabilityStatus.NOTAVAILABLE;
      info.confidence = 'high';
      return info;
    }
  }
  
  // Analyze Authority section for SOA records
  if (dnsResponse.Authority && dnsResponse.Authority.length > 0) {
    // Check for domain's own SOA record
    info.hasSOA = hasOwnSOARecord(dnsResponse, domain);
    
    // Check for parent zone SOA record
    info.hasParentSOA = hasParentSOARecord(dnsResponse, domain);
    
    if (info.hasSOA) {
      info.status = DomainAvailabilityStatus.NOTAVAILABLE;
      info.confidence = 'high';
      return info;
    }
    
    if (info.hasParentSOA) {
      // Perform additional SOA verification
      const soaResult = await fetchDns(domain, DnsRecordType.SOA);
      if (soaResult.success && soaResult.data?.Status === DnsResponseStatus.NOERROR && 
          soaResult.data.Answer && soaResult.data.Answer.length > 0) {
        info.hasSOA = true;
        info.status = DomainAvailabilityStatus.NOTAVAILABLE;
        info.confidence = 'high';
      } else {
        info.status = DomainAvailabilityStatus.AVAILABLE;
        info.confidence = 'medium';
      }
      return info;
    }
  }
  
  // NOERROR without clear indicators
  info.status = DomainAvailabilityStatus.UNKNOWN;
  info.confidence = 'low';
  
  return info;
};

/**
 * Clears the DNS cache
 */
export const clearDnsCache = (): void => {
  dnsCache.clear();
};

/**
 * Gets DNS cache statistics
 * @returns Cache statistics
 */
export const getDnsCacheStats = () => {
  const now = Date.now();
  const entries = Array.from(dnsCache.values());
  const validEntries = entries.filter(entry => isCacheEntryValid(entry));
  
  return {
    totalEntries: dnsCache.size,
    validEntries: validEntries.length,
    expiredEntries: entries.length - validEntries.length,
    memoryUsage: JSON.stringify(Array.from(dnsCache.entries())).length
  };
};