/**
 * Vue 3 composable for managing Service Worker communications and notifications
 */
import { ref, onMounted, onUnmounted, readonly, type Ref } from 'vue';

// ===== Types et Interfaces =====

/**
 * Status enumeration for Service Worker states
 */
export enum ServiceWorkerStatus {
  INITIALIZING = 'Initializing...',
  ACTIVE = 'Service Worker active',
  UPDATED = 'Service Worker updated',
  FAILED = 'Service Worker failed to initialize',
  NOT_SUPPORTED = 'Service Worker not supported',
  REGISTRATION_FAILED = 'Service Worker registration failed'
}

/**
 * Service Worker message types
 */
export enum ServiceWorkerMessageType {
  SW_READY = 'SW_READY',
  SHOW_NOTIFICATION = 'SHOW_NOTIFICATION',
  BACKGROUND_SYNC = 'BACKGROUND_SYNC',
  CACHE_UPDATE = 'CACHE_UPDATE'
}

/**
 * Base interface for Service Worker messages
 */
export interface ServiceWorkerMessage {
  type: ServiceWorkerMessageType;
  timestamp?: string;
  payload?: unknown;
}

/**
 * Service Worker ready message data
 */
export interface ServiceWorkerReadyMessage extends ServiceWorkerMessage {
  type: ServiceWorkerMessageType.SW_READY;
  message: string;
  version?: string;
}

/**
 * Notification payload interface
 */
export interface NotificationPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  tag?: string;
  image?: string;
  data?: Record<string, unknown>;
  actions?: NotificationAction[];
  silent?: boolean;
  requireInteraction?: boolean;
  timestamp?: number;
}

/**
 * Notification action interface
 */
export interface NotificationAction {
  action: string;
  title: string;
  icon?: string;
}

/**
 * Service Worker error types
 */
export class ServiceWorkerError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly originalError?: Error
  ) {
    super(message);
    this.name = 'ServiceWorkerError';
  }
}

/**
 * Return type for the useServiceWorker composable
 */
export interface UseServiceWorkerReturn {
  /** Reactive flag indicating if Service Worker is ready */
  readonly isServiceWorkerReady: Readonly<Ref<boolean>>;
  /** Reactive status message of Service Worker */
  readonly serviceWorkerStatus: Readonly<Ref<ServiceWorkerStatus>>;
  /** Send a typed message to the Service Worker */
  readonly sendMessageToSW: (message: ServiceWorkerMessage) => Promise<void>;
  /** Test notification functionality */
  readonly testNotification: () => Promise<void>;
  /** Request notification permission */
  readonly requestNotificationPermission: () => Promise<NotificationPermission>;
  /** Check if notifications are supported and permitted */
  readonly isNotificationSupported: () => boolean;
  /** Cleanup function for manual cleanup if needed */
  readonly cleanup: () => void;
}

// ===== Utilitaires privés =====

/**
 * Check if Service Worker is supported in the current environment
 */
const isServiceWorkerSupported = (): boolean => {
  return typeof navigator !== 'undefined' && 'serviceWorker' in navigator;
};

/**
 * Check if Notifications API is supported
 */
const isNotificationAPISupported = (): boolean => {
  return typeof window !== 'undefined' && 'Notification' in window;
};

/**
 * Get the active service worker from registration
 */
const getActiveServiceWorker = (registration: ServiceWorkerRegistration): ServiceWorker | null => {
  return registration.active || registration.waiting || registration.installing || null;
};

// ===== Composable principal =====

/**
 * Vue 3 composable for managing Service Worker communications
 * 
 * Provides reactive state management for Service Worker status,
 * message passing capabilities, and notification handling.
 * 
 * Features:
 * - Automatic Service Worker detection and status tracking
 * - Type-safe message passing to Service Worker
 * - Notification permission management
 * - Proper cleanup of event listeners
 * - Comprehensive error handling
 * 
 * @returns {UseServiceWorkerReturn} Object containing reactive state and methods
 * 
 * @throws {ServiceWorkerError} When Service Worker operations fail
 */
