/**
 * PWA Alert Service for Domain Expiration Notifications
 * 
 * Provides comprehensive domain expiration alert management with:
 * - Database persistence
 * - Service Worker integration for background notifications
 * - Permission management
 * - Legacy data migration
 * 
 * @example
 * ```typescript
 * import { alertService } from '@/services/alertService';
 * 
 * // Create an alert
 * const alert = await alertService.saveAlert({
 *   domain: 'example.com',
 *   enabled: true,
 *   alertDate: new Date('2025-12-01'),
 *   reminderFrequency: 'weekly',
 *   expirationDate: new Date('2025-12-31')
 * });
 * 
 * // Get alerts for a domain
 * const existingAlert = await alertService.getAlertByDomain('example.com');
 * ```
 */
import * as db from './dbService';

// ===== Types et Interfaces =====

/**
 * Reminder frequency options for alert notifications
 */
export type ReminderFrequency = 'once' | 'daily' | 'weekly';

/**
 * Notification permission status
 */
export type NotificationPermissionStatus = 'granted' | 'denied' | 'default';

/**
 * Alert configuration settings
 */
export interface AlertSettings {
  readonly id: string;
  readonly domain: string;
  readonly enabled: boolean;
  readonly alertDate: Date;
  readonly reminderFrequency: ReminderFrequency;
  readonly expirationDate: Date;
  readonly createdAt: Date;
  readonly lastNotified?: Date;
}

/**
 * Input type for creating new alerts (excludes generated fields)
 */
export type CreateAlertInput = Omit<AlertSettings, 'id' | 'createdAt'>;

/**
 * Notification payload structure for Service Worker
 */
export interface NotificationPayload {
  readonly title: string;
  readonly body: string;
  readonly icon?: string;
  readonly badge?: string;
  readonly tag: string;
  readonly data?: Record<string, unknown>;
  readonly actions?: readonly NotificationAction[];
  readonly silent?: boolean;
  readonly requireInteraction?: boolean;
  readonly timestamp?: number;
}

/**
 * Notification action button configuration
 */
export interface NotificationAction {
  readonly action: string;
  readonly title: string;
  readonly icon?: string;
}

/**
 * Service Worker message types for alert management
 */
export enum AlertServiceWorkerMessageType {
  SYNC_ALERTS = 'SYNC_ALERTS',
  CHECK_NOTIFICATIONS = 'CHECK_NOTIFICATIONS',
  SHOW_NOTIFICATION = 'SHOW_NOTIFICATION'
}

/**
 * Service Worker message structure
 */
export interface AlertServiceWorkerMessage {
  readonly type: AlertServiceWorkerMessageType;
  readonly alerts?: readonly AlertSettings[];
  readonly payload?: NotificationPayload;
  readonly timestamp?: string;
}

/**
 * Notification support check result
 */
export interface NotificationSupportResult {
  readonly supported: boolean;
  readonly permission: NotificationPermissionStatus;
  readonly serviceWorkerAvailable: boolean;
}

/**
 * Alert service error types
 */
export class AlertServiceError extends Error {
  constructor(
    message: string,
    public readonly code: AlertServiceErrorCode,
    public readonly originalError?: Error
  ) {
    super(message);
    this.name = 'AlertServiceError';
  }
}

/**
 * Alert service error codes
 */
export enum AlertServiceErrorCode {
  INITIALIZATION_FAILED = 'INITIALIZATION_FAILED',
  SERVICE_WORKER_UNAVAILABLE = 'SERVICE_WORKER_UNAVAILABLE',
  NOTIFICATION_NOT_SUPPORTED = 'NOTIFICATION_NOT_SUPPORTED',
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  DATABASE_ERROR = 'DATABASE_ERROR',
  INVALID_INPUT = 'INVALID_INPUT',
  DOMAIN_NOT_FOUND = 'DOMAIN_NOT_FOUND',
  SYNC_FAILED = 'SYNC_FAILED'
}

// ===== Configuration et Constantes =====

/**
 * Service configuration constants
 */
