import { DomainAvailabilityStatus } from '@/types';
import { 
  DnsRecordType, 
  DnsResponseStatus,
  type DnsJsonResponse,
  type DomainDnsInfo 
} from '@/types/dns';

/**
 * Cloudflare DNS over HTTPS endpoint
 * @see https://developers.cloudflare.com/1.1.1.1/encryption/dns-over-https/
 */
const DNS_OVER_HTTPS_URL = 'https://cloudflare-dns.com/dns-query';

/**
 * Default timeout for DNS queries in milliseconds
 */
const DNS_QUERY_TIMEOUT = 10000; // 10 seconds

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
 * Validates a domain name format
 * @param domain - Domain to validate
 * @returns true if domain format is valid
 */
const isValidDomain = (domain: string): boolean => {
  if (!domain || typeof domain !== 'string') return false;
  
  // Basic domain validation - contains at least one dot and valid characters
  const domainRegex = /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
  return domainRegex.test(domain) && domain.length <= 253;
};

/**
 * Creates a timeout promise for fetch operations
 * @param timeoutMs - Timeout in milliseconds
 * @returns Promise that rejects after timeout
 */
const createTimeoutPromise = (timeoutMs: number): Promise<never> => {
  return new Promise((_, reject) => {
    setTimeout(() => reject(new Error('DNS query timeout')), timeoutMs);
  });
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
 * @returns Promise resolving to the DNS response in JSON format
 * @throws Error if the DNS query fails or returns an error
 */
export const fetchDns = async (domain: string, type: DnsRecordType = DnsRecordType.A): Promise<DnsJsonResponse> => {
  // Validate domain format before making the request
  if (!isValidDomain(domain)) {
    throw new Error(`Invalid domain format: ${domain}`);
  }

  try {
    const fetchPromise = fetch(`${DNS_OVER_HTTPS_URL}?name=${domain}&type=${type}`, {
      headers: {
        accept: 'application/dns-json'
      }
    });
    
    // Race between fetch and timeout
    const response: Response = await Promise.race([
      fetchPromise,
      createTimeoutPromise(DNS_QUERY_TIMEOUT)
    ]);
    
    if (!response.ok) {
      const errorMessage: string = await response.text();
      throw new Error(`DNS query failed with status ${response.status}: ${errorMessage}`);
    }
    
    const dnsResponseAsJson: DnsJsonResponse = await response.json();
    return dnsResponseAsJson;
  } catch (error: any) {
    // Re-throw with more context if not already our error
    if (error.message?.includes('DNS query') || error.message?.includes('Invalid domain') || error.message?.includes('timeout')) {
      throw error;
    }
    throw new Error(`DNS lookup error: ${error.message ?? error}`);
  }
}

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
  try {
    // Primary check using A record query
    const dnsResponse: DnsJsonResponse = await fetchDns(domain, DnsRecordType.A);
    
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
  } catch (error) {
    // Network or other errors result in unknown status
    return DomainAvailabilityStatus.UNKNOWN;
  }
}

/**
 * Performs additional SOA record check for edge cases
 * Used when initial query shows parent SOA but no direct domain records
 * 
 * @param domain - The domain to check
 * @returns Promise resolving to availability status
 */
const performSOACheck = async (domain: string): Promise<DomainAvailabilityStatus> => {
  try {
    const soaResponse = await fetchDns(domain, DnsRecordType.SOA);
    
    if (soaResponse.Status === DnsResponseStatus.NOERROR && 
        soaResponse.Answer && 
        soaResponse.Answer.length > 0) {
      return DomainAvailabilityStatus.NOTAVAILABLE; // Domain has direct SOA
    }
    
    return DomainAvailabilityStatus.AVAILABLE; // No direct SOA, likely available
  } catch {
    return DomainAvailabilityStatus.UNKNOWN; // Error during SOA check
  }
}

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

  try {
    // Primary DNS lookup using A record
    const dnsResponse: DnsJsonResponse = await fetchDns(domain, DnsRecordType.A);
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
        try {
          const soaResponse = await fetchDns(domain, DnsRecordType.SOA);
          if (soaResponse.Status === DnsResponseStatus.NOERROR && 
              soaResponse.Answer && 
              soaResponse.Answer.length > 0) {
            info.hasSOA = true;
            info.status = DomainAvailabilityStatus.NOTAVAILABLE;
            info.confidence = 'high';
          } else {
            info.status = DomainAvailabilityStatus.AVAILABLE;
            info.confidence = 'medium';
          }
        } catch {
          info.status = DomainAvailabilityStatus.UNKNOWN;
          info.confidence = 'low';
        }
        return info;
      }
    }
    
    // NOERROR without clear indicators
    info.status = DomainAvailabilityStatus.UNKNOWN;
    info.confidence = 'low';
    
  } catch (error) {
    info.status = DomainAvailabilityStatus.UNKNOWN;
    info.confidence = 'low';
  }
  
  return info;
}