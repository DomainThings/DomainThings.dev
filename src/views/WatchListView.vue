<script lang="ts" setup>
import { onMounted, ref, computed, watch } from 'vue';
import DefaultLayout from '@/layouts/DefaultLayout.vue';
import DomainItem from '@/components/DomainItem.vue';
import SpinnerIcon from '@/icons/SpinnerIcon.vue';
import SearchIcon from '@/icons/SearchIcon.vue';
import CloseIcon from '@/icons/CloseIcon.vue';
import type { Domain } from '@/types';
import { getDb } from '@/services/dbService';
import { useRoute, useRouter } from 'vue-router';

// Router & Route
const route = useRoute();
const router = useRouter();

// Reactive state
const isLoading = ref(false);
const bookmarks = ref<readonly Domain[]>([]);
const searchQuery = ref(route.query.search?.toString() || '');

// Computed properties for search and filtering
const filteredBookmarks = computed(() => {
  if (!searchQuery.value.trim()) return bookmarks.value;
  
  const query = searchQuery.value.toLowerCase().trim();
  return bookmarks.value.filter(bookmark => 
    bookmark.name.toLowerCase().includes(query)
  );
});

// Computed properties for UI state
const searchResultsCount = computed(() => filteredBookmarks.value.length);
const totalBookmarksCount = computed(() => bookmarks.value.length);
const hasSearchResults = computed(() => filteredBookmarks.value.length > 0);
const isSearchActive = computed(() => searchQuery.value.trim());

// Lifecycle hooks
onMounted(async () => {
  await fetchBookmarks();
});

// Business logic functions
const fetchBookmarks = async (): Promise<void> => {
  isLoading.value = true;
  try {
    const db = await getDb();
    const fetchedBookmarks = await db.getAll('domains');
    bookmarks.value = Object.freeze(fetchedBookmarks);
  } catch (error) {
    console.error('Error fetching bookmarks:', error);
    bookmarks.value = [];
  } finally {
    isLoading.value = false;
  }
};

const clearSearch = (): void => {
  searchQuery.value = '';
};

// Watchers for URL synchronization
watch(searchQuery, () => {
  const query: Record<string, string> = {};
  
  if (searchQuery.value.trim()) {
    query.search = searchQuery.value.trim();
  }
  
  router.push({ query });
}, { 
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
            placeholder="Search bookmarked domains..."
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
      </form>
      
      <!-- Search Results Info -->
      <div v-if="!isLoading" class="text-sm text-neutral-600 dark:text-neutral-400 px-2">
        <span v-if="isSearchActive">
          Showing {{ searchResultsCount }} of {{ totalBookmarksCount }} bookmarked domains
        </span>
        <span v-else>
          {{ totalBookmarksCount }} bookmarked domains total
        </span>
      </div>
      
      <hr class="w-full h-px bg-neutral-200 border-0 dark:bg-neutral-700">
    </div>

    <!-- Loading State -->
    <div v-if="isLoading" class="flex items-center justify-center">
      <SpinnerIcon class="w-12 h-12 fill-neutral-800 text-neutral-500"></SpinnerIcon>
    </div>
    
    <!-- Bookmarks List -->
    <div v-else-if="hasSearchResults" class="w-full">
      <template v-for="(bookmark, index) in filteredBookmarks" :key="bookmark.name">
        <DomainItem :domainName="bookmark.name"></DomainItem>
        <hr v-if="index < filteredBookmarks.length - 1" class="w-full h-px bg-gray-200 border-0 dark:bg-gray-700">
      </template>
    </div>
    
    <!-- No Results -->
    <div v-else class="flex flex-col items-center justify-center py-12 text-center">
      <div class="text-neutral-500 dark:text-neutral-400 mb-2">
        <SearchIcon class="w-12 h-12 mx-auto mb-3 opacity-50"></SearchIcon>
        <h3 class="text-lg font-medium mb-1">No domains found</h3>
        <p class="text-sm">
          <span v-if="searchQuery.trim()">
            No bookmarked domains match "{{ searchQuery.trim() }}". 
            <button @click="clearSearch" class="text-blue-600 dark:text-blue-400 hover:underline">Clear search</button>
          </span>
          <span v-else>
            You haven't bookmarked any domains yet.
          </span>
        </p>
      </div>
    </div>
  </DefaultLayout>
</template>
