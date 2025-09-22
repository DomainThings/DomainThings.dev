<template>
  <div v-if="modelValue" role="alert"
    :class="classes"
    class="p-4 mb-4 text-sm rounded-lg">
    <span class="font-medium" v-if="slots.title"><slot name="title"></slot></span> 
    <slot/>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

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

// Business logic
const close = (): void => {
  modelValue.value = false;
};

// Computed properties
const classes = computed((): string => {
  const typeClasses: Record<NonNullable<Props['type']>, string> = {
    info: 'text-blue-800 bg-blue-50 dark:bg-gray-800 dark:text-blue-400',
    success: 'text-green-800 bg-green-50 dark:bg-gray-800 dark:text-green-300',
    warning: 'text-yellow-800 bg-yellow-50 dark:bg-gray-800 dark:text-yellow-400',
    error: 'text-red-800 bg-red-50 dark:bg-gray-800 dark:text-red-400'
  };
  
  return typeClasses[props.type] || typeClasses.info;
});

// Expose close method for parent components
defineExpose({
  close
});
</script>