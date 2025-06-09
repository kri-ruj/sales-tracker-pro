const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const winston = require('winston');

// Core modules
const config = require('./config/config');
const VertexAIService = require('./services/vertexai.service');

// Integration tools
const SalesforceIntegration = require('./integrations/crm/salesforce.integration');
const GmailIntegration = require('./integrations/email/gmail.integration');
const OutlookEmailIntegration = require('./integrations/email/outlook.integration');
const SMTPIntegration = require('./integrations/email/smtp.integration');
const GoogleCalendarIntegration = require('./integrations/calendar/google-calendar.integration');
const OutlookCalendarIntegration = require('./integrations/calendar/outlook-calendar.integration');

/**
 * Unified AI Agent Server
 * Production-ready server with all core components integrated
 */
class UnifiedAIServer {
    constructor() {
        this.app = express();
        this.config = config;
        
        // Initialize logger
        this.logger = this.initializeLogger();
        
        // Core components
        this.aiProvider = null;
        this.integrations = new Map();
        
        // Server instance
        this.server = null;
    }

    /**
     * Initialize the server
     */
    async initialize() {
        try {
            this.logger.info('Initializing Unified AI Server...');

            // Initialize core components
            await this.initializeComponents();
            
            // Setup middleware
            this.setupMiddleware();
            
            // Setup routes
            this.setupRoutes();
            
            // Setup error handling
            this.setupErrorHandling();
            
            this.logger.info('Server initialization complete');
            
        } catch (error) {
            this.logger.error('Server initialization failed', { error: error.message });
            throw error;
        }
    }

    /**
     * Initialize core components
     */
    async initializeComponents() {
        // Initialize AI Provider
        this.aiProvider = new VertexAIProvider({
            projectId: this.config.get('googleCloud.projectId'),
            location: this.config.get('googleCloud.location'),
            defaultModel: this.config.get('ai.primaryModel'),
            fallbackModel: this.config.get('ai.fallbackModel')
        });

        // Initialize Tool Registry
        this.toolRegistry = new ToolRegistry({
            maxTools: this.config.get('tools.maxTools'),
            enableCache: this.config.get('tools.enableCache'),
            cacheSize: this.config.get('tools.cacheSize'),
            executionTimeout: this.config.get('tools.executionTimeout')
        });

        // Register tools
        await this.registerTools();

        // Initialize Orchestrator
        this.orchestrator = new AgentOrchestrator(this.aiProvider, this.toolRegistry, {
            maxExecutionTime: this.config.get('orchestrator.maxExecutionTime'),
            maxRetries: this.config.get('orchestrator.maxRetries'),
            enableParallel: this.config.get('orchestrator.enableParallel'),
            enableStreaming: this.config.get('orchestrator.enableStreaming'),
            enableMemory: this.config.get('orchestrator.enableMemory'),
            memorySize: this.config.get('orchestrator.memorySize')
        });

        // Initialize Tool Composer
        this.toolComposer = new ToolComposer(this.toolRegistry);

        this.logger.info('Core components initialized');
    }

