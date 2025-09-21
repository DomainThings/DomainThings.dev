import type { RdapResponse, RdapBootstrap, RdapService } from '@/types/rdap';

/**
 * RDAP Service Configuration
 */
const RDAP_CONFIG = {
  /** IANA RDAP Bootstrap URL */
  BOOTSTRAP_URL: 'https://data.iana.org/rdap/dns.json',
  /** Default timeout for RDAP queries in milliseconds */
  TIMEOUT: 15000,
  /** Cache TTL for bootstrap services in milliseconds */
  BOOTSTRAP_CACHE_TTL: 86400000, // 24 hours
  /** Cache TTL for RDAP responses in milliseconds */
  RESPONSE_CACHE_TTL: 3600000, // 1 hour
  /** Maximum retry attempts for failed requests */
  MAX_RETRIES: 2,
} as const;

/**
 * Result type for RDAP operations
 */
interface RdapResult<T> {
  readonly success: boolean;
  readonly data?: T;
  readonly error?: string;
  readonly fromCache?: boolean;
  readonly provider?: string;
}

/**
 * Cache entry structure
 */
interface RdapCacheEntry<T> {
  readonly data: T;
  readonly timestamp: number;
  readonly ttl: number;
}

/**
 * In-memory cache for bootstrap services and RDAP responses
 */
const bootstrapCache = new Map<string, RdapCacheEntry<RdapService[]>>();
const responseCache = new Map<string, RdapCacheEntry<RdapResponse>>();

/**
 * Cached services to avoid repeated bootstrap fetches
 */
let cachedServices: RdapService[] | null = null;
let lastBootstrapFetch: number = 0;

/**
 * Creates a timeout promise for fetch operations
 * @param timeoutMs - Timeout in milliseconds
 * @returns Promise that rejects after timeout
 */
const createTimeoutPromise = (timeoutMs: number): Promise<never> => {
  return new Promise((_, reject) => {
    setTimeout(() => {
      reject(new Error(`RDAP query timeout after ${timeoutMs}ms`));
    }, timeoutMs);
  });
};

/**
 * Checks if a cached entry is still valid
 * @param entry - Cache entry to check
 * @returns true if entry is still valid
 */
const isCacheEntryValid = <T>(entry: RdapCacheEntry<T>): boolean => {
  return Date.now() - entry.timestamp < entry.ttl;
};

/**
 * Validates domain name format for RDAP queries
 * @param domain - Domain to validate
 * @returns true if domain format is valid for RDAP
 */
const isValidDomainForRdap = (domain: string): boolean => {
  if (!domain || typeof domain !== 'string') return false;
  
  // Must contain at least one dot (domain.tld)
  if (!domain.includes('.')) return false;
  
  // Basic domain validation
  const domainRegex = /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
  return domainRegex.test(domain) && domain.length <= 253;
};

/**
 * Extracts TLD from domain name
 * @param domain - Domain name
 * @returns TLD or undefined if not found
 */
const extractTld = (domain: string): string | undefined => {
  const parts = domain.split('.');
  return parts.length > 1 ? parts[parts.length - 1] : undefined;
};

/**
 * Fetches RDAP bootstrap services with caching and error handling
 * @returns Promise resolving to RDAP services result
 */
export const getServices = async (): Promise<RdapResult<RdapService[]>> => {
  // Check if we have valid cached services
  if (cachedServices && 
      Date.now() - lastBootstrapFetch < RDAP_CONFIG.BOOTSTRAP_CACHE_TTL) {
    return {
      success: true,
      data: cachedServices,
      fromCache: true
    };
  }

  try {
    const fetchPromise = fetch(RDAP_CONFIG.BOOTSTRAP_URL, {
      headers: {
        'accept': 'application/json',
        'user-agent': 'DomainCheck/1.0'
      },
      mode: 'cors',
      cache: 'default'
    });
    
    const response: Response = await Promise.race([
      fetchPromise,
      createTimeoutPromise(RDAP_CONFIG.TIMEOUT)
    ]);
    
    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      return {
        success: false,
        error: `Bootstrap fetch failed with status ${response.status}: ${errorText}`
      };
    }
    
    const bootstrapData: RdapBootstrap = await response.json();
    
    // Validate bootstrap response structure
    if (!bootstrapData.services || !Array.isArray(bootstrapData.services)) {
      return {
        success: false,
        error: 'Invalid bootstrap response: missing or invalid services array'
      };
    }
    
    // Cache the services
    cachedServices = bootstrapData.services;
    lastBootstrapFetch = Date.now();
    
    return {
      success: true,
      data: bootstrapData.services,
      fromCache: false
    };
    
  } catch (error: any) {
    const errorMessage = error?.message ?? String(error);
    
    // Provide more specific error messages
    if (errorMessage.includes('timeout')) {
      return {
        success: false,
        error: 'RDAP bootstrap request timeout'
      };
    }
    
    if (errorMessage.includes('network') || errorMessage.includes('fetch')) {
      return {
        success: false,
        error: 'Network error during RDAP bootstrap fetch'
      };
    }
    
    return {
      success: false,
      error: `Bootstrap fetch error: ${errorMessage}`
    };
  }
};

