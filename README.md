# Spotify Playlist Manager

Extrait vos playlists Spotify en CSV.

## Installation

```bash
npm install
```

Créez `.env` :
```
SPOTIFY_CLIENT_ID=your_client_id
SPOTIFY_CLIENT_SECRET=your_client_secret
```

## Commandes

```bash
node index.js sync                          # Synchroniser les playlists
node index.js list                          # Lister les playlists
node index.js extract                       # Extraire les marquées
node index.js extract [PLAYLIST_ID]         # Extraire une playlist spécifique
```

## Workflow

1. `sync` → Récupère vos playlists dans `data/playlists.json`
2. Éditer `data/playlists.json` → Mettre `to_extract: true` 
3. `extract` → Crée les CSV dans `data/extractions/`