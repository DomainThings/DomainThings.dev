<script lang="ts" setup>
import { computed, onMounted, ref, watch, nextTick, onUnmounted } from 'vue';
import { DomainAvailabilityStatus, Domain } from '@/types';
import DnsComponent from '@/components/DnsComponent.vue';
import RdapComponent from '@/components/RdapComponent.vue';
import { getDomainAvailabilityStatus } from '@/services/dnsService';
import { fetchRdap } from '@/services/rdapService';
import { extractExpirationDate, extractCreationDate, extractRegistrar, formatCompactDate, getDaysUntil, isSoon, createDomainCheckFromRdap, createDomainCheckFromDns } from '@/utils/rdapUtil';
import StarIcon from '@/icons/StarIcon.vue';
import AlertCircleIcon from '@/icons/AlertCircleIcon.vue';
import CheckIcon from '@/icons/CheckIcon.vue';
import SpinnerIcon from '@/icons/SpinnerIcon.vue';
import BaseModal from './BaseModal.vue';
import AlertForm from './AlertForm.vue';
import { getDb } from '@/services/dbService';
import * as AlertService from '@/services/alertService';
import OpenIcon from '@/icons/OpenIcon.vue';
import { useTheme } from '@/composables/useTheme';

// Constants
const CLOUDFLARE_REGISTER_URL = 'https://domains.cloudflare.com/?domain=';
const DEBOUNCE_DELAY = 300;

// Props & Emits
interface Props {
  domainName: string;
}