const ALERT_SERVICE_CONFIG = Object.freeze({
  maxInitializationAttempts: 50,
  initializationTimeoutMs: 100,
  maxInitializationWaitMs: 5000,
  legacyStorageKey: 'domain-alerts'
} as const);

// ===== Utilitaires privés =====

/**
 * Check if Service Worker is available
 */
const isServiceWorkerSupported = (): boolean => {
  return typeof navigator !== 'undefined' && 'serviceWorker' in navigator;
};

/**
 * Check if Notification API is available
 */
const isNotificationAPISupported = (): boolean => {
  return typeof window !== 'undefined' && 'Notification' in window;
};

/**
 * Validate domain string format
 */
const isValidDomain = (domain: string): boolean => {
  if (!domain || typeof domain !== 'string') return false;
  
  // Basic domain validation regex
  const domainRegex = /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
  return domainRegex.test(domain) && domain.length <= 253;
};

/**
 * Validate alert settings input
 */
const validateAlertInput = (input: CreateAlertInput): void => {
  if (!input || typeof input !== 'object') {
    throw new AlertServiceError(
      'Alert input must be a valid object',
      AlertServiceErrorCode.INVALID_INPUT
    );
  }

  if (!isValidDomain(input.domain)) {
    throw new AlertServiceError(
      `Invalid domain format: ${input.domain}`,
      AlertServiceErrorCode.INVALID_INPUT
    );
  }

  if (typeof input.enabled !== 'boolean') {
    throw new AlertServiceError(
      'Alert enabled flag must be a boolean',
      AlertServiceErrorCode.INVALID_INPUT
    );
  }

  if (!(input.alertDate instanceof Date) || isNaN(input.alertDate.getTime())) {
    throw new AlertServiceError(
      'Alert date must be a valid Date object',
      AlertServiceErrorCode.INVALID_INPUT
    );
  }

  if (!['once', 'daily', 'weekly'].includes(input.reminderFrequency)) {
    throw new AlertServiceError(
      'Reminder frequency must be one of: once, daily, weekly',
      AlertServiceErrorCode.INVALID_INPUT
    );
  }

  if (!(input.expirationDate instanceof Date) || isNaN(input.expirationDate.getTime())) {
    throw new AlertServiceError(
      'Expiration date must be a valid Date object',
      AlertServiceErrorCode.INVALID_INPUT
    );
  }
};

/**
 * Generate unique alert ID
 */
const generateAlertId = (domain: string): string => {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substr(2, 9);
  return `alert_${domain.replace(/\./g, '_')}_${timestamp}_${random}`;
};

// ===== Service Principal =====

/**
 * Singleton service for managing domain expiration alerts
 * 
 * Features:
 * - Database persistence with automatic migration
 * - Service Worker integration for background notifications
 * - Notification permission management
 * - Type-safe API with comprehensive error handling
 * - Performance optimized with caching
 */
class AlertService {
  private static instance: AlertService | null = null;
  private readonly alerts: Map<string, AlertSettings> = new Map();
  private serviceWorker: ServiceWorker | null = null;
  private isInitialized: boolean = false;
  private initializationPromise: Promise<void> | null = null;

  private constructor() {
    // Private constructor for singleton pattern
  }

  /**
   * Get the singleton instance of AlertService
   * 
   * @returns The AlertService instance
   */
  static getInstance(): AlertService {
    if (!AlertService.instance) {
      AlertService.instance = new AlertService();
    }
    return AlertService.instance;
  }

  /**
   * Initialize the service (called automatically on first use)
   * 
   * @throws {AlertServiceError} When initialization fails
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    this.initializationPromise = this.performInitialization();
    
    try {
      await this.initializationPromise;
    } finally {
      this.initializationPromise = null;
    }
  }

  /**
   * Perform the actual initialization logic
   */
  private async performInitialization(): Promise<void> {
    try {
      // Initialize Service Worker first
      await this.initializeServiceWorker();
      
      // Then load alerts from database
      await this.loadAlertsFromDatabase();
      
      this.isInitialized = true;
      console.info('AlertService initialized successfully');
      
    } catch (error) {
      this.isInitialized = true; // Prevent infinite retry loops
      
      const alertError = new AlertServiceError(
        'Failed to initialize AlertService',
        AlertServiceErrorCode.INITIALIZATION_FAILED,
        error instanceof Error ? error : new Error(String(error))
      );
      
      console.error('AlertService initialization failed:', alertError);
      throw alertError;
    }
  }

