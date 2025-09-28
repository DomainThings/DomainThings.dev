/**
 * Domain Check PWA Service Worker
 * 
 * Provides comprehensive background functionality for domain expiration monitoring:
 * - Asset precaching and offline support
 * - Background notification system
 * - Periodic sync for domain alerts
 * - IndexedDB persistence
 * - Cross-tab communication
 * 
 * @version 2.0.0
 * @since 1.0.0
 * 
 * @example
 * ```typescript
 * // Message from main thread
 * navigator.serviceWorker.controller?.postMessage({
 *   type: 'SYNC_ALERTS',
 *   alerts: alertsArray
 * });
 * ```
 */

/// <reference lib="webworker" />
declare let self: ServiceWorkerGlobalScope;

import { clientsClaim } from 'workbox-core';
import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching';

// TypeScript module export to avoid "not a module" errors
export {};

// ===== Constants and Configuration =====

/**
 * Service Worker configuration constants
 */
const SW_CONFIG = Object.freeze({
  dbName: 'domaincheck-db',
  dbVersion: 6,
  alertStoreName: 'alerts',
  periodicSyncTag: 'check-domain-alerts',
  periodicSyncInterval: 12 * 60 * 60 * 1000, // 12 hours
  defaultIcon: '/icons/android-chrome-192x192.png',
  defaultBadge: '/icons/android-chrome-192x192.png'
} as const);

// ===== Types and Interfaces =====

/**
 * Reminder frequency for alert notifications
 */
type ReminderFrequency = 'once' | 'daily' | 'weekly';

/**
 * Alert settings interface for Service Worker
 */
interface AlertSettings {
  readonly id: string;
  readonly domain: string;
  readonly alertDate: string; // ISO string in Service Worker
  readonly reminderFrequency: ReminderFrequency;
  readonly expirationDate: string; // ISO string in Service Worker
  readonly createdAt: string;
  readonly lastNotified?: string;
}



/**
 * Service Worker message types
 */
enum ServiceWorkerMessageType {
  SW_READY = 'SW_READY',
  SHOW_NOTIFICATION = 'SHOW_NOTIFICATION',
  SYNC_ALERTS = 'SYNC_ALERTS',
  CHECK_NOTIFICATIONS = 'CHECK_NOTIFICATIONS',
  NAVIGATE_TO_DOMAIN = 'NAVIGATE_TO_DOMAIN'
}

/**
 * Service Worker message structure
 */
interface ServiceWorkerMessage {
  readonly type: ServiceWorkerMessageType;
  readonly message?: string;
  readonly payload?: NotificationPayload;
  readonly alerts?: readonly AlertSettings[];
  readonly domain?: string;
}

/**
 * Notification payload structure
 */
interface NotificationPayload {
  readonly title: string;
  readonly body: string;
  readonly icon?: string;
  readonly badge?: string;
  readonly tag: string;
  readonly data?: Record<string, unknown>;
  readonly requireInteraction?: boolean;
  readonly silent?: boolean;
  readonly actions?: readonly NotificationAction[];
}

/**
 * Extended notification action
 */
interface NotificationAction {
  readonly action: string;
  readonly title: string;
  readonly icon?: string;
}

/**
 * Service Worker error class
 */
class ServiceWorkerError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly operation: string,
    public readonly originalError?: Error
  ) {
    super(message);
    this.name = 'ServiceWorkerError';
  }
}

/**
 * Database operation result
 */
interface DatabaseResult<T = unknown> {
  readonly success: boolean;
  readonly data?: T;
  readonly error?: string;
}

// ===== Database Operations =====

/**
 * Initialize IndexedDB with proper error handling and schema management
 */
