<script lang="ts" setup>
import { computed, ref, onMounted, onUnmounted } from 'vue';
import { useRoute } from 'vue-router';
import DarkModeSwitch from '@/components/DarkModeSwitch.vue';
import BurgerIcon from '@/icons/BurgerIcon.vue';
import CloseIcon from '@/icons/CloseIcon.vue';
import GithubIcon from '@/icons/GithubIcon.vue';

// Types
interface NavigationItem {
  readonly name: string;
  readonly label: string;
  readonly routeName: string;
}

// Router
const route = useRoute();

// Reactive state
const showMobileMenu = ref(false);

// Navigation configuration
const navigationItems: readonly NavigationItem[] = Object.freeze([
  { name: 'search', label: 'Search', routeName: 'Search' },
  { name: 'watchlist', label: 'Watch list', routeName: 'WatchList' },
  { name: 'extensions', label: 'Extensions', routeName: 'ExtensionList' },
  { name: 'settings', label: 'Settings', routeName: 'Settings' }
]);

// Computed properties
const currentRouteName = computed(() => route.name);

const isRouteActive = (routeName: string): boolean => {
  return currentRouteName.value === routeName;
};

const getRouteLinkClass = (routeName: string): string => {
  const baseClass = 'font-medium text-lg text-neutral-900 dark:text-neutral-100 hover:text-neutral-600 dark:hover:text-neutral-300 transition-colors';
  const activeClass = 'border-b-2 border-neutral-900 dark:border-neutral-100';
  
  return isRouteActive(routeName) ? `${baseClass} ${activeClass}` : baseClass;
};

// Business logic
const toggleMobileMenu = (): void => {
  showMobileMenu.value = !showMobileMenu.value;
};

const closeMobileMenu = (): void => {
  showMobileMenu.value = false;
};

// Handle escape key to close mobile menu
const handleEscapeKey = (event: KeyboardEvent): void => {
  if (event.key === 'Escape' && showMobileMenu.value) {
    closeMobileMenu();
  }
};

// Lifecycle hooks
onMounted(() => {
  document.addEventListener('keydown', handleEscapeKey);
});

onUnmounted(() => {
  document.removeEventListener('keydown', handleEscapeKey);
});

// Expose for testing
defineExpose({
  toggleMobileMenu,
  closeMobileMenu,
  isRouteActive
});
</script>

<template>
  <div class="flex flex-col min-h-screen items-center">
    <!-- Header Navigation -->
    <header class="fixed top-0 left-0 right-0 z-50 flex w-full h-16 px-4 py-2 justify-between items-center bg-white dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-700">
      <!-- App Title in Header -->
      <div class="flex-shrink-0">
        <h1 class="text-xl font-bold text-neutral-900 dark:text-neutral-100">
          <RouterLink 
            :to="{ name: 'Search' }"
            class="hover:text-neutral-600 dark:hover:text-neutral-300 transition-colors"
          >
            DomainThings
          </RouterLink>
        </h1>
      </div>

      <!-- Navigation Container -->
      <div class="flex items-center">
        <!-- Mobile Menu Toggle -->
        <div class="sm:hidden">
        <button 
          v-if="!showMobileMenu"
          @click="toggleMobileMenu"
          class="text-neutral-700 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-neutral-100 rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-neutral-500"
          aria-label="Open navigation menu"
        >
          <BurgerIcon class="w-5 h-5" />
        </button>
        <button 
          v-else
          @click="closeMobileMenu"
          class="text-neutral-700 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-neutral-100 rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-neutral-500"
          aria-label="Close navigation menu"
        >
          <CloseIcon class="w-5 h-5" />
        </button>
      </div>

        <!-- Desktop Navigation -->
        <nav class="hidden sm:flex gap-8 justify-end items-center" role="navigation" aria-label="Main navigation">
          <RouterLink 
            v-for="item in navigationItems"
            :key="item.name"
            :to="{ name: item.routeName }"
            :class="getRouteLinkClass(item.routeName)"
            :aria-current="isRouteActive(item.routeName) ? 'page' : undefined"
          >
            {{ item.label }}
          </RouterLink>
          <DarkModeSwitch />
        </nav>
      </div>
    </header>

    <!-- Page Title -->
    <div 
      v-if="!showMobileMenu"
      class="flex justify-center items-center px-4 py-6 mt-16"
    >
      <slot name="page-title" />
    </div>

    <!-- Mobile Navigation Menu (Full Height) -->
    <div 
      v-if="showMobileMenu"
      class="flex-1 px-4 py-2 flex flex-col gap-12 items-center text-neutral-900 dark:text-neutral-100 sm:hidden mt-16 mb-12"
    >
      <nav class="flex flex-col gap-12 items-center mt-12" role="navigation" aria-label="Mobile navigation">
        <RouterLink 
          v-for="item in navigationItems"
          :key="item.name"
          :to="{ name: item.routeName }"
          @click="closeMobileMenu"
          :class="getRouteLinkClass(item.routeName)"
          :aria-current="isRouteActive(item.routeName) ? 'page' : undefined"
        >
          {{ item.label }}
        </RouterLink>
        <DarkModeSwitch />
      </nav>
    </div>

    <!-- Main Content -->
    <main 
      v-if="!showMobileMenu"
      class="flex-1 px-4 py-2 max-w-lg w-full text-neutral-900 dark:text-neutral-100 mb-12"
    >
      <slot />
    </main>

    <!-- Footer -->
    <footer class="fixed bottom-0 left-0 right-0 z-50 flex w-full h-12 px-4 bg-neutral-100 dark:bg-neutral-800 border-t border-neutral-200 dark:border-neutral-700">
      <div class="flex w-full justify-end items-center">
        <a 
          href="https://github.com/domain-check/domain-check.github.io" 
          target="_blank" 
          rel="noopener noreferrer"
          class="flex items-center text-sm gap-2 text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 transition-colors"
          aria-label="View source code on GitHub"
        >
          <GithubIcon class="w-4 h-4" />
          <span>GitHub</span>
        </a>
      </div>
    </footer>
  </div>
</template>
