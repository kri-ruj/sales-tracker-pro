const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const winston = require('winston');
const databaseService = require('./database.service');

const logger = winston.createLogger({
    level: 'info',
    format: winston.format.json(),
    transports: [
        new winston.transports.Console()
    ]
});

class AuthService {
    constructor() {
        this.jwtSecret = process.env.JWT_SECRET || 'your-secret-key-change-this';
        this.jwtExpiry = process.env.JWT_EXPIRY || '24h';
        this.bcryptRounds = 10;
        
        // In-memory user store (replace with database in production)
        this.users = new Map();
        
        // API keys store
        this.apiKeys = new Map();
        
        // Session store
        this.sessions = new Map();
        
        // Initialize with a demo user
        this.createUser({
            username: 'demo',
            password: 'demo123',
            email: 'demo@example.com'
        });
    }

    async createUser({ username, password, email }) {
        try {
            if (this.users.has(username)) {
                throw new Error('User already exists');
            }

            const hashedPassword = await bcrypt.hash(password, this.bcryptRounds);
            const userId = this.generateId();
            
            const user = {
                id: userId,
                username,
                email,
                password: hashedPassword,
                createdAt: new Date(),
                apiKey: this.generateApiKey()
            };

            this.users.set(username, user);
            this.apiKeys.set(user.apiKey, userId);
            
            // Save to database if available
            await databaseService.saveUser(user);
            
            logger.info('User created', { username, userId });
            
            return {
                id: user.id,
                username: user.username,
                email: user.email,
                apiKey: user.apiKey
            };
        } catch (error) {
            logger.error('Failed to create user:', error);
            throw error;
        }
    }

    async login({ username, password }) {
        try {
            // Try to get user from database first
            let user = await databaseService.getUser(username);
            
            // Fallback to in-memory storage
            if (!user) {
                user = this.users.get(username);
            }
            
            if (!user) {
                throw new Error('Invalid credentials');
            }

            const isValid = await bcrypt.compare(password, user.password);
            
            if (!isValid) {
                throw new Error('Invalid credentials');
            }

            const token = jwt.sign(
                {
                    userId: user.id,
                    username: user.username
                },
                this.jwtSecret,
                {
                    expiresIn: this.jwtExpiry
                }
            );

            // Create session
            const sessionId = this.generateId();
            this.sessions.set(sessionId, {
                userId: user.id,
                username: user.username,
                createdAt: new Date(),
                lastActivity: new Date()
            });

            logger.info('User logged in', { username, userId: user.id });

            return {
                token,
                sessionId,
                user: {
                    id: user.id,
                    username: user.username,
                    email: user.email
                }
            };
        } catch (error) {
            logger.error('Login failed:', error);
            throw error;
        }
    }

    async verifyToken(token) {
        try {
            const decoded = jwt.verify(token, this.jwtSecret);
            return decoded;
        } catch (error) {
            logger.error('Token verification failed:', error);
            throw new Error('Invalid token');
        }
    }

    async verifyApiKey(apiKey) {
        const userId = this.apiKeys.get(apiKey);
        
        if (!userId) {
            throw new Error('Invalid API key');
        }

        // Find user by ID
        for (const [username, user] of this.users.entries()) {
            if (user.id === userId) {
                return {
                    userId: user.id,
                    username: user.username
                };
            }
        }

        throw new Error('User not found');
    }

    async updateSession(sessionId) {
        const session = this.sessions.get(sessionId);
        
        if (!session) {
            throw new Error('Invalid session');
        }

        session.lastActivity = new Date();
        return session;
    }

    async logout(sessionId) {
        this.sessions.delete(sessionId);
        logger.info('User logged out', { sessionId });
    }

    generateId() {
        return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    generateApiKey() {
        return `sk_${Buffer.from(Math.random().toString()).toString('base64').replace(/[^a-zA-Z0-9]/g, '').substr(0, 32)}`;
    }

    // Middleware for Express
    authenticate() {
        return async (req, res, next) => {
            try {
                // Check for API key
                const apiKey = req.headers['x-api-key'];
                if (apiKey) {
                    const user = await this.verifyApiKey(apiKey);
                    req.user = user;
                    return next();
                }

                // Check for JWT token
                const authHeader = req.headers.authorization;
                if (!authHeader) {
                    return res.status(401).json({ error: 'No authorization header' });
                }

                const token = authHeader.replace('Bearer ', '');
                const decoded = await this.verifyToken(token);
                
                req.user = decoded;
                next();
            } catch (error) {
                logger.error('Authentication failed:', error);
                res.status(401).json({ error: 'Authentication failed' });
            }
        };
    }

    // Rate limiting per user
    createUserRateLimiter(options = {}) {
        const {
            windowMs = 15 * 60 * 1000, // 15 minutes
            max = 100 // limit each user to 100 requests per windowMs
        } = options;

        const userRequests = new Map();

        return (req, res, next) => {
            if (!req.user) {
                return next();
            }

            const userId = req.user.userId;
            const now = Date.now();
            
            if (!userRequests.has(userId)) {
                userRequests.set(userId, []);
            }

            const requests = userRequests.get(userId);
            const recentRequests = requests.filter(timestamp => now - timestamp < windowMs);
            
            if (recentRequests.length >= max) {
                return res.status(429).json({
                    error: 'Too many requests',
                    retryAfter: windowMs / 1000
                });
            }

            recentRequests.push(now);
            userRequests.set(userId, recentRequests);
            
            next();
        };
    }
}

module.exports = new AuthService();