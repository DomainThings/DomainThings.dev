<template>
  <button 
    @click="toggleDark()" 
    type="button"
    class="text-neutral-700 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-neutral-100 focus:ring-2 focus:ring-neutral-500 rounded-lg p-1 transition-colors"
    :aria-label="isDark ? 'Switch to light mode' : 'Switch to dark mode'"
    :title="isDark ? 'Switch to light mode' : 'Switch to dark mode'"
  >
    <MoonIcon v-if="isDark" class="w-5 h-5" aria-hidden="true" />
    <SunIcon v-else class="w-5 h-5" aria-hidden="true" />
  </button>
</template>

<script setup lang="ts">
import { useDark, useToggle } from '@vueuse/core';
import MoonIcon from '@/icons/MoonIcon.vue';
import SunIcon from '@/icons/SunIcon.vue';

// Theme management using VueUse
const isDark = useDark({
  selector: 'html',
  attribute: 'class',
  valueDark: 'dark',
  valueLight: ''
});

const toggleDark = useToggle(isDark);

// Expose for testing
defineExpose({
  isDark,
  toggleDark
});
</script>