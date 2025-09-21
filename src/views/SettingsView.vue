<template>
  <DefaultLayout>
    <div class="settings-view space-y-6">
      <!-- Header -->
      <div class="text-center pb-4 border-b border-gray-200 dark:border-gray-700">
        <h1 class="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          Paramètres
        </h1>
        <p class="text-sm text-gray-600 dark:text-gray-400">
          Gérez vos préférences et les données de l'application
        </p>
      </div>

      <!-- Appearance Section -->
      <section class="space-y-3">
        <h2 class="text-lg font-semibold text-gray-900 dark:text-white">
          Apparence
        </h2>
        <div class="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
          <div class="flex items-center justify-between">
            <div>
              <h3 class="font-medium text-gray-900 dark:text-white">
                Mode sombre
              </h3>
              <p class="text-xs text-gray-600 dark:text-gray-400">
                Basculer entre le mode clair et sombre
              </p>
            </div>
            <DarkModeSwitch />
          </div>
        </div>
      </section>

      <!-- Data Management Section -->
      <section class="space-y-3">
        <h2 class="text-lg font-semibold text-gray-900 dark:text-white">
          Gestion des données
        </h2>
        
        <!-- Storage Info -->
        <div class="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
          <div class="flex items-center justify-between">
            <div>
              <h3 class="font-medium text-gray-900 dark:text-white">
                Stockage local
              </h3>
              <p class="text-xs text-gray-600 dark:text-gray-400">
                Gérer les données stockées localement
              </p>
            </div>
            <button
              @click="clearStorage"
              class="px-3 py-1.5 text-xs font-medium text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 border border-red-200 dark:border-red-700 rounded-md hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
            >
              Effacer
            </button>
          </div>
        </div>
      </section>

      <!-- Search Settings -->
      <section class="space-y-3">
        <h2 class="text-lg font-semibold text-gray-900 dark:text-white">
          Recherche
        </h2>
        <div class="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700 space-y-3">
          <div class="flex items-center justify-between">
            <div>
              <h3 class="font-medium text-gray-900 dark:text-white">
                Historique des recherches
              </h3>
              <p class="text-xs text-gray-600 dark:text-gray-400">
                Conserver l'historique des recherches
              </p>
            </div>
            <label class="relative inline-flex items-center cursor-pointer">
              <input
                v-model="keepSearchHistory"
                type="checkbox"
                class="sr-only peer"
              >
              <div class="w-9 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
            </label>
          </div>

          <div class="flex items-center justify-between">
            <div>
              <h3 class="font-medium text-gray-900 dark:text-white">
                Suggestions automatiques
              </h3>
              <p class="text-xs text-gray-600 dark:text-gray-400">
                Afficher des suggestions pendant la saisie
              </p>
            </div>
            <label class="relative inline-flex items-center cursor-pointer">
              <input
                v-model="enableSuggestions"
                type="checkbox"
                class="sr-only peer"
              >
              <div class="w-9 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
            </label>
          </div>
        </div>
      </section>

      <!-- About Section -->
      <section class="space-y-3">
        <h2 class="text-lg font-semibold text-gray-900 dark:text-white">
          À propos
        </h2>
        <div class="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
          <div class="space-y-1">
            <p class="text-xs text-gray-600 dark:text-gray-400">
              <span class="font-medium">Version :</span> {{ version }}
            </p>
            <p class="text-xs text-gray-600 dark:text-gray-400">
              <span class="font-medium">Base de données :</span> {{ dbVersion }}
            </p>
            <p class="text-xs text-gray-600 dark:text-gray-400">
              <span class="font-medium">Dernière mise à jour :</span> {{ lastUpdate }}
            </p>
          </div>
        </div>
      </section>
    </div>
  </DefaultLayout>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import DefaultLayout from '@/layouts/DefaultLayout.vue'
import DarkModeSwitch from '@/components/DarkModeSwitch.vue'
import { clearAllData } from '@/services/dbService'

// Reactive data
const keepSearchHistory = ref(true)
const enableSuggestions = ref(true)
const version = ref('1.0.0')
const dbVersion = ref('4')
const lastUpdate = ref(new Date().toLocaleDateString())

// Methods
const clearStorage = async (): Promise<void> => {
  if (confirm('Êtes-vous sûr de vouloir effacer toutes les données ? Cette action est irréversible.')) {
    try {
      const clearResult = await clearAllData()
      if (!clearResult.success) {
        throw new Error(clearResult.error)
      }
      
      alert('Toutes les données ont été effacées.')
      // Recharger la page pour réinitialiser l'état
      window.location.reload()
    } catch (error) {
      console.error('Erreur lors de l\'effacement des données:', error)
      alert('Erreur lors de l\'effacement des données.')
    }
  }
}

// Lifecycle
onMounted(async () => {
  try {
    // Charger les préférences sauvegardées
    const preferences = localStorage.getItem('app-preferences')
    if (preferences) {
      const parsed = JSON.parse(preferences)
      keepSearchHistory.value = parsed.keepSearchHistory ?? true
      enableSuggestions.value = parsed.enableSuggestions ?? true
    }

    // Version de la base de données fixe (v4)
    dbVersion.value = '4'
  } catch (error) {
    console.error('Erreur lors du chargement des paramètres:', error)
  }
})

// Watcher pour sauvegarder les préférences
import { watch } from 'vue'

watch([keepSearchHistory, enableSuggestions], () => {
  const preferences = {
    keepSearchHistory: keepSearchHistory.value,
    enableSuggestions: enableSuggestions.value
  }
  localStorage.setItem('app-preferences', JSON.stringify(preferences))
}, { deep: true })
</script>
