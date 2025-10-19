# Intégration AlertService + Cloudflare

## Configuration AlertService avec Cloudflare

### 1. Configuration de base (locale uniquement)

```typescript
import { alertService } from '@/services/alertService';

// Utilisation normale - notifications locales uniquement
const alert = await alertService.saveAlert({
  domain: 'example.com',
  alertDate: new Date('2025-12-01'),
  reminderFrequency: 'weekly',
  expirationDate: new Date('2025-12-31')
});
```

### 2. Configuration avec Cloudflare (recommandée)

```typescript
import { createAlertServiceWithCloudflare } from '@/services/alertService';

// Configuration Cloudflare
const alertService = createAlertServiceWithCloudflare({
  enableCloudflareNotifications: true,
  cloudflareWorkerUrl: 'https://notifications.your-domain.workers.dev',
  vapidPublicKey: 'YOUR_VAPID_PUBLIC_KEY'
});

// Utilisation identique - notifications locales + Cloudflare
const alert = await alertService.saveAlert({
  domain: 'example.com',
  alertDate: new Date('2025-12-01'),
  reminderFrequency: 'weekly',
  expirationDate: new Date('2025-12-31')
});
```

## Vérification du support

```typescript
const support = await alertService.checkNotificationSupport();

console.log('Support notifications:', {
  apiSupported: support.supported,
  permission: support.permission,
  serviceWorker: support.serviceWorkerAvailable,
  cloudflare: support.cloudflareNotificationsSupported
});
```

## Flux de données complet

### Création d'alerte

```
1. saveAlert() appelé
2. Validation des données
3. Sauvegarde IndexedDB ✅
4. Synchronisation Service Worker ✅
5. Programmation notification Cloudflare ✅
6. Retour AlertSettings
```

### Suppression d'alerte

```
1. removeAlert() appelé
2. Suppression IndexedDB ✅
3. Nettoyage cache local ✅
4. Synchronisation Service Worker ✅
5. Annulation notification Cloudflare ✅
```

## Gestion d'erreurs

L'AlertService utilise une approche **graceful degradation** :

- ❌ **Cloudflare indisponible** → Continue avec notifications locales
- ❌ **Service Worker manquant** → Continue sans notifications background
- ❌ **IndexedDB échoue** → Lève une `AlertServiceError`

```typescript
try {
  const alert = await alertService.saveAlert(alertData);
  // ✅ Succès garanti côté local
  // ⚠️ Cloudflare peut échouer silencieusement
} catch (error) {
  if (error instanceof AlertServiceError) {
    console.error('Erreur critique:', error.code, error.message);
  }
}
```

## Migration progressive

### Étape 1: Garder l'existant
```typescript
import { alertService } from '@/services/alertService';
// Code existant fonctionne sans changement
```

### Étape 2: Tester Cloudflare en parallèle
```typescript
import { createAlertServiceWithCloudflare } from '@/services/alertService';

const cloudflareService = createAlertServiceWithCloudflare({
  enableCloudflareNotifications: true,
  // ... config
});

// Test sur quelques domaines
```

### Étape 3: Migration complète
```typescript
// Remplacer l'import par défaut
import { createAlertServiceWithCloudflare as createAlertService } from '@/services/alertService';

const alertService = createAlertService({
  enableCloudflareNotifications: true,
  cloudflareWorkerUrl: process.env.VITE_CLOUDFLARE_WORKER_URL,
  vapidPublicKey: process.env.VITE_VAPID_PUBLIC_KEY
});
```

## Variables d'environnement

```bash
# .env
VITE_CLOUDFLARE_WORKER_URL=https://notifications.your-domain.workers.dev
VITE_VAPID_PUBLIC_KEY=BL8...your-key
```

## Avantages de cette intégration

✅ **Backward compatible** - Code existant fonctionne sans modification
✅ **Progressive enhancement** - Cloudflare s'ajoute sans casser l'existant  
✅ **Fallback gracieux** - Toujours fonctionnel même si Cloudflare échoue
✅ **Type-safe** - Même API, même types TypeScript
✅ **Cross-platform** - iOS Safari + Android + Desktop