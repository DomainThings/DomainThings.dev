/**
 * Composable pour gérer les communications avec le Service Worker
 */
import { ref, onMounted, onUnmounted } from 'vue';

export function useServiceWorker() {
  const isServiceWorkerReady = ref(false);
  const serviceWorkerStatus = ref<string>('Initializing...');

  // Stockage des handlers pour un nettoyage approprié
  let messageHandler: ((event: MessageEvent) => void) | null = null;
  let controllerChangeHandler: (() => void) | null = null;

  onMounted(() => {
    if ('serviceWorker' in navigator) {
      // Listen for messages from the service worker
      messageHandler = (event: MessageEvent) => {
        if (event.data?.type === 'SW_READY') {
          isServiceWorkerReady.value = true;
          serviceWorkerStatus.value = event.data.message;
        }
      };

      // Listen for SW updates
      controllerChangeHandler = () => {
        serviceWorkerStatus.value = 'Service Worker updated';
      };

      // Ajouter les event listeners
      navigator.serviceWorker.addEventListener('message', messageHandler);
      navigator.serviceWorker.addEventListener('controllerchange', controllerChangeHandler);

      // Check if SW is already active
      navigator.serviceWorker.ready.then((registration) => {
        if (registration.active) {
          isServiceWorkerReady.value = true;
          serviceWorkerStatus.value = 'Service Worker active';
        }
      }).catch(error => {
        console.error('Service Worker initialization failed:', error);
        serviceWorkerStatus.value = 'Service Worker failed to initialize';
      });
    } else {
      serviceWorkerStatus.value = 'Service Worker not supported';
      console.warn('Service Worker not supported in this browser');
    }
  });

  onUnmounted(() => {
    // Nettoyage approprié de tous les event listeners
    if ('serviceWorker' in navigator) {
      if (messageHandler) {
        navigator.serviceWorker.removeEventListener('message', messageHandler);
        messageHandler = null;
      }
      
      if (controllerChangeHandler) {
        navigator.serviceWorker.removeEventListener('controllerchange', controllerChangeHandler);
        controllerChangeHandler = null;
      }
    }
  });

  /**
   * Send a message to the service worker
   */
  const sendMessageToSW = async (message: any): Promise<void> => {
    if (!('serviceWorker' in navigator)) {
      console.error('Service Worker not supported');
      return;
    }

    try {
      const registration = await navigator.serviceWorker.ready;
      
      if (registration.active) {
        registration.active.postMessage(message);
      } else if (registration.waiting) {
        registration.waiting.postMessage(message);
      } else if (registration.installing) {
        registration.installing.postMessage(message);
      } else {
        console.error('No Service Worker available to send message to');
      }
    } catch (error) {
      console.error('Error sending message to Service Worker:', error);
    }
  };

  /**
   * Test notification via service worker
   */
  const testNotification = async (): Promise<void> => {
    if (!isServiceWorkerReady.value) {
      console.warn('Service Worker not ready yet');
      return;
    }

    // Check notification permission
    if (!('Notification' in window)) {
      console.error('Notifications not supported');
      return;
    }

    if (Notification.permission !== 'granted') {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        console.warn('Notification permission denied');
        return;
      }
    }

    // Send test notification
    const testPayload = {
      title: '🧪 Test Notification',
      body: 'Ceci est un test du système d\'alertes',
      icon: '/icons/android-chrome-192x192.png',
      tag: 'test-notification',
      data: {
        test: true,
        timestamp: new Date().toISOString()
      }
    };

    await sendMessageToSW({
      type: 'SHOW_NOTIFICATION',
      payload: testPayload
    });
  };

  return {
    isServiceWorkerReady,
    serviceWorkerStatus,
    sendMessageToSW,
    testNotification
  };
}