  /**
   * Ensure service is initialized before operations
   */
  private async ensureInitialized(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    // If initialization is in progress, wait for it
    if (this.initializationPromise) {
      await this.initializationPromise;
      return;
    }

    // Start initialization
    await this.initialize();
  }

  /**
   * Initialize Service Worker for background notifications
   */
  private async initializeServiceWorker(): Promise<void> {
    if (!isServiceWorkerSupported()) {
      console.warn('Service Worker not supported, background notifications unavailable');
      return;
    }

    try {
      const registration = await navigator.serviceWorker.ready;
      this.serviceWorker = registration.active || registration.waiting || registration.installing || null;
      
      if (this.serviceWorker) {
        console.info('Service Worker initialized for alerts');
      } else {
        console.warn('No active Service Worker found');
      }
    } catch (error) {
      const swError = new AlertServiceError(
        'Failed to initialize Service Worker',
        AlertServiceErrorCode.SERVICE_WORKER_UNAVAILABLE,
        error instanceof Error ? error : new Error(String(error))
      );
      
      console.error('Service Worker initialization failed:', swError);
      // Don't throw here, service can work without SW
    }
  }

  /**
   * Check notification support and permissions
   * 
   * @returns Comprehensive support information
   * 
   * @example
   * ```typescript
   * const support = await alertService.checkNotificationSupport();
   * if (support.supported && support.permission === 'granted') {
   *   // Notifications are fully supported
   * }
   * ```
   */
  async checkNotificationSupport(): Promise<NotificationSupportResult> {
    const supported = isNotificationAPISupported();
    const permission: NotificationPermissionStatus = supported ? Notification.permission : 'denied';
    const serviceWorkerAvailable = this.serviceWorker !== null;

    return {
      supported,
      permission,
      serviceWorkerAvailable
    };
  }

  /**
   * Request notification permission from user
   * 
   * @returns The permission status after the request
   * @throws {AlertServiceError} When notification API is not supported
   * 
   * @example
   * ```typescript
   * try {
   *   const permission = await alertService.requestNotificationPermission();
   *   if (permission === 'granted') {
   *     console.log('Notifications enabled');
   *   }
   * } catch (error) {
   *   console.error('Failed to request permission:', error);
   * }
   * ```
   */
  async requestNotificationPermission(): Promise<NotificationPermissionStatus> {
    if (!isNotificationAPISupported()) {
      throw new AlertServiceError(
        'Notification API not supported in this environment',
        AlertServiceErrorCode.NOTIFICATION_NOT_SUPPORTED
      );
    }

    try {
      const permission = Notification.permission === 'default' 
        ? await Notification.requestPermission()
        : Notification.permission;
      
      console.info('Notification permission status:', permission);
      return permission;
    } catch (error) {
      const alertError = new AlertServiceError(
        'Failed to request notification permission',
        AlertServiceErrorCode.PERMISSION_DENIED,
        error instanceof Error ? error : new Error(String(error))
      );
      
      console.error('Permission request failed:', alertError);
      throw alertError;
    }
  }

