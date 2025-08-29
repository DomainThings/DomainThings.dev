<script lang="ts" setup>
import { onMounted, ref } from 'vue';
import DefaultLayout from '@/layouts/DefaultLayout.vue';
import DomainItem from '@/components/DomainItem.vue';
import type { Domain } from '@/types';
import { getDb } from '@/services/dbService';

const isLoading = ref(false);
const bookmarks = ref<Domain[]>();

onMounted(async () => {
  await fetchBookmarks();
})

const fetchBookmarks = async () => {
  isLoading.value = true;
  const db = await getDb();
  bookmarks.value = await db.getAll('domains');
  isLoading.value = false;
}
</script>

<template>
  <DefaultLayout>

    <div class="w-full">
      <template v-for="domain, index in bookmarks?.map(bookmark => bookmark.name)" :key="index">
        <DomainItem :domainName="domain"></DomainItem>
        <hr class="w-full h-px bg-gray-200 border-0 dark:bg-gray-700">
      </template>
    </div>
  </DefaultLayout>
</template>
