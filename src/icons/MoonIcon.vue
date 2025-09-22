<template>
  <svg :class="class" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z"></path>
  </svg>
</template>
<script setup lang="ts">
// Types
interface Props {
  readonly class?: string | string[];
}

// Props
defineProps<Props>();
</script>