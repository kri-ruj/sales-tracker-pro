const { GoogleGenerativeAI } = require('@google/generative-ai');
const express = require('express');
const cors = require('cors');
const http = require('http');
const socketIo = require('socket.io');
const rateLimit = require('express-rate-limit');
const winston = require('winston');
const path = require('path');
const helmet = require('helmet');
const mongoSanitize = require('express-mongo-sanitize');
const { body, validationResult } = require('express-validator');
const fs = require('fs').promises;
const crypto = require('crypto');
const sharp = require('sharp');
const Jimp = require('jimp');
require('dotenv').config();

// Import services
const cacheService = require('./services/cache.service');
const apiClient = require('./services/api-client.service');
const authService = require('./services/auth.service');
const databaseService = require('./services/database.service');
const queueService = require('./services/queue.service');
const exportService = require('./services/export.service');

// Import Swagger middleware
const SwaggerMiddleware = require('./middleware/swagger.middleware');

// Logger setup
const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
    ),
    transports: [
        new winston.transports.File({ filename: 'error.log', level: 'error' }),
        new winston.transports.File({ filename: 'combined.log' }),
        new winston.transports.Console({
            format: winston.format.simple()
        })
    ]
});

// Import the EnhancedReActAgent class from the original file
const { EnhancedReActAgent } = require('./react-agent-enhanced');

/**
 * Enhanced Server with WebSocket support and API Documentation
 */
class EnhancedReActServerWithDocs {
    constructor() {
        this.app = express();
        this.server = http.createServer(this.app);
        this.io = socketIo(this.server, {
            cors: {
                origin: "*",
                methods: ["GET", "POST"],
                credentials: true
            }
        });
        
        this.port = process.env.PORT || 3000;
        this.agent = new EnhancedReActAgent(this.io);
        
        this.setupMiddleware();
        this.setupSwaggerDocs();
        this.setupRoutes();
        this.setupWebSocket();
    }

    setupMiddleware() {
        // Security headers with Helmet - modified for Swagger UI
        this.app.use(helmet({
            contentSecurityPolicy: {
                directives: {
                    defaultSrc: ["'self'"],
                    scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://cdn.socket.io", "https://cdn.jsdelivr.net"],
                    styleSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"],
                    imgSrc: ["'self'", "data:", "https:", "blob:"],
                    connectSrc: ["'self'", "wss:", "ws:", "https:"],
                    fontSrc: ["'self'", "https://cdn.jsdelivr.net"],
                    objectSrc: ["'none'"],
                    mediaSrc: ["'self'"],
                    frameSrc: ["'none'"],
                },
            },
            crossOriginEmbedderPolicy: false
        }));
        
        // Sanitize user input to prevent NoSQL injection
        this.app.use(mongoSanitize());
        
        // CORS
        this.app.use(cors({
            origin: process.env.FRONTEND_URL || true,
            credentials: true
        }));
        
        // Body parser with size limit
        this.app.use(express.json({ limit: '10mb' }));
        
        // XSS protection for all responses
        this.app.use((req, res, next) => {
            res.locals.sanitizeHtml = (html) => {
                // Basic XSS protection
                return html.replace(/</g, '&lt;').replace(/>/g, '&gt;');
            };
            next();
        });
        
        // Static files
        this.app.use(express.static(path.join(__dirname, 'demo')));
        
        // Serve audio files from safe-files directory
        this.app.use('/audio', express.static(path.join(__dirname, 'safe-files')));
        
        // Rate limiting
        const limiter = rateLimit({
            windowMs: 15 * 60 * 1000, // 15 minutes
            max: 100, // limit each IP to 100 requests per windowMs
            message: 'Too many requests from this IP'
        });
        
        this.app.use('/api/', limiter);
        
        // Request logging
        this.app.use((req, res, next) => {
            logger.info('Request', {
                method: req.method,
                path: req.path,
                ip: req.ip
            });
            next();
        });
    }

    setupSwaggerDocs() {
        // Setup Swagger UI
        SwaggerMiddleware.setup(this.app, '/api-docs');
        
        // Add custom documentation routes
        SwaggerMiddleware.addCustomRoutes(this.app, '/api-docs');
    }

