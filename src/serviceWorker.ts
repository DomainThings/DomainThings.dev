/// <reference lib="webworker" />
declare let self: ServiceWorkerGlobalScope

import { clientsClaim } from 'workbox-core';
import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching'

// precache public assets
const swManifest = self.__WB_MANIFEST;
precacheAndRoute(swManifest);

// clean old assets
cleanupOutdatedCaches();

// do not wait page refresh or change to update service worker
self.skipWaiting();
clientsClaim();

if (import.meta.env.DEV) {
  console.log('[DomainChecker] Hello from service worker !')
}