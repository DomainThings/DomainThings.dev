<template>
  <DefaultLayout>
    <template #page-title>
      <h2 class="text-2xl font-bold text-neutral-900 dark:text-neutral-100">Settings</h2>
    </template>
    
    <div class="settings-view space-y-6">
      <!-- Header -->
      <div class="text-center pb-4 border-b border-neutral-200 dark:border-neutral-700">
        <p class="text-sm text-neutral-600 dark:text-neutral-400">
          Manage your preferences and application data
        </p>
      </div>

      <!-- Appearance Section -->
      <section class="space-y-3">
        <h2 class="text-lg font-semibold text-neutral-900 dark:text-white">
          Appearance
        </h2>
        <div class="bg-white dark:bg-neutral-800 rounded-lg p-4 border border-neutral-200 dark:border-neutral-700">
          <div class="flex items-center justify-between">
            <div>
              <h3 class="font-medium text-neutral-900 dark:text-white">
                Dark mode
              </h3>
              <p class="text-xs text-neutral-600 dark:text-neutral-400">
                Toggle between light and dark theme
              </p>
            </div>
            <DarkModeSwitch />
          </div>
        </div>
      </section>

      <!-- Data Management Section -->
      <section class="space-y-3">
        <h2 class="text-lg font-semibold text-neutral-900 dark:text-white">
          Data Management
        </h2>
        
        <!-- Storage Info -->
        <div class="bg-white dark:bg-neutral-800 rounded-lg p-4 border border-neutral-200 dark:border-neutral-700">
          <div class="flex items-center justify-between">
            <div>
              <h3 class="font-medium text-neutral-900 dark:text-white">
                Local storage
              </h3>
              <p class="text-xs text-neutral-600 dark:text-neutral-400">
                Manage locally stored data
              </p>
            </div>
            <button
              @click="clearStorage"
              :class="['px-3 py-1.5 text-xs font-medium', getButtonClasses('error')]"
            >
              Clear
            </button>
          </div>
        </div>
      </section>
    </div>
  </DefaultLayout>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import DefaultLayout from '@/layouts/DefaultLayout.vue'
import DarkModeSwitch from '@/components/DarkModeSwitch.vue'
import { clearAllData } from '@/services/dbService'
import { useTheme } from '@/composables/useTheme'

const { getButtonClasses } = useTheme()

// Methods
const clearStorage = async (): Promise<void> => {
  if (confirm('Are you sure you want to clear all data? This action is irreversible.')) {
    try {
      const clearResult = await clearAllData()
      if (!clearResult.success) {
        throw new Error(clearResult.error)
      }
      
      alert('All data has been cleared.')
      // Reload page to reset state
      window.location.reload()
    } catch (error) {
      console.error('Error clearing data:', error)
      alert('Error clearing data.')
    }
  }
}
</script>
