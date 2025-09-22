/**
 * Composable pour gérer les communications avec le Service Worker
 */
import { ref, onMounted, onUnmounted } from 'vue';

export function useServiceWorker() {
  const isServiceWorkerReady = ref(false);
  const serviceWorkerStatus = ref<string>('Initializing...');

  let messageHandler: ((event: MessageEvent) => void) | null = null;

  onMounted(() => {
    if ('serviceWorker' in navigator) {
      // Listen for messages from the service worker
      messageHandler = (event: MessageEvent) => {
        if (event.data?.type === 'SW_READY') {
          isServiceWorkerReady.value = true;
          serviceWorkerStatus.value = event.data.message;
        }
      };

      navigator.serviceWorker.addEventListener('message', messageHandler);

      // Check if SW is already active
      navigator.serviceWorker.ready.then((registration) => {
        if (registration.active) {
          isServiceWorkerReady.value = true;
          serviceWorkerStatus.value = 'Service Worker active';
        }
      }).catch(error => {
        console.error('Service Worker initialization failed:', error);
      });

      // Listen for SW updates
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        serviceWorkerStatus.value = 'Service Worker updated';
      });
    } else {
      serviceWorkerStatus.value = 'Service Worker not supported';
      console.warn('Service Worker not supported in this browser');
    }
  });

  onUnmounted(() => {
    if (messageHandler && 'serviceWorker' in navigator) {
      navigator.serviceWorker.removeEventListener('message', messageHandler);
    }
  });

  /**
   * Send a message to the service worker
   */
  const sendMessageToSW = async (message: any) => {
    if ('serviceWorker' in navigator) {
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
    } else {
      console.error('Service Worker not supported');
    }
  };

  /**
   * Test notification via service worker
   */
  const testNotification = async () => {
    if (!isServiceWorkerReady.value) {
      console.warn('Service Worker not ready yet');
      return;
    }

    // Check notification permission
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
