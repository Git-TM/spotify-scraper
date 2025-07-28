require('dotenv').config();
const PlaylistManager = require('./business/playlist-manager');

// Configuration depuis les variables d'environnement
const CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;

if (!CLIENT_ID || !CLIENT_SECRET) {
    console.error('❌ Variables d\'environnement manquantes:');
    console.error('Créez un fichier .env avec SPOTIFY_CLIENT_ID et SPOTIFY_CLIENT_SECRET');
    process.exit(1);
}

// Créer l'instance du manager
const manager = new PlaylistManager(CLIENT_ID, CLIENT_SECRET);

// ===================================
// FONCTIONS BUSINESS ESSENTIELLES
// ===================================

async function syncPlaylists() {
    console.log('🔄 === SYNCHRONISATION DES PLAYLISTS ===');
    return await manager.syncPlaylists();
}

async function extractPlaylists() {
    console.log('🎯 === EXTRACTION DES PLAYLISTS MARQUÉES ===');
    return await manager.extractMarkedPlaylists();
}

function listPlaylists() {
    console.log('📋 === LISTE DES PLAYLISTS ===');
    return manager.listPlaylists();
}

async function extractPlaylistById(playlistId) {
    console.log('🎯 === EXTRACTION PAR ID ===');
    return await manager.extractPlaylistById(playlistId);
}

// ===================================
// POINT D'ENTRÉE PRINCIPAL
// ===================================

async function main() {
    const arg1 = process.argv[2];
    
    // Si pas d'argument ou argument classique
    if (!arg1) {
        console.log(`
🎵 SPOTIFY PLAYLIST MANAGER 🎵

Usage simple:
  node index.js sync                    → Synchroniser
  node index.js list                    → Lister avec IDs  
  node index.js extract                 → Extraire marquées
  node index.js [PLAYLIST_ID]           → Extraire par ID

Exemple:
  node index.js 5hAQMFDL6ozHE1cXdt8ycJ
        `);
        return;
    }
    
    // Si c'est un ID de playlist (chaîne longue)
    if (arg1.length > 10 && !['sync', 'list', 'extract'].includes(arg1)) {
        await extractPlaylistById(arg1);
        return;
    }
    
    // Actions standard
    switch(arg1) {
        case 'sync':
            await syncPlaylists();
            break;
        case 'list':
            listPlaylists();
            break;
        case 'extract':
            await extractPlaylists();
            break;
        default:
            console.log('❌ Action non reconnue');
            console.log('📖 Usage: node index.js [sync|list|extract|PLAYLIST_ID]');
    }
}

// Exporter les fonctions pour utilisation en module
module.exports = {
    manager,
    syncPlaylists,
    extractPlaylists,
    listPlaylists,
    extractPlaylistById
};

// Exécuter si lancé directement
if (require.main === module) {
    main().catch(console.error);
} 