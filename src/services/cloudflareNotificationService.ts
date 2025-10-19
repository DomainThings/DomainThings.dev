/**
 * Cloudflare Worker Notification Service
 * 
 * Handles push notifications via Cloudflare Workers for cross-platform support
 * Maintains privacy-first approach while enabling background notifications
 * 
 * @version 1.0.0
 */

interface CloudflareNotificationConfig {
  readonly workerUrl: string;
  readonly vapidPublicKey: string;
}

interface NotificationSubscription {
  readonly endpoint: string;
  readonly keys: {
    readonly p256dh: string;
    readonly auth: string;
  };
}

interface ScheduleNotificationRequest {
  readonly domain: string;
  readonly alertDate: string;
  readonly expirationDate: string;
  readonly pushSubscription: NotificationSubscription;
  readonly userAgent: string;
}

interface CloudflareServiceResult<T = unknown> {
  readonly success: boolean;
  readonly data?: T;
  readonly error?: string;
}

/**
 * Cloudflare Worker notification service
 */
export class CloudflareNotificationService {
  private readonly config: CloudflareNotificationConfig;
  private pushSubscription: PushSubscription | null = null;

  constructor(config: CloudflareNotificationConfig) {
    this.config = config;
  }

  /**
   * Initialize push subscription
   */
  async initializePushSubscription(): Promise<CloudflareServiceResult<PushSubscription>> {
    try {
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        return {
          success: false,
          error: 'Push notifications not supported'
        };
      }

      const registration = await navigator.serviceWorker.ready;
      
      // Check for existing subscription
      let subscription = await registration.pushManager.getSubscription();
      
      if (!subscription) {
        // Create new subscription
        const applicationServerKey = this.urlBase64ToUint8Array(this.config.vapidPublicKey);
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: applicationServerKey as BufferSource
        });
      }

      this.pushSubscription = subscription;
      
      return {
        success: true,
        data: subscription
      };

    } catch (error) {
      console.error('Push subscription initialization failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Schedule notification via Cloudflare Worker
   */
  async scheduleNotification(
    domain: string,
    alertDate: Date,
    expirationDate: Date
  ): Promise<CloudflareServiceResult<void>> {
    try {
      if (!this.pushSubscription) {
        const initResult = await this.initializePushSubscription();
        if (!initResult.success) {
          return {
            success: false,
            error: 'Push subscription not available'
          };
        }
      }

      const request: ScheduleNotificationRequest = {
        domain,
        alertDate: alertDate.toISOString(),
        expirationDate: expirationDate.toISOString(),
        pushSubscription: {
          endpoint: this.pushSubscription!.endpoint,
          keys: {
            p256dh: this.arrayBufferToBase64(this.pushSubscription!.getKey('p256dh')!),
            auth: this.arrayBufferToBase64(this.pushSubscription!.getKey('auth')!)
          }
        },
        userAgent: navigator.userAgent
      };

      const response = await fetch(`${this.config.workerUrl}/api/notifications/schedule`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(request)
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      
      return {
        success: result.success,
        error: result.error
      };

    } catch (error) {
      console.error('Schedule notification failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Cancel scheduled notification
   */
  async cancelNotification(domain: string): Promise<CloudflareServiceResult<void>> {
    try {
      const response = await fetch(`${this.config.workerUrl}/api/notifications/cancel`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ domain })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      
      return {
        success: result.success,
        error: result.error
      };

    } catch (error) {
      console.error('Cancel notification failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get notification permission status
   */
  getNotificationPermission(): NotificationPermission {
    return Notification.permission;
  }

  /**
   * Request notification permission
   */
  async requestNotificationPermission(): Promise<CloudflareServiceResult<NotificationPermission>> {
    try {
      const permission = await Notification.requestPermission();
      
      return {
        success: permission === 'granted',
        data: permission
      };

    } catch (error) {
      console.error('Notification permission request failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Check if push notifications are supported
   */
  isPushNotificationSupported(): boolean {
    return (
      'serviceWorker' in navigator &&
      'PushManager' in window &&
      'Notification' in window
    );
  }

  /**
   * Utility: Convert VAPID key to Uint8Array
   */
  private urlBase64ToUint8Array(base64String: string): Uint8Array {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
      .replace(/-/g, '+')
      .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }

  /**
   * Utility: Convert ArrayBuffer to Base64
   */
  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      const byte = bytes[i];
      if (byte !== undefined) {
        binary += String.fromCharCode(byte);
      }
    }
    return window.btoa(binary);
  }
}

/**
 * Default configuration for production
 */
export const defaultCloudflareConfig: CloudflareNotificationConfig = {
  workerUrl: 'https://notifications.your-domain.workers.dev',
  vapidPublicKey: 'YOUR_VAPID_PUBLIC_KEY' // À générer
};

/**
 * Create notification service instance
 */
export const createCloudflareNotificationService = (
  config: CloudflareNotificationConfig = defaultCloudflareConfig
): CloudflareNotificationService => {
  return new CloudflareNotificationService(config);
};