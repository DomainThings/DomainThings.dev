# Configuration Cloudflare Worker Notifications

## Architecture

```
PWA (Client) ←→ Cloudflare Worker ←→ Push Services (FCM/Mozilla/Apple)
     ↓                 ↓
 IndexedDB       Cloudflare KV
```

## Avantages de cette solution

### ✅ **Notifications Cross-Platform**
- **iOS Safari** : Push notifications natives via Worker
- **Android Chrome** : Notifications même app fermée
- **Desktop** : Fonctionne partout

### ✅ **Privacy-First**
- Données minimales stockées (domaine + dates uniquement)
- Pas de tracking utilisateur
- VAPID keys pour authentification sécurisée
- Auto-suppression après envoi

### ✅ **Économique**
- Cloudflare Workers : 100,000 requêtes/jour gratuit
- KV storage : 1GB gratuit
- Cron jobs : Inclus dans le plan gratuit

## Setup Instructions

### 1. Génération des clés VAPID

```bash
# Installer web-push
npm install -g web-push

# Générer les clés VAPID
web-push generate-vapid-keys
```

### 2. Configuration Cloudflare

```bash
# Créer le namespace KV
wrangler kv:namespace create "NOTIFICATIONS_KV"

# Configurer les secrets
wrangler secret put VAPID_PRIVATE_KEY
# Coller la clé privée générée

# Déployer le worker
wrangler deploy
```

### 3. Configuration PWA

```typescript
// Dans votre app Vue
import { createCloudflareNotificationService } from '@/services/cloudflareNotificationService';

const notificationService = createCloudflareNotificationService({
  workerUrl: 'https://domaincheck-notifications.your-username.workers.dev',
  vapidPublicKey: 'YOUR_VAPID_PUBLIC_KEY'
});

// Programmer une notification
await notificationService.scheduleNotification(
  'example.com',
  new Date('2024-12-01'), // Date d'alerte
  new Date('2024-12-15')  // Date d'expiration
);
```

### 4. Intégration dans AlertService

```typescript
// Modifier src/services/alertService.ts
import { createCloudflareNotificationService } from './cloudflareNotificationService';

export class AlertService {
  private cloudflareService = createCloudflareNotificationService();

  async createAlert(domain: string, alertDate: Date, expirationDate: Date) {
    // Sauvegarder localement (existant)
    const localResult = await this.saveToIndexedDB(/* ... */);
    
    // Programmer notification cloud (nouveau)
    if (this.cloudflareService.isPushNotificationSupported()) {
      await this.cloudflareService.scheduleNotification(
        domain, 
        alertDate, 
        expirationDate
      );
    }
    
    return localResult;
  }
}
```

## Flow complet

### 1. Utilisateur crée une alerte
```
PWA → AlertService → IndexedDB + Cloudflare Worker
```

### 2. Notification programmée
```
Cloudflare Cron (toutes les 6h) → KV Storage → Push Service → Device
```

### 3. Utilisateur reçoit notification
```
Notification Click → Ouvre PWA → Navigation vers domaine
```

## Migration progressive

Vous pouvez implémenter ceci **progressivement** :

1. **Phase 1** : Garder le Service Worker actuel
2. **Phase 2** : Ajouter le service Cloudflare en parallèle
3. **Phase 3** : Laisser l'utilisateur choisir (local vs cloud)
4. **Phase 4** : Optionnel - migration complète

## Coûts estimés

Pour **10,000 utilisateurs** avec **5 domaines chacun** :
- **50,000 notifications/mois** : Gratuit (sous la limite)
- **KV operations** : ~200,000/mois : Gratuit
- **Worker executions** : ~150,000/mois : Gratuit

→ **Coût total : 0€/mois** 🎉

Voulez-vous que je vous aide à implémenter cette solution ?