import { createRouter, createWebHashHistory, createWebHistory } from 'vue-router';
import SearchView from '@/views/SearchView.vue';
import WatchListView from '@/views/WatchListView.vue';
import ExtensionListView from '@/views/ExtensionListView.vue';
import Error404View from '@/views/Error404View.vue';
import analyticsService from '@/services/analyticsService';

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      name: 'Search',
      component: SearchView,
    },
    {
      path: '/:pathMatch(.*)',
      name: '404',
      component: Error404View
    },
    {
      path: '/watch',
      name: 'WatchList',
      component: WatchListView
    },
    {
      path: '/extensions',
      name: 'ExtensionList',
      component: ExtensionListView
    }
  ],
})

// Track page views on route changes for Cloudflare Web Analytics
router.afterEach((to) => {
  // Update document title based on route
  const routeTitle = getPageTitle(to.name as string);
  document.title = routeTitle;
  
  // Track the page view with analytics service
  setTimeout(() => {
    analyticsService.trackPageView({
      path: to.fullPath,
      title: routeTitle,
      timestamp: Date.now()
    });
  }, 100); // Small delay to ensure route transition is complete
})

// Helper function to get page titles
function getPageTitle(routeName: string): string {
  const titles: Record<string, string> = {
    'Search': 'Domain Check - Search Domains',
    'WatchList': 'Domain Check - Watch List',
    'ExtensionList': 'Domain Check - TLD Extensions',
    '404': 'Domain Check - Page Not Found'
  };
  return titles[routeName] || 'Domain Check';
}

export default router
