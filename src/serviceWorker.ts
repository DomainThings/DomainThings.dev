/// <reference lib="webworker" />
declare let self: ServiceWorkerGlobalScope

import { clientsClaim } from 'workbox-core';
import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching';

// TypeScript module export pour éviter les erreurs "not a module"
export {};

// Types for alert management in Service Worker
interface AlertSettings {
  id: string;
  domain: string;
  enabled: boolean;
  daysBeforeExpiration: number;
  reminderFrequency: 'once' | 'daily' | 'weekly';
  expirationDate: string; // ISO string in Service Worker
  createdAt: string;
  lastNotified?: string;
}

/**
 * Load alerts from IndexedDB (Service Worker persistent storage)
 */
async function loadAlertsFromDB(): Promise<AlertSettings[]> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('domaincheck-db', 6); // Updated DB name and version
    
    request.onerror = () => reject(request.error);
    
    request.onsuccess = () => {
      const db = request.result;
      const transaction = db.transaction(['alerts'], 'readonly');
      const store = transaction.objectStore('alerts');
      const getAllRequest = store.getAll();
      
      getAllRequest.onsuccess = () => resolve(getAllRequest.result || []);
      getAllRequest.onerror = () => reject(getAllRequest.error);
    };
    
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('alerts')) {
        const store = db.createObjectStore('alerts', { keyPath: 'id' });
        store.createIndex('domain', 'domain', { unique: false });
        store.createIndex('enabled', 'enabled');
        store.createIndex('expirationDate', 'expirationDate');
      }
    };
  });
}

/**
 * Save alert to IndexedDB
 */
async function saveAlertToDB(alert: AlertSettings): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('domaincheck-db', 6);
    
    request.onsuccess = () => {
      const db = request.result;
      const transaction = db.transaction(['alerts'], 'readwrite');
      const store = transaction.objectStore('alerts');
      const putRequest = store.put(alert);
      
      putRequest.onsuccess = () => resolve();
      putRequest.onerror = () => reject(putRequest.error);
    };
    
    request.onerror = () => reject(request.error);
  });
}

/**
 * Check and send due notifications
 */
async function checkAndSendNotifications(): Promise<void> {
  try {
    const alerts = await loadAlertsFromDB();
    const now = new Date();
    
    for (const alert of alerts) {
      if (!alert.enabled) continue;
      
      const shouldNotify = shouldSendNotification(alert, now);
      if (shouldNotify) {
        await sendBackgroundNotification(alert);
        
        // Update last notified date
        alert.lastNotified = now.toISOString();
        await saveAlertToDB(alert);
      }
    }
  } catch (error) {
    console.error('Error checking notifications in Service Worker:', error);
  }
}

/**
 * Determine if notification should be sent
 */
function shouldSendNotification(alert: AlertSettings, now: Date): boolean {
  const alertDate = new Date(alert.expirationDate);
  alertDate.setDate(alertDate.getDate() - alert.daysBeforeExpiration);
  
  // Check if we've reached alert date
  if (now < alertDate) {
    return false;
  }

  // Check frequency if already notified
  if (alert.lastNotified) {
    const timeSinceLastNotification = now.getTime() - new Date(alert.lastNotified).getTime();
    const daysSinceLastNotification = timeSinceLastNotification / (1000 * 60 * 60 * 24);

    switch (alert.reminderFrequency) {
      case 'once':
        return false;
      case 'daily':
        return daysSinceLastNotification >= 1;
      case 'weekly':
        return daysSinceLastNotification >= 7;
      default:
        return false;
    }
  }

  return true;
}

/**
 * Send notification from Service Worker
 */
