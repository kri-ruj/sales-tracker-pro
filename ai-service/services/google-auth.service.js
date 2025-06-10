const { google } = require('googleapis');
const { OAuth2Client } = require('google-auth-library');
const fs = require('fs').promises;
const path = require('path');
const http = require('http');
const url = require('url');
// Dynamic import for ESM module
let open;

/**
 * Google OAuth2 Authentication Service
 * Handles authentication for Gmail, Calendar, and other Google services
 */
class GoogleAuthService {
    constructor() {
        this.oauth2Client = null;
        this.TOKEN_PATH = path.join(__dirname, '../tokens/google-token.json');
        this.CREDENTIALS_PATH = process.env.GOOGLE_CREDENTIALS_PATH || 
                               path.join(__dirname, '../credentials/google-credentials.json');
        
        this.SCOPES = [
            'https://www.googleapis.com/auth/gmail.send',
            'https://www.googleapis.com/auth/gmail.readonly',
            'https://www.googleapis.com/auth/gmail.compose',
            'https://www.googleapis.com/auth/calendar',
            'https://www.googleapis.com/auth/calendar.events'
        ];
    }

    /**
     * Initialize OAuth2 client
     */
    async initialize() {
        try {
            // Check if we're using service account or OAuth2
            if (process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
                return this.initializeServiceAccount();
            }

            // Load client credentials
            const credentials = await this.loadCredentials();
            
            const { client_id, client_secret, redirect_uris } = credentials.installed || credentials.web;
            this.oauth2Client = new OAuth2Client(client_id, client_secret, redirect_uris[0]);

            // Try to load existing token
            try {
                const token = await fs.readFile(this.TOKEN_PATH, 'utf8');
                this.oauth2Client.setCredentials(JSON.parse(token));
                
                // Check if token is expired
                const tokenInfo = await this.oauth2Client.getTokenInfo(
                    this.oauth2Client.credentials.access_token
                );
                
                console.log('[GoogleAuth] Token loaded, expires in:', 
                    Math.round((tokenInfo.expiry_date - Date.now()) / 1000 / 60), 'minutes');
                
                return this.oauth2Client;
            } catch (error) {
                console.log('[GoogleAuth] No valid token found, need to authenticate');
                return this.authenticate();
            }
        } catch (error) {
            console.error('[GoogleAuth] Initialization failed:', error.message);
            throw error;
        }
    }

    /**
     * Initialize with service account (for server environments)
     */
    async initializeServiceAccount() {
        const auth = new google.auth.GoogleAuth({
            keyFile: process.env.GOOGLE_SERVICE_ACCOUNT_KEY,
            scopes: this.SCOPES,
        });
        
        this.oauth2Client = await auth.getClient();
        console.log('[GoogleAuth] Service account authentication successful');
        return this.oauth2Client;
    }

    /**
     * Load credentials from file
     */
    async loadCredentials() {
        try {
            const content = await fs.readFile(this.CREDENTIALS_PATH, 'utf8');
            return JSON.parse(content);
        } catch (error) {
            throw new Error(`Failed to load credentials from ${this.CREDENTIALS_PATH}: ${error.message}`);
        }
    }

    /**
     * Authenticate user with OAuth2 flow
     */
    async authenticate() {
        return new Promise((resolve, reject) => {
            const authUrl = this.oauth2Client.generateAuthUrl({
                access_type: 'offline',
                scope: this.SCOPES,
                prompt: 'consent'
            });

            console.log('[GoogleAuth] Opening browser for authentication...');
            console.log('[GoogleAuth] If browser does not open, visit:', authUrl);

            // Create local server to receive the OAuth callback
            const server = http.createServer(async (req, res) => {
                if (req.url.indexOf('/oauth2callback') > -1) {
                    const qs = new url.URL(req.url, `http://localhost:${server.address().port}`)
                        .searchParams;
                    const code = qs.get('code');

                    res.writeHead(200, { 'Content-Type': 'text/html' });
                    res.end(`
                        <html>
                            <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
                                <h1>✅ Authentication Successful!</h1>
                                <p>You can close this window and return to the application.</p>
                                <script>window.setTimeout(() => window.close(), 3000);</script>
                            </body>
                        </html>
                    `);

                    server.close();

                    try {
                        const { tokens } = await this.oauth2Client.getToken(code);
                        this.oauth2Client.setCredentials(tokens);
                        
                        // Save token for future use
                        await this.saveToken(tokens);
                        
                        console.log('[GoogleAuth] Authentication successful!');
                        resolve(this.oauth2Client);
                    } catch (error) {
                        console.error('[GoogleAuth] Error getting tokens:', error);
                        reject(error);
                    }
                }
            });

            server.listen(0, () => {
                const port = server.address().port;
                const redirectUri = `http://localhost:${port}/oauth2callback`;
                
                // Update redirect URI
                this.oauth2Client.redirectUri = redirectUri;
                
                const finalAuthUrl = this.oauth2Client.generateAuthUrl({
                    access_type: 'offline',
                    scope: this.SCOPES,
                    prompt: 'consent'
                });

                // Try to open browser
                if (!open) {
                    import('open').then(module => {
                        open = module.default;
                        open(finalAuthUrl).catch(() => {
                            console.log('[GoogleAuth] Could not open browser automatically');
                        });
                    });
                } else {
                    open(finalAuthUrl).catch(() => {
                        console.log('[GoogleAuth] Could not open browser automatically');
                    });
                }
            });

            // Timeout after 5 minutes
            setTimeout(() => {
                server.close();
                reject(new Error('Authentication timeout'));
            }, 300000);
        });
    }

    /**
     * Save token to file
     */
    async saveToken(tokens) {
        try {
            // Ensure directory exists
            const dir = path.dirname(this.TOKEN_PATH);
            await fs.mkdir(dir, { recursive: true });
            
            await fs.writeFile(this.TOKEN_PATH, JSON.stringify(tokens, null, 2));
            console.log('[GoogleAuth] Token saved to:', this.TOKEN_PATH);
        } catch (error) {
            console.error('[GoogleAuth] Error saving token:', error);
        }
    }

    /**
     * Get authenticated client
     */
    async getAuthClient() {
        if (!this.oauth2Client) {
            await this.initialize();
        }
        return this.oauth2Client;
    }

    /**
     * Refresh token if needed
     */
    async refreshToken() {
        try {
            const { credentials } = await this.oauth2Client.refreshAccessToken();
            this.oauth2Client.setCredentials(credentials);
            await this.saveToken(credentials);
            console.log('[GoogleAuth] Token refreshed successfully');
            return credentials;
        } catch (error) {
            console.error('[GoogleAuth] Token refresh failed:', error);
            throw error;
        }
    }

    /**
     * Revoke authentication
     */
    async revoke() {
        try {
            await this.oauth2Client.revokeCredentials();
            await fs.unlink(this.TOKEN_PATH);
            console.log('[GoogleAuth] Authentication revoked');
        } catch (error) {
            console.error('[GoogleAuth] Error revoking auth:', error);
        }
    }
}

module.exports = GoogleAuthService;