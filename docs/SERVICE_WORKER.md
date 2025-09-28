# Service Worker Development Setup

## 🔧 Architecture

This project uses an automated system to manage the Service Worker in development and production:

### 📁 **Files**

- `src/serviceWorker.ts` - Main Service Worker with Workbox (prod)
- `scripts/build-dev-sw.js` - Build script for development
- `public/dev-sw.js` - Automatically generated Service Worker (dev)

### ⚙️ **How it works**

#### **Development Mode (`npm run dev`)**
1. **Automatic build**: `npm run build:dev-sw` compiles `serviceWorker.ts`
2. **Mock Workbox**: Replaces Workbox dependencies with mocks
3. **Output**: Generates `public/dev-sw.js` (IIFE format, readable)
4. **Vite PWA**: Uses the generated Service Worker

#### **Production Mode (`npm run build`)**
- Vite PWA directly uses `src/serviceWorker.ts`
- Complete Workbox with precaching and optimizations

## 🚀 **Commands**

```bash
# Development (auto-build + server)
npm run dev

# Manual build of dev Service Worker
npm run build:dev-sw

# Production build
npm run build
```

## 🧪 **Testing notifications**

1. Open http://localhost:5174/
2. Go to Settings (⚙️)
3. Check the Service Worker status (should be green)
4. Click "Test" for a test notification
5. Configure alerts on expired domains

## 📋 **Logs to verify**

### Main console
```
🔧 Initializing Service Worker communications...
📋 Service Worker ready: ServiceWorkerRegistration {...}
✅ Service Worker was already active
```

### Console Service Worker (DevTools → Application → Service Workers → Inspect)
```
🚀 Development Service Worker loaded
📱 Workbox clientsClaim (mocked for dev)
📦 Workbox precacheAndRoute (mocked for dev): []
Service Worker registered and ready for notifications
Service Worker received message: {type: 'SHOW_NOTIFICATION', ...}
```

## 🔍 **Debugging**

If the Service Worker is not working:

1. **Check DevTools**: Application → Service Workers
2. **Console errors**: Compilation/import errors
3. **Rebuild**: `npm run build:dev-sw` then refresh
4. **Clear cache**: DevTools → Application → Storage → Clear storage

## 📝 **Modifications**

To modify notification behavior:
- **Edit** `src/serviceWorker.ts`
- **Restart** `npm run dev` (automatic rebuild)
- **Test** via Settings → Test

Changes are automatically taken into account! 🔄
