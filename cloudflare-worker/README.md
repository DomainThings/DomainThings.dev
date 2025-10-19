# Cloudflare Worker - Domain Check Notifications

## ⚠️ État actuel : Prototype fonctionnel

Cette implémentation est un **prototype fonctionnel** pour démontrer l'architecture. Pour la production, certains éléments nécessitent une implémentation complète.

### ✅ Fonctionnel
- ✅ API endpoints (`/api/notifications/schedule`, `/api/notifications/cancel`)
- ✅ Stockage KV des notifications
- ✅ Cron jobs périodiques
- ✅ Gestion des erreurs et CORS
- ✅ Types TypeScript complets

### ⚠️ À compléter pour la production

#### 1. **Web Push Protocol complet**
```javascript
// Actuel : notification vide (fonctionne mais générique)
body: null

// Production : payload chiffré AES-GCM
body: encryptedPayload
```

#### 2. **VAPID JWT Signing**
```javascript
// Actuel : headers simplifiés
'Authorization': `WebPush ${privateKey}`

// Production : JWT signé avec clé privée ECDSA
'Authorization': `vapid t=${signedJWT}, k=${publicKey}`
```

### 🚀 Déploiement rapide

```bash
# 1. Installer Wrangler
npm install -g wrangler

# 2. Authentification Cloudflare
wrangler login

# 3. Créer namespace KV
wrangler kv:namespace create "NOTIFICATIONS_KV"

# 4. Mettre à jour wrangler.toml avec l'ID du namespace

# 5. Générer clés VAPID
npm install -g web-push
web-push generate-vapid-keys

# 6. Configurer les secrets
wrangler secret put VAPID_PRIVATE_KEY
wrangler secret put VAPID_PUBLIC_KEY
wrangler secret put CONTACT_EMAIL

# 7. Déployer
wrangler deploy
```

### 📱 Test de fonctionnement

```javascript
// Test API depuis votre PWA
const response = await fetch('https://your-worker.your-subdomain.workers.dev/api/notifications/schedule', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    domain: 'example.com',
    alertDate: '2025-12-01T00:00:00Z',
    expirationDate: '2025-12-31T00:00:00Z',
    pushSubscription: subscription,
    userAgent: navigator.userAgent
  })
});
```

### 🔄 Migration vers production complète

1. **Ajouter une bibliothèque Web Push** (ex: `web-push` npm package)
2. **Implémenter le chiffrement AES-GCM** pour les payload
3. **Signer les JWT VAPID** correctement
4. **Tester sur tous les navigateurs** (Chrome, Firefox, Safari, Edge)

### 💡 Alternative rapide

Pour un déploiement immédiat, vous pouvez :
- Utiliser des **notifications génériques** (sans payload custom)
- Les navigateurs affichent le nom de votre app
- Ajouter les détails dans le **click handler** de l'app

Cette approche fonctionne parfaitement pour un MVP ! 🎯

### 📊 Limites Cloudflare (plan gratuit)

- **100,000 requêtes/jour** (largement suffisant)
- **1GB KV storage** (millions de notifications)
- **10ms CPU time** par requête (OK pour notre use case)

**Coût estimé : 0€/mois** pour la plupart des usages ! 💰