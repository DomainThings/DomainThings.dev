<script lang="ts" setup>
import { onMounted, ref } from 'vue';
import StarIcon from '@/icons/StarIcon.vue';
import { getDb } from '@/services/dbService';

// Types
interface Props {
  readonly tld: string;
}

interface Emits {
  bookmark: [];
}

// Props & Emits
const props = defineProps<Props>();
const emit = defineEmits<Emits>();

// Reactive state
const isBookmarked = ref(false);
const isLoading = ref(false);

// Business logic
const checkBookmarkStatus = async (): Promise<boolean> => {
  try {
    const db = await getDb();
    const bookmark = await db.get('tlds', props.tld);
    return Boolean(bookmark);
  } catch (error) {
    console.error('Error checking bookmark status:', error);
    return false;
  }
};

const toggleBookmark = async (): Promise<void> => {
  if (isLoading.value) return;
  
  isLoading.value = true;
  try {
    const db = await getDb();
    
    if (isBookmarked.value) {
      await db.delete('tlds', props.tld);
    } else {
      await db.add('tlds', { tld: props.tld });
    }
    
    isBookmarked.value = !isBookmarked.value;
    emit('bookmark');
  } catch (error) {
    console.error('Error toggling bookmark:', error);
  } finally {
    isLoading.value = false;
  }
};

// Lifecycle hooks
onMounted(async () => {
  isBookmarked.value = await checkBookmarkStatus();
});

// Expose for testing
defineExpose({
  toggleBookmark,
  checkBookmarkStatus
});
</script>
<template>
  <div class="flex items-center p-2 gap-3 group">
    <button 
      @click="toggleBookmark()" 
      type="button"
      class="flex items-center justify-center p-1 text-neutral-500 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-neutral-500"
      :class="{ 'text-yellow-500 dark:text-yellow-500': isBookmarked }"
      :disabled="isLoading"
      :aria-label="isBookmarked ? `Remove ${tld} from bookmarks` : `Add ${tld} to bookmarks`"
    >
      <StarIcon class="w-5 h-5" />
    </button>
    
    <div class="flex items-center text-neutral-900 dark:text-neutral-100 font-mono">
      <span class="text-neutral-500 dark:text-neutral-400">.</span>{{ tld }}
    </div>
  </div>
</template>