    /**
     * Register available tools
     */
    async registerTools() {
        // Register shared tools first
        const databaseTool = new DatabaseTool();
        this.toolRegistry.registerTool(databaseTool, {
            aliases: ['db', 'storage']
        });

        // Initialize database
        try {
            await databaseTool.execute({ operation: 'init', sampleData: true }, {});
        } catch (error) {
            this.logger.warn('Database initialization failed, continuing without sample data', { error: error.message });
        }

        // Register chat tool
        const chatTool = new ChatTool();
        chatTool.setAIProvider(this.aiProvider);
        this.toolRegistry.registerTool(chatTool, {
            aliases: ['conversation', 'ask', 'talk']
        });

        // Register sales tools
        const leadSearchTool = new LeadSearchTool();
        leadSearchTool.setDatabaseTool(databaseTool);
        this.toolRegistry.registerTool(leadSearchTool, {
            aliases: ['findLeads', 'searchProspects']
        });

        const emailGeneratorTool = new EmailGeneratorTool();
        emailGeneratorTool.setDependencies(databaseTool, this.aiProvider);
        this.toolRegistry.registerTool(emailGeneratorTool, {
            aliases: ['writeEmail', 'composeEmail']
        });

        const leadAnalyzerTool = new LeadAnalyzerTool();
        leadAnalyzerTool.setDependencies(databaseTool, this.aiProvider);
        this.toolRegistry.registerTool(leadAnalyzerTool, {
            aliases: ['analyzeLead', 'scoreLead']
        });

        // Register massage tools
        const massageRecommendationTool = new MassageRecommendationTool();
        massageRecommendationTool.setDependencies(databaseTool, this.aiProvider);
        this.toolRegistry.registerTool(massageRecommendationTool, {
            aliases: ['massageAdvice', 'massageSuggestion']
        });

        // Register analytics tools
        const performanceAnalyticsTool = new PerformanceAnalyticsTool();
        performanceAnalyticsTool.setDependencies(databaseTool, this.aiProvider);
        this.toolRegistry.registerTool(performanceAnalyticsTool, {
            aliases: ['performanceReport', 'salesMetrics']
        });

        const dataVisualizationTool = new DataVisualizationTool();
        dataVisualizationTool.setDependencies(databaseTool, this.aiProvider);
        this.toolRegistry.registerTool(dataVisualizationTool, {
            aliases: ['createChart', 'makeGraph', 'visualize']
        });

        // Register productivity tools
        const calendarTool = new CalendarTool();
        await calendarTool.initialize();
        this.toolRegistry.registerTool(calendarTool, {
            aliases: ['schedule', 'calendar', 'meeting']
        });

        const taskManagerTool = new TaskManagerTool();
        taskManagerTool.setDatabaseTool(databaseTool);
        await taskManagerTool.initialize();
        this.toolRegistry.registerTool(taskManagerTool, {
            aliases: ['tasks', 'todo', 'taskList']
        });

        const documentGeneratorTool = new DocumentGeneratorTool();
        documentGeneratorTool.setAIProvider(this.aiProvider);
        this.toolRegistry.registerTool(documentGeneratorTool, {
            aliases: ['createDocument', 'generateDoc', 'writeDocument']
        });

        this.logger.info('Tools registered', {
            totalTools: this.toolRegistry.getStats().totalTools,
            categories: this.toolRegistry.getCategories(),
            tools: Array.from(this.toolRegistry.tools.keys())
        });
    }

