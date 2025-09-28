<script setup lang="ts">
import { RouterLink } from 'vue-router';
import DefaultLayout from '@/layouts/DefaultLayout.vue';
</script>

<template>
  <DefaultLayout>
    <template #page-title>
      <h2 class="text-2xl font-brand font-bold text-neutral-900 dark:text-neutral-100">Page Not Found</h2>
    </template>
    
    <div class="py-8 px-4 mx-auto max-w-screen-xl lg:py-16 lg:px-6">
      <div class="mx-auto max-w-screen-sm text-center">
        <h1 class="mb-4 text-7xl tracking-tight font-extrabold lg:text-9xl text-neutral-600 dark:text-neutral-100">404
        </h1>
        <p class="mb-4 text-3xl tracking-tight font-bold text-neutral-900 md:text-4xl dark:text-neutral-100">Something's missing.
        </p>
        <p class="mb-4 text-lg font-light text-neutral-500 dark:text-neutral-400">Sorry, we can't find that page.</p>
        <RouterLink :to="{ name: 'Search' }"
          class="inline-flex text-neutral-100 bg-neutral-600 hover:bg-neutral-800 focus:ring-4 focus:outline-none font-medium rounded-lg text-sm px-5 py-2.5 text-center my-4">
          Back
          to Homepage</RouterLink>
      </div>
    </div>
  </DefaultLayout>
</template>
