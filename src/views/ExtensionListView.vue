<script lang="ts" setup>
import { onMounted, ref, computed, watch } from 'vue';
import DefaultLayout from '@/layouts/DefaultLayout.vue';
import { getTlds } from '@/services/rdapService';
import TldItem from '@/components/TldItem.vue';
import SpinnerIcon from '@/icons/SpinnerIcon.vue';
import SearchIcon from '@/icons/SearchIcon.vue';
import CloseIcon from '@/icons/CloseIcon.vue';
import { getDb } from '@/services/dbService';
import { useRoute, useRouter } from 'vue-router';

// Types
interface TldWithBookmark {
  readonly tld: string;
  readonly isBookmarked: boolean;
}

// Router & Route
const route = useRoute();
const router = useRouter();

// Reactive state
const isLoading = ref(true);
const tlds = ref<readonly string[]>([]);
const bookmarkedTlds = ref<Set<string>>(new Set());
const searchQuery = ref(route.query.search?.toString() || '');
const showBookmarkedOnly = ref(route.query.bookmarked === 'true');

// Computed properties for search and filtering
const normalizedSearchQuery = computed(() => {
  const query = searchQuery.value.trim();
  // Remove leading dot if present (e.g., ".com" becomes "com")
  // Also handle multiple dots (e.g., "..com" becomes "com")
  return query.replace(/^\.+/, '');
});

const filteredBySearch = computed(() => {
  if (!normalizedSearchQuery.value) return tlds.value;
  
  const query = normalizedSearchQuery.value.toLowerCase();
  return tlds.value.filter(tld => tld.toLowerCase().includes(query));
});

const sortedTlds = computed((): readonly TldWithBookmark[] => {
  // Map to TldWithBookmark objects
  const tldsWithBookmarks = filteredBySearch.value.map(tld => ({
    tld,
    isBookmarked: bookmarkedTlds.value.has(tld)
  }));
  
  // Filter by bookmark status if needed
  const finalTlds = showBookmarkedOnly.value 
    ? tldsWithBookmarks.filter(item => item.isBookmarked)
    : tldsWithBookmarks;
  
  // Sort: bookmarked first, then alphabetical
  return finalTlds.sort((a, b) => {
    if (a.isBookmarked !== b.isBookmarked) {
      return a.isBookmarked ? -1 : 1;
    }
    return a.tld.localeCompare(b.tld);
  });
});

// Computed properties for UI state
const searchResultsCount = computed(() => sortedTlds.value.length);
const totalTldsCount = computed(() => tlds.value.length);
const bookmarkedCount = computed(() => bookmarkedTlds.value.size);
const hasSearchResults = computed(() => sortedTlds.value.length > 0);
const isSearchActive = computed(() => normalizedSearchQuery.value || showBookmarkedOnly.value);

// Lifecycle hooks
onMounted(async () => {
  await Promise.all([
    fetchTlds(),
    loadBookmarkedTlds()
  ]);
});

// Business logic functions
const fetchTlds = async (): Promise<void> => {
  isLoading.value = true;
  try {
    const result = await getTlds();
    
    if (result.success && result.data) {
      tlds.value = Object.freeze(result.data);
    } else {
      console.error('Error fetching TLDs:', result.error);
      tlds.value = [];
    }
  } catch (error) {
    console.error('Error fetching TLDs:', error);
    tlds.value = [];
  } finally {
    isLoading.value = false;
  }
};

const loadBookmarkedTlds = async (): Promise<void> => {
  try {
    const db = await getDb();
    const allBookmarks = await db.getAll('tlds');
    
    bookmarkedTlds.value = new Set(
      allBookmarks.map(bookmark => bookmark.tld)
    );
  } catch (error) {
    console.error('Error loading bookmarked TLDs:', error);
    bookmarkedTlds.value = new Set();
  }
};

const handleTldBookmarkChange = async (): Promise<void> => {
  await loadBookmarkedTlds();
};

const clearSearch = (): void => {
  searchQuery.value = '';
};

// Watchers for URL synchronization
watch([searchQuery, showBookmarkedOnly], () => {
  const query: Record<string, string> = {};
  
  // Use normalized query for URL (without leading dot)
  if (normalizedSearchQuery.value) {
    query.search = normalizedSearchQuery.value;
  }
  
  if (showBookmarkedOnly.value) {
    query.bookmarked = 'true';
  }
  
  router.push({ query });
}, { 
  // Debounce URL updates to avoid excessive navigation
  flush: 'post' 
});
</script>

