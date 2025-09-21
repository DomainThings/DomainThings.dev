<script lang="ts" setup>
import { computed, onMounted, ref, watch } from 'vue';
import { DnsResponseStatus, DnsRecordType, type DnsJsonResponse } from '@/types/dns';
import { fetchDns } from '@/services/dnsService';
import SpinnerIcon from '@/icons/SpinnerIcon.vue';
import BaseAlert from './BaseAlert.vue';
import ArrowDownIcon from '@/icons/ArrowDownIcon.vue';

// Types
interface Props {
  readonly domain: string;
}

interface DnsError {
  readonly title: string;
  readonly text?: string;
}

interface DnsTypeOption {
  readonly value: DnsRecordType;
  readonly title: string;
}

// Props
const props = defineProps<Props>();

// Reactive state
const dnsResponse = ref<DnsJsonResponse | null>(null);
const dnsError = ref<DnsError | null>(null);
const isDnsLoading = ref(false);
const isResponseShown = ref(false);
const dnsType = ref<DnsRecordType>(DnsRecordType.A);

// Computed properties
const dnsTypes = computed((): readonly DnsTypeOption[] => {
  return Object.values(DnsRecordType)
    .filter((value): value is DnsRecordType => typeof value === 'number')
    .map((value): DnsTypeOption => ({
      value,
      title: DnsRecordType[value]
    }))
    .sort((a, b) => a.title.localeCompare(b.title));
});

const hasAnswers = computed((): boolean => {
  return Boolean(dnsResponse.value?.Answer?.length);
});

const statusBadgeClass = computed((): string => {
  if (!dnsResponse.value) return '';
  
  const status = dnsResponse.value.Status;
  if (status === DnsResponseStatus.NOERROR) {
    return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
  } else if (status === DnsResponseStatus.NXDOMAIN) {
    return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300';
  }
  return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300';
});

// Lifecycle hooks
onMounted(async () => {
  await fetchDnsData();
});

// Watchers
watch(dnsType, async () => {
  await fetchDnsData();
});

// Business logic
async function fetchDnsData(): Promise<void> {
  dnsError.value = null;
  isDnsLoading.value = true;
  
  try {
    dnsResponse.value = await fetchDns(props.domain, dnsType.value);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    dnsError.value = {
      title: 'DNS request failed',
      text: errorMessage
    };
    dnsResponse.value = null;
  } finally {
    isDnsLoading.value = false;
  }
}

const toggleResponseVisibility = (): void => {
  isResponseShown.value = !isResponseShown.value;
};

// Expose for testing
defineExpose({
  fetchDnsData,
  toggleResponseVisibility
});
</script>

<template>
  <div class="flex flex-col gap-4">
    <!-- Loading State -->
    <div v-if="isDnsLoading" class="flex items-center justify-center py-8">
      <SpinnerIcon class="w-12 h-12 fill-neutral-800 text-neutral-500" />
    </div>

    <!-- Error State -->
    <BaseAlert v-if="dnsError" type="error">
      <template #title>{{ dnsError.title }}</template>
      <template v-if="dnsError.text">{{ dnsError.text }}</template>
    </BaseAlert>

    <!-- DNS Response Content -->
    <template v-if="dnsResponse && !isDnsLoading">
      <!-- Status Badge -->
      <div class="flex items-center gap-2">
        <span class="text-sm font-medium text-neutral-700 dark:text-neutral-300">Status:</span>
        <span 
          class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium"
          :class="statusBadgeClass"
        >
          {{ DnsResponseStatus[dnsResponse.Status] }}
        </span>
      </div>

      <!-- DNS Record Type Selector -->
      <div class="relative">
        <label for="dns-type-select" class="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
          DNS Record Type
        </label>
        <div class="grid">
          <select 
            id="dns-type-select"
            v-model="dnsType"
            class="block w-full p-2.5 pr-8 appearance-none row-start-1 col-start-1 text-sm rounded-lg border bg-neutral-100 border-neutral-300 text-neutral-900 dark:bg-neutral-800 dark:border-neutral-700 dark:text-neutral-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none cursor-pointer"
          >
            <option v-for="type in dnsTypes" :key="type.value" :value="type.value">
              {{ type.title }}
            </option>
          </select>
          <ArrowDownIcon 
            class="w-5 h-5 row-start-1 col-start-1 self-center justify-self-end mr-2 pointer-events-none text-neutral-500" 
            aria-hidden="true"
          />
        </div>
      </div>

      <!-- DNS Records Table -->
      <div v-if="hasAnswers" class="overflow-x-auto">
        <table class="min-w-full divide-y divide-neutral-200 dark:divide-neutral-700">
          <thead class="bg-neutral-50 dark:bg-neutral-800">
            <tr>
              <th scope="col" class="px-4 py-3 text-left text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
                Name
              </th>
              <th scope="col" class="px-4 py-3 text-left text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
                Type
              </th>
              <th scope="col" class="px-4 py-3 text-left text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
                TTL
              </th>
              <th scope="col" class="px-4 py-3 text-left text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
                Data
              </th>
            </tr>
          </thead>
          <tbody class="bg-white dark:bg-neutral-900 divide-y divide-neutral-200 dark:divide-neutral-700">
            <tr v-for="(record, index) in dnsResponse.Answer" :key="index" class="hover:bg-neutral-50 dark:hover:bg-neutral-800">
              <td class="px-4 py-3 text-sm text-neutral-900 dark:text-neutral-100 break-all">
                {{ record.name }}
              </td>
              <td class="px-4 py-3 text-sm text-neutral-900 dark:text-neutral-100">
                {{ DnsRecordType[record.type] }}
              </td>
              <td class="px-4 py-3 text-sm text-neutral-900 dark:text-neutral-100">
                {{ record.TTL }}
              </td>
              <td class="px-4 py-3 text-sm text-neutral-900 dark:text-neutral-100 break-all">
                {{ record.data }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- No Records Message -->
      <div v-else class="text-center py-6">
        <p class="text-neutral-500 dark:text-neutral-400">No DNS records found for this query.</p>
      </div>

      <!-- Raw Response Toggle -->
      <div class="border-t border-neutral-200 dark:border-neutral-700 pt-4">
        <button 
          @click="toggleResponseVisibility"
          class="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 underline text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 rounded"
        >
          {{ isResponseShown ? 'Hide Raw Response' : 'Show Raw Response' }}
        </button>
        
        <div v-if="isResponseShown" class="mt-3">
          <pre 
            class="max-h-96 p-4 bg-neutral-100 dark:bg-neutral-800 overflow-auto rounded-lg text-xs font-mono text-neutral-900 dark:text-neutral-100 border border-neutral-200 dark:border-neutral-700"
          >{{ JSON.stringify(dnsResponse, null, 2) }}</pre>
        </div>
      </div>
    </template>
  </div>
</template>