  /**
   * Create or update an alert for a domain
   * 
   * @param alertInput - Alert configuration (without ID and createdAt)
   * @returns The created alert settings
   * @throws {AlertServiceError} When save operation fails
   * 
   * @example
   * ```typescript
   * const alert = await alertService.saveAlert({
   *   domain: 'example.com',
   *   enabled: true,
   *   alertDate: new Date('2025-12-01'),
   *   reminderFrequency: 'weekly',
   *   expirationDate: new Date('2025-12-31')
   * });
   * ```
   */
  async saveAlert(alertInput: CreateAlertInput): Promise<AlertSettings> {
    await this.ensureInitialized();
    
    // Validate input
    validateAlertInput(alertInput);
    
    try {
      // Remove existing alert for this domain
      await this.removeAlertByDomain(alertInput.domain);
      
      // Create new alert
      const alert: AlertSettings = {
        id: generateAlertId(alertInput.domain),
        ...alertInput,
        createdAt: new Date()
      };

      // Save to database
      const alertRecord: db.AlertRecord = {
        id: alert.id,
        domain: alert.domain,
        enabled: alert.enabled,
        alertDate: alert.alertDate.toISOString(),
        reminderFrequency: alert.reminderFrequency,
        expirationDate: alert.expirationDate.toISOString(),
        createdAt: alert.createdAt.toISOString(),
        lastNotified: alert.lastNotified?.toISOString()
      };
      
      const result = await db.saveAlert(alertRecord);
      if (!result.success) {
        throw new AlertServiceError(
          result.error || 'Database save operation failed',
          AlertServiceErrorCode.DATABASE_ERROR
        );
      }
      
      // Update local cache
      this.alerts.set(alert.id, alert);
      
      // Sync with Service Worker
      await this.syncAlertsToServiceWorker();
      
      console.info('Alert saved successfully:', alert.domain);
      return alert;
      
    } catch (error) {
      if (error instanceof AlertServiceError) {
        throw error;
      }
      
      const alertError = new AlertServiceError(
        `Failed to save alert for domain: ${alertInput.domain}`,
        AlertServiceErrorCode.DATABASE_ERROR,
        error instanceof Error ? error : new Error(String(error))
      );
      
      console.error('Save alert failed:', alertError);
      throw alertError;
    }
  }

  /**
   * Remove an alert by its ID
   * 
   * @param alertId - The unique alert identifier
   * @returns True if alert was removed, false if not found
   * @throws {AlertServiceError} When removal fails
   * 
   * @example
   * ```typescript
   * const removed = await alertService.removeAlert('alert_example_com_123456');
   * ```
   */
  async removeAlert(alertId: string): Promise<boolean> {
    await this.ensureInitialized();
    
    if (!alertId || typeof alertId !== 'string') {
      throw new AlertServiceError(
        'Alert ID must be a non-empty string',
        AlertServiceErrorCode.INVALID_INPUT
      );
    }

    try {
      const result = await db.removeAlert(alertId);
      
      if (result.success && result.data) {
        this.alerts.delete(alertId);
        await this.syncAlertsToServiceWorker();
        console.info('Alert removed successfully:', alertId);
        return true;
      }
      
      return false;
      
    } catch (error) {
      const alertError = new AlertServiceError(
        `Failed to remove alert: ${alertId}`,
        AlertServiceErrorCode.DATABASE_ERROR,
        error instanceof Error ? error : new Error(String(error))
      );
      
      console.error('Remove alert failed:', alertError);
      throw alertError;
    }
  }

  /**
   * Remove all alerts for a specific domain
   * 
   * @param domain - The domain name
   * @returns True if any alerts were removed
   * @throws {AlertServiceError} When removal fails
   * 
   * @example
   * ```typescript
   * const removed = await alertService.removeAlertByDomain('example.com');
   * ```
   */
  async removeAlertByDomain(domain: string): Promise<boolean> {
    await this.ensureInitialized();
    
    if (!isValidDomain(domain)) {
      throw new AlertServiceError(
        `Invalid domain format: ${domain}`,
        AlertServiceErrorCode.INVALID_INPUT
      );
    }

    try {
      const result = await db.removeAlertsByDomain(domain);
      
      if (result.success && result.data && result.data > 0) {
        // Remove from local cache
        for (const [id, alert] of this.alerts.entries()) {
          if (alert.domain === domain) {
            this.alerts.delete(id);
          }
        }
        
        await this.syncAlertsToServiceWorker();
        console.info('Domain alerts removed successfully:', domain);
        return true;
      }
      
      return false;
      
    } catch (error) {
      const alertError = new AlertServiceError(
        `Failed to remove alerts for domain: ${domain}`,
        AlertServiceErrorCode.DATABASE_ERROR,
        error instanceof Error ? error : new Error(String(error))
      );
      
      console.error('Remove domain alerts failed:', alertError);
      throw alertError;
    }
  }

