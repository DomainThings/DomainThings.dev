<template>
  <div v-if="modelValue" role="alert"
    :class="[getAlertClasses(props.type), 'mb-4']">
    <span class="font-medium" v-if="slots.title"><slot name="title"></slot></span> 
    <slot/>
  </div>
</template>

<script setup lang="ts">
import { useTheme } from '@/composables/useTheme';

// Types
interface Props {
  readonly type?: 'info' | 'success' | 'warning' | 'error';
}

// Model and Props
const modelValue = defineModel<boolean>({ default: true });

const props = withDefaults(defineProps<Props>(), {
  type: 'info'
});

const slots = defineSlots<{
  title(): any;
  default(): any;
}>();

// Theme composable
const { getAlertClasses } = useTheme();

// Business logic
const close = (): void => {
  modelValue.value = false;
};

// Expose close method for parent components
defineExpose({
  close
});
</script>