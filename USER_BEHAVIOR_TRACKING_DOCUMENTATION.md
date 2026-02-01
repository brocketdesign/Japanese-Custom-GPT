# User Behavior Tracking Documentation

## Vue d'ensemble

Ce système de tracking permet de suivre les comportements utilisateur pour améliorer l'analyse et comprendre comment les utilisateurs interagissent avec la plateforme.

## Événements Trackés

### 1. Start Chat (Démarrage de conversation)
**Objectif** : Savoir où les utilisateurs cliquent pour démarrer une conversation.

**Collection MongoDB** : `user_behavior_tracking`

**Données collectées** :
- `userId` : ID de l'utilisateur
- `chatId` : ID du chat démarré
- `source` : Source du clic (voir sources ci-dessous)
- `sourceElementId` : ID de l'élément HTML cliqué
- `sourceElementClass` : Classes CSS de l'élément cliqué
- `pageUrl` : URL de la page
- `referrer` : Page de provenance
- `createdAt` : Date/heure de l'événement

### 2. Message Sent (Message envoyé)
**Objectif** : Compter le nombre de messages envoyés par utilisateur.

**Données collectées** :
- `userId` : ID de l'utilisateur
- `chatId` : ID du chat
- `messageType` : Type de message (text, image, etc.)
- `hasImage` : Si le message contient une image
- `createdAt` : Date/heure de l'événement

### 3. Premium View (Vue du modal premium)
**Objectif** : Savoir combien de fois le modal premium a été affiché.

**Données collectées** :
- `userId` : ID de l'utilisateur
- `source` : Source qui a déclenché le modal
- `triggerAction` : Action qui a causé l'affichage
- `pageUrl` : URL de la page
- `createdAt` : Date/heure de l'événement

### 4. User Location (Localisation utilisateur)
**Objectif** : Connaître la provenance géographique des utilisateurs.

**Collection MongoDB** : `user_locations`

**Données collectées** :
- `userId` : ID de l'utilisateur
- `ip` : Adresse IP
- `country` : Pays
- `countryCode` : Code pays (ex: FR, JP, US)
- `region` : Région/État
- `city` : Ville
- `latitude/longitude` : Coordonnées
- `timezone` : Fuseau horaire
- `isp` : Fournisseur d'accès internet
- `updatedAt` : Dernière mise à jour

---

## Sources de Chat Start

Les identifiants de sources pour le tracking "Start Chat" :

| Source ID | Description | Fichier Template |
|-----------|-------------|-----------------|
| `character_intro_modal` | Modal d'introduction du personnage | `views/partials/dashboard-modals.hbs` |
| `character_page` | Page de détail d'un personnage | `views/character.hbs`, `views/character_old.hbs` |
| `chat_list` | Liste des conversations | `views/chat-list.hbs` |
| `home_featured` | Personnages en vedette sur la page d'accueil | `views/home.hbs` |
| `home_carousel` | Carousel sur la page d'accueil | `views/home.hbs` |
| `explore_card` | Carte dans la page d'exploration | `views/explore.hbs`, `views/post.hbs` |
| `search_results` | Résultats de recherche | `views/search.hbs` |
| `recommendation` | Recommandations personnalisées | Divers |
| `cold_onboarding` | Processus d'onboarding | `views/cold-onboarding.hbs` |
| `payment_success` | Après un paiement réussi | `views/payment-success.hbs` |
| `direct_url` | Accès direct via URL | N/A |
| `unknown` | Source non identifiée | N/A |

---

## Sources de Premium View

Les identifiants de sources pour le tracking "Premium View" :

| Source ID | Description | Fichier(s) |
|-----------|-------------|------------|
| `chat_tool_settings` | Paramètres d'outils du chat | `public/js/chat-tool-settings.js` |
| `image_generation` | Génération d'images | `public/js/admin-image-test.js` |
| `dashboard_generation` | Dashboard de génération | `public/js/dashboard-generation.js` |
| `settings_page` | Page de paramètres | `views/settings.hbs` |
| `character_creation` | Création de personnage | `views/character-creation.hbs` |
| `creator_application` | Application créateur | `views/creator-application.hbs` |
| `affiliation_dashboard` | Dashboard d'affiliation | `views/affiliation.hbs` |
| `civitai_search` | Recherche Civitai | `public/js/civitai-model-search.js` |
| `websocket_trigger` | Déclenché via WebSocket | `public/js/websocket.js` |
| `menu_upgrade` | Menu de mise à niveau | `views/partials/dashboard-avatar.hbs` |
| `unknown` | Source non identifiée | N/A |

