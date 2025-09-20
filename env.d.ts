/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

// Cloudflare Web Analytics types
declare global {
  interface Window {
    __cfBeacon?: {
      load: (type: 'page' | 'event', data: any) => void;
      [key: string]: any;
    };
  }
}

export {};