<template>
  <DefaultLayout>
    <!-- Search Form -->
    <div class="flex flex-col justify-center gap-4 mb-6">
      <form @submit.prevent autocomplete="off" class="flex flex-col gap-3">
        <div class="relative">
          <div class="absolute inset-y-0 start-0 flex items-center ps-3.5 pointer-events-none">
            <SearchIcon class="w-5 h-5 text-neutral-900 dark:text-neutral-100"></SearchIcon>
          </div>
          <input 
            type="text" 
            v-model="searchQuery" 
            placeholder="Search extensions (e.g., com, .org, dev...)"
            class="ps-10 pe-12 py-3 w-full rounded-3xl text-neutral-900 bg-neutral-200 text-base placeholder-neutral-500 dark:bg-neutral-800 dark:placeholder-neutral-300 dark:text-neutral-100 !outline-none">
          <button 
            v-if="searchQuery.trim()"
            @click="clearSearch"
            type="button"
            class="absolute inset-y-0 end-0 flex items-center pe-3.5 text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 transition-colors"
            :aria-label="'Clear search'">
            <CloseIcon class="w-5 h-5" />
          </button>
        </div>
        
        <!-- Filter Options -->
        <div class="flex items-center gap-4">
          <label class="inline-flex items-center cursor-pointer">
            <input type="checkbox" v-model="showBookmarkedOnly" class="sr-only peer">
            <div class="relative w-8 h-4 bg-neutral-200 rounded-full dark:bg-neutral-700 after:content-[''] after:absolute after:top-[0px] after:start-[0px] after:bg-neutral-100 after:border-neutral-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-neutral-600 peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-neutral-100 peer-checked:bg-neutral-600 dark:peer-checked:bg-neutral-600">
            </div>
            <span class="ms-3 text-sm font-medium text-gray-900 dark:text-gray-300">Show bookmarked only</span>
          </label>
        </div>
      </form>
      
      <!-- Search Results Info -->
      <div v-if="!isLoading" class="text-sm text-neutral-600 dark:text-neutral-400 px-2">
        <span v-if="isSearchActive">
          Showing {{ searchResultsCount }} of {{ totalTldsCount }} extensions
          <span v-if="showBookmarkedOnly">({{ bookmarkedCount }} bookmarked)</span>
        </span>
        <span v-else>
          {{ totalTldsCount }} extensions total ({{ bookmarkedCount }} bookmarked)
        </span>
      </div>
      
      <hr class="w-full h-px bg-neutral-200 border-0 dark:bg-neutral-700">
    </div>

    <!-- Loading State -->
    <div v-if="isLoading" class="flex items-center justify-center">
      <SpinnerIcon class="w-12 h-12 fill-neutral-800 text-neutral-500"></SpinnerIcon>
    </div>
    
    <!-- Extensions List -->
    <div v-else-if="hasSearchResults">
      <template v-for="{ tld, isBookmarked }, index in sortedTlds" :key="tld">
        <TldItem 
          :tld="tld" 
          @bookmark="handleTldBookmarkChange"
          :class="{ 'bg-yellow-50 dark:bg-yellow-900/20 border-l-2 border-yellow-400': isBookmarked }"
        />
        <hr v-if="index < sortedTlds.length - 1" class="w-full h-px bg-gray-200 border-0 dark:bg-gray-700">
      </template>
    </div>
    
    <!-- No Results -->
    <div v-else class="flex flex-col items-center justify-center py-12 text-center">
      <div class="text-neutral-500 dark:text-neutral-400 mb-2">
        <SearchIcon class="w-12 h-12 mx-auto mb-3 opacity-50"></SearchIcon>
        <h3 class="text-lg font-medium mb-1">No extensions found</h3>
        <p class="text-sm">
          <span v-if="searchQuery.trim()">
            Try adjusting your search term or 
            <button @click="clearSearch" class="text-blue-600 dark:text-blue-400 hover:underline">clear the search</button>
          </span>
          <span v-else-if="showBookmarkedOnly">
            You haven't bookmarked any extensions yet.
          </span>
          <span v-else>
            No extensions available.
          </span>
        </p>
      </div>
    </div>
  </DefaultLayout>
</template>
