import type { DomainAvailabilityStatus } from ".";

/**
 * DNS response status codes as per RFC 1035.
 * These codes indicate the outcome of a DNS query operation.
 * @see https://www.iana.org/assignments/dns-parameters/dns-parameters.xhtml#dns-parameters-6
 */
export enum DnsResponseStatus {
  /** No error condition */
  NOERROR = 0,
  /** Format error - The name server was unable to interpret the query */
  FORMERR = 1,
  /** Server failure - The name server was unable to process this query due to a problem with the name server */
  SERVFAIL = 2,
  /** Name Error - Meaningful only for responses from an authoritative name server, this code signifies that the domain name referenced in the query does not exist */
  NXDOMAIN = 3,
  /** Not Implemented - The name server does not support the requested kind of query */
  NOTIMP = 4,
  /** Refused - The name server refuses to perform the specified operation for policy reasons */
  REFUSED = 5,
  /** Name Exists when it should not */
  YXDOMAIN = 6,
  /** RR Set Exists when it should not */
  YXRRSET = 7,
  /** RR Set that should exist does not */
  NXRRSET = 8,
  /** Server Not Authoritative for zone / Not Authorized */
  NOTAUTH = 9,
  /** Name not contained in zone */
  NOTZONE = 10
}

/**
 * Common DNS record types as numeric codes.
 * These are defined in RFC 1035 and subsequent RFCs, maintained by IANA.
 * @see https://www.iana.org/assignments/dns-parameters/dns-parameters.xhtml#dns-parameters-4
 */
export enum DnsRecordType {
  /** IPv4 address record */
  A = 1,
  /** Authoritative name server */
  NS = 2,
  /** Mail destination (obsolete) */
  MD = 3,
  /** Mail forwarder (obsolete) */
  MF = 4,
  /** Canonical name for an alias */
  CNAME = 5,
  /** Start of a zone of authority */
  SOA = 6,
  /** Mailbox domain name (experimental) */
  MB = 7,
  /** Mail group member (experimental) */
  MG = 8,
  /** Mail rename domain name (experimental) */
  MR = 9,
  /** Null RR (experimental) */
  NULL = 10,
  /** Well known service description */
  WKS = 11,
  /** Domain name pointer */
  PTR = 12,
  /** Host information */
  HINFO = 13,
  /** Mailbox or mail list information */
  MINFO = 14,
  /** Mail exchange */
  MX = 15,
  /** Text strings */
  TXT = 16,
  /** IPv6 address record */
  AAAA = 28,
  /** Service locator */
  SRV = 33
}

/**
 * A DNS query question section.
 * The `type` field corresponds to a DNS record type code.
 */
export interface DnsQuestion {
  readonly name: string;
  readonly type: DnsRecordType;
}

/**
 * A generic DNS record structure for Answer, Authority, and Additional sections.
 * The `type` field corresponds to a DNS record type code.
 */
export interface DnsRecord {
  readonly name: string;
  readonly type: DnsRecordType;
  readonly TTL: number;
  readonly data: string;
}

/**
 * DNS JSON response as provided by Cloudflare DNS over HTTPS.
 * This structure follows the standard DNS message format in JSON.
 * @see https://developers.cloudflare.com/1.1.1.1/encryption/dns-over-https/make-api-requests/dns-json/
 */
export interface DnsJsonResponse {
  /** DNS response status code. */
  readonly Status: DnsResponseStatus;

  /** True if the DNS message was truncated. */
  readonly TC: boolean;

  /** True if recursion was desired. */
  readonly RD: boolean;

  /** True if recursion is available. */
  readonly RA: boolean;

  /** True if all responses are authenticated (DNSSEC). */
  readonly AD: boolean;

  /** True if DNSSEC validation was disabled (CD bit set). */
  readonly CD: boolean;

  /** The list of questions asked. Typically a single entry. */
  readonly Question: readonly DnsQuestion[];

  /** The answer section records (if any). */
  readonly Answer?: readonly DnsRecord[];

  /** The authority section records (if any). */
  readonly Authority?: readonly DnsRecord[];

  /** The additional section records (if any). */
  readonly Additional?: readonly DnsRecord[];

  /** The EDNS client subnet, if present (RFC 7871). */
  edns_client_subnet?: string;

  /** Optional comment returned by the server. */
  Comment?: string;
}

/**
 * Comprehensive DNS information for domain analysis.
 * Provides detailed insights into DNS response and availability confidence.
 */
export interface DomainDnsInfo {
  status: DomainAvailabilityStatus;
  dnsStatus: DnsResponseStatus;
  hasWebRecords: boolean;
  hasSOA: boolean;
  hasParentSOA: boolean;
  recordTypes: DnsRecordType[];
  confidence: 'high' | 'medium' | 'low';
}
