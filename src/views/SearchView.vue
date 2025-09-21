<script lang="ts" setup>
import { computed, onMounted, ref, useTemplateRef, watch } from 'vue';
import DefaultLayout from '@/layouts/DefaultLayout.vue';
import DomainItem from '@/components/DomainItem.vue';
import router from '@/router';
import { useRoute } from 'vue-router';
import { isDomainValid } from '@/utils/domainUtil';
import SearchIcon from '@/icons/SearchIcon.vue';
import CloseIcon from '@/icons/CloseIcon.vue';
import { useSearchStore } from '@/stores/searchStore';
import { getTlds } from '@/services/rdapService';
import { getDb } from '@/services/dbService';

const route = useRoute();
const searchStore = useSearchStore();

const isFormValid = ref(false);
const isSubmitted = ref(false);
const q = ref(route.query.q?.toString() ?? searchStore.q ?? '');

const tlds = ref<string[]>([]);
const bookmarkedTlds = ref<{ tld: string }[]>([]);
const showAllTlds = ref(false);

const domains = ref<string[]>([]);
const nbDomainsByCall = 20;

onMounted(async () => {
  tlds.value = await getTlds();
  const db = await getDb();
  bookmarkedTlds.value = await db.getAll('tlds');

  window.onscroll = () => {
    let bottomOfWindow = Math.max(window.pageYOffset, document.documentElement.scrollTop, document.body.scrollTop) + window.innerHeight + 32 >= document.documentElement.offsetHeight
    if (bottomOfWindow && showAllTlds.value) {
      loadMoreItems();
    }
  }

  isFormValid.value = !!q.value && isDomainValid(q.value);
  if (isFormValid.value) {
    submit();
  }
})

watch(() => q.value, () => {
  isSubmitted.value = false;
  isFormValid.value = isDomainValid(q.value);
  searchStore.q = q.value;
  router.push({ query: { q: q.value } });
  if (isFormValid.value) {
    submit();
  }
})

watch(() => showAllTlds.value, () => {
  if (isFormValid.value) {
    submit();
  }
})

watch(() => route.query.q, () => {
  if (!route.query.q) {
    q.value = '';
    isSubmitted.value = false;
  }
})

const submit = () => {
  if (isFormValid.value) {
    const [_, tld] = q.value.split('.');
    if (tld) {
      domains.value = [q.value]
    }
    else if (showAllTlds.value) {
      // domains.value = tlds.value.map((tld) => `${q.value}.${tld}`).slice(0, nbDomainsByCall)
      loadMoreItems()
    }
    else {
      // show bookmarked tlds 
      bookmarkedTlds.value = bookmarkedTlds.value.length > 0 ? bookmarkedTlds.value : [{ tld: 'com' }];
      domains.value = bookmarkedTlds.value.map((tld) => `${q.value}.${tld.tld}`)
    }
    isSubmitted.value = true;
  }
}

const loadMoreItems = () => {
  const offset: number = domains.value.length - bookmarkedTlds.value.length;
  const addedDomains: string[] = tlds.value.map((tld) => `${q.value}.${tld}`).slice(offset, offset + nbDomainsByCall);
  addedDomains.forEach((addedDomain) => domains.value.push(addedDomain));
}

const clearSearch = (): void => {
  q.value = '';
}

</script>

<template>
  <DefaultLayout>
    <div class="flex flex-col justify-center gap-4">
      <form action="/" method="get" role="search" @submit.prevent="submit" autocomplete="off"
        class="flex flex-col gap-3">
        <div class="relative">
          <div class="absolute inset-y-0 start-0 flex items-center ps-3.5 pointer-events-none">
            <SearchIcon class="w-5 h-5 text-neutral-900 dark:text-neutral-100"></SearchIcon>
          </div>
          <input type="text" name="q" v-model="q" placeholder="Search domain name"
            class="ps-10 pe-12 py-3 w-full rounded-3xl text-neutral-900 bg-neutral-200 text-base placeholder-neutral-500 dark:bg-neutral-800 dark:placeholder-neutral-300 dark:text-neutral-100 !outline-none">
          <button 
            v-if="q.trim()"
            @click="clearSearch"
            type="button"
            class="absolute inset-y-0 end-0 flex items-center pe-3.5 text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 transition-colors"
            :aria-label="'Clear search'">
            <CloseIcon class="w-5 h-5" />
          </button>
        </div>
        <label class="inline-flex items-center cursor-pointer">
          <input type="checkbox" v-model="showAllTlds" class="sr-only peer">
          <div
            class="relative w-8 h-4 bg-neutral-200 rounded-full dark:bg-neutral-700 after:content-[''] after:absolute after:top-[0px] after:start-[0px] after:bg-neutral-100 after:border-neutral-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-neutral-600 peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-neutral-100 peer-checked:bg-neutral-600 dark:peer-checked:bg-neutral-600">
          </div>
          <span class="ms-3 text-sm font-medium text-gray-900 dark:text-gray-300">Show all extensions</span>
        </label>
      </form>
      <hr class="w-full h-px bg-neutral-200 border-0 dark:bg-neutral-700">
      <div v-if="isFormValid && isSubmitted">
        <DomainItem :domainName="domain" v-for="domain, index in domains" :key="index"></DomainItem>
      </div>
    </div>
  </DefaultLayout>
</template>
