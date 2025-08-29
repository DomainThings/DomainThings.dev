<template>
  <div v-if="modelValue" class="fixed inset-0 flex items-center justify-center bg-neutral-950/90 z-20 p-4"
    @click.self="close">
    <div class="flex flex-col gap-4 bg-neutral-100 dark:bg-neutral-800 rounded-lg shadow-lg w-full max-w-md max-h-full p-6 relative" role="dialog" aria-modal="true">
      <!-- Header -->
      <div class="flex justify-between items-center">
        <h3 class="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
          <slot name="header"></slot>
        </h3>
        <button type="button" class="text-neutral-400 hover:text-neutral-600 focus:outline-none" @click="close">
          <span class="sr-only">Close</span>
          ✕
        </button>
      </div>

      <hr class="w-full h-px bg-neutral-200 border-0 dark:bg-neutral-700">

      <!-- Body -->
      <div class="text-neutral-900 dark:text-neutral-100 overflow-hidden flex-1">
        <slot name="body"></slot>
      </div>

      <!-- Footer -->
      <hr v-if="slots.footer" class="w-full h-px bg-neutral-200 border-0 dark:bg-neutral-700">
      <div v-if="slots.footer" class="flex justify-end space-x-2">
        <slot name="footer"></slot>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const modelValue = defineModel()
const slots = defineSlots<{
  header: string
  body: string
  footer: string
}>()
const close = () => modelValue.value = false;
</script>