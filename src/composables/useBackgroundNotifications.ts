/**
 * Vue 3 composable for managing background notifications via Service Worker
 * 
 * Provides comprehensive background notification management with:
 * - Service Worker and Notification API support detection
 * - Periodic background sync capabilities
 * - Manual notification triggers
 * - User-friendly recommendations
 * 
 * @example
 * ```typescript
 * import { useBackgroundNotifications } from '@/composables/useBackgroundNotifications';
 * 
 * const {
 *   isSupported,
 *   supportInfo,
 *   recommendations,
 *   checkBackgroundSupport,
 *   triggerManualCheck
 * } = useBackgroundNotifications();
 * 
 * // Initialize support detection
 * await checkBackgroundSupport();
 * 
 * // Check current support status
 * if (supportInfo.value.backgroundNotifications) {
 *   console.log('Full background notifications supported');
 * }
 * ```
 */
import { ref, computed, readonly, onMounted, type Ref, type ComputedRef } from 'vue';
import { triggerNotificationCheck } from '@/services/alertService';

// ===== Types and Interfaces =====

/**
 * Background notification support capabilities
 */
export interface BackgroundSupportInfo {
  readonly notifications: boolean;
  readonly serviceWorker: boolean;
  readonly periodicSync: boolean;
  readonly backgroundNotifications: boolean;
  readonly fallbackMode: boolean;
}

/**
 * Background notification check result
 */
export interface NotificationCheckResult {
  readonly success: boolean;
  readonly timestamp: Date;
  readonly error?: string;
}

/**
 * User recommendation levels
 */
export enum RecommendationLevel {
  SUCCESS = 'success',
  WARNING = 'warning',
  ERROR = 'error',
  INFO = 'info'
}

/**
 * User recommendation item
 */
export interface UserRecommendation {
  readonly message: string;
  readonly level: RecommendationLevel;
  readonly actionRequired: boolean;
}

/**
 * Background notification error types
 */
export class BackgroundNotificationError extends Error {
  constructor(
    message: string,
    public readonly code: BackgroundNotificationErrorCode,
    public readonly originalError?: Error
  ) {
    super(message);
    this.name = 'BackgroundNotificationError';
  }
}

/**
 * Background notification error codes
 */
export enum BackgroundNotificationErrorCode {
  SERVICE_WORKER_UNAVAILABLE = 'SERVICE_WORKER_UNAVAILABLE',
  NOTIFICATION_NOT_SUPPORTED = 'NOTIFICATION_NOT_SUPPORTED',
  PERIODIC_SYNC_UNAVAILABLE = 'PERIODIC_SYNC_UNAVAILABLE',
  MANUAL_CHECK_FAILED = 'MANUAL_CHECK_FAILED',
  SUPPORT_CHECK_FAILED = 'SUPPORT_CHECK_FAILED'
}

/**
 * Return type for the useBackgroundNotifications composable
 */
export interface UseBackgroundNotificationsReturn {
  /** Whether basic notification support is available */
  readonly isSupported: Readonly<Ref<boolean>>;
  /** Whether periodic background sync is supported */
  readonly isPeriodicSyncSupported: Readonly<Ref<boolean>>;
  /** Timestamp of the last manual notification check */
  readonly lastCheckTime: Readonly<Ref<Date | null>>;
  /** Result of the last manual check attempt */
  readonly lastCheckResult: Readonly<Ref<NotificationCheckResult | null>>;
  /** Detailed support information */
  readonly supportInfo: ComputedRef<BackgroundSupportInfo>;
  /** User-friendly recommendations based on support */
  readonly recommendations: ComputedRef<readonly UserRecommendation[]>;
  /** Whether initialization is complete */
  readonly isInitialized: Readonly<Ref<boolean>>;
  /** Check background notification support capabilities */
  readonly checkBackgroundSupport: () => Promise<BackgroundSupportInfo>;
  /** Trigger a manual notification check */
  readonly triggerManualCheck: () => Promise<NotificationCheckResult>;
  /** Reset the composable state */
  readonly reset: () => void;
}

// ===== Private Utilities =====

/**
 * Check if Service Worker API is available
 */
const isServiceWorkerAPIAvailable = (): boolean => {
  return typeof navigator !== 'undefined' && 'serviceWorker' in navigator;
};

/**
 * Check if Notification API is available
 */
const isNotificationAPIAvailable = (): boolean => {
  return typeof window !== 'undefined' && 'Notification' in window;
};

/**
 * Check if periodic background sync is supported
 */