    /**
     * Setup middleware
     */
    setupMiddleware() {
        // Security
        this.app.use(helmet());
        
        // Compression
        this.app.use(compression());
        
        // CORS
        if (this.config.get('security.cors.enabled')) {
            this.app.use(cors({
                origin: this.config.get('security.cors.origins'),
                credentials: this.config.get('security.cors.credentials')
            }));
        }
        
        // Body parsing
        this.app.use(express.json({ limit: '10mb' }));
        this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));
        
        // Rate limiting
        if (this.config.get('rateLimiting.enabled')) {
            // Global rate limit
            this.app.use(rateLimit(this.config.get('rateLimiting.global')));
            
            // AI-specific rate limit
            this.app.use('/api/ai', rateLimit(this.config.get('rateLimiting.ai')));
        }
        
        // Request logging
        this.app.use(this.requestLogger());
        
        // API key validation
        if (this.config.get('security.apiKeys.enabled')) {
            this.app.use(this.apiKeyValidator());
        }
    }

    /**
     * Setup routes
     */
    setupRoutes() {
        const router = express.Router();

        // Health check
        router.get('/health', (req, res) => {
            const health = {
                status: 'healthy',
                service: this.config.get('server.name'),
                version: this.config.get('server.version'),
                timestamp: new Date().toISOString(),
                components: {
                    aiProvider: this.aiProvider ? 'ready' : 'not ready',
                    toolRegistry: this.toolRegistry ? 'ready' : 'not ready',
                    orchestrator: this.orchestrator ? 'ready' : 'not ready'
                }
            };

            if (this.config.get('monitoring.healthCheck.detailed')) {
                health.stats = {
                    tools: this.toolRegistry.getStats(),
                    orchestrator: this.orchestrator.getStats(),
                    ai: this.aiProvider.getMetrics()
                };
            }

            res.json(health);
        });

        // Main AI endpoint
        router.post('/ai/process', async (req, res) => {
            try {
                const { message, context = {} } = req.body;

                if (!message) {
                    return res.status(400).json({
                        success: false,
                        error: 'Message is required'
                    });
                }

                // Add user context
                const enrichedContext = {
                    ...context,
                    userId: req.user?.id || req.ip,
                    authenticated: !!req.user,
                    requestId: req.id
                };

                // Process request
                const result = await this.orchestrator.processRequest(message, enrichedContext);

                res.json(result);

            } catch (error) {
                this.logger.error('Request processing failed', {
                    error: error.message,
                    requestId: req.id
                });

                res.status(500).json({
                    success: false,
                    error: 'Internal server error',
                    message: this.config.get('development.verboseErrors') ? error.message : undefined
                });
            }
        });

        // Streaming endpoint
        router.post('/ai/stream', async (req, res) => {
            try {
                const { message, context = {} } = req.body;

                if (!message) {
                    return res.status(400).json({
                        success: false,
                        error: 'Message is required'
                    });
                }

                // Set SSE headers
                res.setHeader('Content-Type', 'text/event-stream');
                res.setHeader('Cache-Control', 'no-cache');
                res.setHeader('Connection', 'keep-alive');

                // Process with streaming
                await this.orchestrator.processRequestStream(
                    message,
                    async (chunk) => {
                        res.write(`data: ${JSON.stringify(chunk)}\n\n`);
                    },
                    context
                );

                res.end();

            } catch (error) {
                this.logger.error('Streaming failed', {
                    error: error.message,
                    requestId: req.id
                });

                res.write(`data: ${JSON.stringify({ type: 'error', error: error.message })}\n\n`);
                res.end();
            }
        });

        // Tool management endpoints
        router.get('/tools', (req, res) => {
            const tools = this.toolRegistry.getToolDescriptions({
                category: req.query.category,
                excludeAuth: !req.user
            });

            res.json({
                success: true,
                tools,
                categories: this.toolRegistry.getCategories()
            });
        });

        router.get('/tools/:name', (req, res) => {
            const tool = this.toolRegistry.getTool(req.params.name);
            
            if (!tool) {
                return res.status(404).json({
                    success: false,
                    error: 'Tool not found'
                });
            }

            res.json({
                success: true,
                tool: tool.getInfo()
            });
        });

        // Workflow endpoints
        router.get('/workflows', (req, res) => {
            const workflows = this.toolComposer.listWorkflows();
            res.json({
                success: true,
                workflows,
                count: workflows.length
            });
        });

        router.post('/workflows', async (req, res) => {
            try {
                const { name, description, steps } = req.body;
                
                const workflow = this.toolComposer.createWorkflow(name, {
                    description,
                    steps
                });
                
                res.json({
                    success: true,
                    workflow
                });
            } catch (error) {
                res.status(400).json({
                    success: false,
                    error: error.message
                });
            }
        });

        router.post('/workflows/:id/execute', async (req, res) => {
            try {
                const { id } = req.params;
                const { input = {} } = req.body;
                
                const context = {
                    userId: req.user?.id || req.ip,
                    authenticated: !!req.user,
                    requestId: req.id
                };
                
                const result = await this.toolComposer.executeWorkflow(id, input, context);
                
                res.json(result);
            } catch (error) {
                res.status(500).json({
                    success: false,
                    error: error.message
                });
            }
        });

        router.post('/workflows/template/:name/execute', async (req, res) => {
            try {
                const { name } = req.params;
                const { input = {} } = req.body;
                
                const context = {
                    userId: req.user?.id || req.ip,
                    authenticated: !!req.user,
                    requestId: req.id
                };
                
                const result = await this.toolComposer.executeTemplate(name, input, context);
                
                res.json(result);
            } catch (error) {
                res.status(500).json({
                    success: false,
                    error: error.message
                });
            }
        });

        // Statistics endpoint
        router.get('/stats', (req, res) => {
            res.json({
                success: true,
                stats: {
                    tools: this.toolRegistry.getStats(),
                    orchestrator: this.orchestrator.getStats(),
                    ai: this.aiProvider.getMetrics(),
                    workflows: this.toolComposer.listWorkflows().length,
                    server: {
                        uptime: process.uptime(),
                        memory: process.memoryUsage(),
                        cpu: process.cpuUsage()
                    }
                }
            });
        });

        // Mount routes
        this.app.use('/api', router);

        // Root endpoint
        this.app.get('/', (req, res) => {
            res.json({
                service: this.config.get('server.name'),
                version: this.config.get('server.version'),
                status: 'operational',
                endpoints: {
                    health: '/api/health',
                    process: '/api/ai/process',
                    stream: '/api/ai/stream',
                    tools: '/api/tools',
                    stats: '/api/stats'
                }
            });
        });
    }

    /**
     * Setup error handling
     */
    setupErrorHandling() {
        // 404 handler
        this.app.use((req, res) => {
            res.status(404).json({
                success: false,
                error: 'Not Found',
                path: req.path
            });
        });

        // Error handler
        this.app.use((err, req, res, next) => {
            this.logger.error('Unhandled error', {
                error: err.message,
                stack: err.stack,
                requestId: req.id
            });

            res.status(err.status || 500).json({
                success: false,
                error: err.message || 'Internal Server Error',
                requestId: req.id,
                stack: this.config.get('development.verboseErrors') ? err.stack : undefined
            });
        });
    }

    /**
     * Initialize logger
     */
    initializeLogger() {
        const transports = [];

        // Console transport
        if (this.config.get('logging.transports.console')) {
            transports.push(new winston.transports.Console({
                format: winston.format.combine(
                    winston.format.colorize(),
                    winston.format.simple()
                )
            }));
        }

        // File transports
        if (this.config.get('logging.transports.file')) {
            transports.push(
                new winston.transports.File({
                    filename: this.config.get('logging.files.error'),
                    level: 'error'
                }),
                new winston.transports.File({
                    filename: this.config.get('logging.files.combined')
                })
            );
        }

        return winston.createLogger({
            level: this.config.get('logging.level'),
            format: winston.format.combine(
                winston.format.timestamp(),
                winston.format.errors({ stack: true }),
                winston.format.json()
            ),
            transports
        });
    }

    /**
     * Request logger middleware
     */
    requestLogger() {
        return (req, res, next) => {
            req.id = this.generateRequestId();
            const start = Date.now();

            res.on('finish', () => {
                const duration = Date.now() - start;
                
                this.logger.info('Request processed', {
                    requestId: req.id,
                    method: req.method,
                    path: req.path,
                    status: res.statusCode,
                    duration,
                    ip: req.ip,
                    userAgent: req.get('user-agent')
                });
            });

            next();
        };
    }

    /**
     * API key validator middleware
     */
    apiKeyValidator() {
        return (req, res, next) => {
            // Skip validation for health check
            if (req.path === '/api/health') {
                return next();
            }

            const apiKey = req.get(this.config.get('security.apiKeys.header'));
            const validKeys = this.config.get('security.apiKeys.keys');

            if (!apiKey || !validKeys[apiKey]) {
                return res.status(401).json({
                    success: false,
                    error: 'Invalid or missing API key'
                });
            }

            req.apiKeyName = validKeys[apiKey];
            next();
        };
    }

    /**
     * Start the server
     */
    async start() {
        const port = this.config.get('server.port');
        const host = this.config.get('server.host');

        this.server = this.app.listen(port, host, () => {
            this.logger.info('Server started', {
                port,
                host,
                env: this.config.get('server.env'),
                url: `http://${host}:${port}`
            });

            this.printStartupBanner();
        });

        // Graceful shutdown
        this.setupGracefulShutdown();
    }

    /**
     * Print startup banner
     */
    printStartupBanner() {
        console.log(`
╔═══════════════════════════════════════════════════════════════╗
║                   🚀 AI Agent Service v${this.config.get('server.version')}                  ║
╠═══════════════════════════════════════════════════════════════╣
║  Status:     ✅ Operational                                    ║
║  Port:       ${this.config.get('server.port')}                                             ║
║  Model:      ${this.config.get('ai.primaryModel')}                              ║
║  Tools:      ${this.toolRegistry.getStats().totalTools} registered                                   ║
║  Docs:       http://localhost:${this.config.get('server.port')}/api-docs                   ║
╚═══════════════════════════════════════════════════════════════╝
        `);
    }

    /**
     * Setup graceful shutdown
     */
    setupGracefulShutdown() {
        const shutdown = async (signal) => {
            this.logger.info(`${signal} received, starting graceful shutdown`);

            // Stop accepting new connections
            this.server.close(() => {
                this.logger.info('HTTP server closed');
            });

            // Clean up resources
            try {
                // Clear caches
                this.toolRegistry.clearCache();
                this.aiProvider.clearCache();
                
                // Close database connections
                // await this.database?.close();
                
                this.logger.info('Cleanup complete, exiting');
                process.exit(0);
            } catch (error) {
                this.logger.error('Error during shutdown', { error: error.message });
                process.exit(1);
            }
        };

        process.on('SIGTERM', () => shutdown('SIGTERM'));
        process.on('SIGINT', () => shutdown('SIGINT'));
    }

    /**
     * Generate request ID
     */
    generateRequestId() {
        return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
}

// Main execution
if (require.main === module) {
    const server = new UnifiedAIServer();
    
    server.initialize()
        .then(() => server.start())
        .catch(error => {
            console.error('Failed to start server:', error);
            process.exit(1);
        });
}

module.exports = UnifiedAIServer;