const initializeDatabase = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(SW_CONFIG.dbName, SW_CONFIG.dbVersion);
    
    request.onerror = () => {
      const error = new ServiceWorkerError(
        'Failed to open IndexedDB',
        'DB_OPEN_FAILED',
        'initializeDatabase',
        request.error || undefined
      );
      console.error('Database initialization failed:', error);
      reject(error);
    };
    
    request.onsuccess = () => {
      console.info('IndexedDB initialized successfully');
      resolve(request.result);
    };
    
    request.onupgradeneeded = (event) => {
      const db = request.result;
      const oldVersion = event.oldVersion;
      
      console.info(`Upgrading database from version ${oldVersion} to ${SW_CONFIG.dbVersion}`);
      
      try {
        // Create alerts store if it doesn't exist
        if (!db.objectStoreNames.contains(SW_CONFIG.alertStoreName)) {
          const alertStore = db.createObjectStore(SW_CONFIG.alertStoreName, { 
            keyPath: 'id' 
          });
          
          // Create indexes for efficient querying
          alertStore.createIndex('domain', 'domain', { unique: false });
          alertStore.createIndex('enabled', 'enabled', { unique: false });
          alertStore.createIndex('expirationDate', 'expirationDate', { unique: false });
          alertStore.createIndex('lastNotified', 'lastNotified', { unique: false });
          
          console.info('Alert store created with indexes');
        }
        
        // Add version-specific migrations here if needed
        if (oldVersion < 6) {
          // Migration logic for version 6
          console.info('Applied migration for version 6');
        }
        
      } catch (error) {
        const dbError = new ServiceWorkerError(
          'Database schema upgrade failed',
          'DB_UPGRADE_FAILED',
          'initializeDatabase',
          error instanceof Error ? error : new Error(String(error))
        );
        console.error('Database upgrade failed:', dbError);
        reject(dbError);
      }
    };
  });
};

/**
 * Load all alerts from IndexedDB with comprehensive error handling
 */
const loadAlertsFromDB = async (): Promise<DatabaseResult<AlertSettings[]>> => {
  try {
    const db = await initializeDatabase();
    
    return new Promise((resolve) => {
      const transaction = db.transaction([SW_CONFIG.alertStoreName], 'readonly');
      const store = transaction.objectStore(SW_CONFIG.alertStoreName);
      const getAllRequest = store.getAll();
      
      getAllRequest.onsuccess = () => {
        const alerts = getAllRequest.result || [];
        console.debug(`Loaded ${alerts.length} alerts from IndexedDB`);
        resolve({
          success: true,
          data: alerts
        });
      };
      
      getAllRequest.onerror = () => {
        const error = new ServiceWorkerError(
          'Failed to load alerts from IndexedDB',
          'DB_LOAD_FAILED',
          'loadAlertsFromDB',
          getAllRequest.error || undefined
        );
        console.error('Load alerts failed:', error);
        resolve({
          success: false,
          error: error.message
        });
      };
      
      transaction.onerror = () => {
        const error = new ServiceWorkerError(
          'Transaction failed during alert loading',
          'DB_TRANSACTION_FAILED',
          'loadAlertsFromDB',
          transaction.error || undefined
        );
        console.error('Transaction failed:', error);
        resolve({
          success: false,
          error: error.message
        });
      };
    });
    
  } catch (error) {
    const dbError = new ServiceWorkerError(
      'Database access failed during alert loading',
      'DB_ACCESS_FAILED',
      'loadAlertsFromDB',
      error instanceof Error ? error : new Error(String(error))
    );
    console.error('Database access failed:', dbError);
    return {
      success: false,
      error: dbError.message
    };
  }
};

/**
 * Save a single alert to IndexedDB
 */
const saveAlertToDB = async (alert: AlertSettings): Promise<DatabaseResult<void>> => {
  try {
    const db = await initializeDatabase();
    
    return new Promise((resolve) => {
      const transaction = db.transaction([SW_CONFIG.alertStoreName], 'readwrite');
      const store = transaction.objectStore(SW_CONFIG.alertStoreName);
      const putRequest = store.put(alert);
      
      putRequest.onsuccess = () => {
        console.debug(`Alert saved to IndexedDB: ${alert.domain}`);
        resolve({
          success: true
        });
      };
      
      putRequest.onerror = () => {
        const error = new ServiceWorkerError(
          `Failed to save alert for domain: ${alert.domain}`,
          'DB_SAVE_FAILED',
          'saveAlertToDB',
          putRequest.error || undefined
        );
        console.error('Save alert failed:', error);
        resolve({
          success: false,
          error: error.message
        });
      };
      
      transaction.onerror = () => {
        const error = new ServiceWorkerError(
          'Transaction failed during alert saving',
          'DB_TRANSACTION_FAILED',
          'saveAlertToDB',
          transaction.error || undefined
        );
        console.error('Transaction failed:', error);
        resolve({
          success: false,
          error: error.message
        });
      };
    });
    
  } catch (error) {
    const dbError = new ServiceWorkerError(
      'Database access failed during alert saving',
      'DB_ACCESS_FAILED',
      'saveAlertToDB',
      error instanceof Error ? error : new Error(String(error))
    );
    console.error('Database access failed:', dbError);
    return {
      success: false,
      error: dbError.message
    };
  }
};

