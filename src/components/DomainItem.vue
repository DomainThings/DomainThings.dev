<script lang="ts" setup>
import { computed, onMounted, ref, watch } from 'vue';
import { DomainAvailabilityStatus, type Domain } from '@/types';
import DnsComponent from '@/components/DnsComponent.vue';
import RdapComponent from '@/components/RdapComponent.vue';
import { getDomainAvailabilityStatus } from '@/services/dnsService';
import StarIcon from '@/icons/StarIcon.vue';
import AlertCircleIcon from '@/icons/AlertCircleIcon.vue';
import CheckIcon from '@/icons/CheckIcon.vue';
import SpinnerIcon from '@/icons/SpinnerIcon.vue';
import BaseModal from './BaseModal.vue';
import { getDb } from '@/services/dbService';

const props = defineProps({
  domain: {
    type: String,
    required: true
  }
});

const emit = defineEmits(['bookmark']);

const domainData = computed<Domain>(() => {
  const name = props.domain;
  const [label = '', tld = ''] = name.split('.');
  const domain: Domain = { name, label, tld }
  return domain;
});

const isBookmarked = ref(false);
const availabilityStatus = ref<DomainAvailabilityStatus>(2); // UNKNOWN at start up

onMounted(async () => {
  availabilityStatus.value = await getDomainAvailabilityStatus(props.domain);
  isBookmarked.value = await isAlreadyBookmarked();
})

watch(() => props.domain, async () => {
  availabilityStatus.value = await getDomainAvailabilityStatus(props.domain);
  isBookmarked.value = await isAlreadyBookmarked();
})

const isAlreadyBookmarked = async (): Promise<boolean> => {
  const db = await getDb();
  return await db.get('domains', props.domain) ? true : false;
}

const bookmark = async () => {
  const db = await getDb();
  if (isBookmarked.value) {
    await db.delete('domains', props.domain);
    emit('bookmark');
    isBookmarked.value = !isBookmarked.value;
    return;
  }
  await db.add('domains', { ...domainData.value });
  emit('bookmark');
  isBookmarked.value = !isBookmarked.value;
}

// dns & rdap
const rdapDialog = ref(false)
const dnsDialog = ref(false)


</script>

<template>

  <div v-if="domain" class="w-full py-2 text-h5 flex flex-col sm:flex-row justify-between sm:items-center gap-2">

    <div class="flex items-center gap-2">
      <button @click="bookmark()" type="button"
        class="text-neutral-500 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded-lg"
        :class="{ '!text-yellow-500 !dark:text-yellow-500': isBookmarked }">
        <StarIcon class="w-5 h-5"></StarIcon>
      </button>
      <div class="text-xl font-medium text-neutral-900 dark:text-neutral-100">{{ domain }}</div>
    </div>

    <div class="flex justify-between items-center gap-2 flex-1">
      <div class="flex items-center gap-1">
        <button @click="dnsDialog = true" type="button"
          class="rounded-lg text-xs px-1 py-1 text-neutral-900 bg-neutral-100 border border-neutral-300 focus:outline-none hover:bg-neutral-100 focus:ring-4 focus:ring-gray-100 dark:bg-neutral-800 dark:text-neutral-100 dark:border-neutral-600 dark:hover:bg-neutral-700 dark:hover:border-neutral-600 dark:focus:ring-neutral-700">
          DNS</button>
        <button @click="rdapDialog = true" type="button"
          class="rounded-lg text-xs px-1 py-1 text-neutral-900 bg-neutral-100 border border-neutral-300 focus:outline-none hover:bg-neutral-100 focus:ring-4 focus:ring-gray-100 dark:bg-neutral-800 dark:text-neutral-100 dark:border-neutral-600 dark:hover:bg-neutral-700 dark:hover:border-neutral-600 dark:focus:ring-neutral-700">
          RDAP</button>
      </div>

      <span v-if="availabilityStatus === 0">
        <AlertCircleIcon class="w-5 h-5 text-red-600 dark:text-red-400"></AlertCircleIcon>
      </span>
      <span v-if="availabilityStatus === 1">
        <CheckIcon class="w-5 h-5 text-green-600 dark:text-green-400"></CheckIcon>
      </span>
      <span v-if="availabilityStatus === 2">
        <SpinnerIcon class="w-5 h-5 fill-orange-600 text-gray-200 dark:fill-orange-400 dark:text-gray-700"></SpinnerIcon>
      </span>

      <!-- <span v-if="availabilityStatus === 0"
        class="flex items-center gap-1 text-xs px-2 py-1 rounded bg-red-100 text-red-800 whitespace-nowrap">
        <AlertCircleIcon class="w-5 h-5"></AlertCircleIcon>
        Not available
      </span>
      <span v-if="availabilityStatus === 1"
        class="flex items-center gap-1 text-xs px-2 py-1 rounded bg-green-100 text-green-800 whitespace-nowrap">
        <CheckIcon class="w-5 h-5"></CheckIcon>
        Available
      </span>
      <span v-if="availabilityStatus === 2"
        class="flex items-center gap-1 text-xs px-2 py-1 rounded bg-orange-100 text-orange-800 whitespace-nowrap">
        <SpinnerIcon class="w-5 h-5 fill-orange-800 text-gray-200"></SpinnerIcon>
        Unknown availability
      </span> -->
    </div>

    

    <BaseModal v-model="dnsDialog">
      <template v-slot:header>DNS {{ domain }}</template>
      <template v-slot:body><DnsComponent :domain="domain"></DnsComponent></template>
    </BaseModal>

    <BaseModal v-model="rdapDialog">
      <template v-slot:header>RDAP {{ domain }}</template>
      <template v-slot:body><RdapComponent :domain="domain"></RdapComponent></template>
    </BaseModal>
  </div>
  

</template>
