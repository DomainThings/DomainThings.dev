<script lang="ts" setup>
import { computed } from 'vue';
import BaseButton from './BaseButton.vue';
import BaseBadge from './BaseBadge.vue';
import { useTheme } from '@/composables/useTheme';
import * as AlertService from '@/services/alertService';
import { formatCompactDate, getDaysUntil } from '@/utils/rdapUtil';
import BellIcon from '@/icons/BellIcon.vue';
import BellOutlineIcon from '@/icons/BellOutlineIcon.vue';

interface Props {
  alerts: readonly AlertService.AlertSettings[];
  domain: string;
  expirationDate: Date;
}

interface Emits {
  addAlert: [];
  editAlert: [alert: AlertService.AlertSettings];
  deleteAlert: [alertId: string];
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

const { getBadgeClasses, getButtonClasses, getTextClasses, getIconClasses } = useTheme();

// Computed
const sortedAlerts = computed(() => {
  return [...props.alerts].sort((a, b) => a.alertDate.getTime() - b.alertDate.getTime());
});

const formattedExpirationDate = computed(() => {
  return props.expirationDate.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
});

// Methods
const formatAlertDate = (date: Date): string => {
  return formatCompactDate(date);
};

const getDaysUntilAlert = (alertDate: Date): number => {
  return getDaysUntil(alertDate);
};

const getAlertStatus = (alert: AlertService.AlertSettings) => {
  const daysUntil = getDaysUntilAlert(alert.alertDate);
  
  if (!alert.enabled) {
    return { text: 'Disabled', variant: 'neutral' as const };
  }
  
  if (daysUntil < 0) {
    return { text: 'Past due', variant: 'error' as const };
  } else if (daysUntil === 0) {
    return { text: 'Today', variant: 'warning' as const };
  } else if (daysUntil <= 7) {
    return { text: `In ${daysUntil} day${daysUntil > 1 ? 's' : ''}`, variant: 'warning' as const };
  } else {
    return { text: `In ${daysUntil} days`, variant: 'success' as const };
  }
};

const handleAddAlert = () => {
  emit('addAlert');
};

const handleEditAlert = (alert: AlertService.AlertSettings) => {
  emit('editAlert', alert);
};

const handleDeleteAlert = (alertId: string) => {
  emit('deleteAlert', alertId);
};
</script>

<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="space-y-2">
      <h3 :class="[getTextClasses('neutral'), 'text-lg font-semibold']">
        Expiration Alerts for {{ domain }}
      </h3>
      <div :class="[getTextClasses('neutral'), 'text-sm']">
        <p>Domain expires on: <strong>{{ formattedExpirationDate }}</strong></p>
      </div>
    </div>

    <!-- Alerts List -->
    <div v-if="alerts.length > 0" class="space-y-3">
      <div 
        v-for="alert in sortedAlerts" 
        :key="alert.id"
        class="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
        
        <!-- Alert Info -->
        <div class="flex items-center gap-3">
          <div class="flex-shrink-0">
            <BellIcon v-if="alert.enabled" :class="[getIconClasses('primary'), 'w-5 h-5']" />
            <BellOutlineIcon v-else :class="[getIconClasses('neutral'), 'w-5 h-5 opacity-50']" />
          </div>
          
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2 mb-1">
              <span :class="[getTextClasses('neutral'), 'font-medium']">
                {{ formatAlertDate(alert.alertDate) }}
              </span>
              <BaseBadge :variant="getAlertStatus(alert).variant" size="sm">
                {{ getAlertStatus(alert).text }}
              </BaseBadge>
            </div>
            
            <div :class="[getTextClasses('neutral'), 'text-sm opacity-75']">
              Frequency: {{ alert.reminderFrequency }}
              <span v-if="alert.lastNotified" class="ml-2">
                • Last notified: {{ formatAlertDate(alert.lastNotified) }}
              </span>
            </div>
          </div>
        </div>

        <!-- Actions -->
        <div class="flex items-center gap-2">
          <BaseButton 
            @click="handleEditAlert(alert)"
            variant="neutral"
            size="sm">
            Edit
          </BaseButton>
          <BaseButton 
            @click="handleDeleteAlert(alert.id)"
            variant="error"
            size="sm">
            Delete
          </BaseButton>
        </div>
      </div>
    </div>

    <!-- Empty State -->
    <div v-else class="text-center py-8">
      <BellOutlineIcon :class="[getIconClasses('neutral'), 'w-12 h-12 mx-auto mb-4 opacity-50']" />
      <p :class="[getTextClasses('neutral'), 'text-sm opacity-75 mb-4']">
        No alerts configured for this domain
      </p>
    </div>

    <!-- Add Alert Button -->
    <div class="flex justify-center pt-4 border-t border-gray-200 dark:border-gray-700">
      <BaseButton 
        @click="handleAddAlert"
        variant="primary"
        size="sm">
        Add New Alert
      </BaseButton>
    </div>
  </div>
</template>