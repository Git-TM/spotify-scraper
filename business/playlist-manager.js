const fs = require('fs');
const path = require('path');
const SpotifyAuth = require('../scrapper/authentication');
const SpotifyPlaylists = require('../scrapper/playlists');

class PlaylistManager {
    constructor(clientId, clientSecret) {
        this.auth = new SpotifyAuth(clientId, clientSecret);
        this.playlistsApi = new SpotifyPlaylists(this.auth);
        this.metadataFile = 'data/playlists.json';
    }

    /**
     * Initialiser l'authentification
     */
    async initialize() {
        console.log('🚀 Initialisation...');
        
        // Essayer de charger un état d'authentification existant
        const authLoaded = this.auth.loadAuthState();
        
        if (authLoaded && this.auth.isTokenValid()) {
            console.log('✅ Authentification existante valide');
        } else {
            console.log('🔐 Authentification requise...');
            await this.auth.authenticate();
            this.auth.saveAuthState();
        }
    }

    /**
     * FONCTION BUSINESS 1: Synchroniser les playlists
     * Récupère toutes les playlists et les sauvegarde avec payload minimal
     */
    async syncPlaylists() {
        await this.initialize();
        
        console.log('📋 Synchronisation des playlists...');
        
        // Récupérer toutes les playlists depuis l'API
        const apiPlaylists = await this.playlistsApi.getAllPlaylists();
        
        // Charger les métadonnées existantes
        const existingMetadata = this.loadExistingMetadata();
        const existingMap = new Map(existingMetadata.map(p => [p.id, p]));
        
        console.log(`📊 Existantes: ${existingMetadata.length}, Découvertes: ${apiPlaylists.length}`);

        // Créer les métadonnées synchronisées avec payload minimale
        const syncedMetadata = apiPlaylists.map(playlist => {
            const existing = existingMap.get(playlist.id);
            
            return {
                id: playlist.id,
                name: playlist.name,
                tracks_total: playlist.tracks.total,
                // Garder les flags existants ou mettre false par défaut
                to_extract: existing?.to_extract || false
            };
        });

        // Compter les nouvelles playlists
        const newCount = syncedMetadata.filter(p => !existingMap.has(p.id)).length;
        if (newCount > 0) {
            console.log(`✨ ${newCount} nouvelles playlists découvertes`);
        }

        // Sauvegarder les métadonnées synchronisées
        this.saveMetadata(syncedMetadata);
        
        console.log(`✅ Synchronisation terminée - ${syncedMetadata.length} playlists`);
        return syncedMetadata;
    }

    /**
     * FONCTION BUSINESS 2: Extraire les playlists marquées
     * Extrait toutes les playlists avec to_extract: true et crée des CSV timestampés
     */
    async extractMarkedPlaylists() {
        await this.initialize();
        
        console.log('🎯 Extraction des playlists marquées...');
        
        // Charger les métadonnées
        const metadata = this.loadExistingMetadata();
        const toExtract = metadata.filter(p => p.to_extract);
        
        if (toExtract.length === 0) {
            console.log('ℹ️ Aucune playlist marquée pour extraction');
            console.log('💡 Modifiez le fichier data/playlists.json pour marquer des playlists (to_extract: true)');
            return [];
        }

        console.log(`🎵 ${toExtract.length} playlists à extraire:`);
        toExtract.forEach(p => console.log(`  - ${p.name} (${p.tracks_total} musiques)`));

        // Créer le timestamp
        const timestamp = this.generateTimestamp();
        
        // Créer le dossier de destination
        const outputDir = 'data/extractions';
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }

        const extractedFiles = [];

        // Extraire chaque playlist
        for (const playlistMeta of toExtract) {
            try {
                console.log(`\n🎵 Extraction de "${playlistMeta.name}"...`);
                
                // Récupérer les tracks via l'API
                const tracks = await this.playlistsApi.getPlaylistTracks(playlistMeta.id, playlistMeta.name);
                
                // Créer le nom de fichier
                const safePlaylistName = this.sanitizeFilename(playlistMeta.name);
                const filename = `${timestamp}_${safePlaylistName}.csv`;
                const filepath = path.join(outputDir, filename);
                
                // Sauvegarder en CSV
                this.saveTracksToCSV(tracks, playlistMeta, filepath);
                
                extractedFiles.push({
                    playlist: playlistMeta.name,
                    filename: filename,
                    tracks_count: tracks.length
                });
                
                console.log(`✅ "${playlistMeta.name}": ${tracks.length} musiques → ${filename}`);
                
            } catch (error) {
                console.error(`❌ Erreur pour "${playlistMeta.name}": ${error.message}`);
            }
        }

