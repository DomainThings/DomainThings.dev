#!/usr/bin/env node

import { build } from 'esbuild';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Build the Service Worker for development
 * Compiles TypeScript to JavaScript without Workbox dependencies for dev mode
 */
async function buildDevServiceWorker() {
  const inputFile = join(__dirname, '../src/serviceWorker.ts');
  const outputFile = join(__dirname, '../public/dev-sw.js');

  console.log('🔨 Building development Service Worker...');
  console.log(`📁 Input: ${inputFile}`);
  console.log(`📁 Output: ${outputFile}`);

  try {
    await build({
      entryPoints: [inputFile],
      bundle: true,
      outfile: outputFile,
      format: 'iife', // IIFE format for Service Worker
      target: 'es2020',
      platform: 'browser', // Use 'browser' instead of 'webworker'
      define: {
        // Mock Workbox dependencies for dev mode
        'self.__WB_MANIFEST': '[]',
      },
      external: [
        // Exclude Workbox dependencies in dev mode
        'workbox-core',
        'workbox-precaching'
      ],
      banner: {
        js: `// Development Service Worker - Auto-generated from serviceWorker.ts
// This file is automatically rebuilt when running 'npm run dev'
console.log('🚀 Development Service Worker loaded');`
      },
      footer: {
        js: `console.log('✅ Development Service Worker ready');`
      },
      plugins: [
        {
          name: 'workbox-mock',
          setup(build) {
            // Mock workbox imports for development
            build.onResolve({ filter: /^workbox-/ }, args => {
              return { path: args.path, namespace: 'workbox-mock' };
            });
            
            build.onLoad({ filter: /.*/, namespace: 'workbox-mock' }, args => {
              if (args.path === 'workbox-core') {
                return {
                  contents: `
                    export const clientsClaim = () => {
                      console.log('📱 Workbox clientsClaim (mocked for dev)');
                    };
                  `,
                  loader: 'js'
                };
              }
              
              if (args.path === 'workbox-precaching') {
                return {
                  contents: `
                    export const precacheAndRoute = (manifest) => {
                      console.log('📦 Workbox precacheAndRoute (mocked for dev):', manifest);
                    };
                    export const cleanupOutdatedCaches = () => {
                      console.log('🧹 Workbox cleanupOutdatedCaches (mocked for dev)');
                    };
                  `,
                  loader: 'js'
                };
              }
              
              return { contents: '', loader: 'js' };
            });
          }
        }
      ],
      minify: false, // Keep readable for dev
      sourcemap: true,
    });

    console.log('✅ Development Service Worker built successfully!');
  } catch (error) {
    console.error('❌ Failed to build development Service Worker:', error);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  buildDevServiceWorker();
}

export { buildDevServiceWorker };