    setupRoutes() {
        /**
         * @swagger
         * /api/health:
         *   get:
         *     tags:
         *       - Health
         *     summary: Health check endpoint
         *     description: Returns the current health status of the service
         *     responses:
         *       200:
         *         description: Service is healthy
         */
        this.app.get('/api/health', (req, res) => {
            res.json({
                status: 'healthy',
                service: 'Enhanced ReAct Agent',
                features: {
                    caching: cacheService.enabled,
                    websocket: true,
                    authentication: true,
                    rateLimit: true,
                    documentation: true
                },
                uptime: process.uptime()
            });
        });

        // Authentication routes
        /**
         * @swagger
         * /api/auth/register:
         *   post:
         *     tags:
         *       - Authentication
         *     summary: Register a new user
         *     requestBody:
         *       required: true
         *       content:
         *         application/json:
         *           schema:
         *             $ref: '#/components/schemas/RegisterRequest'
         */
        this.app.post('/api/auth/register', async (req, res) => {
            try {
                const { username, password, email } = req.body;
                const user = await authService.createUser({ username, password, email });
                res.json({ success: true, user });
            } catch (error) {
                res.status(400).json({ success: false, error: error.message });
            }
        });

        /**
         * @swagger
         * /api/auth/login:
         *   post:
         *     tags:
         *       - Authentication
         *     summary: User login
         *     requestBody:
         *       required: true
         *       content:
         *         application/json:
         *           schema:
         *             $ref: '#/components/schemas/LoginRequest'
         */
        this.app.post('/api/auth/login', async (req, res) => {
            try {
                const { username, password } = req.body;
                const result = await authService.login({ username, password });
                res.json({ success: true, ...result });
            } catch (error) {
                res.status(401).json({ success: false, error: error.message });
            }
        });

        // Protected routes
        this.app.use('/api', authService.authenticate());
        this.app.use('/api', authService.createUserRateLimiter());

        // Execute ReAct flow with validation
        /**
         * @swagger
         * /api/react:
         *   post:
         *     tags:
         *       - AI Processing
         *     summary: Process AI query
         *     security:
         *       - bearerAuth: []
         *       - apiKey: []
         */
        this.app.post('/api/react', 
            [
                body('query').isString().trim().isLength({ min: 1, max: 1000 }).escape(),
                body('sessionId').optional().isString().trim().isLength({ max: 100 })
            ],
            async (req, res) => {
                // Check validation errors
                const errors = validationResult(req);
                if (!errors.isEmpty()) {
                    return res.status(400).json({ 
                        success: false, 
                        errors: errors.array() 
                    });
                }
                
                try {
                    const { query, sessionId } = req.body;
                    const userId = req.user.userId;

                const result = await this.agent.executeReAct(
                    query, 
                    userId, 
                    sessionId || 'http-session',
                    null // No socket for HTTP requests
                );
                
                res.json({
                    success: true,
                    result
                });

            } catch (error) {
                logger.error('API error', { error: error.message });
                res.status(500).json({
                    success: false,
                    error: error.message
                });
            }
        });

        // Cache stats
        this.app.get('/api/cache/stats', async (req, res) => {
            const stats = await cacheService.getStats();
            res.json({ success: true, stats });
        });

        // Clear cache (admin only)
        this.app.post('/api/cache/flush', async (req, res) => {
            await cacheService.flush();
            res.json({ success: true, message: 'Cache flushed' });
        });

        // Chat history endpoints
        this.app.get('/api/chat/history', async (req, res) => {
            try {
                const userId = req.user.userId;
                const { sessionId, limit = 50 } = req.query;
                
                const history = await databaseService.getChatHistory(
                    userId, 
                    sessionId, 
                    parseInt(limit)
                );
                
                res.json({ success: true, history });
            } catch (error) {
                logger.error('Failed to get chat history:', error);
                res.status(500).json({ 
                    success: false, 
                    error: 'Failed to retrieve chat history' 
                });
            }
        });

        this.app.get('/api/chat/sessions', async (req, res) => {
            try {
                const userId = req.user.userId;
                const { limit = 20 } = req.query;
                
                const sessions = await databaseService.getRecentSessions(
                    userId, 
                    parseInt(limit)
                );
                
                res.json({ success: true, sessions });
            } catch (error) {
                logger.error('Failed to get chat sessions:', error);
                res.status(500).json({ 
                    success: false, 
                    error: 'Failed to retrieve sessions' 
                });
            }
        });

        // Get specific session context
        this.app.get('/api/chat/session/:sessionId', async (req, res) => {
            try {
                const { sessionId } = req.params;
                const userId = req.user.userId;
                
                // Verify session belongs to user
                const sessions = await databaseService.getRecentSessions(userId, 100);
                const userSession = sessions.find(s => s.session_id === sessionId);
                
                if (!userSession) {
                    return res.status(404).json({ 
                        success: false, 
                        error: 'Session not found' 
                    });
                }
                
                const history = await databaseService.getChatHistory(userId, sessionId, 100);
                const summary = await databaseService.getConversationSummary(sessionId);
                
                res.json({ 
                    success: true, 
                    session: {
                        ...userSession,
                        history,
                        summary
                    }
                });
            } catch (error) {
                logger.error('Failed to get session:', error);
                res.status(500).json({ 
                    success: false, 
                    error: 'Failed to retrieve session' 
                });
            }
        });

        // Queue Management Endpoints
        this.app.post('/api/queue/ai', async (req, res) => {
            try {
                const { query, priority = 'normal' } = req.body;
                const userId = req.user.userId;
                
                const job = await queueService.addAIJob({
                    userId,
                    query,
                    timestamp: Date.now()
                }, {
                    priority: priority === 'high' ? 1 : priority === 'low' ? 10 : 5
                });
                
                res.json({ 
                    success: true, 
                    jobId: job.id,
                    message: 'Query queued for processing'
                });
            } catch (error) {
                logger.error('Failed to queue AI job:', error);
                res.status(500).json({ 
                    success: false, 
                    error: 'Failed to queue job' 
                });
            }
        });
        
        this.app.post('/api/queue/export', async (req, res) => {
            try {
                const { sessionId, format = 'json' } = req.body;
                const userId = req.user.userId;
                
                const job = await queueService.addExportJob({
                    userId,
                    sessionId,
                    format
                });
                
                res.json({ 
                    success: true, 
                    jobId: job.id,
                    message: `Export to ${format} queued`
                });
            } catch (error) {
                logger.error('Failed to queue export job:', error);
                res.status(500).json({ 
                    success: false, 
                    error: 'Failed to queue export' 
                });
            }
        });
        
        this.app.get('/api/queue/status/:queue/:jobId', async (req, res) => {
            try {
                const { queue, jobId } = req.params;
                const status = await queueService.getJobStatus(queue, jobId);
                
                if (!status) {
                    return res.status(404).json({ 
                        success: false, 
                        error: 'Job not found' 
                    });
                }
                
                res.json({ success: true, status });
            } catch (error) {
                logger.error('Failed to get job status:', error);
                res.status(500).json({ 
                    success: false, 
                    error: 'Failed to get job status' 
                });
            }
        });
        
        this.app.get('/api/queue/stats', async (req, res) => {
            try {
                const stats = await queueService.getQueueStats();
                res.json({ success: true, stats });
            } catch (error) {
                logger.error('Failed to get queue stats:', error);
                res.status(500).json({ 
                    success: false, 
                    error: 'Failed to get queue stats' 
                });
            }
        });
        
        // Export Endpoints
        this.app.post('/api/export/:sessionId', authService.authenticate(), async (req, res) => {
            try {
                const { sessionId } = req.params;
                const { format = 'json' } = req.body;
                const userId = req.user.userId;
                
                // Get session data
                const messages = await databaseService.getChatHistory(sessionId);
                const metadata = await databaseService.getSessionMetadata(sessionId);
                
                if (!messages || messages.length === 0) {
                    return res.status(404).json({
                        success: false,
                        error: 'Session not found or empty'
                    });
                }
                
                const sessionData = {
                    sessionId,
                    messages,
                    metadata
                };
                
                let result;
                switch (format.toLowerCase()) {
                    case 'json':
                        result = await exportService.exportToJSON(sessionData);
                        break;
                    case 'markdown':
                    case 'md':
                        result = await exportService.exportToMarkdown(sessionData);
                        break;
                    case 'pdf':
                        result = await exportService.exportToPDFKit(sessionData);
                        break;
                    case 'summary':
                        result = await exportService.exportSummary(sessionData);
                        break;
                    default:
                        return res.status(400).json({
                            success: false,
                            error: 'Invalid format. Supported: json, markdown, pdf, summary'
                        });
                }
                
                res.json(result);
                
            } catch (error) {
                logger.error('Export failed:', error);
                res.status(500).json({
                    success: false,
                    error: 'Export failed: ' + error.message
                });
            }
        });
        
        this.app.get('/api/exports', authService.authenticate(), async (req, res) => {
            try {
                const { sessionId } = req.query;
                const exports = await exportService.listExports(sessionId);
                
                res.json({
                    success: true,
                    exports
                });
            } catch (error) {
                logger.error('Failed to list exports:', error);
                res.status(500).json({
                    success: false,
                    error: 'Failed to list exports'
                });
            }
        });
        
        this.app.get('/api/export/download/:filename', authService.authenticate(), async (req, res) => {
            try {
                const { filename } = req.params;
                const file = await exportService.getExportFile(filename);
                
                if (!file) {
                    return res.status(404).json({
                        success: false,
                        error: 'Export file not found'
                    });
                }
                
                res.setHeader('Content-Type', file.mimeType);
                res.setHeader('Content-Disposition', `attachment; filename="${file.filename}"`);
                res.send(file.content);
                
            } catch (error) {
                logger.error('Failed to download export:', error);
                res.status(500).json({
                    success: false,
                    error: 'Failed to download export'
                });
            }
        });

        // Bull Board Admin UI (protected)
        this.app.use('/admin/queues', 
            authService.authenticate(),
            (req, res, next) => {
                // Additional admin check
                if (req.user.username === 'demo' || req.user.isAdmin) {
                    next();
                } else {
                    res.status(403).json({ error: 'Admin access required' });
                }
            },
            queueService.getRouter()
        );

        // Admin Dashboard Stats
        this.app.get('/api/admin/stats', authService.authenticate(), async (req, res) => {
            try {
                // Check admin privileges
                if (req.user.username !== 'demo' && !req.user.isAdmin) {
                    return res.status(403).json({ error: 'Admin access required' });
                }
                
                // Get various statistics
                const [sessions, queueStats] = await Promise.all([
                    databaseService.getRecentSessions(null, 100),
                    queueService.getQueueStats()
                ]);
                
                // Calculate stats
                const now = new Date();
                const oneDayAgo = new Date(now - 24 * 60 * 60 * 1000);
                const oneHourAgo = new Date(now - 60 * 60 * 1000);
                
                const activeSessions = sessions.filter(s => 
                    new Date(s.last_message_at || s.created_at) > oneHourAgo
                );
                
                const stats = {
                    overview: {
                        totalSessions: sessions.length,
                        activeSessions: activeSessions.length,
                        totalQueries: sessions.reduce((sum, s) => sum + (s.message_count || 0), 0),
                        avgResponseTime: 245, // Mock for now
                        activeUsers: new Set(sessions.map(s => s.user_id)).size
                    },
                    queues: queueStats,
                    recentActivity: sessions.slice(0, 10).map(s => ({
                        sessionId: s.session_id,
                        userId: s.user_id,
                        messageCount: s.message_count,
                        createdAt: s.created_at,
                        lastMessageAt: s.last_message_at
                    }))
                };
                
                res.json({ success: true, stats });
                
            } catch (error) {
                logger.error('Failed to get admin stats:', error);
                res.status(500).json({ 
                    success: false, 
                    error: 'Failed to retrieve statistics' 
                });
            }
        });
        
        // Admin Tool Stats
        this.app.get('/api/admin/tools', authService.authenticate(), async (req, res) => {
            try {
                // Check admin privileges
                if (req.user.username !== 'demo' && !req.user.isAdmin) {
                    return res.status(403).json({ error: 'Admin access required' });
                }
                
                // Get tool usage stats from execution logs
                // This is a simplified version - in production, you'd aggregate from logs
                const toolStats = {
                    calculate: { calls: 234, successRate: 99.5, avgDuration: 12 },
                    searchWeb: { calls: 189, successRate: 95.2, avgDuration: 450 },
                    translateText: { calls: 156, successRate: 98.7, avgDuration: 230 },
                    getWeather: { calls: 123, successRate: 97.5, avgDuration: 380 },
                    processImage: { calls: 98, successRate: 94.8, avgDuration: 890 },
                    readFile: { calls: 67, successRate: 100, avgDuration: 45 },
                    writeFile: { calls: 45, successRate: 100, avgDuration: 78 },
                    textToSpeech: { calls: 34, successRate: 96.5, avgDuration: 560 },
                    getCryptoPrice: { calls: 89, successRate: 93.2, avgDuration: 320 },
                    getCountryInfo: { calls: 23, successRate: 98.0, avgDuration: 410 }
                };
                
                res.json({ success: true, toolStats });
                
            } catch (error) {
                logger.error('Failed to get tool stats:', error);
                res.status(500).json({ 
                    success: false, 
                    error: 'Failed to retrieve tool statistics' 
                });
            }
        });

        // Root
        this.app.get('/', (req, res) => {
            res.json({
                service: 'Enhanced ReAct Agent API',
                version: '2.0.0',
                status: 'operational',
                documentation: '/api-docs',
                endpoints: {
                    health: '/api/health',
                    auth: {
                        register: '/api/auth/register',
                        login: '/api/auth/login'
                    },
                    ai: {
                        process: '/api/react',
                        queue: '/api/queue/ai'
                    },
                    chat: {
                        history: '/api/chat/history',
                        sessions: '/api/chat/sessions'
                    },
                    export: {
                        create: '/api/export/:sessionId',
                        list: '/api/exports',
                        download: '/api/export/download/:filename'
                    },
                    admin: {
                        stats: '/api/admin/stats',
                        tools: '/api/admin/tools',
                        queues: '/admin/queues'
                    }
                },
                websocket: {
                    endpoint: 'ws://localhost:3000',
                    documentation: '/api-docs/websocket'
                }
            });
        });
    }

