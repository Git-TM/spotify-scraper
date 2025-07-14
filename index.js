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

// ===================================
// POINT D'ENTRÉE PRINCIPAL
// ===================================

async function main() {
    console.log(`
🎵 SPOTIFY PLAYLIST MANAGER 🎵

Actions disponibles:
- sync    → Synchroniser toutes les playlists
- list    → Afficher les playlists avec statut
- extract → Extraire les playlists marquées
    `);

    const action = process.argv[2] || 'sync';
    
    switch(action) {
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
            console.log('📖 Usage: node index.js [sync|list|extract]');
    }
}

// Exporter les fonctions pour utilisation en module
module.exports = {
    manager,
    syncPlaylists,
    extractPlaylists,
    listPlaylists
};

// Exécuter si lancé directement
if (require.main === module) {
    main().catch(console.error);
} 