        console.log(`\n🎉 Extraction terminée - ${extractedFiles.length} fichiers créés dans ${outputDir}/`);
        return extractedFiles;
    }

    /**
     * FONCTION BUSINESS 3: Lister les playlists avec statut
     * Affiche toutes les playlists avec leur statut d'extraction
     */
    listPlaylists() {
        const metadata = this.loadExistingMetadata();
        
        if (metadata.length === 0) {
            console.log('📋 Aucune playlist trouvée. Exécutez syncPlaylists() d\'abord.');
            return [];
        }
        
        console.log(`\n📋 Vos playlists (${metadata.length} total):`);
        console.log('='.repeat(60));
        
        const toExtract = metadata.filter(p => p.to_extract);
        console.log(`🎯 À extraire: ${toExtract.length}`);
        console.log('');

        metadata.forEach((playlist, index) => {
            const status = playlist.to_extract ? '🎯' : '⚪';
            console.log(`${status} ${(index + 1).toString().padStart(3)}. ${playlist.name} (${playlist.tracks_total} musiques)`);
        });

        console.log('\n💡 Pour marquer/démarquer des playlists, modifiez "to_extract" dans data/playlists.json');
        return metadata;
    }

    // =====================================
    // FONCTIONS UTILITAIRES INTERNES
    // =====================================

    /**
     * Charger les métadonnées existantes
     */
    loadExistingMetadata() {
        try {
            if (fs.existsSync(this.metadataFile)) {
                const content = fs.readFileSync(this.metadataFile, 'utf8');
                return JSON.parse(content);
            }
        } catch (error) {
            console.log('⚠️ Erreur lors du chargement des métadonnées:', error.message);
        }
        return [];
    }

    /**
     * Sauvegarder les métadonnées
     */
    saveMetadata(metadata) {
        // Créer le dossier si nécessaire
        const dir = path.dirname(this.metadataFile);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        fs.writeFileSync(this.metadataFile, JSON.stringify(metadata, null, 2));
        console.log(`💾 Métadonnées sauvegardées dans ${this.metadataFile}`);
    }

    /**
     * Sauvegarder les tracks en CSV
     */
    saveTracksToCSV(tracks, playlistInfo, filepath) {
        // En-têtes CSV
        const headers = [
            'Position',
            'Titre',
            'Artistes',
            'Album',
            'Date de sortie',
            'Durée',
            'Popularité',
            'Explicite',
            'URL Spotify',
            'ID Spotify'
        ];

        // Convertir les tracks en lignes CSV
        const csvRows = [
            headers.join(','),
            ...tracks.map(track => [
                track.position,
                `"${track.name.replace(/"/g, '""')}"`, // Échapper les guillemets
                `"${track.artists.replace(/"/g, '""')}"`,
                `"${track.album.replace(/"/g, '""')}"`,
                track.release_date,
                track.duration_formatted,
                track.popularity,
                track.explicit ? 'Oui' : 'Non',
                track.external_urls,
                track.spotify_id
            ].join(','))
        ];

        // Ajouter un en-tête avec les infos de la playlist
        const csvContent = [
            `# Playlist: ${playlistInfo.name}`,
            `# Total: ${tracks.length} musiques`,
            `# Exporté le: ${new Date().toLocaleDateString('fr-FR')}`,
            '',
            ...csvRows
        ].join('\n');

        fs.writeFileSync(filepath, csvContent, 'utf8');
    }

    /**
     * Générer un timestamp au format YYYYMMDD
     */
    generateTimestamp() {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        return `${year}${month}${day}`;
    }

    /**
     * Nettoyer le nom de fichier
     */
    sanitizeFilename(filename) {
        return filename
            .toLowerCase()
            .replace(/[^a-z0-9\s]/g, '') // Supprimer caractères spéciaux
            .replace(/\s+/g, '_') // Remplacer espaces par underscore
            .substring(0, 50); // Limiter la longueur
    }
}

module.exports = PlaylistManager; 