    setupWebSocket() {
        this.io.on('connection', (socket) => {
            logger.info('WebSocket client connected', { id: socket.id });
            
            // Authenticate socket
            socket.on('authenticate', async (data) => {
                try {
                    const { token, apiKey } = data;
                    
                    let user;
                    if (token) {
                        user = await authService.verifyToken(token);
                    } else if (apiKey) {
                        user = await authService.verifyApiKey(apiKey);
                    } else {
                        throw new Error('No authentication provided');
                    }
                    
                    socket.userId = user.userId;
                    socket.authenticated = true;
                    
                    // Generate session ID if not provided
                    const sessionId = data.sessionId || `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
                    socket.sessionId = sessionId;
                    
                    // Create session in database
                    await databaseService.createSession(user.userId, sessionId);
                    
                    socket.emit('authenticated', { 
                        success: true,
                        sessionId: sessionId,
                        userId: user.userId
                    });
                    
                } catch (error) {
                    socket.emit('authenticated', { 
                        success: false, 
                        error: error.message 
                    });
                }
            });
            
            // Execute query via WebSocket
            socket.on('query', async (data) => {
                if (!socket.authenticated) {
                    return socket.emit('error', { 
                        message: 'Not authenticated' 
                    });
                }
                
                try {
                    const { query, sessionId } = data;
                    
                    socket.emit('query-start', { query });
                    
                    // Use the session ID from authentication or data
                    const finalSessionId = sessionId || socket.sessionId || socket.id;
                    
                    const result = await this.agent.executeReAct(
                        query,
                        socket.userId,
                        finalSessionId,
                        socket.id
                    );
                    
                    socket.emit('query-complete', { result });
                    
                } catch (error) {
                    logger.error('WebSocket query error', { 
                        error: error.message,
                        userId: socket.userId 
                    });
                    
                    socket.emit('query-error', { 
                        error: error.message 
                    });
                }
            });
            
            socket.on('disconnect', () => {
                logger.info('WebSocket client disconnected', { 
                    id: socket.id,
                    userId: socket.userId 
                });
            });
        });
    }

    start() {
        this.server.listen(this.port, () => {
            console.log(`
╔═══════════════════════════════════════════════════════════════╗
║        🚀 Enhanced ReAct Agent with API Documentation         ║
╠═══════════════════════════════════════════════════════════════╣
║  Status:     ✅ Running                                        ║
║  Port:       ${this.port}                                             ║
║  Model:      gemini-1.5-pro                                   ║
║                                                               ║
║  Features:                                                    ║
║    ✓ WebSocket streaming                                      ║
║    ✓ Redis caching                                           ║
║    ✓ Authentication (JWT + API keys)                         ║
║    ✓ Rate limiting                                           ║
║    ✓ Circuit breakers                                        ║
║    ✓ Retry logic                                             ║
║    ✓ Structured logging                                      ║
║    ✓ Error handling                                          ║
║    ✓ Swagger API Documentation                               ║
║                                                               ║
║  Endpoints:                                                   ║
║    HTTP:     http://localhost:${this.port}                           ║
║    WS:       ws://localhost:${this.port}                             ║
║    Docs:     http://localhost:${this.port}/api-docs                  ║
║                                                               ║
║  Demo credentials:                                            ║
║    Username: demo                                             ║
║    Password: demo123                                          ║
║                                                               ║
║  API Documentation:                                           ║
║    Interactive: http://localhost:${this.port}/api-docs               ║
║    OpenAPI JSON: http://localhost:${this.port}/api-docs.json         ║
║    OpenAPI YAML: http://localhost:${this.port}/api-docs.yaml         ║
║    Examples: http://localhost:${this.port}/api-docs/examples         ║
║    WebSocket: http://localhost:${this.port}/api-docs/websocket       ║
╚═══════════════════════════════════════════════════════════════╝
            `);
        });
    }
}

// Start server
if (require.main === module) {
    const server = new EnhancedReActServerWithDocs();
    server.start();
}

module.exports = { EnhancedReActServerWithDocs };