interface Emits {
  bookmark: [];
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

// Computed
const domain = computed<Domain>(() => new Domain(props.domainName));

const registrationUrl = computed(() => `${CLOUDFLARE_REGISTER_URL}${domain.value.name}`);

const isAvailable = computed(() => availabilityStatus.value === DomainAvailabilityStatus.AVAILABLE);
const isNotAvailable = computed(() => availabilityStatus.value === DomainAvailabilityStatus.NOTAVAILABLE);
const isStatusUnknown = computed(() => availabilityStatus.value === DomainAvailabilityStatus.UNKNOWN);

// Computed properties for expiration info
const expirationDate = computed(() => domainInfo.value?.expirationDate);
const hasExpirationDate = computed(() => Boolean(expirationDate.value));
const formattedExpirationDate = computed(() => 
  expirationDate.value ? formatCompactDate(expirationDate.value) : null
);
const daysUntilExpiration = computed(() => 
  expirationDate.value ? getDaysUntil(expirationDate.value) : null
);
const isExpirationSoon = computed(() => 
  expirationDate.value ? isSoon(expirationDate.value) : false
);
const isExpired = computed(() => 
  daysUntilExpiration.value !== null && daysUntilExpiration.value < 0
);

// Reactive state
const isBookmarked = ref(false);
const availabilityStatus = ref<DomainAvailabilityStatus>(DomainAvailabilityStatus.UNKNOWN);
const isLoadingAvailability = ref(false);
const isLoadingBookmark = ref(false);
const isLoadingRdap = ref(false);
const domainInfo = ref<Domain | null>(null);
const existingAlert = ref<AlertService.AlertSettings | null>(null);

// Modal states
const showDnsModal = ref(false);
const showRdapModal = ref(false);
const showAlertModal = ref(false);

// Theme composable
const { getBadgeClasses, getButtonClasses, getIconClasses, getTextClasses } = useTheme();

// Debounce timer
let debounceTimer: ReturnType<typeof setTimeout> | null = null;

// Business logic functions
/**
 * Optimized domain availability check using RDAP-first strategy
 * 
 * Strategy:
 * 1. Try RDAP first - if successful, domain is definitely registered (not available)
 * 2. If RDAP fails, fallback to DNS check for availability status
 * 3. If DNS says "not available" but RDAP failed, retry RDAP for metadata
 * 
 * This approach leverages the fact that:
 * - RDAP success = domain is registered + rich metadata
 * - RDAP failure + DNS NXDOMAIN = domain is available
 * - RDAP failure + DNS has records = domain might be registered but RDAP unavailable
 */
const checkBookmarkStatus = async (): Promise<boolean> => {
  try {
    const db = await getDb();
    const existingDomain = await db.get('domains', props.domainName);
    return Boolean(existingDomain);
  } catch (error) {
    console.error('Error checking bookmark status:', error);
    return false;
  }
};

const checkDomainAvailabilityWithRdap = async (): Promise<void> => {
  if (!props.domainName) return;
  
  isLoadingAvailability.value = true;
  isLoadingRdap.value = true;
  
  try {
    // Try RDAP first as it's more reliable for registered domains
    const rdapResult = await fetchRdap(props.domainName);
    
    if (rdapResult.success && rdapResult.data) {
      // If we get RDAP data, domain is definitely not available (registered)
      const checkResult = createDomainCheckFromRdap(rdapResult.data);
      availabilityStatus.value = checkResult.availability;
      
      domainInfo.value = domain.value.with({
        availability: checkResult.availability,
        expirationDate: checkResult.expirationDate,
        creationDate: checkResult.creationDate,
        registrar: checkResult.registrar,
        lastChecked: new Date()
      });
      
      isLoadingRdap.value = false;
      return;
    }
    
    // RDAP failed or no data - fallback to DNS check
    isLoadingRdap.value = false;
    const dnsAvailability = await getDomainAvailabilityStatus(props.domainName);
    availabilityStatus.value = dnsAvailability;
    
    // If DNS says not available but we have no RDAP data, try RDAP again with timeout
    if (dnsAvailability === DomainAvailabilityStatus.NOTAVAILABLE && !rdapResult.success) {
      // Quick retry for RDAP data (don't block UI too long)
      isLoadingRdap.value = true;
      
      // Set a shorter timeout for this retry
      const retryPromise = fetchRdap(props.domainName);
      const timeoutPromise = new Promise<typeof rdapResult>((resolve) => {
        setTimeout(() => resolve({ success: false, error: 'Retry timeout' }), 3000);
      });
      
      const retryResult = await Promise.race([retryPromise, timeoutPromise]);
      
      if (retryResult.success && retryResult.data) {
        const retryCheckResult = createDomainCheckFromRdap(retryResult.data);
        domainInfo.value = domain.value.with({
          availability: retryCheckResult.availability,
          expirationDate: retryCheckResult.expirationDate,
          creationDate: retryCheckResult.creationDate,
          registrar: retryCheckResult.registrar,
          lastChecked: new Date()
        });
      }
      isLoadingRdap.value = false;
    }
    
  } catch (error) {
    console.error('Error checking domain availability:', error);
    availabilityStatus.value = DomainAvailabilityStatus.UNKNOWN;
    isLoadingRdap.value = false;
  } finally {
    isLoadingAvailability.value = false;
  }
};

const loadDomainData = async (): Promise<void> => {
  await Promise.all([
    checkDomainAvailabilityWithRdap(),
    checkBookmarkStatus().then(status => { isBookmarked.value = status; }),
    loadExistingAlert()
  ]);
};

const toggleBookmark = async (): Promise<void> => {
  if (isLoadingBookmark.value) return;
  
  isLoadingBookmark.value = true;
  try {
    const db = await getDb();
    
    if (isBookmarked.value) {
      await db.delete('domains', props.domainName);
    } else {
      await db.add('domains', { ...domain.value });
    }
    
    isBookmarked.value = !isBookmarked.value;
    emit('bookmark');
  } catch (error) {
    console.error('Error toggling bookmark:', error);
  } finally {
    isLoadingBookmark.value = false;
  }
};

const loadExistingAlert = async (): Promise<void> => {
  try {
    const alert = await AlertService.getAlertByDomain(props.domainName);
    existingAlert.value = alert || null;
  } catch (error) {
    console.error('Error loading existing alert:', error);
  }
};

const handleSaveAlert = async (alertSettings: Omit<AlertService.AlertSettings, 'id' | 'createdAt'>): Promise<void> => {
  try {
    const savedAlert = await AlertService.saveAlert(alertSettings);
    existingAlert.value = savedAlert;
    showAlertModal.value = false;
  } catch (error) {
    console.error('Error saving alert:', error);
  }
};

const handleDeleteAlert = async (): Promise<void> => {
  try {
    await AlertService.removeAlertByDomain(props.domainName);
    existingAlert.value = null;
    showAlertModal.value = false;
  } catch (error) {
    console.error('Error deleting alert:', error);
  }
};

const handleCloseAlertModal = (): void => {
  showAlertModal.value = false;
};

const openAlertModal = (): void => {
  if (expirationDate.value) {
    showAlertModal.value = true;
  }
};

// Debounced domain change handler
const handleDomainChange = (): void => {
  if (debounceTimer) {
    clearTimeout(debounceTimer);
  }
  
  debounceTimer = setTimeout(async () => {
    await loadDomainData();
  }, DEBOUNCE_DELAY);
};

// Lifecycle hooks
onMounted(() => {
  loadDomainData();
});

onUnmounted(() => {
  if (debounceTimer) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }
});

watch(() => props.domainName, () => {
  handleDomainChange();
});


</script>

