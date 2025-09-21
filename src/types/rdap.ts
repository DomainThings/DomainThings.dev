/**
 * RDAP (Registration Data Access Protocol) type definitions
 * @see https://tools.ietf.org/html/rfc7483
 */

/**
 * RDAP bootstrap configuration from IANA
 */
export interface RdapBootstrap {
  readonly version: string;
  readonly description: string;
  readonly publication: string;
  readonly services: readonly RdapService[];
}

/**
 * RDAP service configuration - [TLDs[], ServiceURLs[]]
 */
export type RdapService = readonly [readonly string[], readonly string[]];

/**
 * RDAP link object as defined in RFC 7483
 */
export interface RdapLink {
  readonly value: string;
  readonly rel: string;
  readonly href: string;
  readonly hreflang?: readonly string[];
  readonly type?: string;
  readonly media?: string;
  readonly title?: string;
}

/**
 * RDAP status values as defined in RFC 7483
 */
export type RdapStatus =
  | "unknown"
  | "validated"
  | "renew prohibited"
  | "update prohibited"
  | "transfer prohibited"
  | "delete prohibited"
  | "proxy"
  | "private"
  | "removed"
  | "obscured"
  | "associated"
  | "active"
  | "inactive"
  | "locked"
  | "pending create"
  | "pending renew"
  | "pending transfer"
  | "pending update"
  | "pending delete";

/**
 * RDAP notice and remark types as defined in RFC 7483
 */
export type RdapNoticeAndRemarkTypes =
  | "result set truncated due to authorization"
  | "result set truncated due to excessive load"
  | "result set truncated due to unexplainable reasons"
  | "object truncated due to authorization"
  | "object truncated due to excessive load"
  | "object truncated due to unexplainable reasons";

/**
 * RDAP notice object
 */
export interface RdapNotice {
  readonly title?: string;
  readonly type?: RdapNoticeAndRemarkTypes;
  readonly description: readonly string[];
  readonly links?: readonly RdapLink[];
}

/**
 * Main RDAP response object for domain queries
 */
export interface RdapResponse {
  readonly objectClassName: string;
  readonly handle: string;
  readonly ldhName: string;
  readonly nameservers?: readonly RdapNameserver[];
  readonly secureDNS?: {
    readonly delegationSigned: boolean;
  };
  readonly links?: readonly RdapLink[];
  readonly entities?: readonly RdapEntity[];
  readonly events?: readonly RdapEvent[];
  readonly status?: readonly RdapStatus[];
  readonly notices?: readonly RdapNotice[];
  readonly rdapConformance?: readonly string[];
  readonly port43?: string;
}

/**
 * RDAP event object representing domain lifecycle events
 */
export interface RdapEvent {
  readonly eventAction: string;
  readonly eventDate: string;
  readonly eventActor?: string;
  readonly status?: readonly RdapStatus[];
  readonly links?: readonly RdapLink[];
}

/**
 * RDAP nameserver object
 */
export interface RdapNameserver {
  readonly objectClassName: string;
  readonly handle?: string;
  readonly ldhName?: string;
  readonly unicodeName?: string;
  readonly ipAddresses?: {
    readonly v6?: readonly string[];
    readonly v4?: readonly string[];
  };
  readonly entities?: readonly RdapEntity[];
  readonly status?: readonly RdapStatus[];
  readonly remarks?: readonly RdapNotice[];
  readonly links?: readonly RdapLink[];
  readonly port43?: string;
  readonly events?: readonly RdapEvent[];
}

/**
 * Public identifier for RDAP entities
 */
export interface PublicId {
  readonly type: string;
  readonly identifier: string;
}

/**
 * RDAP entity object representing persons, organizations, or roles
 */
export interface RdapEntity {
  readonly objectClassName: string;
  readonly handle?: string;
  readonly vcardArray?: readonly [
    string,
    readonly (readonly [string, object, string, string] | readonly [string, object, string, readonly string[]])[]
  ];
  readonly roles?: readonly string[];
  readonly publicIds?: readonly PublicId[];
  readonly entities?: readonly RdapEntity[];
  readonly events?: readonly RdapEvent[];
  readonly links?: readonly RdapLink[];
  readonly legalRepresentative?: string;
}