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

        return await this.extractPlaylists(toExtract);
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

    /**
     * FONCTION BUSINESS 4: Extraire des playlists spécifiques
     * Permet de ré-extraire certaines playlists par nom (partiel)
     * @param {Array<string>} playlistNames - Noms (partiels) des playlists à extraire
     */
    async extractSpecificPlaylists(playlistNames) {
        await this.initialize();
        
        console.log('🎯 Extraction de playlists spécifiques...');
        
        // Charger les métadonnées
        const metadata = this.loadExistingMetadata();
        const toExtract = metadata.filter(playlist => 
            playlistNames.some(name => 
                playlist.name.toLowerCase().includes(name.toLowerCase())
            )
        );
        
        if (toExtract.length === 0) {
            console.log('❌ Aucune playlist trouvée avec ces noms:');
            playlistNames.forEach(name => console.log(`  - "${name}"`));
            console.log('\n📋 Playlists disponibles:');
            metadata.forEach(p => console.log(`  - ${p.name}`));
            return [];
        }

        console.log(`🎵 ${toExtract.length} playlists trouvées:`);
        toExtract.forEach(p => console.log(`  - ${p.name} (${p.tracks_total} musiques)`));

        return await this.extractPlaylists(toExtract);
    }

    /**
     * FONCTION BUSINESS 4: Extraire une playlist par ID
     * Méthode simple : passer l'ID et ça extrait
     * @param {string} playlistId - ID de la playlist à extraire
     */
    async extractPlaylistById(playlistId) {
        await this.initialize();
        
        console.log(`🎯 Extraction de la playlist ID: ${playlistId}`);
        
        // Charger les métadonnées pour récupérer le nom
        const metadata = this.loadExistingMetadata();
        const playlist = metadata.find(p => p.id === playlistId);
        
        if (!playlist) {
            console.log(`❌ Playlist avec ID "${playlistId}" non trouvée`);
            console.log('💡 Exécutez listPlaylists() pour voir les IDs disponibles');
            return null;
        }

        console.log(`🎵 Extraction de "${playlist.name}"...`);

        try {
            // Récupérer les tracks via l'API
            const tracks = await this.playlistsApi.getPlaylistTracks(playlistId, playlist.name);
            
            // Créer le timestamp et nom de fichier
            const timestamp = this.generateTimestamp();
            const safePlaylistName = this.sanitizeFilename(playlist.name);
            const filename = `${timestamp}_${safePlaylistName}.csv`;
            
            // Créer le dossier de destination
            const outputDir = 'data/extractions';
            if (!fs.existsSync(outputDir)) {
                fs.mkdirSync(outputDir, { recursive: true });
            }
            
            const filepath = path.join(outputDir, filename);
            
            // Sauvegarder en CSV
            this.saveTracksToCSV(tracks, playlist, filepath);
            
            console.log(`✅ "${playlist.name}": ${tracks.length} musiques → ${filename}`);
            
            return {
                playlist: playlist.name,
                filename: filename,
                tracks_count: tracks.length,
                filepath: filepath
            };
            
        } catch (error) {
            console.error(`❌ Erreur pour "${playlist.name}": ${error.message}`);
            return null;
        }
    }

    // =====================================
    // FONCTIONS UTILITAIRES INTERNES
    // =====================================

    /**
     * Extraire une liste de playlists (utilisé par extractMarkedPlaylists et extractSpecificPlaylists)
     */
    async extractPlaylists(playlistsToExtract) {
        // Créer le timestamp
        const timestamp = this.generateTimestamp();
        
        // Créer le dossier de destination
        const outputDir = 'data/extractions';
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }

        const extractedFiles = [];

        // Extraire chaque playlist
        for (const playlistMeta of playlistsToExtract) {
            try {
                console.log(`\n🎵 Extraction de "${playlistMeta.name}"...`);
                
                // Récupérer les tracks via l'API
                const tracks = await this.playlistsApi.getPlaylistTracks(playlistMeta.id, playlistMeta.name);
                
                // Créer le nom de fichier
                const safePlaylistName = this.sanitizeFilename(playlistMeta.name);
                const filename = `${timestamp}_${safePlaylistName}.csv`;
                const filepath = path.join(outputDir, filename);
                
                // Sauvegarder en CSV avec formatage corrigé
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
     * Sauvegarder les tracks en CSV (version simple avec point-virgule)
     */
    saveTracksToCSV(tracks, playlistInfo, filepath) {
        // En-têtes CSV simples
        const headers = [
            'Position',
            'Titre',
            'Artistes',
            'Album',
            'Date_sortie',
            'Duree',
            'Popularite',
            'Explicite',
            'URL_Spotify',
            'ID_Spotify'
        ];

        // Fonction pour nettoyer simplement (enlever point-virgule pour éviter confusion)
        const cleanField = (field) => {
            if (field === null || field === undefined) {
                return '';
            }
            
            let stringField = String(field);
            
            // Nettoyer : enlever les point-virgules et caractères problématiques
            stringField = stringField.replace(/[;"\n\r]/g, ' ');
            
            // Nettoyer les caractères spéciaux mais garder plus de choses
            stringField = stringField.replace(/[^\w\s\-\.\:\/]/g, '');
            
            // Supprimer les espaces multiples
            stringField = stringField.replace(/\s+/g, ' ').trim();
            
            return stringField;
        };

        // Créer les lignes CSV avec point-virgule
        const csvLines = [];
        
        // Ligne d'en-têtes
        csvLines.push(headers.join(';'));
        
        // Lignes de données nettoyées
        tracks.forEach(track => {
            const row = [
                cleanField(track.position),
                cleanField(track.name),
                cleanField(track.artists),
                cleanField(track.album),
                cleanField(track.release_date),
                cleanField(track.duration_formatted),
                cleanField(track.popularity),
                cleanField(track.explicit ? 'Oui' : 'Non'),
                cleanField(track.external_urls),
                cleanField(track.spotify_id)
            ];
            csvLines.push(row.join(';'));
        });

        // Joindre toutes les lignes
        const csvContent = csvLines.join('\n');

        // Écrire le fichier simple
        fs.writeFileSync(filepath, csvContent, 'utf8');
        
        console.log(`📊 CSV généré avec ${tracks.length} lignes (délimiteur point-virgule, version simple)`);
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