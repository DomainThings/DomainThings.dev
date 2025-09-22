<script lang="ts" setup>
import { computed } from 'vue';
import { useTheme, type ThemeVariant } from '@/composables/useTheme';

interface Props {
  variant?: ThemeVariant;
  size?: 'sm' | 'md' | 'lg';
}

const props = withDefaults(defineProps<Props>(), {
  variant: 'neutral',
  size: 'md',
});

const { getBadgeClasses } = useTheme();

const badgeClasses = computed(() => {
  const baseClasses = getBadgeClasses(props.variant);
  
  // Tailles
  const sizeClasses = {
    sm: 'text-xs px-1.5 py-0.5',
    md: 'text-xs px-2 py-1',
    lg: 'text-sm px-3 py-1.5',
  };

  return [
    baseClasses.replace('text-xs px-2 py-1', ''), // Remove default size
    sizeClasses[props.size],
  ].join(' ');
});
</script>

<template>
  <span :class="badgeClasses">
    <slot />
  </span>
</template>
