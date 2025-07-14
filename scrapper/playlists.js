const axios = require('axios');

class SpotifyPlaylists {
    constructor(spotifyAuth) {
        this.auth = spotifyAuth;
        this.baseUrl = 'https://api.spotify.com/v1';
    }

    /**
     * Effectuer une requête API avec gestion automatique des erreurs et tokens
     * @param {string} url - URL de l'API
     * @param {Object} params - Paramètres de la requête
     * @returns {Promise<Object>}
     */
    async makeApiRequest(url, params = {}) {
        const accessToken = await this.auth.getValidAccessToken();

        try {
            const response = await axios.get(url, {
                headers: {
                    'Authorization': `Bearer ${accessToken}`
                },
                params: params
            });
            return response.data;
        } catch (error) {
            if (error.response?.status === 401) {
                // Forcer le rafraîchissement et réessayer
                console.log('🔄 Token invalide, rafraîchissement forcé...');
                await this.auth.refreshAccessToken();
                const newAccessToken = await this.auth.getValidAccessToken();
                
                const response = await axios.get(url, {
                    headers: {
                        'Authorization': `Bearer ${newAccessToken}`
                    },
                    params: params
                });
                return response.data;
            }
            throw error;
        }
    }

    /**
     * Récupérer toutes les playlists de l'utilisateur
     * @returns {Promise<Array>}
     */
    async getAllPlaylists() {
        console.log('📋 Récupération de vos playlists...');
        let allPlaylists = [];
        let url = `${this.baseUrl}/me/playlists`;
        let offset = 0;
        const limit = 50;

        while (url) {
            const data = await this.makeApiRequest(url, { limit, offset });
            allPlaylists = allPlaylists.concat(data.items);
            
            console.log(`📋 ${allPlaylists.length}/${data.total} playlists récupérées`);
            
            url = data.next;
            offset += limit;
        }

        return allPlaylists;
    }

    /**
     * Récupérer toutes les musiques d'une playlist
     * @param {string} playlistId - ID de la playlist
     * @param {string} playlistName - Nom de la playlist (pour les logs)
     * @returns {Promise<Array>}
     */
    async getPlaylistTracks(playlistId, playlistName = '') {
        console.log(`🎵 Récupération des musiques${playlistName ? ` de "${playlistName}"` : ''}...`);
        let allTracks = [];
        let url = `${this.baseUrl}/playlists/${playlistId}/tracks`;
        let offset = 0;
        const limit = 100;

        while (url) {
            const data = await this.makeApiRequest(url, { limit, offset });
            
            // Filtrer pour ne garder que les vraies tracks (pas les épisodes podcasts)
            const tracks = data.items
                .filter(item => item.track && item.track.type === 'track')
                .map((item, index) => ({
                    position: offset + index + 1,
                    name: item.track.name,
                    artists: item.track.artists.map(artist => artist.name).join(', '),
                    album: item.track.album.name,
                    release_date: item.track.album.release_date,
                    duration_ms: item.track.duration_ms,
                    duration_formatted: this.formatDuration(item.track.duration_ms),
                    popularity: item.track.popularity,
                    explicit: item.track.explicit,
                    external_urls: item.track.external_urls.spotify,
                    spotify_id: item.track.id,
                    added_at: item.added_at,
                    added_by: item.added_by?.id || 'unknown'
                }));
            
            allTracks = allTracks.concat(tracks);
            
            console.log(`🎵 ${allTracks.length} musiques récupérées${playlistName ? ` pour "${playlistName}"` : ''}`);
            
            url = data.next;
            offset += limit;

            // Petite pause pour éviter de surcharger l'API
            await new Promise(resolve => setTimeout(resolve, 100));
        }

        return allTracks;
    }

    /**
     * Formater la durée en mm:ss
     * @param {number} durationMs - Durée en millisecondes
     * @returns {string}
     */
    formatDuration(durationMs) {
        const minutes = Math.floor(durationMs / 60000);
        const seconds = Math.floor((durationMs % 60000) / 1000);
        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }
}

module.exports = SpotifyPlaylists; 