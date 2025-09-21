<script lang="ts" setup>
import { computed, onMounted, ref, watch, onUnmounted } from 'vue';
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

// Types
interface BookmarkedTld {
  readonly tld: string;
}

// Constants
const DOMAINS_PER_LOAD = 20;
const SCROLL_THRESHOLD = 32;

// Router and store
const route = useRoute();
const searchStore = useSearchStore();

// Reactive state
const isFormValid = ref(false);
const isSubmitted = ref(false);
const q = ref(route.query.q?.toString() ?? searchStore.q ?? '');
const isLoading = ref(false);

const tlds = ref<readonly string[]>([]);
const bookmarkedTlds = ref<readonly BookmarkedTld[]>([]);
const showAllTlds = ref(false);
const domains = ref<string[]>([]);

// Scroll handler for infinite loading
let scrollHandler: (() => void) | null = null;

// Computed properties
const hasValidInput = computed(() => !!q.value && isDomainValid(q.value));
const isSearchingSpecificDomain = computed(() => q.value.includes('.'));
const searchLabel = computed(() => q.value.split('.')[0]);
const hasResults = computed(() => domains.value.length > 0);

// Lifecycle hooks
onMounted(async () => {
  await initializeData();
  setupInfiniteScroll();
  
  // Auto-submit if valid query from URL or store
  isFormValid.value = hasValidInput.value;
  if (isFormValid.value) {
    submit();
  }
});

onUnmounted(() => {
  cleanupInfiniteScroll();
});

// Business logic functions
const initializeData = async (): Promise<void> => {
  try {
    isLoading.value = true;
    const [fetchedTlds, db] = await Promise.all([
      getTlds(),
      getDb()
    ]);
    
    tlds.value = Object.freeze(fetchedTlds);
    const bookmarks = await db.getAll('tlds');
    bookmarkedTlds.value = Object.freeze(bookmarks);
  } catch (error) {
    console.error('Error initializing search data:', error);
    tlds.value = [];
    bookmarkedTlds.value = [];
  } finally {
    isLoading.value = false;
  }
};

const setupInfiniteScroll = (): void => {
  scrollHandler = () => {
    const isAtBottom = Math.max(
      window.pageYOffset, 
      document.documentElement.scrollTop, 
      document.body.scrollTop
    ) + window.innerHeight + SCROLL_THRESHOLD >= document.documentElement.offsetHeight;
    
    if (isAtBottom && showAllTlds.value && isFormValid.value) {
      loadMoreItems();
    }
  };
  
  window.addEventListener('scroll', scrollHandler, { passive: true });
};

const cleanupInfiniteScroll = (): void => {
  if (scrollHandler) {
    window.removeEventListener('scroll', scrollHandler);
    scrollHandler = null;
  }
};

const submit = (): void => {
  if (!hasValidInput.value) return;
  
  // Update validation state
  isFormValid.value = true;
  
  if (isSearchingSpecificDomain.value) {
    // User searched for specific domain (e.g., "example.com")
    domains.value = [q.value];
  } else if (showAllTlds.value) {
    // Show all TLDs - start with bookmarked ones, then load more
    const tldsToUse = bookmarkedTlds.value.length > 0 
      ? bookmarkedTlds.value 
      : [{ tld: 'com' }]; // Fallback to .com if no bookmarks
    
    // Start with bookmarked TLDs
    domains.value = tldsToUse.map((bookmark) => `${searchLabel.value}.${bookmark.tld}`);
    
    // Then load more non-bookmarked TLDs
    loadMoreItems();
  } else {
    // Show only bookmarked TLDs (default behavior)
    const tldsToUse = bookmarkedTlds.value.length > 0 
      ? bookmarkedTlds.value 
      : [{ tld: 'com' }]; // Fallback to .com if no bookmarks
    
    domains.value = tldsToUse.map((bookmark) => `${searchLabel.value}.${bookmark.tld}`);
  }
  
  isSubmitted.value = true;
};

const loadMoreItems = (): void => {
  if (!hasValidInput.value || isSearchingSpecificDomain.value || !showAllTlds.value) return;
  
  // Calculate offset: current domains minus the bookmarked ones we already added
  const currentBookmarkedCount = bookmarkedTlds.value.length > 0 ? bookmarkedTlds.value.length : 1; // +1 for fallback .com
  const offset = domains.value.length - currentBookmarkedCount;
  
  const newDomains = tlds.value
    .map((tld) => `${searchLabel.value}.${tld}`)
    .slice(offset, offset + DOMAINS_PER_LOAD);
  
  domains.value.push(...newDomains);
};

const clearSearch = (): void => {
  q.value = '';
};

// Watchers for reactive behavior (preserving UX)
watch(() => q.value, () => {
  isSubmitted.value = false;
  isFormValid.value = hasValidInput.value;
  searchStore.q = q.value;
  
  // Update URL with current query
  router.push({ query: { q: q.value } });
  
  // Auto-submit if valid
  if (isFormValid.value) {
    submit();
  }
});

watch(() => showAllTlds.value, () => {
  // Re-submit when toggle changes (preserves UX behavior)
  if (isFormValid.value) {
    submit();
  }
});

watch(() => route.query.q, () => {
  // Handle back/forward navigation and direct URL access
  if (!route.query.q) {
    q.value = '';
    isSubmitted.value = false;
  }
});

</script>

<template>
  <DefaultLayout>
    <div class="flex flex-col justify-center gap-4">
      <!-- Search Form -->
      <form action="/" method="get" role="search" @submit.prevent="submit" autocomplete="off"
        class="flex flex-col gap-3">
        
        <!-- Search Input -->
        <div class="relative">
          <div class="absolute inset-y-0 start-0 flex items-center ps-3.5 pointer-events-none">
            <SearchIcon class="w-5 h-5 text-neutral-900 dark:text-neutral-100"></SearchIcon>
          </div>
          <input 
            type="text" 
            name="q" 
            v-model="q" 
            placeholder="Search domain name"
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
        
        <!-- Toggle for All Extensions -->
        <label class="inline-flex items-center cursor-pointer">
          <input type="checkbox" v-model="showAllTlds" class="sr-only peer">
          <div class="relative w-8 h-4 bg-neutral-200 rounded-full dark:bg-neutral-700 after:content-[''] after:absolute after:top-[0px] after:start-[0px] after:bg-neutral-100 after:border-neutral-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-neutral-600 peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-neutral-100 peer-checked:bg-neutral-600 dark:peer-checked:bg-neutral-600">
          </div>
          <span class="ms-3 text-sm font-medium text-gray-900 dark:text-gray-300">Show all extensions</span>
        </label>
      </form>
      
      <hr class="w-full h-px bg-neutral-200 border-0 dark:bg-neutral-700">
      
      <!-- Results -->
      <div v-if="isFormValid && isSubmitted && hasResults">
        <DomainItem 
          v-for="(domain, index) in domains" 
          :key="`${domain}-${index}`"
          :domainName="domain" 
        />
      </div>
      
      <!-- Empty State -->
      <div v-else-if="isFormValid && isSubmitted && !hasResults" class="flex flex-col items-center justify-center py-12 text-center">
        <div class="text-neutral-500 dark:text-neutral-400">
          <SearchIcon class="w-12 h-12 mx-auto mb-3 opacity-50"></SearchIcon>
          <h3 class="text-lg font-medium mb-1">No domains to show</h3>
          <p class="text-sm">Try adjusting your search criteria.</p>
        </div>
      </div>
    </div>
  </DefaultLayout>
</template>
