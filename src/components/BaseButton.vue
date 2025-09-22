<script lang="ts" setup>
import { computed } from 'vue';
import { useTheme, type ThemeVariant } from '@/composables/useTheme';

interface Props {
  variant?: ThemeVariant;
  outline?: boolean;
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  loading?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  variant: 'neutral',
  outline: false,
  size: 'md',
  disabled: false,
  loading: false,
});

const { getButtonClasses } = useTheme();

const buttonClasses = computed(() => {
  const baseClasses = getButtonClasses(props.variant, props.outline);
  
  // Tailles
  const sizeClasses = {
    sm: 'text-xs px-2 py-1',
    md: 'text-sm px-3 py-2',
    lg: 'text-base px-4 py-2',
  };

  // Classes additionnelles
  const additionalClasses = [
    'cursor-pointer',
    'focus:outline-none',
    'focus:ring-2',
    'focus:ring-offset-2',
    'disabled:opacity-50',
    'disabled:cursor-not-allowed',
    'transition-all',
    'duration-150',
  ];

  return [
    baseClasses.replace('text-xs px-2 py-1', ''), // Remove default size
    sizeClasses[props.size],
    ...additionalClasses,
  ].join(' ');
});
</script>

<template>
  <button
    :class="buttonClasses"
    :disabled="disabled || loading"
    type="button"
  >
    <span v-if="loading" class="inline-flex items-center">
      <svg class="animate-spin -ml-1 mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
      </svg>
    </span>
    <slot />
  </button>
</template>
