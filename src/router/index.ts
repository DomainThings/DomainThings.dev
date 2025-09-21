import { createRouter, createWebHistory } from 'vue-router';
import type { RouteRecordRaw } from 'vue-router';
import SearchView from '@/views/SearchView.vue';
import WatchListView from '@/views/WatchListView.vue';
import ExtensionListView from '@/views/ExtensionListView.vue';
import Error404View from '@/views/Error404View.vue';
import analyticsService from '@/services/analyticsService';

// Types
interface RouteTitle {
  readonly [key: string]: string;
}

// Constants
const ROUTE_TITLES: RouteTitle = Object.freeze({
  'Search': 'Domain Check - Search Domains',
  'WatchList': 'Domain Check - Watch List', 
  'ExtensionList': 'Domain Check - TLD Extensions',
  '404': 'Domain Check - Page Not Found'
});

const DEFAULT_TITLE = 'Domain Check';
const ANALYTICS_DELAY = 100; // ms - Delay to ensure route transition is complete

// Route configuration
const routes: readonly RouteRecordRaw[] = Object.freeze([
  {
    path: '/',
    name: 'Search',
    component: SearchView,
    meta: {
      title: 'Search Domains',
      description: 'Search and check domain availability'
    }
  },
  {
    path: '/watch',
    name: 'WatchList', 
    component: WatchListView,
    meta: {
      title: 'Watch List',
      description: 'Manage your bookmarked domains'
    }
  },
  {
    path: '/extensions',
    name: 'ExtensionList',
    component: ExtensionListView,
    meta: {
      title: 'TLD Extensions',
      description: 'Browse and bookmark TLD extensions'
    }
  },
  {
    path: '/:pathMatch(.*)*',
    name: '404',
    component: Error404View,
    meta: {
      title: 'Page Not Found',
      description: 'The requested page could not be found'
    }
  }
]);

// Router instance
const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior(to, from, savedPosition) {
    // Return to saved position when using browser back/forward
    if (savedPosition) {
      return savedPosition;
    }
    
    // Scroll to top for new routes
    return { top: 0 };
  }
});

// Helper functions
const getPageTitle = (routeName: string | symbol | null | undefined): string => {
  if (typeof routeName !== 'string') {
    return DEFAULT_TITLE;
  }
  
  return ROUTE_TITLES[routeName] || DEFAULT_TITLE;
};

const updateDocumentTitle = (title: string): void => {
  document.title = title;
};

const trackPageView = (path: string, title: string): void => {
  analyticsService.trackPageView({
    path,
    title,
    timestamp: Date.now()
  });
};

// Route guards and analytics
router.afterEach((to) => {
  const routeTitle = getPageTitle(to.name);
  
  // Update document title
  updateDocumentTitle(routeTitle);
  
  // Track page view with analytics service
  setTimeout(() => {
    trackPageView(to.fullPath, routeTitle);
  }, ANALYTICS_DELAY);
});

// Error handling for route errors
router.onError((error, to, from) => {
  console.error('Router error:', error);
  
  // Log navigation context for debugging
  console.error('Navigation context:', {
    to: to?.path,
    from: from?.path,
    error: error.message
  });
});

export default router;
