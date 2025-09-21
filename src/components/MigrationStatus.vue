<script lang="ts" setup>
import { ref, onMounted } from 'vue';
import { getMigrationStatus, forceMigration, cleanupLegacyDatabase } from '@/services/dbService';
import BaseAlert from './BaseAlert.vue';
import SpinnerIcon from '@/icons/SpinnerIcon.vue';

// Types
interface MigrationInfo {
  isCompleted: boolean;
  migrationData?: {
    version: number;
    timestamp: number;
    migratedCount: number;
  };
  legacyDbExists: boolean;
}

// Reactive state
const migrationInfo = ref<MigrationInfo | null>(null);
const isLoading = ref(false);
const isProcessing = ref(false);
const error = ref<string | null>(null);
const successMessage = ref<string | null>(null);

// Business logic
const checkMigrationStatus = async (): Promise<void> => {
  try {
    isLoading.value = true;
    error.value = null;
    
    const result = await getMigrationStatus();
    
    if (result.success && result.data) {
      migrationInfo.value = result.data;
    } else {
      error.value = result.error || 'Failed to check migration status';
    }
  } catch (err) {
    error.value = err instanceof Error ? err.message : String(err);
  } finally {
    isLoading.value = false;
  }
};

const performMigration = async (): Promise<void> => {
  try {
    isProcessing.value = true;
    error.value = null;
    successMessage.value = null;
    
    const result = await forceMigration();
    
    if (result.success && result.data) {
      successMessage.value = `Successfully migrated ${result.data.migratedCount} records from legacy database`;
      await checkMigrationStatus(); // Refresh status
    } else {
      error.value = result.error || 'Migration failed';
    }
  } catch (err) {
    error.value = err instanceof Error ? err.message : String(err);
  } finally {
    isProcessing.value = false;
  }
};

const cleanupLegacyDb = async (): Promise<void> => {
  try {
    isProcessing.value = true;
    error.value = null;
    successMessage.value = null;
    
    const result = await cleanupLegacyDatabase();
    
    if (result.success) {
      successMessage.value = 'Legacy database cleaned up successfully';
      await checkMigrationStatus(); // Refresh status
    } else {
      error.value = result.error || 'Cleanup failed';
    }
  } catch (err) {
    error.value = err instanceof Error ? err.message : String(err);
  } finally {
    isProcessing.value = false;
  }
};

// Lifecycle
onMounted(() => {
  checkMigrationStatus();
});
</script>

<template>
  <div class="space-y-4">
    <!-- Loading State -->
    <div v-if="isLoading" class="flex items-center justify-center py-4">
      <SpinnerIcon class="w-6 h-6 fill-neutral-800 text-neutral-500" />
      <span class="ml-2 text-sm text-neutral-600 dark:text-neutral-400">Checking migration status...</span>
    </div>

    <!-- Error State -->
    <BaseAlert v-if="error" type="error">
      <template #title>Migration Error</template>
      {{ error }}
    </BaseAlert>

    <!-- Success Message -->
    <BaseAlert v-if="successMessage" type="success">
      <template #title>Success</template>
      {{ successMessage }}
    </BaseAlert>

    <!-- Migration Status -->
    <div v-if="migrationInfo && !isLoading" class="bg-neutral-50 dark:bg-neutral-800 rounded-lg p-4 border border-neutral-200 dark:border-neutral-700">
      <h3 class="text-lg font-medium text-neutral-900 dark:text-neutral-100 mb-3">
        Database Migration Status
      </h3>
      
      <!-- Migration Completed -->
      <div v-if="migrationInfo.isCompleted" class="space-y-3">
        <div class="flex items-center gap-2">
          <div class="w-3 h-3 bg-green-500 rounded-full"></div>
          <span class="text-sm font-medium text-green-700 dark:text-green-400">Migration Completed</span>
        </div>
        
        <div v-if="migrationInfo.migrationData" class="text-sm text-neutral-600 dark:text-neutral-400 space-y-1">
          <p>• Migrated {{ migrationInfo.migrationData.migratedCount }} records</p>
          <p>• Completed on {{ new Date(migrationInfo.migrationData.timestamp).toLocaleString() }}</p>
          <p>• Database version: {{ migrationInfo.migrationData.version }}</p>
        </div>
        
        <!-- Legacy Database Cleanup -->
        <div v-if="migrationInfo.legacyDbExists" class="mt-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded border border-yellow-200 dark:border-yellow-800">
          <p class="text-sm text-yellow-700 dark:text-yellow-400 mb-2">
            Legacy database still exists and can be safely removed.
          </p>
          <button
            @click="cleanupLegacyDb"
            :disabled="isProcessing"
            class="px-3 py-1.5 text-xs bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300 rounded hover:bg-yellow-200 dark:hover:bg-yellow-800 transition-colors disabled:opacity-50"
          >
            <SpinnerIcon v-if="isProcessing" class="w-3 h-3 inline mr-1" />
            Clean Up Legacy Database
          </button>
        </div>
      </div>
      
      <!-- Migration Needed -->
      <div v-else class="space-y-3">
        <div class="flex items-center gap-2">
          <div class="w-3 h-3 bg-orange-500 rounded-full"></div>
          <span class="text-sm font-medium text-orange-700 dark:text-orange-400">Migration Required</span>
        </div>
        
        <div v-if="migrationInfo.legacyDbExists" class="space-y-3">
          <p class="text-sm text-neutral-600 dark:text-neutral-400">
            A legacy database was detected. Migration will transfer your existing data to the new database structure.
          </p>
          
          <button
            @click="performMigration"
            :disabled="isProcessing"
            class="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors disabled:opacity-50 text-sm"
          >
            <SpinnerIcon v-if="isProcessing" class="w-4 h-4 inline mr-2" />
            {{ isProcessing ? 'Migrating...' : 'Start Migration' }}
          </button>
        </div>
        
        <div v-else class="text-sm text-neutral-600 dark:text-neutral-400">
          No legacy database found. You're using the latest database structure.
        </div>
      </div>
      
      <!-- Refresh Button -->
      <div class="mt-4 pt-3 border-t border-neutral-200 dark:border-neutral-700">
        <button
          @click="checkMigrationStatus"
          :disabled="isLoading || isProcessing"
          class="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 underline disabled:opacity-50"
        >
          Refresh Status
        </button>
      </div>
    </div>
  </div>
</template>
