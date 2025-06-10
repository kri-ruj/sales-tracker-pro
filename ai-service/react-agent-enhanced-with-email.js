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
const webhookService = require('./services/webhook.service');
const EnhancedEmailService = require('./services/enhanced-email.service');

// Import email admin routes
const emailAdminRoutes = require('./routes/email-admin.routes');

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

/**
 * Enhanced ReAct Agent with Email Notifications
 */
class EnhancedReActAgentWithEmail {
    constructor(io) {
        this.io = io;
        this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        this.maxIterations = 10;
        this.activeChats = new Map();
        
        // Initialize email service
        this.emailService = new EnhancedEmailService(queueService, databaseService);
        
        // Circuit breakers for each API
        this.circuitBreakers = {
            crypto: apiClient.createCircuitBreaker('crypto'),
            weather: apiClient.createCircuitBreaker('weather'),
            search: apiClient.createCircuitBreaker('search'),
            country: apiClient.createCircuitBreaker('country')
        };
        
        // System prompt
        this.systemPrompt = `You are a helpful AI assistant that uses tools to provide accurate, real-time information.

When answering questions:
1. Think about what information you need
2. Use the appropriate tools to gather that information
3. Provide a clear answer based on the tool results

Important: Always use tools when current information is requested. Never make up data.`;

        // Tool definitions (kept from original)
        this.tools = [
            {
                functionDeclarations: [
                    {
                        name: "searchWeb",
                        description: "Search the web for current information",
                        parameters: {
                            type: "object",
                            properties: {
                                query: { type: "string", description: "Search query" }
                            },
                            required: ["query"]
                        }
                    },
                    {
                        name: "getCryptoPrice",
                        description: "Get real-time cryptocurrency prices",
                        parameters: {
                            type: "object",
                            properties: {
                                symbol: { type: "string", description: "Crypto symbol (BTC, ETH, etc.)" }
                            },
                            required: ["symbol"]
                        }
                    },
                    {
                        name: "getWeather",
                        description: "Get current weather data",
                        parameters: {
                            type: "object",
                            properties: {
                                location: { type: "string", description: "City name or coordinates" }
                            },
                            required: ["location"]
                        }
                    },
                    {
                        name: "searchCountryInfo",
                        description: "Get information about a country",
                        parameters: {
                            type: "object",
                            properties: {
                                country: { type: "string", description: "Country name" }
                            },
                            required: ["country"]
                        }
                    },
                    {
                        name: "calculate",
                        description: "Perform mathematical calculations",
                        parameters: {
                            type: "object",
                            properties: {
                                expression: { type: "string", description: "Mathematical expression to evaluate" }
                            },
                            required: ["expression"]
                        }
                    },
                    {
                        name: "getCurrentTime",
                        description: "Get current date and time",
                        parameters: {
                            type: "object",
                            properties: {
                                timezone: { type: "string", description: "Timezone (e.g., 'UTC', 'America/New_York')" }
                            }
                        }
                    }
                ]
            }
        ];
    }
    
    /**
     * Initialize the agent
     */
    async initialize() {
        await this.emailService.initialize();
        logger.info('Enhanced ReAct Agent with Email initialized');
    }
    