  /**
   * Get alert settings for a specific domain
   * 
   * @param domain - The domain name
   * @returns Alert settings if found, undefined otherwise
   * @throws {AlertServiceError} When retrieval fails
   * 
   * @example
   * ```typescript
   * const alert = await alertService.getAlertByDomain('example.com');
   * if (alert) {
   *   console.log('Alert found:', alert.alertDate);
   * }
   * ```
   */
  async getAlertByDomain(domain: string): Promise<AlertSettings | undefined> {
    await this.ensureInitialized();
    
    if (!isValidDomain(domain)) {
      throw new AlertServiceError(
        `Invalid domain format: ${domain}`,
        AlertServiceErrorCode.INVALID_INPUT
      );
    }

    try {
      // Check local cache first
      for (const alert of this.alerts.values()) {
        if (alert.domain === domain) {
          return alert;
        }
      }
      
      // Query database if not in cache
      const result = await db.getAlertByDomain(domain);
      
      if (result.success && result.data) {
        const alert = this.convertDbRecordToAlert(result.data);
        this.alerts.set(alert.id, alert);
        return alert;
      }
      
      return undefined;
      
    } catch (error) {
      const alertError = new AlertServiceError(
        `Failed to get alert for domain: ${domain}`,
        AlertServiceErrorCode.DATABASE_ERROR,
        error instanceof Error ? error : new Error(String(error))
      );
      
      console.error('Get domain alert failed:', alertError);
      throw alertError;
    }
  }

  /**
   * Get all configured alerts
   * 
   * @returns Array of all alert settings
   * @throws {AlertServiceError} When retrieval fails
   * 
   * @example
   * ```typescript
   * const alerts = await alertService.getAllAlerts();
   * console.log(`Found ${alerts.length} alerts`);
   * ```
   */
  async getAllAlerts(): Promise<readonly AlertSettings[]> {
    await this.ensureInitialized();

    try {
      const result = await db.getAllAlerts();
      
      if (result.success) {
        // Update local cache
        this.alerts.clear();
        
        const alerts = result.data?.map(record => {
          const alert = this.convertDbRecordToAlert(record);
          this.alerts.set(alert.id, alert);
          return alert;
        }) || [];
        
        return Object.freeze(alerts);
      }
      
      // Fallback to cached data on database error
      const cachedAlerts = Array.from(this.alerts.values());
      console.warn('Database read failed, returning cached alerts');
      return Object.freeze(cachedAlerts);
      
    } catch (error) {
      const alertError = new AlertServiceError(
        'Failed to retrieve all alerts',
        AlertServiceErrorCode.DATABASE_ERROR,
        error instanceof Error ? error : new Error(String(error))
      );
      
      console.error('Get all alerts failed:', alertError);
      throw alertError;
    }
  }

  /**
   * Manually trigger notification check via Service Worker
   * 
   * @throws {AlertServiceError} When Service Worker is unavailable
   * 
   * @example
   * ```typescript
   * await alertService.triggerNotificationCheck();
   * ```
   */
  async triggerNotificationCheck(): Promise<void> {
    await this.ensureInitialized();
    
    if (!this.serviceWorker) {
      throw new AlertServiceError(
        'Service Worker not available for notification check',
        AlertServiceErrorCode.SERVICE_WORKER_UNAVAILABLE
      );
    }

    try {
      const message: AlertServiceWorkerMessage = {
        type: AlertServiceWorkerMessageType.CHECK_NOTIFICATIONS,
        timestamp: new Date().toISOString()
      };
      
      this.serviceWorker.postMessage(message);
      console.info('Notification check triggered');
      
    } catch (error) {
      const alertError = new AlertServiceError(
        'Failed to trigger notification check',
        AlertServiceErrorCode.SYNC_FAILED,
        error instanceof Error ? error : new Error(String(error))
      );
      
      console.error('Trigger notification check failed:', alertError);
      throw alertError;
    }
  }