async function sendBackgroundNotification(alert: AlertSettings): Promise<void> {
  const daysUntilExpiration = Math.ceil(
    (new Date(alert.expirationDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
  );

  await self.registration.showNotification(
    `⚠️ Expiration de domaine`,
    {
      body: `Le domaine ${alert.domain} expire dans ${daysUntilExpiration} jour${daysUntilExpiration > 1 ? 's' : ''}`,
      icon: '/icons/android-chrome-192x192.png',
      badge: '/icons/android-chrome-192x192.png',
      tag: `domain-alert-${alert.domain}`,
      data: {
        domain: alert.domain,
        expirationDate: alert.expirationDate,
        alertId: alert.id
      },
      requireInteraction: true
    }
  );
}

// precache public assets
const swManifest = self.__WB_MANIFEST;
precacheAndRoute(swManifest);

// clean old assets
cleanupOutdatedCaches();

// do not wait page refresh or change to update service worker
self.skipWaiting();
clientsClaim();

// ===== BACKGROUND NOTIFICATIONS SETUP =====

// Register for periodic background sync (if supported)
self.addEventListener('install', (event) => {
  // Force waiting service worker to become active
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  // Take control of all pages immediately
  event.waitUntil(self.clients.claim());
  
  // Start background notification checks
  event.waitUntil(setupBackgroundSync());
});

/**
 * Setup background sync for notifications
 */
async function setupBackgroundSync(): Promise<void> {
  try {
    // Register for periodic background sync (if supported)
    if ('periodicSync' in self.registration) {
      await (self.registration as any).periodicSync.register('check-domain-alerts', {
        minInterval: 12 * 60 * 60 * 1000, // 12 hours minimum
      });
    }
    
    // Fallback: manual check on activation
    await checkAndSendNotifications();
  } catch (error) {
    console.error('Error setting up background sync:', error);
  }
}

// Handle periodic background sync
self.addEventListener('periodicsync', (event: any) => {
  if (event.tag === 'check-domain-alerts') {
    event.waitUntil(checkAndSendNotifications());
  }
});

// ===== MESSAGE HANDLING =====

// Notify the main thread that SW is ready
self.clients.matchAll().then(clients => {
  clients.forEach(client => {
    client.postMessage({
      type: 'SW_READY',
      message: 'Service Worker is ready for notifications!'
    });
  });
});

// Handle messages from the main thread
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SHOW_NOTIFICATION') {
    const { payload } = event.data;
    
    // Show notification
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: payload.icon || '/icons/android-chrome-192x192.png',
      badge: payload.badge || '/icons/android-chrome-192x192.png',
      tag: payload.tag,
      data: payload.data,
      requireInteraction: true // Keep notification visible until user interacts
    });
  }
  
  // Handle alert sync from main thread
  if (event.data && event.data.type === 'SYNC_ALERTS') {
    const { alerts } = event.data;
    event.waitUntil(syncAlertsToIndexedDB(alerts));
  }
  
  // Handle manual notification check
  if (event.data && event.data.type === 'CHECK_NOTIFICATIONS') {
    event.waitUntil(checkAndSendNotifications());
  }
});

/**
 * Sync alerts from main thread to IndexedDB
 */
async function syncAlertsToIndexedDB(alerts: any[]): Promise<void> {
  try {
    const request = indexedDB.open('domaincheck-db', 6);
    
    request.onsuccess = () => {
      const db = request.result;
      const transaction = db.transaction(['alerts'], 'readwrite');
      const store = transaction.objectStore('alerts');
      
      // Clear existing alerts
      store.clear();
      
      // Add new alerts
      alerts.forEach(alert => {
        store.put({
          ...alert,
          expirationDate: alert.expirationDate instanceof Date 
            ? alert.expirationDate.toISOString() 
            : alert.expirationDate,
          createdAt: alert.createdAt instanceof Date 
            ? alert.createdAt.toISOString() 
            : alert.createdAt,
          lastNotified: alert.lastNotified instanceof Date 
            ? alert.lastNotified.toISOString() 
            : alert.lastNotified
        });
      });
    };
  } catch (error) {
    console.error('Error syncing alerts to IndexedDB:', error);
  }
}

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  // Open the app and navigate to the domain
  const domain = event.notification.data?.domain;
  const url = domain ? `/?search=${encodeURIComponent(domain)}` : '/';
  
  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then((clients) => {
      // Check if there's already a window/tab open
      for (const client of clients) {
        if (client.url.includes(self.location.origin)) {
          client.focus();
          client.postMessage({
            type: 'NAVIGATE_TO_DOMAIN',
            domain: domain
          });
          return;
        }
      }
      
      // If no window is open, open a new one
      return self.clients.openWindow(url);
    })
  );
});

// Handle notification close
self.addEventListener('notificationclose', (event) => {
  // Silent close - no logging needed
});