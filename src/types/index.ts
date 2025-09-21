
/**
 * Domain availability status enum
 * Represents the possible states of a domain name's registration status
 */
export enum DomainAvailabilityStatus {
  /** Domain is not available for registration */
  NOTAVAILABLE = 0,
  /** Domain is available for registration */
  AVAILABLE = 1,
  /** Domain availability status is unknown or uncertain */
  UNKNOWN = 2
}

/**
 * Interface representing basic domain properties
 */
export interface IDomain {
  readonly label: string;
  readonly tld: string;
  readonly name: string;
  readonly availabilityStatus?: DomainAvailabilityStatus;
}

/**
 * Serializable domain data for JSON storage
 */
export interface DomainData {
  readonly name: string;
  readonly availability?: DomainAvailabilityStatus;
  readonly isInWatchList?: boolean;
  readonly isChecking?: boolean;
  readonly creationDate?: string; // ISO string
  readonly expirationDate?: string; // ISO string
  readonly registrar?: string;
  readonly lastChecked?: string; // ISO string
}

/**
 * Domain entity representing a domain name with its status and metadata
 * Immutable by design - use with() method for updates
 */
export class Domain implements IDomain {
  constructor(
    public readonly name: string,
    public readonly availability?: DomainAvailabilityStatus,
    public readonly isInWatchList: boolean = false,
    public readonly isChecking: boolean = false,
    public readonly creationDate?: Date,
    public readonly expirationDate?: Date,
    public readonly registrar?: string,
    public readonly lastChecked?: Date
  ) {
    // Parse label and TLD from name
    const [labelPart = '', tldPart = ''] = name.split('.');
    this._label = labelPart;
    this._tld = tldPart;
  }

  private readonly _label: string;
  private readonly _tld: string;

  /**
   * Domain label (second-level domain)
   */
  get label(): string {
    return this._label;
  }

  /**
   * Top-level domain
   */
  get tld(): string {
    return this._tld;
  }

  /**
   * Legacy property for compatibility
   * @deprecated Use availability instead
   */
  get availabilityStatus(): DomainAvailabilityStatus | undefined {
    return this.availability;
  }

  /**
   * Creates a new Domain instance with updated properties
   * @param updates - Partial properties to update
   * @returns New Domain instance with merged properties
   */
  with(updates: Partial<Omit<Domain, 'name' | 'label' | 'tld'>>): Domain {
    return new Domain(
      this.name,
      updates.availability ?? this.availability,
      updates.isInWatchList ?? this.isInWatchList,
      updates.isChecking ?? this.isChecking,
      updates.creationDate ?? this.creationDate,
      updates.expirationDate ?? this.expirationDate,
      updates.registrar ?? this.registrar,
      updates.lastChecked ?? this.lastChecked
    );
  }

  /**
   * Gets the full HTTPS URL for this domain
   * @returns Full URL string
   */
  getFullUrl(): string {
    return `https://${this.name}`;
  }

  /**
   * Checks if domain is available for registration
   * @returns true if domain is available
   */
  get isAvailable(): boolean {
    return this.availability === DomainAvailabilityStatus.AVAILABLE;
  }

  /**
   * Checks if domain is registered/not available
   * @returns true if domain is not available
   */
  get isNotAvailable(): boolean {
    return this.availability === DomainAvailabilityStatus.NOTAVAILABLE;
  }

  /**
   * Checks if domain status is unknown/uncertain
   * @returns true if availability is unknown
   */
  get isUnknown(): boolean {
    return this.availability === DomainAvailabilityStatus.UNKNOWN || this.availability === undefined;
  }

  /**
   * Checks if domain data needs refresh based on last check time
   * @param maxAgeMs - Maximum age in milliseconds (default: 1 hour)
   * @returns true if domain data is stale
   */
  isStale(maxAgeMs: number = 3600000): boolean {
    if (!this.lastChecked) return true;
    return Date.now() - this.lastChecked.getTime() > maxAgeMs;
  }

  /**
   * Validates basic domain name format
   * @returns true if domain name appears valid
   */
  get isValidFormat(): boolean {
    if (!this.name || typeof this.name !== 'string') return false;
    const domainRegex = /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
    return domainRegex.test(this.name) && this.name.length <= 253;
  }

  /**
   * Checks if domain is expired based on expiration date
   * @returns true if domain is expired
   */
  get isExpired(): boolean {
    if (!this.expirationDate) return false;
    return this.expirationDate < new Date();
  }

  /**
   * Gets days until expiration
   * @returns Number of days until expiration, or null if no expiration date
   */
  get daysUntilExpiration(): number | null {
    if (!this.expirationDate) return null;
    const diffMs = this.expirationDate.getTime() - Date.now();
    return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  }

  /**
   * Converts domain to JSON-serializable object
   * @returns Plain object representation
   */
  toJSON(): DomainData {
    return {
      name: this.name,
      availability: this.availability,
      isInWatchList: this.isInWatchList,
      isChecking: this.isChecking,
      creationDate: this.creationDate?.toISOString(),
      expirationDate: this.expirationDate?.toISOString(),
      registrar: this.registrar,
      lastChecked: this.lastChecked?.toISOString()
    };
  }

  /**
   * Creates Domain instance from JSON data
   * @param data - Serialized domain data
   * @returns Domain instance
   */
  static fromJSON(data: DomainData): Domain {
    return new Domain(
      data.name,
      data.availability,
      data.isInWatchList ?? false,
      data.isChecking ?? false,
      data.creationDate ? new Date(data.creationDate) : undefined,
      data.expirationDate ? new Date(data.expirationDate) : undefined,
      data.registrar,
      data.lastChecked ? new Date(data.lastChecked) : undefined
    );
  }

  /**
   * Creates a Domain instance with checking status enabled
   * @param name - Domain name
   * @returns Domain instance marked as checking
   */
  static checking(name: string): Domain {
    return new Domain(name, undefined, false, true);
  }
}