/**
 * Finds the appropriate RDAP service for a given TLD
 * @param tld - Top-level domain
 * @param services - Available RDAP services
 * @returns RDAP service or undefined if not found
 */
const findServiceForTld = (tld: string, services: RdapService[]): RdapService | undefined => {
  return services.find((service: RdapService) => {
    const [tlds] = service;
    return tlds.includes(tld) || tlds.includes(`.${tld}`);
  });
};

/**
 * Gets the service URL from an RDAP service
 * @param service - RDAP service
 * @returns Service URL or undefined
 */
const getServiceUrl = (service: RdapService): string | undefined => {
  const [, urls] = service;
  return urls && urls.length > 0 ? urls[0] : undefined;
};

/**
 * Creates a cache key for RDAP responses
 * @param domain - Domain name
 * @returns Cache key
 */
const createResponseCacheKey = (domain: string): string => {
  return domain.toLowerCase();
};

/**
 * Gets cached RDAP response if available and valid
 * @param domain - Domain name
 * @returns Cached response or undefined
 */
const getCachedResponse = (domain: string): RdapResponse | undefined => {
  const key = createResponseCacheKey(domain);
  const entry = responseCache.get(key);
  
  if (entry && isCacheEntryValid(entry)) {
    return entry.data;
  }
  
  // Clean up expired entry
  if (entry) {
    responseCache.delete(key);
  }
  
  return undefined;
};

/**
 * Caches an RDAP response
 * @param domain - Domain name
 * @param response - RDAP response to cache
 */
const cacheResponse = (domain: string, response: RdapResponse): void => {
  const key = createResponseCacheKey(domain);
  const entry: RdapCacheEntry<RdapResponse> = {
    data: response,
    timestamp: Date.now(),
    ttl: RDAP_CONFIG.RESPONSE_CACHE_TTL
  };
  
  responseCache.set(key, entry);
  
  // Prevent cache from growing too large
  if (responseCache.size > 500) {
    const oldestKey = responseCache.keys().next().value;
    if (oldestKey) {
      responseCache.delete(oldestKey);
    }
  }
};

/**
 * Performs RDAP query with retry logic
 * @param url - RDAP service URL
 * @param domain - Domain name
 * @param retryCount - Current retry attempt
 * @returns Promise resolving to RDAP response
 */
const performRdapQuery = async (
  url: string, 
  domain: string, 
  retryCount: number = 0
): Promise<RdapResult<RdapResponse>> => {
  try {
    const rdapUrl = `${url}domain/${encodeURIComponent(domain)}`;
    
    const fetchPromise = fetch(rdapUrl, {
      headers: {
        'accept': 'application/rdap+json',
        'user-agent': 'DomainCheck/1.0'
      },
      mode: 'cors',
      cache: 'default'
    });
    
    const response: Response = await Promise.race([
      fetchPromise,
      createTimeoutPromise(RDAP_CONFIG.TIMEOUT)
    ]);
    
    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      
      // Check if we should retry (5xx errors or timeouts)
      if (response.status >= 500 && retryCount < RDAP_CONFIG.MAX_RETRIES) {
        console.warn(`RDAP query failed (${response.status}), retrying... (${retryCount + 1}/${RDAP_CONFIG.MAX_RETRIES})`);
        await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1))); // Exponential backoff
        return performRdapQuery(url, domain, retryCount + 1);
      }
      
      return {
        success: false,
        error: `RDAP query failed with status ${response.status}: ${errorText}`,
        provider: url
      };
    }
    
    const rdapResponse: RdapResponse = await response.json();
    
    // Basic validation of RDAP response
    if (!rdapResponse.objectClassName || !rdapResponse.ldhName) {
      return {
        success: false,
        error: 'Invalid RDAP response: missing required fields',
        provider: url
      };
    }
    
    // Cache successful response
    cacheResponse(domain, rdapResponse);
    
    return {
      success: true,
      data: rdapResponse,
      fromCache: false,
      provider: url
    };
    
  } catch (error: any) {
    const errorMessage = error?.message ?? String(error);
    
    // Retry on network errors
    if ((errorMessage.includes('timeout') || errorMessage.includes('network')) && 
        retryCount < RDAP_CONFIG.MAX_RETRIES) {
      console.warn(`RDAP query error (${errorMessage}), retrying... (${retryCount + 1}/${RDAP_CONFIG.MAX_RETRIES})`);
      await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1)));
      return performRdapQuery(url, domain, retryCount + 1);
    }
    
    return {
      success: false,
      error: `RDAP query error: ${errorMessage}`,
      provider: url
    };
  }
};

