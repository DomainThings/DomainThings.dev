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
  isBookmarked?: boolean;
}

interface Emits {
  save: [alert: Omit<AlertService.AlertSettings, 'id' | 'createdAt'>];
  delete: [alertId: string];
  close: [];
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

const { getButtonClasses, getBadgeClasses, getTextClasses } = useTheme();
const { supportInfo, recommendations, checkBackgroundSupport } = useBackgroundNotifications();


// Calculate default alert date (expiration date or existing alert date)
const getDefaultAlertDate = (): string => {
  if (props.existingAlert) {
    // If existing alert, use the existing alert date directly
    return formatDateForInput(new Date(props.existingAlert.alertDate));
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
  return props.expirationDate.toLocaleDateString('en-US', {
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
    alertDate: new Date(alertDate.value),
    reminderFrequency: 'once' as const,
    domain: props.domain,
    expirationDate: props.expirationDate
  };
  
  emit('save', alertSettings);
};

const handleDelete = () => {
  if (props.existingAlert?.id) {
    emit('delete', props.existingAlert.id);
  }
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
        Expiration Alert for {{ domain }}
      </h3>
      <div :class="[getTextClasses('neutral'), 'text-sm']">
        <p>Domain expires on: <strong>{{ formattedExpirationDate }}</strong></p>
      </div>
    </div>

    <!-- Notification Permission Check -->
    <div v-if="isNotificationSupported && notificationPermission !== 'granted'" 
         class="p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
      <div class="flex items-center justify-between gap-4">
        <div>
          <h4 :class="[getTextClasses('warning'), 'font-medium']">Permission Required</h4>
          <p :class="[getTextClasses('neutral'), 'text-sm mt-1']">
            Allow notifications to receive expiration alerts.
          </p>
        </div>
        <BaseButton 
          @click="requestNotificationPermission"
          variant="warning"
          size="sm">
          Allow
        </BaseButton>
      </div>
    </div>

    <!-- Alert not supported -->
    <div v-else-if="!isNotificationSupported"
         class="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
      <h4 :class="[getTextClasses('error'), 'font-medium']">Notifications Not Supported</h4>
      <p :class="[getTextClasses('neutral'), 'text-sm mt-1']">
        Your browser does not support push notifications.
      </p>
    </div>

    <!-- Background notifications info -->
    <div v-if="notificationPermission === 'granted'" 
         class="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
      <h4 :class="[getTextClasses('neutral'), 'font-medium text-sm mb-2']">
        🔔 Background Notifications
      </h4>
      
      <div class="space-y-2 text-xs">
        <div v-if="supportInfo.backgroundNotifications" class="flex items-center gap-2">
          <BaseBadge variant="success" size="sm">✅ Fully Supported</BaseBadge>
        </div>
        <div v-else-if="supportInfo.fallbackMode" class="flex items-center gap-2">
          <BaseBadge variant="warning" size="sm">⚠️ Partial Support</BaseBadge>
        </div>
        <div v-else class="flex items-center gap-2">
          <BaseBadge variant="error" size="sm">❌ Not Supported</BaseBadge>
        </div>
        
        <ul :class="[getTextClasses('neutral'), 'text-xs space-y-1 mt-2 opacity-75']">
          <li v-for="(recommendation, i) in recommendations" 
              :key="i" 
              class="flex items-start gap-1">
            <span class="text-gray-400 mt-0.5">•</span>
            <span>{{ recommendation.message }}</span>
          </li>
        </ul>
      </div>
    </div>

    <!-- Watch List Info -->
    <div v-if="isNewAlert" 
         class="p-4 rounded-lg border"
         :class="isBookmarked 
           ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800' 
           : 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800'">
      <div class="flex items-start gap-3">
        <div class="flex-shrink-0 mt-1">
          <svg v-if="!isBookmarked" class="w-5 h-5 text-blue-600 dark:text-blue-400" fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd" />
          </svg>
          <svg v-else class="w-5 h-5 text-green-600 dark:text-green-400" fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
          </svg>
        </div>
        <div>
          <h4 :class="[getTextClasses('neutral'), 'font-medium text-sm']">
            <span v-if="!isBookmarked">📌 Automatic Bookmark</span>
            <span v-else>✅ Already in Watch List</span>
          </h4>
          <p :class="[getTextClasses('neutral'), 'text-xs mt-1 opacity-75']">
            <span v-if="!isBookmarked">
              Creating an alert will automatically add <strong>{{ domain }}</strong> to your watch list.
            </span>
            <span v-else>
              <strong>{{ domain }}</strong> is already in your watch list.
            </span>
          </p>
        </div>
      </div>
    </div>

    <!-- Form -->
    <form @submit.prevent="handleSave" class="space-y-4">
      <div class="space-y-4">
        <!-- Alert Date Selection -->
        <div>
          <label :class="[getTextClasses('neutral'), 'block text-sm font-medium mb-2']" for="alert-date">
            Alert Date
          </label>
          <input 
            id="alert-date"
            v-model="alertDate"
            type="date"
            class="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white">
          <p :class="[getTextClasses('neutral'), 'text-xs mt-1 opacity-75']">
            <span v-if="daysBeforeExpiration === 0">Alert on expiration date</span>
            <span v-else-if="daysBeforeExpiration === 1">Alert 1 day before expiration</span>
            <span v-else>Alert {{ daysBeforeExpiration }} days before expiration</span>
          </p>
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
          Delete Alert
        </BaseButton>
      </div>
      
      <div class="flex gap-2">
        <BaseButton 
          @click="handleClose"
          variant="neutral"
          size="sm">
          Cancel
        </BaseButton>
        <BaseButton 
          @click="handleSave"
          variant="primary"
          size="sm"
          :disabled="!isNotificationSupported || (isNotificationSupported && notificationPermission !== 'granted')">
          {{ isNewAlert ? 'Create Alert' : 'Update Alert' }}
        </BaseButton>
      </div>
    </div>
  </div>
</template>