<template>

  <div v-if="domain" class="w-full py-2 text-h5 flex flex-col sm:flex-row justify-between sm:items-center gap-2">

    <div class="flex items-center gap-2">
      <button @click="toggleBookmark()" type="button"
        :disabled="isLoadingBookmark"
        :class="[isBookmarked ? '!text-yellow-500 !dark:text-yellow-500 disabled:opacity-50 disabled:cursor-not-allowed' : '', getButtonClasses('neutral', true, false)]"
        :aria-label="isBookmarked ? 'Remove from bookmarks' : 'Add to bookmarks'">
        <StarIcon class="w-5 h-5"></StarIcon>
      </button>
      <a target="blank" :href="domain.getFullUrl()"
        :class="['text-xl font-medium flex items-end leading-3.5 gap-1', getTextClasses('neutral')]"
        :aria-label="`Visit ${domain.name}`">
        {{ domain.name }} 
        <OpenIcon class="w-3 h-3"></OpenIcon>
      </a>
    </div>

    <div class="flex justify-between items-center gap-2 flex-1">
      <div class="flex items-center gap-1">
        <button @click="showDnsModal = true" type="button"
          :class="getButtonClasses('neutral', true)"
          :aria-label="`View DNS information for ${domain.name}`">
          DNS
        </button>
        <button @click="showRdapModal = true" type="button"
          :class="getButtonClasses('neutral', true)"
          :aria-label="`View RDAP information for ${domain.name}`">
          RDAP
        </button>
      </div>

      <!-- Availability Status -->
      <div class="flex items-center gap-2">
        <!-- Not Available -->
        <span v-if="isNotAvailable" class="flex items-center gap-2">
          <!-- Expiration Date Display -->
          <button v-if="hasExpirationDate && !isLoadingRdap" 
            @click="openAlertModal"
            :class="[
              getBadgeClasses('neutral'),
              'whitespace-nowrap cursor-pointer hover:opacity-80 transition-opacity',
              {
                [getBadgeClasses('error')]: isExpired,
                [getBadgeClasses('warning')]: isExpirationSoon && !isExpired
              }
            ]"
            :title="`Configure expiration alert for ${domain.name}`">
            exp. {{ formattedExpirationDate }}
            <span v-if="existingAlert" class="ml-1">🔔</span>
          </button>
          <!-- Loading RDAP indicator -->
          <span v-else-if="isLoadingRdap" 
            :class="getBadgeClasses('neutral')">
            <SpinnerIcon :class="[getIconClasses('neutral'), 'w-3 h-3']"></SpinnerIcon>
          </span>
          <AlertCircleIcon :class="[getIconClasses('error'), 'w-5 h-5']" :aria-label="'Domain is not available'"></AlertCircleIcon>
        </span>
        
        <!-- Available -->
        <span v-else-if="isAvailable" class="flex items-center gap-2">
          <a :href="registrationUrl" target="_blank" rel="noopener noreferrer"
            :class="[getBadgeClasses('success'), 'whitespace-nowrap flex items-center gap-1']"
            :aria-label="`Register ${domain.name} on Cloudflare`">
            <span>REGISTER</span>
            <OpenIcon class="w-3 h-3" />
          </a>
          <CheckIcon :class="[getIconClasses('success'), 'w-5 h-5']"></CheckIcon>
        </span>
        
        <!-- Unknown/Loading -->
        <span v-else-if="isStatusUnknown || isLoadingAvailability" :aria-label="'Checking domain availability'">
          <SpinnerIcon :class="[getIconClasses('warning'), 'w-5 h-5']">
          </SpinnerIcon>
        </span>
      </div>
    </div>

    <!-- DNS Modal -->
    <BaseModal v-model="showDnsModal">
      <template v-slot:header>DNS {{ domain.name }}</template>
      <template v-slot:body>
        <DnsComponent :domain="domain.name"></DnsComponent>
      </template>
    </BaseModal>

    <!-- RDAP Modal -->
    <BaseModal v-model="showRdapModal">
      <template v-slot:header>RDAP {{ domain.name }}</template>
      <template v-slot:body>
        <RdapComponent :domain="domain.name"></RdapComponent>
      </template>
    </BaseModal>

    <!-- Alert Modal -->
    <BaseModal v-model="showAlertModal">
      <template v-slot:header>Expiration Alert</template>
      <template v-slot:body>
        <AlertForm 
          v-if="expirationDate"
          :domain="domain.name"
          :expiration-date="expirationDate"
          :existing-alert="existingAlert"
          @save="handleSaveAlert"
          @delete="handleDeleteAlert"
          @close="handleCloseAlertModal">
        </AlertForm>
      </template>
    </BaseModal>
  </div>


</template>
