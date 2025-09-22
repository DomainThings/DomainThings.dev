/**
 * Composable pour gérer les notifications en arrière-plan via Service Worker
 */
import { ref, computed } from 'vue';
import { triggerNotificationCheck } from '@/services/alertService';

export function useBackgroundNotifications() {
  const isSupported = ref(false);
  const isPeriodicSyncSupported = ref(false);
  const lastCheckTime = ref<Date | null>(null);

  /**
   * Vérifier le support des notifications en arrière-plan
   */
  const checkBackgroundSupport = async (): Promise<void> => {
    // Vérifier le support des notifications
    isSupported.value = 'Notification' in window && 'serviceWorker' in navigator;
    
    // Vérifier le support du periodic background sync
    if ('serviceWorker' in navigator) {
      try {
        const registration = await navigator.serviceWorker.ready;
        isPeriodicSyncSupported.value = 'periodicSync' in registration;
      } catch (error) {
        console.warn('Erreur lors de la vérification du periodic sync:', error);
        isPeriodicSyncSupported.value = false;
      }
    }
  };

  /**
   * Déclencher une vérification manuelle des notifications
   */
  const triggerManualCheck = async (): Promise<void> => {
    try {
      await triggerNotificationCheck();
      lastCheckTime.value = new Date();
    } catch (error) {
      console.error('Erreur lors du déclenchement manuel:', error);
    }
  };

  /**
   * Obtenir des informations sur le support des notifications
   */
  const getSupportInfo = computed(() => ({
    notifications: isSupported.value,
    periodicSync: isPeriodicSyncSupported.value,
    backgroundNotifications: isSupported.value && isPeriodicSyncSupported.value,
    fallbackMode: isSupported.value && !isPeriodicSyncSupported.value
  }));

  /**
   * Obtenir des recommandations pour l'utilisateur
   */
  const getRecommendations = computed(() => {
    const recommendations: string[] = [];
    
    if (!isSupported.value) {
      recommendations.push('Votre navigateur ne supporte pas les notifications PWA');
    } else if (!isPeriodicSyncSupported.value) {
      recommendations.push('Les notifications automatiques en arrière-plan ne sont pas supportées');
      recommendations.push('Ouvrez régulièrement l\'application pour vérifier les alertes');
    } else {
      recommendations.push('Notifications en arrière-plan entièrement supportées');
      recommendations.push('Vous recevrez des alertes même quand l\'app est fermée');
    }
    
    return recommendations;
  });

  return {
    // État
    isSupported,
    isPeriodicSyncSupported,
    lastCheckTime,
    
    // Computed
    getSupportInfo,
    getRecommendations,
    
    // Méthodes
    checkBackgroundSupport,
    triggerManualCheck
  };
}
