# Service Worker Development Setup

## 🔧 Architecture

Ce projet utilise un système automatisé pour gérer le Service Worker en développement et en production :

### 📁 **Fichiers**

- `src/serviceWorker.ts` - Service Worker principal avec Workbox (prod)
- `scripts/build-dev-sw.js` - Script de build pour le développement
- `public/dev-sw.js` - Service Worker généré automatiquement (dev)

### ⚙️ **Fonctionnement**

#### **Mode Développement (`npm run dev`)**
1. **Build automatique** : `npm run build:dev-sw` compile `serviceWorker.ts`
2. **Mock Workbox** : Remplace les dépendances Workbox par des mocks
3. **Output** : Génère `public/dev-sw.js` (format IIFE, lisible)
4. **Vite PWA** : Utilise le Service Worker généré

#### **Mode Production (`npm run build`)**
- Vite PWA utilise directement `src/serviceWorker.ts`
- Workbox complet avec precaching et optimisations

## 🚀 **Commandes**

```bash
# Développement (auto-build + serveur)
npm run dev

# Build manuel du Service Worker de dev
npm run build:dev-sw

# Build de production
npm run build
```

## 🧪 **Testing des notifications**

1. Ouvrir http://localhost:5174/
2. Aller dans Settings (⚙️)
3. Vérifier le statut du Service Worker (doit être vert)
4. Cliquer "Test" pour une notification d'essai
5. Configurer des alertes sur les domaines expirés

## 📋 **Logs à vérifier**

### Console principale
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

Si le Service Worker ne fonctionne pas :

1. **Vérifier les DevTools** : Application → Service Workers
2. **Console errors** : Erreurs de compilation/import
3. **Rebuild** : `npm run build:dev-sw` puis rafraîchir
4. **Clear cache** : DevTools → Application → Storage → Clear storage

## 📝 **Modifications**

Pour modifier le comportement des notifications :
- **Éditer** `src/serviceWorker.ts`
- **Relancer** `npm run dev` (rebuild automatique)
- **Tester** via Settings → Test

Les changements sont automatiquement pris en compte ! 🔄