const checkPeriodicSyncSupport = async (): Promise<boolean> => {
  if (!isServiceWorkerAPIAvailable()) {
    return false;
  }

  try {
    const registration = await navigator.serviceWorker.ready;
    return 'periodicSync' in registration;
  } catch (error) {
    console.warn('Failed to check periodic sync support:', error);
    return false;
  }
};

/**
 * Generate user recommendations based on support status
 */
const generateRecommendations = (supportInfo: BackgroundSupportInfo): readonly UserRecommendation[] => {
  const recommendations: UserRecommendation[] = [];

  if (!supportInfo.notifications) {
    recommendations.push({
      message: 'Your browser does not support PWA notifications',
      level: RecommendationLevel.ERROR,
      actionRequired: true
    });
    
    recommendations.push({
      message: 'Please use a modern browser (Chrome, Firefox, Safari)',
      level: RecommendationLevel.INFO,
      actionRequired: true
    });
  } else if (!supportInfo.serviceWorker) {
    recommendations.push({
      message: 'Service Worker unavailable, notifications are limited',
      level: RecommendationLevel.WARNING,
      actionRequired: false
    });
  } else if (!supportInfo.periodicSync) {
    recommendations.push({
      message: 'Automatic background notifications are not supported',
      level: RecommendationLevel.WARNING,
      actionRequired: false
    });
    
    recommendations.push({
      message: 'Open the application regularly to check for alerts',
      level: RecommendationLevel.INFO,
      actionRequired: true
    });
    
    recommendations.push({
      message: 'Fallback mode: notifications available when app is open',
      level: RecommendationLevel.INFO,
      actionRequired: false
    });
  } else {
    recommendations.push({
      message: 'Background notifications are fully supported',
      level: RecommendationLevel.SUCCESS,
      actionRequired: false
    });
    
    recommendations.push({
      message: 'You will receive alerts even when the application is closed',
      level: RecommendationLevel.SUCCESS,
      actionRequired: false
    });
    
    recommendations.push({
      message: 'Make sure notifications are allowed in your browser settings',
      level: RecommendationLevel.INFO,
      actionRequired: true
    });
  }

  return Object.freeze(recommendations);
};

// ===== Main Composable =====

/**
 * Vue 3 composable for managing background notifications
 * 
 * Provides reactive state management for background notification capabilities,
 * support detection, and user guidance for optimal notification experience.
 * 
 * Features:
 * - Automatic capability detection
 * - Periodic sync support checking
 * - Manual notification triggers with error handling
 * - User-friendly recommendations
 * - Performance optimized with caching
 * 
 * @returns {UseBackgroundNotificationsReturn} Object containing reactive state and methods
 * 
 * @throws {BackgroundNotificationError} When critical operations fail
 */