/**
 * Synchronize alerts from main thread to IndexedDB
 */
const syncAlertsToIndexedDB = async (alerts: readonly AlertSettings[]): Promise<DatabaseResult<void>> => {
  try {
    const db = await initializeDatabase();
    
    return new Promise((resolve) => {
      const transaction = db.transaction([SW_CONFIG.alertStoreName], 'readwrite');
      const store = transaction.objectStore(SW_CONFIG.alertStoreName);
      
      // Clear existing alerts first
      const clearRequest = store.clear();
      
      clearRequest.onsuccess = () => {
        // Add new alerts
        let completedOperations = 0;
        const totalOperations = alerts.length;
        
        if (totalOperations === 0) {
          console.info('Alert sync completed: 0 alerts synchronized');
          resolve({ success: true });
          return;
        }
        
        const checkCompletion = () => {
          completedOperations++;
          if (completedOperations === totalOperations) {
            console.info(`Alert sync completed: ${totalOperations} alerts synchronized`);
            resolve({ success: true });
          }
        };
        
        alerts.forEach(alert => {
          // Normalize date fields to ISO strings
          const normalizeDate = (value: any): string | undefined => {
            if (!value) return value;
            if (typeof value === 'string') return value;
            if (value instanceof Date) return value.toISOString();
            return String(value);
          };
          
          const normalizedAlert: AlertSettings = {
            ...alert,
            expirationDate: normalizeDate(alert.expirationDate) || alert.expirationDate,
            createdAt: normalizeDate(alert.createdAt) || alert.createdAt,
            lastNotified: normalizeDate(alert.lastNotified)
          };
          
          const putRequest = store.put(normalizedAlert);
          putRequest.onsuccess = checkCompletion;
          putRequest.onerror = () => {
            console.error(`Failed to sync alert: ${alert.domain}`, putRequest.error);
            checkCompletion(); // Continue with other alerts
          };
        });
      };
      
      clearRequest.onerror = () => {
        const error = new ServiceWorkerError(
          'Failed to clear existing alerts during sync',
          'DB_CLEAR_FAILED',
          'syncAlertsToIndexedDB',
          clearRequest.error || undefined
        );
        console.error('Clear alerts failed:', error);
        resolve({
          success: false,
          error: error.message
        });
      };
      
      transaction.onerror = () => {
        const error = new ServiceWorkerError(
          'Transaction failed during alert synchronization',
          'DB_TRANSACTION_FAILED',
          'syncAlertsToIndexedDB',
          transaction.error || undefined
        );
        console.error('Transaction failed:', error);
        resolve({
          success: false,
          error: error.message
        });
      };
    });
    
  } catch (error) {
    const dbError = new ServiceWorkerError(
      'Database access failed during alert synchronization',
      'DB_ACCESS_FAILED',
      'syncAlertsToIndexedDB',
      error instanceof Error ? error : new Error(String(error))
    );
    console.error('Database access failed:', dbError);
    return {
      success: false,
      error: dbError.message
    };
  }
};

// ===== Notification Logic =====

/**
 * Determine if a notification should be sent for an alert
 */
const shouldSendNotification = (alert: AlertSettings, now: Date): boolean => {
  try {
    const alertDate = new Date(alert.alertDate);
    
    // Check if we've reached the alert date
    if (now < alertDate) {
      return false;
    }
    
    // Check if already notified
    if (alert.lastNotified) {
      return false;
    }
    
    return true;
    
  } catch (error) {
    console.error(`Error evaluating notification for ${alert.domain}:`, error);
    return false;
  }
};

/**
 * Send background notification for domain expiration
 */
