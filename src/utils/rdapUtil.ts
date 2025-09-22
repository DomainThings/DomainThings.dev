import type { RdapResponse, RdapEvent } from '@/types/rdap';
import { DomainAvailabilityStatus } from '@/types';

/**
 * RDAP utility functions for extracting domain information
 */

/**
 * Result type for enhanced domain checks
 */
export interface DomainCheckResult {
  readonly availability: DomainAvailabilityStatus;
  readonly expirationDate?: Date;
  readonly creationDate?: Date;
  readonly registrar?: string;
  readonly confidence: 'high' | 'medium' | 'low';
  readonly source: 'rdap' | 'dns' | 'hybrid';
}

/**
 * Extracts expiration date from RDAP response
 * @param rdapResponse - RDAP response object
 * @returns Date object representing expiration date, or undefined if not found
 */
export const extractExpirationDate = (rdapResponse: RdapResponse): Date | undefined => {
  if (!rdapResponse.events || rdapResponse.events.length === 0) {
    return undefined;
  }

  // Look for expiration event in RDAP events
  const expirationEvent = rdapResponse.events.find(
    (event: RdapEvent) => event.eventAction === 'expiration'
  );

  if (!expirationEvent?.eventDate) {
    return undefined;
  }

  try {
    return new Date(expirationEvent.eventDate);
  } catch (error) {
    console.warn('Invalid expiration date format in RDAP response:', expirationEvent.eventDate);
    return undefined;
  }
};

/**
 * Extracts creation/registration date from RDAP response
 * @param rdapResponse - RDAP response object
 * @returns Date object representing creation date, or undefined if not found
 */
export const extractCreationDate = (rdapResponse: RdapResponse): Date | undefined => {
  if (!rdapResponse.events || rdapResponse.events.length === 0) {
    return undefined;
  }

  // Look for registration event in RDAP events
  const creationEvent = rdapResponse.events.find(
    (event: RdapEvent) => event.eventAction === 'registration'
  );

  if (!creationEvent?.eventDate) {
    return undefined;
  }

  try {
    return new Date(creationEvent.eventDate);
  } catch (error) {
    console.warn('Invalid creation date format in RDAP response:', creationEvent.eventDate);
    return undefined;
  }
};

/**
 * Extracts registrar information from RDAP response
 * @param rdapResponse - RDAP response object
 * @returns Registrar name or undefined if not found
 */
export const extractRegistrar = (rdapResponse: RdapResponse): string | undefined => {
  if (!rdapResponse.entities || rdapResponse.entities.length === 0) {
    return undefined;
  }

  // Look for registrar entity
  const registrarEntity = rdapResponse.entities.find(
    entity => entity.roles?.includes('registrar')
  );

  if (!registrarEntity?.vcardArray?.[1]) {
    return undefined;
  }

  // Extract organization name from vCard
  const vcardData = registrarEntity.vcardArray[1];
  const orgField = vcardData.find(
    field => Array.isArray(field) && field[0] === 'org'
  );

  if (orgField && Array.isArray(orgField[3])) {
    return orgField[3][0] as string;
  }

  // Fallback to fn (formatted name) field
  const fnField = vcardData.find(
    field => Array.isArray(field) && field[0] === 'fn'
  );

  if (fnField && typeof fnField[3] === 'string') {
    return fnField[3];
  }

  return undefined;
};

/**
 * Formats a date for display in a compact format
 * @param date - Date to format
 * @param locale - Locale for formatting (default: 'fr-FR')
 * @returns Formatted date string
 */
export const formatCompactDate = (date: Date, locale: string = 'fr-FR'): string => {
  return date.toLocaleDateString(locale, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
};

/**
 * Gets the number of days until a date
 * @param date - Target date
 * @returns Number of days (positive for future, negative for past)
 */
export const getDaysUntil = (date: Date): number => {
  const diffMs = date.getTime() - Date.now();
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
};

/**
 * Checks if a date is considered "soon" (within specified days)
 * @param date - Date to check
 * @param daysThreshold - Days threshold (default: 30)
 * @returns true if date is within threshold
 */
export const isSoon = (date: Date, daysThreshold: number = 30): boolean => {
  const days = getDaysUntil(date);
  return days >= 0 && days <= daysThreshold;
};

/**
 * Creates a domain check result from RDAP response
 * @param rdapResponse - RDAP response object
 * @returns Domain check result with high confidence
 */
export const createDomainCheckFromRdap = (rdapResponse: RdapResponse): DomainCheckResult => {
  const expirationDate = extractExpirationDate(rdapResponse);
  const creationDate = extractCreationDate(rdapResponse);
  const registrar = extractRegistrar(rdapResponse);
  
  return {
    availability: DomainAvailabilityStatus.NOTAVAILABLE,
    expirationDate,
    creationDate,
    registrar,
    confidence: 'high',
    source: 'rdap'
  };
};

/**
 * Creates a domain check result for DNS-only checks
 * @param availability - Domain availability status from DNS
 * @returns Domain check result with medium confidence
 */
export const createDomainCheckFromDns = (availability: DomainAvailabilityStatus): DomainCheckResult => {
  return {
    availability,
    confidence: availability === DomainAvailabilityStatus.AVAILABLE ? 'high' : 'medium',
    source: 'dns'
  };
};

/**
 * Creates a hybrid domain check result (DNS + partial RDAP)
 * @param availability - Domain availability status from DNS
 * @param rdapData - Partial RDAP data if available
 * @returns Domain check result with hybrid source
 */
export const createHybridDomainCheck = (
  availability: DomainAvailabilityStatus, 
  rdapData?: {
    expirationDate?: Date;
    creationDate?: Date;
    registrar?: string;
  }
): DomainCheckResult => {
  return {
    availability,
    ...rdapData,
    confidence: rdapData ? 'high' : 'medium',
    source: 'hybrid'
  };
};