---

## Classes CSS de Tracking

### Classes pour les boutons "Start Chat"

```css
/* Tracking automatique - ajoutez ces classes aux éléments */

.track-chat-start-character-intro    /* Modal d'introduction */
.track-chat-start-character-page     /* Page personnage */
.track-chat-start-chat-list          /* Liste des chats */
.track-chat-start-home-featured      /* Page d'accueil featured */
.track-chat-start-home-carousel      /* Carousel accueil */
.track-chat-start-explore-card       /* Carte exploration */
.track-chat-start-search-results     /* Résultats recherche */
.track-chat-start-recommendation     /* Recommandations */
.track-chat-start-cold-onboarding    /* Onboarding */
.track-chat-start-payment-success    /* Succès paiement */
```

### Attribut data-tracking-source

Vous pouvez aussi utiliser l'attribut `data-tracking-source` :

```html
<a href="/chat/123" 
   class="btn btn-primary" 
   data-tracking-source="character_page"
   data-chat-id="123">
   Start Chat
</a>
```

---

## Fichiers Créés/Modifiés

### Nouveaux Fichiers

| Fichier | Description |
|---------|-------------|
| `models/user-behavior-tracking-utils.js` | Utilitaires backend pour le tracking |
| `routes/tracking.js` | Routes API pour le tracking |
| `public/js/user-tracking.js` | Script client pour le tracking |

### Fichiers Modifiés

| Fichier | Modification |
|---------|--------------|
| `plugins/routes.js` | Ajout de la route tracking |
| `public/js/dashboard.js` | Ajout tracking à `loadPlanPage()` |
| `views/partials/dashboard-footer.hbs` | Inclusion du script `user-tracking.js` |
| `views/partials/dashboard-modals.hbs` | Classes de tracking sur les boutons |
| `views/character.hbs` | Classes de tracking sur les boutons |
| `views/character_old.hbs` | Classes de tracking sur les boutons |
| `views/post.hbs` | Classes de tracking sur les boutons |
| `views/admin/users-analytics.hbs` | Nouvelles sections pour les métriques |
| `public/js/admin/user-analytics.js` | Graphiques pour les nouvelles données |

---

## API Endpoints

### Endpoints Publics (authentification requise)

```
POST /api/tracking/start-chat
Body: { chatId, source, sourceElementId, sourceElementClass, pageUrl, referrer }

POST /api/tracking/message-sent
Body: { chatId, messageType, hasImage }

POST /api/tracking/premium-view
Body: { source, triggerAction, pageUrl }

POST /api/tracking/location
(Sauvegarde la location basée sur l'IP)

GET /api/tracking/location
(Récupère la location de l'utilisateur)

GET /api/tracking/my-stats
(Statistiques de tracking de l'utilisateur connecté)

GET /api/tracking/sources
(Liste des sources disponibles)
```

### Endpoints Admin (authentification admin requise)

```
GET /api/tracking/admin/user/:userId
(Statistiques d'un utilisateur spécifique)

GET /api/tracking/admin/stats
Query: { startDate?, endDate? }
(Statistiques agrégées)

GET /api/tracking/admin/trends
Query: { days? } (défaut: 7)
(Tendances quotidiennes)
```

---

## Collections MongoDB

### user_behavior_tracking

```javascript
{
  _id: ObjectId,
  userId: ObjectId,
  eventType: String,  // 'start_chat', 'message_sent', 'premium_view'
  chatId: ObjectId,   // Pour start_chat et message_sent
  metadata: {
    source: String,
    sourceElementId: String,
    sourceElementClass: String,
    pageUrl: String,
    referrer: String,
    triggerAction: String,
    messageType: String,
    hasImage: Boolean,
    // ... autres champs contextuels
  },
  createdAt: Date
}

// Index
{ userId: 1 }
{ eventType: 1 }
{ createdAt: 1 }
{ userId: 1, eventType: 1 }
{ 'metadata.source': 1 }
```

### user_locations

```javascript
{
  _id: ObjectId,
  userId: ObjectId,
  ip: String,
  country: String,
  countryCode: String,
  region: String,
  city: String,
  latitude: Number,
  longitude: Number,
  timezone: String,
  isp: String,
  isLocal: Boolean,
  lastIpAddress: String,
  createdAt: Date,
  updatedAt: Date
}

// Index (unique sur userId)
{ userId: 1 } (unique)
{ country: 1 }
{ city: 1 }
{ updatedAt: 1 }
```

---

