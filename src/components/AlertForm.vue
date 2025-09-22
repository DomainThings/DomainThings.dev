<script lang="ts" setup>
import { ref, computed, onMounted } from 'vue';
import BaseButton from './BaseButton.vue';
import BaseBadge from './BaseBadge.vue';
import { useTheme } from '@/composables/useTheme';
import { useBackgroundNotifications } from '@/composables/useBackgroundNotifications';
import * as AlertService from '@/services/alertService';

interface Props {
  domain: string;
  expirationDate: Date;
  existingAlert?: AlertService.AlertSettings | null;
}

interface Emits {
  save: [alert: Omit<AlertService.AlertSettings, 'id' | 'createdAt'>];
  delete: [];
  close: [];
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

const { getButtonClasses, getBadgeClasses, getTextClasses } = useTheme();
const { getSupportInfo, getRecommendations, checkBackgroundSupport } = useBackgroundNotifications();

// Form state
const enabled = ref(props.existingAlert?.enabled ?? true);

// Calculate default alert date (expiration date or existing alert date)
const getDefaultAlertDate = (): string => {
  if (props.existingAlert) {
    // If existing alert, calculate the alert date from the existing settings
    const alertDate = new Date(props.expirationDate);
    alertDate.setDate(alertDate.getDate() - props.existingAlert.daysBeforeExpiration);
    return formatDateForInput(alertDate);
  } else {
    // Default: expiration date
    return formatDateForInput(props.expirationDate);
  }
};

// Helper function to format date for input (local date, not UTC)
const formatDateForInput = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const alertDate = ref(getDefaultAlertDate());

// Computed
const isNewAlert = computed(() => !props.existingAlert);
const formattedExpirationDate = computed(() => {
  return props.expirationDate.toLocaleDateString('fr-FR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
});

// Computed for days before expiration based on selected alert date
const daysBeforeExpiration = computed(() => {
  const selectedDate = new Date(alertDate.value);
  const expirationDateTime = new Date(props.expirationDate);
  const diffTime = expirationDateTime.getTime() - selectedDate.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return Math.max(0, diffDays);
});

// Methods
const handleSave = () => {
  const alertSettings = {
    enabled: enabled.value,
    daysBeforeExpiration: daysBeforeExpiration.value,
    reminderFrequency: 'once' as const,
    domain: props.domain,
    expirationDate: props.expirationDate
  };
  
  emit('save', alertSettings);
};

const handleDelete = () => {
  emit('delete');
};

const handleClose = () => {
  emit('close');
};

// Check if notifications are supported and granted
const isNotificationSupported = 'Notification' in window;
const notificationPermission = ref(Notification.permission);

const requestNotificationPermission = async () => {
  if (isNotificationSupported) {
    const permission = await Notification.requestPermission();
    notificationPermission.value = permission;
  }
};

// Initialize background support check on mount
onMounted(() => {
  checkBackgroundSupport();
});
</script>

<template>
  <div class="space-y-6">
    <!-- Header Info -->
    <div class="space-y-2">
      <h3 :class="[getTextClasses('neutral'), 'text-lg font-semibold']">
        Alerte d'expiration pour {{ domain }}
      </h3>
      <div :class="[getTextClasses('neutral'), 'text-sm']">
        <p>Domaine expire le : <strong>{{ formattedExpirationDate }}</strong></p>
      </div>
    </div>

    <!-- Notification Permission Check -->
    <div v-if="isNotificationSupported && notificationPermission !== 'granted'" 
         class="p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
      <div class="flex items-center justify-between gap-4">
        <div>
          <h4 :class="[getTextClasses('warning'), 'font-medium']">Autorisation requise</h4>
          <p :class="[getTextClasses('neutral'), 'text-sm mt-1']">
            Autorisez les notifications pour recevoir les alertes d'expiration.
          </p>
        </div>
        <BaseButton 
          @click="requestNotificationPermission"
          variant="warning"
          size="sm">
          Autoriser
        </BaseButton>
      </div>
    </div>

    <!-- Alert not supported -->
    <div v-else-if="!isNotificationSupported"
         class="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
      <h4 :class="[getTextClasses('error'), 'font-medium']">Notifications non supportées</h4>
      <p :class="[getTextClasses('neutral'), 'text-sm mt-1']">
        Votre navigateur ne supporte pas les notifications push.
      </p>
    </div>

    <!-- Background notifications info -->
    <div v-if="notificationPermission === 'granted'" 
         class="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
      <h4 :class="[getTextClasses('neutral'), 'font-medium text-sm mb-2']">
        🔔 Notifications en arrière-plan
      </h4>
      
      <div class="space-y-2 text-xs">
        <div v-if="getSupportInfo.backgroundNotifications" class="flex items-center gap-2">
          <BaseBadge variant="success" size="sm">✅ Entièrement supportées</BaseBadge>
        </div>
        <div v-else-if="getSupportInfo.fallbackMode" class="flex items-center gap-2">
          <BaseBadge variant="warning" size="sm">⚠️ Support partiel</BaseBadge>
        </div>
        <div v-else class="flex items-center gap-2">
          <BaseBadge variant="error" size="sm">❌ Non supportées</BaseBadge>
        </div>
        
        <ul :class="[getTextClasses('neutral'), 'text-xs space-y-1 mt-2 opacity-75']">
          <li v-for="recommendation in getRecommendations" 
              :key="recommendation" 
              class="flex items-start gap-1">
            <span class="text-gray-400 mt-0.5">•</span>
            <span>{{ recommendation }}</span>
          </li>
        </ul>
      </div>
    </div>

    <!-- Form -->
    <form @submit.prevent="handleSave" class="space-y-4">
      <!-- Enable/Disable Toggle -->
      <div class="flex items-center justify-between">
        <label :class="[getTextClasses('neutral'), 'font-medium']" for="alert-enabled">
          Activer l'alerte
        </label>
        <input 
          id="alert-enabled"
          v-model="enabled"
          type="checkbox"
          class="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600">
      </div>

      <div v-if="enabled" class="space-y-4">
        <!-- Alert Date Selection -->
        <div>
          <label :class="[getTextClasses('neutral'), 'block text-sm font-medium mb-2']" for="alert-date">
            Date d'alerte
          </label>
          <input 
            id="alert-date"
            v-model="alertDate"
            type="date"
            :max="formatDateForInput(props.expirationDate)"
            class="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white">
        </div>
      </div>
    </form>

    <!-- Actions -->
    <div class="flex justify-between items-center pt-4 border-t border-gray-200 dark:border-gray-700">
      <div>
        <BaseButton 
          v-if="!isNewAlert"
          @click="handleDelete"
          variant="error"
          size="sm">
          Supprimer l'alerte
        </BaseButton>
      </div>
      
      <div class="flex gap-2">
        <BaseButton 
          @click="handleClose"
          variant="neutral"
          size="sm">
          Annuler
        </BaseButton>
        <BaseButton 
          @click="handleSave"
          variant="primary"
          size="sm"
          :disabled="!isNotificationSupported || (isNotificationSupported && notificationPermission !== 'granted')">
          {{ isNewAlert ? 'Créer l\'alerte' : 'Modifier l\'alerte' }}
        </BaseButton>
      </div>
    </div>
  </div>
</template>
