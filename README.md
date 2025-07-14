# Spotify Playlist Manager

Un système simple et organisé pour extraire vos playlists Spotify de façon sélective.

## 📁 Structure (propre et simple)

```
├── scrapper/
│   ├── authentication.js     # 🔐 Logique technique OAuth
│   └── playlists.js          # 🎵 Logique technique API Spotify  
├── business/
│   └── playlist-manager.js   # 🧠 Logique métier (3 fonctions essentielles)
├── index.js                  # 🚀 Point d'entrée principal
└── data/
    ├── playlists.json        # 📋 Métadonnées minimales
    └── extractions/          # 📂 Fichiers CSV exportés
```

## ⚡ Installation & Config

```bash
npm install
```

Créez un fichier `.env` :
```
SPOTIFY_CLIENT_ID=your_client_id
SPOTIFY_CLIENT_SECRET=your_client_secret
```

## 🎯 3 Fonctions Business Essentielles

| Commande | Fonction | Description |
|----------|----------|-------------|
| `npm run sync` | `syncPlaylists()` | Synchroniser toutes les playlists |
| `npm run list` | `listPlaylists()` | Afficher avec statuts (🎯 = à extraire) |
| `npm run extract` | `extractMarkedPlaylists()` | Extraire en CSV avec timestamp |

## 🔄 Workflow Simple

1. **Synchroniser** : `npm run sync` - Découvrir toutes vos playlists
2. **Marquer** : Éditer `data/playlists.json` - Changer `to_extract: true`
3. **Extraire** : `npm run extract` - Créer les CSV timestampés

## 💻 Utilisation en Code

```javascript
const { manager } = require('./index');

// 1. Synchroniser vos playlists
await manager.syncPlaylists();

// 2. Voir la liste avec statuts
manager.listPlaylists(); 

// 3. Extraire les marquées 
await manager.extractMarkedPlaylists();
```
