import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { VitePWA } from 'vite-plugin-pwa'
import tailwindcss from "@tailwindcss/vite"

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    VitePWA({
      // manifest.json in public folder
      manifest: false,
      registerType: 'autoUpdate',
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'serviceWorker.ts',
      devOptions: {
        enabled: true,
        type: 'classic' as const, // Classic mode for better development experience
        navigateFallback: undefined, // Disable for SPA routing compatibility
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}']
      },
      injectRegister: 'auto'
    }),
    tailwindcss()
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['vue', 'vue-router', 'pinia'],
          workbox: ['workbox-core', 'workbox-precaching']
        },
      },
    },
  },
})
