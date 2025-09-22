<script lang="ts" setup>
import { computed, onMounted, ref } from 'vue';
import { fetchRdap } from '@/services/rdapService';
import type { RdapEvent, RdapResponse } from '@/types/rdap';
import SpinnerIcon from '@/icons/SpinnerIcon.vue';
import BaseAlert from './BaseAlert.vue';
import { useTheme } from '@/composables/useTheme';

const { getIconClasses, getBadgeClasses } = useTheme();

// Types
interface Props {
  readonly domain: string;
}

interface RdapError {
  readonly title: string;
  readonly text?: string;
}

// Props
const props = defineProps<Props>();

// Reactive state
const rdapResponse = ref<RdapResponse | null>(null);
const rdapError = ref<RdapError | null>(null);
const isRdapLoading = ref(false);
const isResponseShown = ref(false);

// Computed properties
const hasStatus = computed((): boolean => {
  return Boolean(rdapResponse.value?.status?.length);
});

const hasEntities = computed((): boolean => {
  return Boolean(rdapResponse.value?.entities?.length);
});

const hasEvents = computed((): boolean => {
  return Boolean(rdapResponse.value?.events?.length);
});

// Helper function to extract entity name from vCard
const getEntityName = (entity: any): string => {
  try {
    return entity.vcardArray?.[1]?.[1]?.[3] || 'Unknown';
  } catch {
    return 'Unknown';
  }
};

// Business logic
const fetchRdapData = async (): Promise<void> => {
  rdapError.value = null;
  isRdapLoading.value = true;
  
  try {
    const result = await fetchRdap(props.domain);
    
    if (result.success && result.data) {
      const response = result.data;
      
      // Sort events by date (newest first) if they exist
      if (response.events) {
        const sortedEvents = [...response.events].sort((a: RdapEvent, b: RdapEvent) => {
          return new Date(b.eventDate).getTime() - new Date(a.eventDate).getTime();
        });
        
        // Create a new response object with sorted events
        rdapResponse.value = {
          ...response,
          events: sortedEvents
        };
      } else {
        rdapResponse.value = response;
      }
    } else {
      rdapError.value = {
        title: 'RDAP request failed',
        text: result.error || 'Unknown RDAP error'
      };
      rdapResponse.value = null;
    }
  } catch (error: unknown) {
    console.error('RDAP fetch error:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    rdapError.value = {
      title: 'RDAP request failed',
      text: errorMessage
    };
    rdapResponse.value = null;
  } finally {
    isRdapLoading.value = false;
  }
};

const toggleResponseVisibility = (): void => {
  isResponseShown.value = !isResponseShown.value;
};

// Lifecycle hooks
onMounted(async () => {
  await fetchRdapData();
});

// Expose for testing
defineExpose({
  fetchRdapData,
  toggleResponseVisibility
});
</script>

<template>
  <div class="flex flex-col gap-4">
    <!-- Loading State -->
    <div v-if="isRdapLoading" class="flex items-center justify-center py-8">
            <SpinnerIcon :class="[getIconClasses('neutral'), 'w-12 h-12']" />
    </div>

    <!-- Error State -->
    <BaseAlert v-if="rdapError" type="error">
      <template #title>{{ rdapError.title }}</template>
      <!-- <template v-if="rdapError.text">{{ rdapError.text }}</template> -->
    </BaseAlert>

    <!-- RDAP Response Content -->
    <template v-if="rdapResponse && !isRdapLoading">
      <!-- Status Section -->
      <div v-if="hasStatus" class="space-y-2">
        <h3 class="text-sm font-medium text-neutral-700 dark:text-neutral-300">Status</h3>
        <div class="flex flex-wrap gap-2">
          <span 
            v-for="(status, index) in rdapResponse.status" 
            :key="index"
            :class="getBadgeClasses('info')"
          >
            {{ status }}
          </span>
        </div>
      </div>

      <!-- Entities Section -->
      <div v-if="hasEntities" class="space-y-3">
        <h3 class="text-sm font-medium text-neutral-700 dark:text-neutral-300">Entities</h3>
        <div class="space-y-3">
          <div 
            v-for="(entity, index) in rdapResponse.entities" 
            :key="index"
            class="p-4 bg-neutral-50 dark:bg-neutral-800 rounded-lg border border-neutral-200 dark:border-neutral-700"
          >
            <div class="flex justify-between items-start gap-3">
              <div class="flex flex-wrap gap-1">
                <span 
                  v-for="(role, roleIndex) in entity.roles" 
                  :key="roleIndex"
                  :class="getBadgeClasses('neutral')"
                >
                  {{ role }}
                </span>
              </div>
              <div class="text-right">
                <div class="font-medium text-neutral-900 dark:text-neutral-100">
                  {{ getEntityName(entity) }}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Events Section -->
      <div v-if="hasEvents" class="space-y-3">
        <h3 class="text-sm font-medium text-neutral-700 dark:text-neutral-300">Events</h3>
        <div class="space-y-2">
          <div 
            v-for="(event, index) in rdapResponse.events" 
            :key="index"
            class="p-3 bg-neutral-50 dark:bg-neutral-800 rounded-lg border border-neutral-200 dark:border-neutral-700"
          >
            <div class="flex justify-between items-center gap-3">
              <span :class="getBadgeClasses('success')">
                {{ event.eventAction }}
              </span>
              <div class="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                {{ new Date(event.eventDate).toLocaleString() }}
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- No Data Message -->
      <div v-if="!hasStatus && !hasEntities && !hasEvents" class="text-center py-6">
        <p class="text-neutral-500 dark:text-neutral-400">No RDAP data available for this domain.</p>
      </div>

      <!-- Raw Response Toggle -->
      <div class="border-t border-neutral-200 dark:border-neutral-700 pt-4">
        <button 
          @click="toggleResponseVisibility"
          :class="[getIconClasses('primary'), 'hover:underline text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 rounded']"
        >
          {{ isResponseShown ? 'Hide Raw Response' : 'Show Raw Response' }}
        </button>
        
        <div v-if="isResponseShown" class="mt-3">
          <pre 
            class="max-h-96 p-4 bg-neutral-100 dark:bg-neutral-800 overflow-auto rounded-lg text-xs font-mono text-neutral-900 dark:text-neutral-100 border border-neutral-200 dark:border-neutral-700"
          >{{ JSON.stringify(rdapResponse, null, 2) }}</pre>
        </div>
      </div>
    </template>
  </div>
</template>