    /**
     * Process a query using ReAct pattern with email notifications
     */
    async processQuery(query, context = {}, sessionId = null) {
        const startTime = Date.now();
        const queryId = crypto.randomBytes(16).toString('hex');
        
        try {
            // Initialize chat session
            const model = this.genAI.getGenerativeModel({ 
                model: "gemini-pro",
                generationConfig: {
                    temperature: 0.7,
                    topK: 40,
                    topP: 0.95,
                    maxOutputTokens: 8192
                }
            });
            
            const chat = model.startChat({
                history: context.history || [],
                tools: this.tools
            });
            
            // Store active chat
            if (sessionId) {
                this.activeChats.set(sessionId, { chat, context, startTime });
            }
            
            // Process with ReAct loop
            let thoughts = [];
            let actions = [];
            let observations = [];
            let toolsUsed = [];
            
            // Send system prompt
            await chat.sendMessage(this.systemPrompt);
            
            // Main query processing
            const response = await chat.sendMessage(query);
            
            if (response.response.functionCalls()) {
                for (const functionCall of response.response.functionCalls()) {
                    const observation = await this.executeTool(functionCall.name, functionCall.args);
                    observations.push({
                        tool: functionCall.name,
                        args: functionCall.args,
                        result: observation
                    });
                    toolsUsed.push(functionCall.name);
                }
            }
            
            // Get final response
            let finalResponse;
            if (observations.length > 0) {
                const observationText = observations.map(o => 
                    `Tool: ${o.tool}\nResult: ${JSON.stringify(o.result)}`
                ).join('\n\n');
                
                const finalResult = await chat.sendMessage(
                    `Based on the tool results:\n${observationText}\n\nPlease provide a comprehensive answer to: ${query}`
                );
                finalResponse = finalResult.response.text();
            } else {
                finalResponse = response.response.text();
            }
            
            // Calculate metrics
            const processingTime = Date.now() - startTime;
            
            // Log query completion
            await databaseService.query(
                `INSERT INTO query_logs (query_id, session_id, query, response, tools_used, processing_time, status)
                 VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [queryId, sessionId, query, finalResponse, JSON.stringify(toolsUsed), processingTime, 'completed']
            );
            
            // Send query completion email if enabled
            if (context.user && context.emailNotifications?.queryCompletions) {
                await this.emailService.sendTemplateEmail('queryCompletion', {
                    queryId,
                    query,
                    processingTime: `${(processingTime / 1000).toFixed(2)}s`,
                    toolsUsed: toolsUsed.join(', ') || 'None',
                    result: finalResponse.substring(0, 500) + (finalResponse.length > 500 ? '...' : '')
                }, context.user.email);
            }
            
            return {
                response: finalResponse,
                metadata: {
                    queryId,
                    processingTime,
                    toolsUsed,
                    observationCount: observations.length,
                    thoughtCount: thoughts.length
                },
                thoughts,
                actions,
                observations
            };
            
        } catch (error) {
            logger.error('Query processing error:', error);
            
            // Log error
            await databaseService.query(
                `INSERT INTO query_logs (query_id, session_id, query, error, status)
                 VALUES (?, ?, ?, ?, ?)`,
                [queryId, sessionId, query, error.message, 'failed']
            );
            
            // Send error notification email if enabled
            if (context.user && context.emailNotifications?.errorNotifications) {
                await this.emailService.sendTemplateEmail('errorNotification', {
                    errorType: 'Query Processing Error',
                    errorMessage: error.message,
                    timestamp: new Date().toISOString(),
                    stackTrace: error.stack || 'No stack trace available'
                }, context.user.email);
            }
            
            throw error;
        }
    }
    
    /**
     * Execute a tool
     */
    async executeTool(toolName, args) {
        logger.info(`Executing tool: ${toolName}`, { args });
        
        try {
            switch (toolName) {
                case 'searchWeb':
                    return await this.searchWeb(args.query);
                
                case 'getCryptoPrice':
                    return await this.getCryptoPrice(args.symbol);
                
                case 'getWeather':
                    return await this.getWeather(args.location);
                
                case 'searchCountryInfo':
                    return await this.searchCountryInfo(args.country);
                
                case 'calculate':
                    return await this.calculate(args.expression);
                
                case 'getCurrentTime':
                    return await this.getCurrentTime(args.timezone);
                
                default:
                    throw new Error(`Unknown tool: ${toolName}`);
            }
        } catch (error) {
            logger.error(`Tool execution error: ${toolName}`, error);
            return { error: error.message };
        }
    }
    
    // Tool implementations (kept from original)
    async searchWeb(query) {
        const cacheKey = `search:${query}`;
        const cached = await cacheService.get(cacheKey);
        if (cached) return cached;
        
        try {
            const results = await this.circuitBreakers.search.fire(async () => {
                return await apiClient.searchDuckDuckGo(query);
            });
            
            await cacheService.set(cacheKey, results, 3600);
            return results;
        } catch (error) {
            logger.error('Web search error:', error);
            return { error: 'Search service unavailable' };
        }
    }
    
    async getCryptoPrice(symbol) {
        const cacheKey = `crypto:${symbol}`;
        const cached = await cacheService.get(cacheKey);
        if (cached) return cached;
        
        try {
            const data = await this.circuitBreakers.crypto.fire(async () => {
                return await apiClient.getCryptoPrice(symbol);
            });
            
            await cacheService.set(cacheKey, data, 60);
            return data;
        } catch (error) {
            logger.error('Crypto price error:', error);
            return { error: 'Crypto service unavailable' };
        }
    }
    
    async getWeather(location) {
        const cacheKey = `weather:${location}`;
        const cached = await cacheService.get(cacheKey);
        if (cached) return cached;
        
        try {
            const data = await this.circuitBreakers.weather.fire(async () => {
                return await apiClient.getWeather(location);
            });
            
            await cacheService.set(cacheKey, data, 1800);
            return data;
        } catch (error) {
            logger.error('Weather error:', error);
            return { error: 'Weather service unavailable' };
        }
    }
    
    async searchCountryInfo(country) {
        const cacheKey = `country:${country}`;
        const cached = await cacheService.get(cacheKey);
        if (cached) return cached;
        
        try {
            const data = await this.circuitBreakers.country.fire(async () => {
                return await apiClient.getCountryInfo(country);
            });
            
            await cacheService.set(cacheKey, data, 86400);
            return data;
        } catch (error) {
            logger.error('Country info error:', error);
            return { error: 'Country service unavailable' };
        }
    }
    
    async calculate(expression) {
        try {
            // Safe math evaluation
            const result = Function('"use strict"; return (' + expression + ')')();
            return { result, expression };
        } catch (error) {
            return { error: 'Invalid mathematical expression' };
        }
    }
    
    async getCurrentTime(timezone = 'UTC') {
        try {
            const date = new Date();
            const options = {
                timeZone: timezone,
                dateStyle: 'full',
                timeStyle: 'long'
            };
            return {
                timezone,
                formatted: date.toLocaleString('en-US', options),
                iso: date.toISOString(),
                unix: Math.floor(date.getTime() / 1000)
            };
        } catch (error) {
            return { error: 'Invalid timezone' };
        }
    }
    
    /**
     * End a session and send summary email
     */
    async endSession(sessionId, userId) {
        try {
            const session = this.activeChats.get(sessionId);
            if (!session) return;
            
            const duration = Date.now() - session.startTime;
            
            // Get session queries
            const queries = await databaseService.query(
                'SELECT query, status FROM query_logs WHERE session_id = ? ORDER BY created_at',
                [sessionId]
            );
            
            // Get user preferences
            const user = await authService.getUserById(userId);
            const preferences = await this.emailService.getUserPreferences(user.email);
            
            // Send session summary email if enabled
            if (preferences?.session_summaries) {
                await this.emailService.sendTemplateEmail('sessionSummary', {
                    sessionId,
                    duration: this.formatDuration(duration / 1000),
                    queries: queries.map(q => ({
                        query: q.query.substring(0, 100) + (q.query.length > 100 ? '...' : ''),
                        status: q.status
                    }))
                }, user.email);
            }
            
            // Clean up
            this.activeChats.delete(sessionId);
            
        } catch (error) {
            logger.error('Error ending session:', error);
        }
    }
    
    /**
     * Format duration
     */
    formatDuration(seconds) {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = Math.floor(seconds % 60);
        
        if (hours > 0) {
            return `${hours}h ${minutes}m ${secs}s`;
        } else if (minutes > 0) {
            return `${minutes}m ${secs}s`;
        } else {
            return `${secs}s`;
        }
    }
}

// Express app setup
const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: process.env.CLIENT_URL || "*",
        methods: ["GET", "POST"]
    }
});

// Initialize agent
const agent = new EnhancedReActAgentWithEmail(io);

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(mongoSanitize());

// Serve static files
app.use('/public', express.static(path.join(__dirname, 'public')));

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100
});
app.use('/api/', limiter);

// Authentication middleware
const authenticate = async (req, res, next) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) {
            return res.status(401).json({ error: 'No token provided' });
        }
        
        const user = await authService.verifyToken(token);
        req.user = user;
        next();
    } catch (error) {
        res.status(401).json({ error: 'Invalid token' });
    }
};

// Initialize services
(async () => {
    try {
        await databaseService.initialize();
        await agent.initialize();
        logger.info('All services initialized');
    } catch (error) {
        logger.error('Initialization error:', error);
        process.exit(1);
    }
})();

// API Routes
app.post('/api/chat', authenticate, [
    body('message').isString().notEmpty(),
    body('sessionId').optional().isString()
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    
    try {
        const { message, sessionId } = req.body;
        
        const result = await agent.processQuery(message, {
            user: req.user,
            emailNotifications: req.user.emailPreferences,
            history: req.body.history || []
        }, sessionId);
        
        res.json(result);
    } catch (error) {
        logger.error('Chat error:', error);
        res.status(500).json({ error: error.message });
    }
});

// End session endpoint
app.post('/api/session/end', authenticate, [
    body('sessionId').isString().notEmpty()
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    
    try {
        await agent.endSession(req.body.sessionId, req.user.id);
        res.json({ success: true });
    } catch (error) {
        logger.error('End session error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Email admin routes
app.use('/api/email-admin', emailAdminRoutes(agent.emailService, authenticate));

// Email tracking endpoints
app.get('/track/open/:messageId', async (req, res) => {
    try {
        await agent.emailService.trackOpen(req.params.messageId);
        // Return 1x1 transparent pixel
        const pixel = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
        res.writeHead(200, {
            'Content-Type': 'image/gif',
            'Content-Length': pixel.length,
            'Cache-Control': 'no-store, no-cache, must-revalidate, private'
        });
        res.end(pixel);
    } catch (error) {
        res.status(200).end();
    }
});

app.get('/track/click/:messageId/:linkIndex', async (req, res) => {
    try {
        await agent.emailService.trackClick(req.params.messageId, req.params.linkIndex);
        const url = req.query.url || '/';
        res.redirect(url);
    } catch (error) {
        res.redirect('/');
    }
});

// Unsubscribe endpoint
app.get('/unsubscribe/:token', async (req, res) => {
    try {
        await agent.emailService.unsubscribe(req.params.token);
        res.send(`
            <html>
                <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
                    <h1>Unsubscribed Successfully</h1>
                    <p>You have been unsubscribed from our email notifications.</p>
                </body>
            </html>
        `);
    } catch (error) {
        res.status(400).send(`
            <html>
                <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
                    <h1>Error</h1>
                    <p>Invalid unsubscribe link.</p>
                </body>
            </html>
        `);
    }
});

// WebSocket handling
io.on('connection', (socket) => {
    logger.info('Client connected:', socket.id);
    
    socket.on('start_session', async (data) => {
        try {
            const user = await authService.verifyToken(data.token);
            socket.userId = user.id;
            socket.sessionId = crypto.randomBytes(16).toString('hex');
            
            // Send welcome email if new user
            if (user.isNewUser) {
                await agent.emailService.sendTemplateEmail('welcome', {
                    name: user.name,
                    company: 'AI Agent System',
                    ctaUrl: process.env.APP_URL
                }, user.email);
            }
            
            socket.emit('session_started', { sessionId: socket.sessionId });
        } catch (error) {
            socket.emit('error', { message: 'Authentication failed' });
        }
    });
    
    socket.on('send_message', async (data) => {
        try {
            if (!socket.userId) {
                socket.emit('error', { message: 'Not authenticated' });
                return;
            }
            
            const user = await authService.getUserById(socket.userId);
            const result = await agent.processQuery(data.message, {
                user,
                emailNotifications: user.emailPreferences,
                history: data.history || []
            }, socket.sessionId);
            
            socket.emit('response', result);
        } catch (error) {
            socket.emit('error', { message: error.message });
        }
    });
    
    socket.on('disconnect', async () => {
        logger.info('Client disconnected:', socket.id);
        if (socket.userId && socket.sessionId) {
            await agent.endSession(socket.sessionId, socket.userId);
        }
    });
});

// Queue monitoring
app.use('/admin/queues', queueService.serverAdapter.getRouter());

// Email admin interface
app.get('/admin/email', authenticate, (req, res) => {
    if (!req.user.isAdmin) {
        return res.status(403).send('Access denied');
    }
    res.sendFile(path.join(__dirname, 'public', 'email-admin.html'));
});

// Health check
app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        services: {
            database: databaseService.isConnected(),
            email: agent.emailService.initialized,
            cache: true,
            queue: true
        }
    });
});

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    logger.info(`Enhanced AI Agent with Email running on port ${PORT}`);
    logger.info(`Email Admin: http://localhost:${PORT}/admin/email`);
    logger.info(`Queue Dashboard: http://localhost:${PORT}/admin/queues`);
});