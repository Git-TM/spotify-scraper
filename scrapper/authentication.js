const express = require('express');
const axios = require('axios');
const qs = require('querystring');
const open = require('open');

class SpotifyAuth {
    constructor(clientId, clientSecret, redirectUri = 'http://localhost:8888/callback') {
        this.clientId = clientId;
        this.clientSecret = clientSecret;
        this.redirectUri = redirectUri;
        this.accessToken = null;
        this.refreshToken = null;
        this.tokenExpiry = null;
    }

    /**
     * Démarrer le processus d'authentification OAuth 2.0
     * @param {Array<string>} scopes - Les permissions demandées
     * @returns {Promise<void>}
     */
    async authenticate(scopes = ['playlist-read-private', 'playlist-read-collaborative']) {
        const authUrl = `https://accounts.spotify.com/authorize?${qs.stringify({
            response_type: 'code',
            client_id: this.clientId,
            scope: scopes.join(' '),
            redirect_uri: this.redirectUri,
            show_dialog: true
        })}`;

        console.log('🔐 Ouverture du navigateur pour l\'authentification...');
        console.log('URL d\'authentification:', authUrl);

        // Créer un serveur temporaire pour recevoir le callback
        return new Promise((resolve, reject) => {
            const app = express();
            const server = app.listen(8888, () => {
                console.log('🌐 Serveur callback démarré sur http://localhost:8888');
                open(authUrl);
            });

            // Timeout de 5 minutes pour éviter un serveur qui reste ouvert
            const timeout = setTimeout(() => {
                server.close();
                reject(new Error('Timeout: Authentification non terminée dans les 5 minutes'));
            }, 5 * 60 * 1000);

            app.get('/callback', async (req, res) => {
                clearTimeout(timeout);
                const { code, error } = req.query;

                if (error) {
                    res.send(`❌ Erreur d'authentification: ${error}`);
                    server.close();
                    reject(new Error(error));
                    return;
                }

                try {
                    await this.getAccessToken(code);
                    res.send(`✅ Authentification réussie! Vous pouvez fermer cette fenêtre.`);
                    server.close();
                    resolve();
                } catch (err) {
                    res.send(`❌ Erreur lors de l'obtention du token: ${err.message}`);
                    server.close();
                    reject(err);
                }
            });
        });
    }

    /**
     * Échanger le code d'autorisation contre un access token
     * @param {string} code - Le code reçu du callback
     * @returns {Promise<void>}
     */
    async getAccessToken(code) {
        const tokenUrl = 'https://accounts.spotify.com/api/token';
        const authString = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64');

        try {
            const response = await axios.post(tokenUrl, qs.stringify({
                grant_type: 'authorization_code',
                code: code,
                redirect_uri: this.redirectUri
            }), {
                headers: {
                    'Authorization': `Basic ${authString}`,
                    'Content-Type': 'application/x-www-form-urlencoded'
                }
            });

            this.accessToken = response.data.access_token;
            this.refreshToken = response.data.refresh_token;
            
            // Calculer l'expiration du token (expires_in est en secondes)
            this.tokenExpiry = new Date(Date.now() + (response.data.expires_in * 1000));
            
            console.log('✅ Tokens obtenus avec succès');
            console.log(`🕐 Token expire le: ${this.tokenExpiry.toLocaleString()}`);
        } catch (error) {
            throw new Error(`Erreur lors de l'obtention du token: ${error.response?.data?.error_description || error.message}`);
        }
    }

    /**
     * Rafraîchir le token d'accès
     * @returns {Promise<void>}
     */
    async refreshAccessToken() {
        if (!this.refreshToken) {
            throw new Error('Aucun refresh token disponible');
        }

        const tokenUrl = 'https://accounts.spotify.com/api/token';
        const authString = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64');

        try {
            const response = await axios.post(tokenUrl, qs.stringify({
                grant_type: 'refresh_token',
                refresh_token: this.refreshToken
            }), {
                headers: {
                    'Authorization': `Basic ${authString}`,
                    'Content-Type': 'application/x-www-form-urlencoded'
                }
            });

            this.accessToken = response.data.access_token;
            
            // Mettre à jour l'expiration
            this.tokenExpiry = new Date(Date.now() + (response.data.expires_in * 1000));
            
            console.log('✅ Token rafraîchi avec succès');
            console.log(`🕐 Nouveau token expire le: ${this.tokenExpiry.toLocaleString()}`);
        } catch (error) {
            throw new Error(`Erreur lors du rafraîchissement du token: ${error.response?.data?.error_description || error.message}`);
        }
    }

    /**
     * Vérifier si le token est valide
     * @returns {boolean}
     */
    isTokenValid() {
        if (!this.accessToken || !this.tokenExpiry) {
            return false;
        }
        
        // Vérifier si le token expire dans moins de 5 minutes (marge de sécurité)
        const fiveMinutesFromNow = new Date(Date.now() + (5 * 60 * 1000));
        return this.tokenExpiry > fiveMinutesFromNow;
    }

    /**
     * S'assurer que nous avons un token valide
     * @returns {Promise<void>}
     */
    async ensureValidToken() {
        if (!this.isTokenValid()) {
            if (this.refreshToken) {
                console.log('🔄 Token expiré, rafraîchissement automatique...');
                await this.refreshAccessToken();
            } else {
                throw new Error('Token expiré et aucun refresh token disponible. Ré-authentification requise.');
            }
        }
    }

    /**
     * Obtenir un token d'accès valide
     * @returns {Promise<string>}
     */
    async getValidAccessToken() {
        await this.ensureValidToken();
        return this.accessToken;
    }

    /**
     * Sauvegarder l'état de l'authentification dans un fichier
     * @param {string} filename - Nom du fichier
     */
    saveAuthState(filename = 'auth_state.json') {
        const fs = require('fs');
        const authState = {
            accessToken: this.accessToken,
            refreshToken: this.refreshToken,
            tokenExpiry: this.tokenExpiry?.toISOString(),
            clientId: this.clientId,
            redirectUri: this.redirectUri
        };
        
        fs.writeFileSync(filename, JSON.stringify(authState, null, 2));
        console.log(`💾 État d'authentification sauvegardé dans ${filename}`);
    }

    /**
     * Charger l'état de l'authentification depuis un fichier
     * @param {string} filename - Nom du fichier
     * @returns {boolean} - True si chargé avec succès
     */
    loadAuthState(filename = 'auth_state.json') {
        const fs = require('fs');
        
        try {
            if (!fs.existsSync(filename)) {
                return false;
            }

            const authState = JSON.parse(fs.readFileSync(filename, 'utf8'));
            
            this.accessToken = authState.accessToken;
            this.refreshToken = authState.refreshToken;
            this.tokenExpiry = authState.tokenExpiry ? new Date(authState.tokenExpiry) : null;
            
            if (this.isTokenValid()) {
                console.log('✅ État d\'authentification chargé avec succès');
                console.log(`🕐 Token valide jusqu'à: ${this.tokenExpiry.toLocaleString()}`);
                return true;
            } else {
                console.log('⚠️ Token chargé mais expiré, rafraîchissement nécessaire');
                return false;
            }
        } catch (error) {
            console.log('❌ Erreur lors du chargement de l\'état d\'authentification:', error.message);
            return false;
        }
    }
}

module.exports = SpotifyAuth; 