  /**
   * Synchronize current alerts with Service Worker for background processing
   */
  private async syncAlertsToServiceWorker(): Promise<void> {
    if (!this.serviceWorker) {
      console.debug('Service Worker not available, skipping alert sync');
      return;
    }

    try {
      const alertsArray = Array.from(this.alerts.values());
      const message: AlertServiceWorkerMessage = {
        type: AlertServiceWorkerMessageType.SYNC_ALERTS,
        alerts: Object.freeze(alertsArray),
        timestamp: new Date().toISOString()
      };
      
      this.serviceWorker.postMessage(message);
      console.debug('Alerts synchronized with Service Worker');
      
    } catch (error) {
      console.error('Failed to sync alerts with Service Worker:', error);
      // Don't throw here, this is not critical for main functionality
    }
  }

  /**
   * Convert database record to AlertSettings
   */
  private convertDbRecordToAlert(record: db.AlertRecord): AlertSettings {
    return {
      id: record.id,
      domain: record.domain,
      enabled: record.enabled,
      alertDate: new Date(record.alertDate),
      reminderFrequency: record.reminderFrequency,
      expirationDate: new Date(record.expirationDate),
      createdAt: new Date(record.createdAt),
      lastNotified: record.lastNotified ? new Date(record.lastNotified) : undefined
    };
  }

  /**
   * Load alerts from database and populate cache
   */
  private async loadAlertsFromDatabase(): Promise<void> {
    try {
      const result = await db.getAllAlerts();
      
      if (result.success && result.data) {
        this.alerts.clear();
        
        for (const alertRecord of result.data) {
          const alert = this.convertDbRecordToAlert(alertRecord);
          this.alerts.set(alert.id, alert);
        }
        
        console.info(`Loaded ${this.alerts.size} alerts from database`);
        
        // Sync with Service Worker after loading
        await this.syncAlertsToServiceWorker();
      }
    } catch (error) {
      console.error('Failed to load alerts from database:', error);
    }
  }
}

// ===== Service Instance Export =====

/**
 * Singleton instance of AlertService
 * 
 * Use this instance for all alert management operations.
 * The service will automatically initialize on first use.
 */
export const alertService = AlertService.getInstance();

// ===== Convenience Functions =====

/**
 * Check notification support and permissions
 * 
 * @returns Notification support information
 */
export const checkNotificationSupport = (): Promise<NotificationSupportResult> => 
  alertService.checkNotificationSupport();

/**
 * Request notification permission from user
 * 
 * @returns Permission status
 */
export const requestNotificationPermission = (): Promise<NotificationPermissionStatus> => 
  alertService.requestNotificationPermission();

/**
 * Create or update an alert
 * 
 * @param settings - Alert configuration
 * @returns Created alert
 */
export const saveAlert = (settings: CreateAlertInput): Promise<AlertSettings> => 
  alertService.saveAlert(settings);

/**
 * Remove an alert by ID
 * 
 * @param alertId - Alert identifier
 * @returns True if removed
 */
export const removeAlert = (alertId: string): Promise<boolean> => 
  alertService.removeAlert(alertId);

/**
 * Remove all alerts for a domain
 * 
 * @param domain - Domain name
 * @returns True if any removed
 */
export const removeAlertByDomain = (domain: string): Promise<boolean> => 
  alertService.removeAlertByDomain(domain);

/**
 * Get alert for a specific domain
 * 
 * @param domain - Domain name
 * @returns Alert settings if found
 */
export const getAlertByDomain = (domain: string): Promise<AlertSettings | undefined> => 
  alertService.getAlertByDomain(domain);

/**
 * Get all configured alerts
 * 
 * @returns Array of all alerts
 */
export const getAllAlerts = (): Promise<readonly AlertSettings[]> => 
  alertService.getAllAlerts();

/**
 * Trigger manual notification check
 */
export const triggerNotificationCheck = (): Promise<void> => 
  alertService.triggerNotificationCheck();