const sendBackgroundNotification = async (alert: AlertSettings): Promise<void> => {
  try {
    const now = new Date();
    const expirationDate = new Date(alert.expirationDate);
    const daysUntilExpiration = Math.ceil(
      (expirationDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    );
    
    // Create user-friendly notification content
    const title = '⚠️ Domain Expiration Alert';
    const body = daysUntilExpiration === 1
      ? `Domain ${alert.domain} expires tomorrow!`
      : daysUntilExpiration <= 0
      ? `Domain ${alert.domain} has expired!`
      : `Domain ${alert.domain} expires in ${daysUntilExpiration} days`;
    
    const notificationOptions: NotificationOptions = {
      body,
      icon: SW_CONFIG.defaultIcon,
      badge: SW_CONFIG.defaultBadge,
      tag: `domain-alert-${alert.domain}`,
      data: {
        domain: alert.domain,
        expirationDate: alert.expirationDate,
        alertId: alert.id,
        daysUntilExpiration,
        timestamp: now.toISOString()
      },
      requireInteraction: true
    };
    
    await self.registration.showNotification(title, notificationOptions);
    console.info(`Background notification sent for domain: ${alert.domain}`);
    
  } catch (error) {
    const notificationError = new ServiceWorkerError(
      `Failed to send notification for domain: ${alert.domain}`,
      'NOTIFICATION_SEND_FAILED',
      'sendBackgroundNotification',
      error instanceof Error ? error : new Error(String(error))
    );
    console.error('Send notification failed:', notificationError);
    throw notificationError;
  }
};

/**
 * Check all alerts and send due notifications
 */
const checkAndSendNotifications = async (): Promise<void> => {
  console.info('Starting background notification check');
  
  try {
    const result = await loadAlertsFromDB();
    
    if (!result.success || !result.data) {
      console.warn('Failed to load alerts for notification check:', result.error);
      return;
    }
    
    const alerts = result.data;
    const now = new Date();
    let notificationsSent = 0;
    let errorsEncountered = 0;
    
    for (const alert of alerts) {
      try {
        if (shouldSendNotification(alert, now)) {
          await sendBackgroundNotification(alert);
          
          // Update last notified timestamp
          const updatedAlert: AlertSettings = {
            ...alert,
            lastNotified: now.toISOString()
          };
          
          const saveResult = await saveAlertToDB(updatedAlert);
          if (!saveResult.success) {
            console.warn(`Failed to update last notified for ${alert.domain}:`, saveResult.error);
          }
          
          notificationsSent++;
        }
      } catch (error) {
        errorsEncountered++;
        console.error(`Error processing alert for ${alert.domain}:`, error);
      }
    }
    
    console.info(`Notification check completed: ${notificationsSent} sent, ${errorsEncountered} errors`);
    
  } catch (error) {
    const checkError = new ServiceWorkerError(
      'Background notification check failed',
      'NOTIFICATION_CHECK_FAILED',
      'checkAndSendNotifications',
      error instanceof Error ? error : new Error(String(error))
    );
    console.error('Notification check failed:', checkError);
  }
};

// ===== Background Sync Setup =====

/**
 * Setup periodic background sync for domain alerts
 */
const setupBackgroundSync = async (): Promise<void> => {
  try {
    console.info('Setting up background sync for domain alerts');
    
    // Register periodic background sync if supported
    if ('periodicSync' in self.registration) {
      await (self.registration as any).periodicSync.register(
        SW_CONFIG.periodicSyncTag,
        {
          minInterval: SW_CONFIG.periodicSyncInterval
        }
      );
      console.info('Periodic background sync registered successfully');
    } else {
      console.warn('Periodic background sync not supported, using fallback methods');
    }
    
    // Perform initial notification check
    await checkAndSendNotifications();
    
  } catch (error) {
    const syncError = new ServiceWorkerError(
      'Background sync setup failed',
      'BACKGROUND_SYNC_FAILED',
      'setupBackgroundSync',
      error instanceof Error ? error : new Error(String(error))
    );
    console.error('Background sync setup failed:', syncError);
  }
};

// ===== Message Handling =====

/**
 * Notify all clients that Service Worker is ready
 */
const notifyClientsReady = async (): Promise<void> => {
  try {
    const clients = await self.clients.matchAll({ includeUncontrolled: true });
    const message: ServiceWorkerMessage = {
      type: ServiceWorkerMessageType.SW_READY,
      message: 'Service Worker is ready for domain notifications!'
    };
    
    clients.forEach(client => {
      client.postMessage(message);
    });
    
    console.info(`Notified ${clients.length} clients that Service Worker is ready`);
  } catch (error) {
    console.error('Failed to notify clients:', error);
  }
};

/**
 * Handle incoming messages from the main thread
 */
const handleMessage = async (event: ExtendableMessageEvent): Promise<void> => {
  const { data } = event;
  
  if (!data || typeof data !== 'object' || !data.type) {
    console.warn('Invalid message received:', data);
    return;
  }
  
  try {
    switch (data.type) {
      case ServiceWorkerMessageType.SHOW_NOTIFICATION:
        if (data.payload) {
          await handleShowNotification(data.payload);
        }
        break;
        
      case ServiceWorkerMessageType.SYNC_ALERTS:
        if (data.alerts) {
          event.waitUntil(handleSyncAlerts(data.alerts));
        }
        break;
        
      case ServiceWorkerMessageType.CHECK_NOTIFICATIONS:
        event.waitUntil(checkAndSendNotifications());
        break;
        
      default:
        console.debug('Unhandled message type:', data.type);
    }
  } catch (error) {
    console.error('Error handling message:', error);
  }
};

/**
 * Handle show notification request
 */
const handleShowNotification = async (payload: NotificationPayload): Promise<void> => {
  try {
    const options: NotificationOptions = {
      body: payload.body,
      icon: payload.icon || SW_CONFIG.defaultIcon,
      badge: payload.badge || SW_CONFIG.defaultBadge,
      tag: payload.tag,
      data: payload.data,
      requireInteraction: payload.requireInteraction ?? true,
      silent: payload.silent ?? false
    };
    
    await self.registration.showNotification(payload.title, options);
    console.info('Manual notification shown:', payload.tag);
    
  } catch (error) {
    const notificationError = new ServiceWorkerError(
      'Failed to show manual notification',
      'MANUAL_NOTIFICATION_FAILED',
      'handleShowNotification',
      error instanceof Error ? error : new Error(String(error))
    );
    console.error('Manual notification failed:', notificationError);
  }
};

/**
 * Handle alerts synchronization
 */
const handleSyncAlerts = async (alerts: readonly AlertSettings[]): Promise<void> => {
  try {
    const result = await syncAlertsToIndexedDB(alerts);
    if (result.success) {
      console.info('Alerts synchronized successfully');
    } else {
      console.error('Alert synchronization failed:', result.error);
    }
  } catch (error) {
    console.error('Error during alert synchronization:', error);
  }
};

// ===== Event Handlers =====

/**
 * Handle notification click events
 */
const handleNotificationClick = async (event: NotificationEvent): Promise<void> => {
  event.notification.close();
  
  try {
    const domain = event.notification.data?.domain as string;
    const action = event.action;
    
    // Handle notification actions
    if (action === 'dismiss') {
      console.debug('Notification dismissed by user');
      return;
    }
    
    // Default action or 'view' action
    const url = domain 
      ? `${self.location.origin}/?search=${encodeURIComponent(domain)}`
      : self.location.origin;
    
    const clients = await self.clients.matchAll({ type: 'window' });
    
    // Check if there's already a window/tab open
    for (const client of clients) {
      if (client.url.includes(self.location.origin)) {
        await client.focus();
        
        if (domain) {
          client.postMessage({
            type: ServiceWorkerMessageType.NAVIGATE_TO_DOMAIN,
            domain
          });
        }
        return;
      }
    }
    
    // If no window is open, open a new one
    await self.clients.openWindow(url);
    console.info('Opened new window for domain:', domain || 'home');
    
  } catch (error) {
    console.error('Error handling notification click:', error);
  }
};

// ===== Workbox Integration =====

// Precache public assets
const swManifest = self.__WB_MANIFEST;
precacheAndRoute(swManifest);

// Clean old assets
cleanupOutdatedCaches();

// Do not wait for page refresh to update service worker
self.skipWaiting();
clientsClaim();

// ===== Service Worker Event Listeners =====

self.addEventListener('install', (event) => {
  console.info('Service Worker installing...');
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.info('Service Worker activating...');
  
  event.waitUntil(
    Promise.all([
      self.clients.claim(),
      setupBackgroundSync(),
      notifyClientsReady()
    ])
  );
});

self.addEventListener('periodicsync', (event: any) => {
  if (event.tag === SW_CONFIG.periodicSyncTag) {
    console.info('Periodic sync triggered for domain alerts');
    event.waitUntil(checkAndSendNotifications());
  }
});

self.addEventListener('message', handleMessage);

self.addEventListener('notificationclick', (event) => {
  event.waitUntil(handleNotificationClick(event));
});

self.addEventListener('notificationclose', (event) => {
  console.debug('Notification closed:', event.notification.tag);
});

// Global error handler
self.addEventListener('error', (event) => {
  console.error('Service Worker error:', event.error);
});

// Unhandled promise rejection handler
self.addEventListener('unhandledrejection', (event) => {
  console.error('Service Worker unhandled rejection:', event.reason);
  event.preventDefault();
});

console.info('Domain Check Service Worker initialized successfully');