## Utilisation JavaScript Côté Client

### Initialisation automatique

Le script `user-tracking.js` s'initialise automatiquement si l'utilisateur est connecté.

```javascript
// Le tracking est initialisé automatiquement au chargement de la page
// pour les utilisateurs connectés (non temporaires)
```

### Utilisation manuelle

```javascript
// Track start chat
await UserTracking.trackStartChat(chatId, 'character_page', {
  sourceElementId: 'myButton',
  sourceElementClass: 'btn btn-primary'
});

// Track message sent
await UserTracking.trackMessageSent(chatId, {
  messageType: 'text',
  hasImage: false
});

// Track premium view
await UserTracking.trackPremiumView('settings_page', {
  triggerAction: 'upgrade_button_click'
});

// Save location (fait automatiquement une fois par session)
await UserTracking.saveLocation();

// Get my stats
const stats = await UserTracking.getMyStats();
console.log(stats);
// { startChatCount, messageSentCount, premiumViewCount, ... }
```

### Debug Mode

```javascript
// Activer les logs de debug
UserTracking.setDebug(true);
```

---

## Dashboard Admin Analytics

La page `/admin/users/analytics` affiche maintenant :

### Nouvelles Métriques de Comportement

1. **Chat Sessions Started**
   - Total des sessions de chat initiées
   - Nombre d'utilisateurs uniques

2. **Messages Sent (Tracked)**
   - Total des messages trackés
   - Nombre d'utilisateurs uniques

3. **Premium Modal Views**
   - Nombre de fois que le modal premium a été affiché
   - Nombre d'utilisateurs uniques

### Nouveaux Graphiques

1. **User Locations (by Country)**
   - Diagramme en barres horizontales
   - Top 10 des pays

2. **Chat Start Sources**
   - Diagramme en donut
   - Distribution des sources de démarrage de chat

3. **Behavior Trends (7 Days)**
   - Graphique en ligne
   - Tendances quotidiennes : Chat Sessions, Messages Sent, Premium Views

---

## Service de Géolocalisation IP

Le système utilise [ip-api.com](http://ip-api.com) (gratuit, 45 requêtes/minute) pour la géolocalisation.

**Limitations** :
- 45 requêtes par minute
- Pas de HTTPS sur le plan gratuit (utilise HTTP)
- Précision variable selon les FAI

**Adresses IP locales** :
- `127.0.0.1`, `::1`, `192.168.x.x`, `10.x.x.x` sont détectées comme "Local"

---

## Ajouter un nouveau point de tracking

### 1. Ajouter une classe CSS

```html
<!-- Dans votre template -->
<a href="/chat/{{chatId}}" 
   class="btn btn-primary track-chat-start-ma-nouvelle-source"
   data-tracking-source="ma_nouvelle_source"
   data-chat-id="{{chatId}}">
   Démarrer le chat
</a>
```

### 2. Ajouter la source dans le backend

Modifiez `models/user-behavior-tracking-utils.js` :

```javascript
const ChatStartSources = {
  // ... sources existantes
  MA_NOUVELLE_SOURCE: 'ma_nouvelle_source'
};
```

### 3. Ajouter la détection côté client

Modifiez `public/js/user-tracking.js` dans `detectChatStartSource()` :

```javascript
// Ma nouvelle source
if (classList.contains('track-chat-start-ma-nouvelle-source') ||
    element.closest('.mon-conteneur-specifique')) {
  return ChatStartSources.MA_NOUVELLE_SOURCE;
}
```

---

## Bonnes Pratiques

1. **Toujours inclure l'attribut `data-chat-id`** sur les liens de chat pour un tracking précis

2. **Utiliser des sources spécifiques** plutôt que "unknown" quand possible

3. **Ne pas tracker les utilisateurs temporaires** (non connectés)

4. **Limiter les appels de tracking** pour éviter la surcharge :
   - Location : une fois par session
   - Message sent : un appel par message envoyé

5. **Vérifier les erreurs** dans la console pour détecter les problèmes de tracking

---

## Maintenance

### Nettoyage des données anciennes

Les données de tracking peuvent s'accumuler. Considérez d'ajouter un job cron pour archiver ou supprimer les anciennes données :

```javascript
// Exemple : supprimer les tracking de plus de 6 mois
db.collection('user_behavior_tracking').deleteMany({
  createdAt: { $lt: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000) }
});
```

### Monitoring

Surveillez :
- La taille de la collection `user_behavior_tracking`
- Les performances des index
- Les erreurs de géolocalisation (rate limiting)