export function useBackgroundNotifications(): UseBackgroundNotificationsReturn {
  // ===== Reactive State =====
  const isSupported = ref<boolean>(false);
  const isPeriodicSyncSupported = ref<boolean>(false);
  const lastCheckTime = ref<Date | null>(null);
  const lastCheckResult = ref<NotificationCheckResult | null>(null);
  const isInitialized = ref<boolean>(false);

  // ===== Computed Properties =====

  /**
   * Comprehensive support information
   */
  const supportInfo = computed<BackgroundSupportInfo>(() => {
    const notifications = isSupported.value;
    const serviceWorker = isServiceWorkerAPIAvailable();
    const periodicSync = isPeriodicSyncSupported.value;
    
    return Object.freeze({
      notifications,
      serviceWorker,
      periodicSync,
      backgroundNotifications: notifications && serviceWorker && periodicSync,
      fallbackMode: notifications && serviceWorker && !periodicSync
    });
  });

  /**
   * User-friendly recommendations based on current support
   */
  const recommendations = computed<readonly UserRecommendation[]>(() => {
    return generateRecommendations(supportInfo.value);
  });

  // ===== Public Methods =====

  /**
   * Check and update background notification support capabilities
   * 
   * Performs comprehensive detection of notification and Service Worker APIs,
   * including periodic background sync support.
   * 
   * @returns Promise resolving to support information
   * @throws {BackgroundNotificationError} When support check fails
   * 
   * @example
   * ```typescript
   * try {
   *   const support = await checkBackgroundSupport();
   *   if (support.backgroundNotifications) {
   *     console.log('Full background support available');
   *   }
   * } catch (error) {
   *   console.error('Support check failed:', error);
   * }
   * ```
   */
  const checkBackgroundSupport = async (): Promise<BackgroundSupportInfo> => {
    try {
      // Check basic notification support
      const notificationSupported = isNotificationAPIAvailable();
      isSupported.value = notificationSupported;

      // Check periodic sync support
      const periodicSyncSupported = await checkPeriodicSyncSupport();
      isPeriodicSyncSupported.value = periodicSyncSupported;

      isInitialized.value = true;

      const support = supportInfo.value;
      console.info('Background notification support check completed:', support);
      
      return support;

    } catch (error) {
      const bgError = new BackgroundNotificationError(
        'Failed to check background notification support',
        BackgroundNotificationErrorCode.SUPPORT_CHECK_FAILED,
        error instanceof Error ? error : new Error(String(error))
      );

      console.error('Background support check failed:', bgError);
      isInitialized.value = true; // Mark as initialized to prevent retry loops
      throw bgError;
    }
  };

  /**
   * Trigger a manual notification check via Service Worker
   * 
   * Attempts to manually trigger notification checking and updates
   * the last check timestamp and result status.
   * 
   * @returns Promise resolving to check result
   * @throws {BackgroundNotificationError} When manual check fails
   * 
   * @example
   * ```typescript
   * try {
   *   const result = await triggerManualCheck();
   *   if (result.success) {
   *     console.log('Manual check completed at:', result.timestamp);
   *   }
   * } catch (error) {
   *   console.error('Manual check failed:', error);
   * }
   * ```
   */
  const triggerManualCheck = async (): Promise<NotificationCheckResult> => {
    const startTime = new Date();

    try {
      // Ensure support is checked first
      if (!isInitialized.value) {
        await checkBackgroundSupport();
      }

      // Validate that basic support is available
      if (!isSupported.value) {
        throw new BackgroundNotificationError(
          'Notifications not supported in this environment',
          BackgroundNotificationErrorCode.NOTIFICATION_NOT_SUPPORTED
        );
      }

      if (!isServiceWorkerAPIAvailable()) {
        throw new BackgroundNotificationError(
          'Service Worker not available for manual check',
          BackgroundNotificationErrorCode.SERVICE_WORKER_UNAVAILABLE
        );
      }

      // Trigger the notification check
      await triggerNotificationCheck();

      // Update state with successful result
      const result: NotificationCheckResult = Object.freeze({
        success: true,
        timestamp: startTime
      });

      lastCheckTime.value = startTime;
      lastCheckResult.value = result;

      console.info('Manual notification check completed successfully');
      return result;

    } catch (error) {
      // Create error result
      const errorMessage = error instanceof Error ? error.message : String(error);
      const result: NotificationCheckResult = Object.freeze({
        success: false,
        timestamp: startTime,
        error: errorMessage
      });

      lastCheckResult.value = result;

      // Wrap in background notification error if needed
      const bgError = error instanceof BackgroundNotificationError 
        ? error 
        : new BackgroundNotificationError(
            'Manual notification check failed',
            BackgroundNotificationErrorCode.MANUAL_CHECK_FAILED,
            error instanceof Error ? error : new Error(String(error))
          );

      console.error('Manual notification check failed:', bgError);
      throw bgError;
    }
  };

  /**
   * Reset the composable state to initial values
   * 
   * Useful for testing or when reinitializing the component.
   * 
   * @example
   * ```typescript
   * // Reset all state
   * reset();
   * 
   * // Re-check support
   * await checkBackgroundSupport();
   * ```
   */
  const reset = (): void => {
    isSupported.value = false;
    isPeriodicSyncSupported.value = false;
    lastCheckTime.value = null;
    lastCheckResult.value = null;
    isInitialized.value = false;
    
    console.debug('Background notifications composable state reset');
  };

  // ===== Lifecycle Hooks =====

  /**
   * Automatically check support on component mount
   */
  onMounted(async () => {
    try {
      await checkBackgroundSupport();
    } catch (error) {
      // Error already logged in checkBackgroundSupport
      console.warn('Failed to initialize background notifications on mount:', error);
    }
  });

  // ===== Public API =====

  return {
    // Read-only reactive state
    isSupported: readonly(isSupported),
    isPeriodicSyncSupported: readonly(isPeriodicSyncSupported),
    lastCheckTime: readonly(lastCheckTime),
    lastCheckResult: readonly(lastCheckResult),
    isInitialized: readonly(isInitialized),

    // Computed properties
    supportInfo,
    recommendations,

    // Methods
    checkBackgroundSupport,
    triggerManualCheck,
    reset
  };
}