/**
 * Fetches RDAP data for a domain with comprehensive error handling
 * @param domain - Domain name to query
 * @returns Promise resolving to RDAP response result
 */
export const fetchRdap = async (domain: string): Promise<RdapResult<RdapResponse>> => {
  // Validate domain format
  if (!isValidDomainForRdap(domain)) {
    return {
      success: false,
      error: `Invalid domain format for RDAP query: ${domain}`
    };
  }
  
  // Check cache first
  const cachedResponse = getCachedResponse(domain);
  if (cachedResponse) {
    return {
      success: true,
      data: cachedResponse,
      fromCache: true
    };
  }
  
  // Extract TLD from domain
  const tld = extractTld(domain);
  if (!tld) {
    return {
      success: false,
      error: `Unable to extract TLD from domain: ${domain}`
    };
  }
  
  // Get RDAP services
  const servicesResult = await getServices();
  if (!servicesResult.success || !servicesResult.data) {
    return {
      success: false,
      error: `Failed to fetch RDAP services: ${servicesResult.error}`
    };
  }
  
  // Find appropriate service for TLD
  const service = findServiceForTld(tld, servicesResult.data);
  if (!service) {
    return {
      success: false,
      error: `No RDAP provider found for TLD: .${tld}`
    };
  }
  
  // Get service URL
  const serviceUrl = getServiceUrl(service);
  if (!serviceUrl) {
    return {
      success: false,
      error: `Invalid RDAP service configuration for TLD: .${tld}`
    };
  }
  
  // Perform RDAP query
  return performRdapQuery(serviceUrl, domain);
};

/**
 * Gets list of all supported TLDs from RDAP services
 * @returns Promise resolving to sorted TLD list result
 */
export const getTlds = async (): Promise<RdapResult<string[]>> => {
  const servicesResult = await getServices();
  
  if (!servicesResult.success || !servicesResult.data) {
    return {
      success: false,
      error: `Failed to fetch RDAP services: ${servicesResult.error}`
    };
  }
  
  try {
    const tlds = servicesResult.data
      // Extract TLDs from each service
      .flatMap((service: RdapService) => service[0])
      // Remove leading dots if present
      .map((tld: string) => tld.replace(/^\./, ''))
      // Remove duplicates and sort
      .filter((tld, index, array) => array.indexOf(tld) === index)
      .sort((a, b) => a.localeCompare(b));
    
    return {
      success: true,
      data: tlds,
      fromCache: servicesResult.fromCache
    };
  } catch (error: any) {
    return {
      success: false,
      error: `Failed to process TLD list: ${error?.message ?? error}`
    };
  }
};

/**
 * Clears all RDAP caches
 */
export const clearRdapCache = (): void => {
  bootstrapCache.clear();
  responseCache.clear();
  cachedServices = null;
  lastBootstrapFetch = 0;
};

/**
 * Gets RDAP cache statistics
 * @returns Cache statistics
 */
export const getRdapCacheStats = () => {
  const now = Date.now();
  const bootstrapValid = cachedServices && (now - lastBootstrapFetch < RDAP_CONFIG.BOOTSTRAP_CACHE_TTL);
  const responseEntries = Array.from(responseCache.values());
  const validResponses = responseEntries.filter(entry => isCacheEntryValid(entry));
  
  return {
    bootstrapCached: !!cachedServices,
    bootstrapValid,
    totalResponses: responseCache.size,
    validResponses: validResponses.length,
    expiredResponses: responseEntries.length - validResponses.length,
    memoryUsage: JSON.stringify([
      cachedServices,
      Array.from(responseCache.entries())
    ]).length
  };
};

