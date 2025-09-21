<template>
  <Teleport to="body">
    <div 
      v-if="modelValue" 
      class="fixed inset-0 flex items-center justify-center bg-neutral-950/90 z-20 p-4"
      @click.self="close"
      @keydown.esc="close"
      tabindex="-1"
    >
      <div 
        class="flex flex-col bg-neutral-100 dark:bg-neutral-800 rounded-lg shadow-lg w-full max-w-md max-h-[90vh] relative overflow-hidden" 
        role="dialog" 
        aria-modal="true"
        :aria-labelledby="headerId"
        :aria-describedby="bodyId"
      >
        <!-- Header (fixed) -->
        <div class="flex justify-between items-center p-6 pb-4 flex-shrink-0">
          <h3 
            :id="headerId"
            class="text-lg font-semibold text-neutral-900 dark:text-neutral-100"
          >
            <slot name="header"></slot>
          </h3>
          <button 
            type="button" 
            class="text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 focus:outline-none focus:ring-2 focus:ring-neutral-500 rounded" 
            @click="close"
            :aria-label="closeLabel"
          >
            <span class="sr-only">{{ closeLabel }}</span>
            ✕
          </button>
        </div>

        <hr class="w-full h-px bg-neutral-200 border-0 dark:bg-neutral-700 flex-shrink-0">

        <!-- Body (scrollable) -->
        <div 
          :id="bodyId"
          class="text-neutral-900 dark:text-neutral-100 overflow-y-auto flex-1 p-6 py-4"
        >
          <slot name="body"></slot>
        </div>

        <!-- Footer (fixed) -->
        <template v-if="slots.footer">
          <hr class="w-full h-px bg-neutral-200 border-0 dark:bg-neutral-700 flex-shrink-0">
          <div class="flex justify-end space-x-2 p-6 pt-4 flex-shrink-0">
            <slot name="footer"></slot>
          </div>
        </template>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, nextTick } from 'vue';

// Types
interface Props {
  readonly closeLabel?: string;
}

// Props and model
const props = withDefaults(defineProps<Props>(), {
  closeLabel: 'Close modal'
});

const modelValue = defineModel<boolean>();

const slots = defineSlots<{
  header(): any;
  body(): any;
  footer?(): any;
}>();

// Computed IDs for accessibility
const headerId = `modal-header-${Math.random().toString(36).substr(2, 9)}`;
const bodyId = `modal-body-${Math.random().toString(36).substr(2, 9)}`;

// Business logic
const close = (): void => {
  modelValue.value = false;
};

// Focus management for accessibility
let previousActiveElement: Element | null = null;

onMounted(() => {
  if (modelValue.value) {
    previousActiveElement = document.activeElement;
    nextTick(() => {
      // Focus the modal dialog for screen readers
      const modal = document.querySelector('[role="dialog"]') as HTMLElement;
      modal?.focus();
    });
  }
});

onUnmounted(() => {
  // Restore focus when modal is destroyed
  if (previousActiveElement instanceof HTMLElement) {
    previousActiveElement.focus();
  }
});

// Expose close method
defineExpose({
  close
});
</script>