export function useServiceWorker(): UseServiceWorkerReturn {
  // ===== État réactif =====
  const isServiceWorkerReady = ref<boolean>(false);
  const serviceWorkerStatus = ref<ServiceWorkerStatus>(ServiceWorkerStatus.INITIALIZING);

  // ===== Gestionnaires d'événements =====
  let messageHandler: ((event: MessageEvent<ServiceWorkerMessage>) => void) | null = null;
  let controllerChangeHandler: (() => void) | null = null;
  let errorHandler: ((event: Event) => void) | null = null;

  // ===== Méthodes privées =====

  /**
   * Handle messages from Service Worker
   */
  const handleServiceWorkerMessage = (event: MessageEvent<ServiceWorkerMessage>): void => {
    try {
      const { data } = event;
      
      if (!data || typeof data !== 'object') {
        console.warn('Invalid message received from Service Worker:', data);
        return;
      }

      switch (data.type) {
        case ServiceWorkerMessageType.SW_READY:
          const readyMessage = data as ServiceWorkerReadyMessage;
          isServiceWorkerReady.value = true;
          serviceWorkerStatus.value = ServiceWorkerStatus.ACTIVE;
          console.info('Service Worker ready:', readyMessage.message);
          break;

        default:
          console.debug('Unhandled Service Worker message:', data.type);
      }
    } catch (error) {
      console.error('Error handling Service Worker message:', error);
    }
  };

  /**
   * Handle Service Worker controller changes
   */
  const handleControllerChange = (): void => {
    serviceWorkerStatus.value = ServiceWorkerStatus.UPDATED;
    console.info('Service Worker controller changed');
  };

  /**
   * Handle Service Worker errors
   */
  const handleServiceWorkerError = (event: Event): void => {
    console.error('Service Worker error:', event);
    serviceWorkerStatus.value = ServiceWorkerStatus.FAILED;
  };

  /**
   * Initialize Service Worker listeners and check readiness
   */
  const initializeServiceWorker = async (): Promise<void> => {
    if (!isServiceWorkerSupported()) {
      serviceWorkerStatus.value = ServiceWorkerStatus.NOT_SUPPORTED;
      console.warn('Service Worker not supported in this browser');
      return;
    }

    try {
      // Setup event handlers
      messageHandler = handleServiceWorkerMessage;
      controllerChangeHandler = handleControllerChange;
      errorHandler = handleServiceWorkerError;

      // Add event listeners
      navigator.serviceWorker.addEventListener('message', messageHandler);
      navigator.serviceWorker.addEventListener('controllerchange', controllerChangeHandler);
      if (errorHandler) {
        navigator.serviceWorker.addEventListener('error', errorHandler);
      }

      // Check if Service Worker is already active
      const registration = await navigator.serviceWorker.ready;
      
      if (registration.active) {
        isServiceWorkerReady.value = true;
        serviceWorkerStatus.value = ServiceWorkerStatus.ACTIVE;
        console.info('Service Worker already active');
      }

    } catch (error) {
      const swError = new ServiceWorkerError(
        'Failed to initialize Service Worker',
        'SW_INIT_FAILED',
        error instanceof Error ? error : new Error(String(error))
      );
      
      console.error('Service Worker initialization failed:', swError);
      serviceWorkerStatus.value = ServiceWorkerStatus.FAILED;
      throw swError;
    }
  };

  /**
   * Clean up event listeners and references
   */
  const cleanup = (): void => {
    if (!isServiceWorkerSupported()) return;

    try {
      if (messageHandler) {
        navigator.serviceWorker.removeEventListener('message', messageHandler);
        messageHandler = null;
      }
      
      if (controllerChangeHandler) {
        navigator.serviceWorker.removeEventListener('controllerchange', controllerChangeHandler);
        controllerChangeHandler = null;
      }

      if (errorHandler) {
        navigator.serviceWorker.removeEventListener('error', errorHandler);
        errorHandler = null;
      }

      console.debug('Service Worker event listeners cleaned up');
    } catch (error) {
      console.error('Error during Service Worker cleanup:', error);
    }
  };

  // ===== Public methods =====

  /**
   * Send a typed message to the Service Worker
   * 
   * @param message - The message to send to the Service Worker
   * @throws {ServiceWorkerError} When message sending fails
   * 
   * @example
   * ```typescript
   * await sendMessageToSW({
   *   type: ServiceWorkerMessageType.SHOW_NOTIFICATION,
   *   payload: { title: 'Hello', body: 'World' }
   * });
   * ```
   */
  const sendMessageToSW = async (message: ServiceWorkerMessage): Promise<void> => {
    if (!isServiceWorkerSupported()) {
      throw new ServiceWorkerError(
        'Service Worker not supported in this environment',
        'SW_NOT_SUPPORTED'
      );
    }

    if (!message || typeof message !== 'object' || !message.type) {
      throw new ServiceWorkerError(
        'Invalid message format. Message must be an object with a type property',
        'INVALID_MESSAGE'
      );
    }

    try {
      const registration = await navigator.serviceWorker.ready;
      const activeWorker = getActiveServiceWorker(registration);
      
      if (!activeWorker) {
        throw new ServiceWorkerError(
          'No active Service Worker available to receive messages',
          'NO_ACTIVE_SW'
        );
      }

      // Add timestamp to message
      const messageWithTimestamp: ServiceWorkerMessage = {
        ...message,
        timestamp: new Date().toISOString()
      };

      activeWorker.postMessage(messageWithTimestamp);
      console.debug('Message sent to Service Worker:', messageWithTimestamp.type);

    } catch (error) {
      const swError = error instanceof ServiceWorkerError 
        ? error 
        : new ServiceWorkerError(
            'Failed to send message to Service Worker',
            'MESSAGE_SEND_FAILED',
            error instanceof Error ? error : new Error(String(error))
          );
      
      console.error('Error sending message to Service Worker:', swError);
      throw swError;
    }
  };

  /**
   * Request notification permission from the user
   * 
   * @returns Promise resolving to the notification permission status
   * 
   * @example
   * ```typescript
   * const permission = await requestNotificationPermission();
   * if (permission === 'granted') {
   *   // Can send notifications
   * }
   * ```
   */
  const requestNotificationPermission = async (): Promise<NotificationPermission> => {
    if (!isNotificationAPISupported()) {
      throw new ServiceWorkerError(
        'Notification API not supported in this environment',
        'NOTIFICATION_NOT_SUPPORTED'
      );
    }

    try {
      if (Notification.permission === 'default') {
        const permission = await Notification.requestPermission();
        console.info('Notification permission requested:', permission);
        return permission;
      }
      
      return Notification.permission;
    } catch (error) {
      const swError = new ServiceWorkerError(
        'Failed to request notification permission',
        'PERMISSION_REQUEST_FAILED',
        error instanceof Error ? error : new Error(String(error))
      );
      
      console.error('Error requesting notification permission:', swError);
      throw swError;
    }
  };

  /**
   * Check if notifications are supported and permitted
   * 
   * @returns True if notifications are supported and permission is granted
   */
  const isNotificationSupported = (): boolean => {
    return isNotificationAPISupported() && Notification.permission === 'granted';
  };

  /**
   * Send a test notification via the Service Worker
   * 
   * Validates Service Worker readiness, notification permissions,
   * and sends a test notification to verify the notification system.
   * 
   * @throws {ServiceWorkerError} When notification sending fails
   * 
   * @example
   * ```typescript
   * try {
   *   await testNotification();
   *   console.log('Test notification sent successfully');
   * } catch (error) {
   *   console.error('Failed to send test notification:', error);
   * }
   * ```
   */
  const testNotification = async (): Promise<void> => {
    // Validate Service Worker readiness
    if (!isServiceWorkerReady.value) {
      throw new ServiceWorkerError(
        'Service Worker not ready. Please wait for initialization to complete.',
        'SW_NOT_READY'
      );
    }

    // Validate notification support
    if (!isNotificationAPISupported()) {
      throw new ServiceWorkerError(
        'Notification API not supported in this browser',
        'NOTIFICATION_NOT_SUPPORTED'
      );
    }

    try {
      // Request permission if needed
      const permission = await requestNotificationPermission();
      
      if (permission !== 'granted') {
        throw new ServiceWorkerError(
          `Notification permission ${permission}. Cannot send notifications.`,
          'PERMISSION_DENIED'
        );
      }

      // Create test notification payload
      const testPayload: NotificationPayload = {
        title: '🧪 [TEST] Alert from DomainThings.dev',
        body: 'Test notification alert from DomainThings.dev',
        icon: '/icons/android-chrome-192x192.png',
        badge: '/icons/android-chrome-192x192.png',
        tag: 'test-notification',
        timestamp: Date.now(),
        data: {
          test: true,
          source: 'useServiceWorker',
          timestamp: new Date().toISOString()
        },
        requireInteraction: false,
        silent: false
      };

      // Send notification message to Service Worker
      await sendMessageToSW({
        type: ServiceWorkerMessageType.SHOW_NOTIFICATION,
        payload: testPayload
      });

      console.info('Test notification sent successfully');

    } catch (error) {
      if (error instanceof ServiceWorkerError) {
        throw error;
      }
      
      const swError = new ServiceWorkerError(
        'Failed to send test notification',
        'TEST_NOTIFICATION_FAILED',
        error instanceof Error ? error : new Error(String(error))
      );
      
      console.error('Test notification failed:', swError);
      throw swError;
    }
  };

  // ===== Lifecycle hooks =====

  onMounted(async () => {
    try {
      await initializeServiceWorker();
    } catch (error) {
      // Error already logged in initializeServiceWorker
      console.error('Failed to mount Service Worker composable:', error);
    }
  });

  onUnmounted(() => {
    cleanup();
  });

  // ===== API publique =====

  return {
    // État réactif en lecture seule
    isServiceWorkerReady: readonly(isServiceWorkerReady),
    serviceWorkerStatus: readonly(serviceWorkerStatus),
    
    // Méthodes
    sendMessageToSW,
    testNotification,
    requestNotificationPermission,
    isNotificationSupported,
    cleanup
  };
}
