import type { DomainAvailabilityStatus } from ".";

/**
 * DNS response status codes as per RFC 1035.
 * 0 = NOERROR, 1 = FORMERR, 2 = SERVFAIL, 3 = NXDOMAIN, 4 = NOTIMP, 5 = REFUSED, etc.
 */
export enum DnsResponseStatus {
  NOERROR = 0,
  FORMERR = 1,
  SERVFAIL = 2,
  NXDOMAIN = 3,
  NOTIMP = 4,
  REFUSED = 5,
  YXDOMAIN = 6,
  YXRRSET = 7,
  NXRRSET = 8,
  NOTAUTH = 9,
  NOTZONE = 10
}

/**
 * Common DNS record types as numeric codes.
 * These are defined in various RFCs (e.g. RFC 1035) and are widely used.
 */
export enum DnsRecordType {
  A = 1,
  NS = 2,
  MD = 3,
  MF = 4,
  CNAME = 5,
  SOA = 6,
  MB = 7,
  MG = 8,
  MR = 9,
  NULL = 10,
  WKS = 11,
  PTR = 12,
  HINFO = 13,
  MINFO = 14,
  MX = 15,
  TXT = 16,
  AAAA = 28,
  SRV = 33
}

/**
 * A DNS query question section.
 * The `type` field corresponds to a DNS record type code.
 */
export interface DnsQuestion {
  name: string;
  type: DnsRecordType;
}

/**
 * A generic DNS record structure for Answer, Authority, and Additional sections.
 * The `type` field corresponds to a DNS record type code.
 */
export interface DnsRecord {
  name: string;
  type: DnsRecordType;
  TTL: number;
  data: string;
}

/**
 * DNS JSON response as provided by Cloudflare DNS over HTTPS.
 * This structure follows the standard DNS message format in JSON.
 */
export interface DnsJsonResponse {
  /** DNS response status code. */
  Status: DnsResponseStatus;

  /** True if the DNS message was truncated. */
  TC: boolean;

  /** True if recursion was desired. */
  RD: boolean;

  /** True if recursion is available. */
  RA: boolean;

  /** True if all responses are authenticated (DNSSEC). */
  AD: boolean;

  /** True if DNSSEC validation was disabled (CD bit set). */
  CD: boolean;

  /** The list of questions asked. Typically a single entry. */
  Question: DnsQuestion[];

  /** The answer section records (if any). */
  Answer?: DnsRecord[];

  /** The authority section records (if any). */
  Authority?: DnsRecord[];

  /** The additional section records (if any). */
  Additional?: DnsRecord[];

  /** The EDNS client subnet, if present (RFC 7871). */
  edns_client_subnet?: string;

  /** Optional comment returned by the server. */
  Comment?: string;
}

export interface DomainDnsInfo {
  status: DomainAvailabilityStatus;
  dnsStatus: DnsResponseStatus;
  hasWebRecords: boolean;
  hasSOA: boolean;
  hasParentSOA: boolean;
  recordTypes: DnsRecordType[];
  confidence: 'high' | 'medium' | 'low';
}
