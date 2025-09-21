import { ref, computed, watch } from 'vue';
import { defineStore } from 'pinia';

/**
 * Search history entry
 */
interface SearchHistoryEntry {
  readonly query: string;
  readonly timestamp: number;
  readonly resultCount?: number;
}

/**
 * Search store for managing search state and history
 * Provides reactive search functionality with history and validation
 */
export const useSearchStore = defineStore('search', () => {
  // Core search state
  const q = ref<string>('');
  const isSearching = ref<boolean>(false);
  const lastSearchTime = ref<number>(0);
  
  // Search history (max 50 entries)
  const searchHistory = ref<SearchHistoryEntry[]>([]);
  const maxHistorySize = 50;
  
  // Search validation
  const minQueryLength = 2;
  const maxQueryLength = 100;
  
  /**
   * Computed: Current query trimmed
   */
  const query = computed({
    get: () => q.value.trim(),
    set: (value: string) => {
      q.value = value;
    }
  });
  
  /**
   * Computed: Whether the current query is valid
   */
  const isValidQuery = computed((): boolean => {
    const trimmed = query.value;
    return trimmed.length >= minQueryLength && 
           trimmed.length <= maxQueryLength &&
           /^[a-zA-Z0-9.-]+$/.test(trimmed);
  });
  
  /**
   * Computed: Query validation error message
   */
  const queryError = computed((): string | null => {
    const trimmed = query.value;
    
    if (trimmed.length === 0) return null; // No error for empty query
    
    if (trimmed.length < minQueryLength) {
      return `Query must be at least ${minQueryLength} characters`;
    }
    
    if (trimmed.length > maxQueryLength) {
      return `Query must be no more than ${maxQueryLength} characters`;
    }
    
    if (!/^[a-zA-Z0-9.-]+$/.test(trimmed)) {
      return 'Query can only contain letters, numbers, dots, and hyphens';
    }
    
    return null;
  });
  
  /**
   * Computed: Whether we can perform a search
   */
  const canSearch = computed((): boolean => {
    return isValidQuery.value && !isSearching.value;
  });
  
  /**
   * Computed: Unique search suggestions from history
   */
  const searchSuggestions = computed((): string[] => {
    if (!query.value) return [];
    
    const currentQuery = query.value.toLowerCase();
    
    return searchHistory.value
      .filter(entry => 
        entry.query.toLowerCase().includes(currentQuery) &&
        entry.query.toLowerCase() !== currentQuery
      )
      .sort((a, b) => b.timestamp - a.timestamp) // Most recent first
      .slice(0, 5) // Limit to 5 suggestions
      .map(entry => entry.query);
  });
  
  /**
   * Computed: Recent searches (last 10)
   */
  const recentSearches = computed((): SearchHistoryEntry[] => {
    return searchHistory.value
      .slice()
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 10);
  });
  
  /**
   * Sets the search query
   * @param newQuery - New query string
   */
  const setQuery = (newQuery: string): void => {
    q.value = newQuery;
  };
  
  /**
   * Clears the current search query
   */
  const clearQuery = (): void => {
    q.value = '';
  };
  
  /**
   * Sets the searching state
   * @param searching - Whether currently searching
   */
  const setSearching = (searching: boolean): void => {
    isSearching.value = searching;
    if (searching) {
      lastSearchTime.value = Date.now();
    }
  };
  
  /**
   * Adds a search to history
   * @param query - Search query
   * @param resultCount - Optional result count
   */
  const addToHistory = (searchQuery: string, resultCount?: number): void => {
    const trimmed = searchQuery.trim();
    if (!trimmed || trimmed.length < minQueryLength) return;
    
    // Remove existing entry for same query
    const existingIndex = searchHistory.value.findIndex(
      entry => entry.query.toLowerCase() === trimmed.toLowerCase()
    );
    
    if (existingIndex >= 0) {
      searchHistory.value.splice(existingIndex, 1);
    }
    
    // Add new entry at the beginning
    searchHistory.value.unshift({
      query: trimmed,
      timestamp: Date.now(),
      resultCount
    });
    
    // Limit history size
    if (searchHistory.value.length > maxHistorySize) {
      searchHistory.value = searchHistory.value.slice(0, maxHistorySize);
    }
    
    // Persist to localStorage
    persistHistory();
  };
  
  /**
   * Removes a search from history
   * @param query - Query to remove
   */
  const removeFromHistory = (queryToRemove: string): void => {
    const index = searchHistory.value.findIndex(
      entry => entry.query === queryToRemove
    );
    
    if (index >= 0) {
      searchHistory.value.splice(index, 1);
      persistHistory();
    }
  };
  
  /**
   * Clears all search history
   */
  const clearHistory = (): void => {
    searchHistory.value = [];
    persistHistory();
  };
  
  /**
   * Persists search history to localStorage
   */
  const persistHistory = (): void => {
    try {
      localStorage.setItem('domaincheck-search-history', JSON.stringify(searchHistory.value));
    } catch (error) {
      console.warn('Failed to persist search history:', error);
    }
  };
  
  /**
   * Loads search history from localStorage
   */
  const loadHistory = (): void => {
    try {
      const stored = localStorage.getItem('domaincheck-search-history');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          // Validate entries and filter out invalid ones
          searchHistory.value = parsed
            .filter(entry => 
              entry && 
              typeof entry.query === 'string' && 
              typeof entry.timestamp === 'number' &&
              entry.query.length >= minQueryLength
            )
            .slice(0, maxHistorySize); // Ensure size limit
        }
      }
    } catch (error) {
      console.warn('Failed to load search history:', error);
      searchHistory.value = [];
    }
  };
  
  /**
   * Gets time since last search in milliseconds
   */
  const getTimeSinceLastSearch = (): number => {
    return lastSearchTime.value > 0 ? Date.now() - lastSearchTime.value : Infinity;
  };
  
  /**
   * Checks if enough time has passed since last search (debouncing)
   * @param minInterval - Minimum interval in milliseconds (default: 500ms)
   */
  const canSearchAgain = (minInterval: number = 500): boolean => {
    return getTimeSinceLastSearch() >= minInterval;
  };
  
  // Initialize history on store creation
  loadHistory();
  
  // Watch for query changes to update URL params if needed
  watch(query, (newQuery) => {
    // You can dispatch events here for URL synchronization
    if (typeof window !== 'undefined' && window.dispatchEvent) {
      window.dispatchEvent(new CustomEvent('search-query-changed', {
        detail: { query: newQuery }
      }));
    }
  });
  
  return {
    // State (read-only refs)
    q,
    isSearching,
    lastSearchTime,
    searchHistory,
    
    // Computed
    query,
    isValidQuery,
    queryError,
    canSearch,
    searchSuggestions,
    recentSearches,
    
    // Actions
    setQuery,
    clearQuery,
    setSearching,
    addToHistory,
    removeFromHistory,
    clearHistory,
    loadHistory,
    getTimeSinceLastSearch,
    canSearchAgain,
    
    // Constants
    minQueryLength,
    maxQueryLength
  };
});
