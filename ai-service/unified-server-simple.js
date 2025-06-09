const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const winston = require('winston');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Services
const VertexAIService = require('./services/vertexai.service');

// Integration tools
const SalesforceIntegration = require('./integrations/crm/salesforce.integration');
const GmailIntegration = require('./integrations/email/gmail.integration');
const GoogleCalendarIntegration = require('./integrations/calendar/google-calendar.integration');

/**
 * Simplified Unified AI Server
 * Works with existing integrations
 */
class UnifiedAIServer {
    constructor() {
        this.app = express();
        this.port = process.env.PORT || 3001;
        this.logger = this.initializeLogger();
        this.aiService = null;
        this.integrations = new Map();
        this.db = null;
    }

    async initialize() {
        try {
            this.logger.info('Initializing Unified AI Server...');
            
            // Load environment variables
            require('dotenv').config();

            // Initialize AI service
            this.aiService = new VertexAIService();
            this.aiService.initialize();
            this.logger.info('AI service initialized', { 
                metrics: this.aiService.getMetrics() 
            });

            // Initialize database
            await this.initializeDatabase();
            
            // Initialize integrations
            await this.initializeIntegrations();
            
            // Setup middleware
            this.setupMiddleware();
            
            // Setup routes
            this.setupRoutes();
            
            this.logger.info('Server initialization complete');
        } catch (error) {
            this.logger.error('Server initialization failed', { error: error.message });
            throw error;
        }
    }

    async initializeDatabase() {
        return new Promise((resolve, reject) => {
            this.db = new sqlite3.Database(':memory:', (err) => {
                if (err) {
                    reject(err);
                    return;
                }
                
                // Create tables
                this.db.serialize(() => {
                    // Conversations table
                    this.db.run(`CREATE TABLE conversations (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        user_id TEXT,
                        message TEXT,
                        response TEXT,
                        tools_used TEXT,
                        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
                    )`);

                    // Tasks table
                    this.db.run(`CREATE TABLE tasks (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        title TEXT,
                        description TEXT,
                        status TEXT DEFAULT 'pending',
                        priority TEXT DEFAULT 'medium',
                        due_date DATETIME,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                    )`);

                    this.logger.info('Database initialized');
                    resolve();
                });
            });
        });
    }

    async initializeIntegrations() {
        // Initialize Salesforce
        const salesforce = new SalesforceIntegration();
        await salesforce.initialize();
        this.integrations.set('salesforce', salesforce);

        // Initialize Gmail
        const gmail = new GmailIntegration();
        await gmail.initialize();
        this.integrations.set('gmail', gmail);

        // Initialize Google Calendar
        const googleCalendar = new GoogleCalendarIntegration();
        await googleCalendar.initialize();
        this.integrations.set('googleCalendar', googleCalendar);

        this.logger.info('Integrations initialized', {
            integrations: Array.from(this.integrations.keys())
        });
    }

    setupMiddleware() {
        // Security
        this.app.use(helmet());
        
        // Compression
        this.app.use(compression());
        
        // CORS
        this.app.use(cors({
            origin: '*',
            credentials: true
        }));
        
        // Body parsing
        this.app.use(express.json({ limit: '10mb' }));
        this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));
        
        // Static files
        this.app.use('/demo', express.static(path.join(__dirname, 'demo')));
        
        // Request logging
        this.app.use((req, res, next) => {
            this.logger.info('Request', {
                method: req.method,
                path: req.path,
                ip: req.ip
            });
            next();
        });
    }

    setupRoutes() {
        // Health check
        this.app.get('/health', (req, res) => {
            res.json({
                status: 'healthy',
                service: 'Unified AI Service',
                timestamp: new Date().toISOString(),
                integrations: Array.from(this.integrations.keys())
            });
        });

        // Main AI endpoint
        this.app.post('/api/ai/process', async (req, res) => {
            try {
                const { message, context = {} } = req.body;

                if (!message) {
                    return res.status(400).json({
                        success: false,
                        error: 'Message is required'
                    });
                }

                // Analyze message for tool requirements
                const tools = this.detectRequiredTools(message);
                
                // Execute tools if needed
                let toolResults = {};
                for (const tool of tools) {
                    if (this.integrations.has(tool)) {
                        try {
                            const integration = this.integrations.get(tool);
                            const result = await this.executeIntegration(integration, message, context);
                            toolResults[tool] = result;
                        } catch (error) {
                            this.logger.error(`Tool execution failed: ${tool}`, { error: error.message });
                            toolResults[tool] = { error: error.message };
                        }
                    }
                }

                // Generate AI response
                const prompt = this.buildPrompt(message, toolResults);
                const aiResponse = await this.aiService.generateContent(prompt);

                // Save to database
                this.saveConversation({
                    userId: context.userId || 'anonymous',
                    message,
                    response: aiResponse,
                    toolsUsed: JSON.stringify(tools)
                });

                res.json({
                    success: true,
                    response: aiResponse,
                    toolsUsed: tools,
                    toolResults: toolResults
                });

            } catch (error) {
                this.logger.error('Request processing failed', { error: error.message });
                res.status(500).json({
                    success: false,
                    error: error.message
                });
            }
        });

        // Streaming endpoint
        this.app.post('/api/ai/stream', async (req, res) => {
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

                // Analyze and process
                const tools = this.detectRequiredTools(message);
                
                // Send initial event
                res.write(`data: ${JSON.stringify({ type: 'start', tools })}\\n\\n`);

                // Execute tools
                for (const tool of tools) {
                    if (this.integrations.has(tool)) {
                        res.write(`data: ${JSON.stringify({ type: 'tool_start', tool })}\\n\\n`);
                        
                        try {
                            const integration = this.integrations.get(tool);
                            const result = await this.executeIntegration(integration, message, context);
                            res.write(`data: ${JSON.stringify({ type: 'tool_result', tool, result })}\\n\\n`);
                        } catch (error) {
                            res.write(`data: ${JSON.stringify({ type: 'tool_error', tool, error: error.message })}\\n\\n`);
                        }
                    }
                }

                // Stream AI response
                const prompt = this.buildPrompt(message, {});
                const stream = await this.aiService.generateContentStream(prompt);
                
                for await (const chunk of stream) {
                    res.write(`data: ${JSON.stringify({ type: 'content', content: chunk })}\\n\\n`);
                }

                res.write(`data: ${JSON.stringify({ type: 'end' })}\\n\\n`);
                res.end();

            } catch (error) {
                this.logger.error('Streaming failed', { error: error.message });
                res.write(`data: ${JSON.stringify({ type: 'error', error: error.message })}\\n\\n`);
                res.end();
            }
        });

        // Integration-specific endpoints
        this.app.get('/api/integrations', (req, res) => {
            const integrations = Array.from(this.integrations.entries()).map(([name, integration]) => ({
                name,
                description: integration.description,
                status: 'active'
            }));

            res.json({
                success: true,
                integrations
            });
        });

        // Tasks endpoint
        this.app.get('/api/tasks', (req, res) => {
            this.db.all('SELECT * FROM tasks ORDER BY created_at DESC', (err, rows) => {
                if (err) {
                    return res.status(500).json({ success: false, error: err.message });
                }
                res.json({ success: true, tasks: rows });
            });
        });

        this.app.post('/api/tasks', (req, res) => {
            const { title, description, priority, due_date } = req.body;
            
            this.db.run(
                'INSERT INTO tasks (title, description, priority, due_date) VALUES (?, ?, ?, ?)',
                [title, description, priority, due_date],
                function(err) {
                    if (err) {
                        return res.status(500).json({ success: false, error: err.message });
                    }
                    res.json({ success: true, taskId: this.lastID });
                }
            );
        });

        // Demo UI
        this.app.get('/', (req, res) => {
            res.redirect('/demo/unified-demo-enhanced.html');
        });

        // 404 handler
        this.app.use((req, res) => {
            res.status(404).json({
                success: false,
                error: 'Not Found'
            });
        });
    }

    detectRequiredTools(message) {
        const tools = [];
        const lowerMessage = message.toLowerCase();

        // Email detection
        if (lowerMessage.includes('email') || lowerMessage.includes('send') || lowerMessage.includes('draft')) {
            tools.push('gmail');
        }

        // Calendar detection
        if (lowerMessage.includes('calendar') || lowerMessage.includes('schedule') || lowerMessage.includes('meeting')) {
            tools.push('googleCalendar');
        }

        // CRM detection
        if (lowerMessage.includes('lead') || lowerMessage.includes('contact') || lowerMessage.includes('customer')) {
            tools.push('salesforce');
        }

        return tools;
    }

    async executeIntegration(integration, message, context) {
        // Simple operation detection based on message
        const lowerMessage = message.toLowerCase();
        
        if (integration.name === 'gmailIntegration') {
            if (lowerMessage.includes('send')) {
                // Extract email details from message (simplified)
                return await integration.execute({
                    operation: 'sendEmail',
                    emailData: {
                        to: context.emailTo || 'example@email.com',
                        subject: context.subject || 'AI Generated Email',
                        body: context.body || 'This is an AI generated email.'
                    }
                }, context);
            } else {
                return await integration.execute({
                    operation: 'listEmails',
                    maxResults: 5
                }, context);
            }
        }
        
        if (integration.name === 'googleCalendarIntegration') {
            if (lowerMessage.includes('schedule')) {
                return await integration.execute({
                    operation: 'createEvent',
                    eventData: {
                        title: context.title || 'AI Scheduled Meeting',
                        startTime: context.startTime || new Date(Date.now() + 86400000).toISOString(),
                        duration: 60
                    }
                }, context);
            } else {
                return await integration.execute({
                    operation: 'listEvents',
                    timeMin: new Date().toISOString(),
                    maxResults: 5
                }, context);
            }
        }
        
        if (integration.name === 'salesforceIntegration') {
            return await integration.execute({
                operation: 'getLeads',
                filters: { status: 'Open' }
            }, context);
        }
        
        return { message: 'Operation not implemented' };
    }

    buildPrompt(message, toolResults) {
        let prompt = `User Query: ${message}\\n\\n`;
        
        if (Object.keys(toolResults).length > 0) {
            prompt += 'Tool Results:\\n';
            for (const [tool, result] of Object.entries(toolResults)) {
                prompt += `\\n${tool}: ${JSON.stringify(result, null, 2)}\\n`;
            }
            prompt += '\\n';
        }
        
        prompt += 'Please provide a helpful response based on the query and any tool results.';
        return prompt;
    }

    saveConversation(data) {
        this.db.run(
            'INSERT INTO conversations (user_id, message, response, tools_used) VALUES (?, ?, ?, ?)',
            [data.userId, data.message, data.response, data.toolsUsed],
            (err) => {
                if (err) {
                    this.logger.error('Failed to save conversation', { error: err.message });
                }
            }
        );
    }

    initializeLogger() {
        return winston.createLogger({
            level: 'info',
            format: winston.format.combine(
                winston.format.timestamp(),
                winston.format.errors({ stack: true }),
                winston.format.json()
            ),
            transports: [
                new winston.transports.Console({
                    format: winston.format.combine(
                        winston.format.colorize(),
                        winston.format.simple()
                    )
                })
            ]
        });
    }

    async start() {
        this.app.listen(this.port, () => {
            this.logger.info(`Server started on port ${this.port}`);
            console.log(`
╔═══════════════════════════════════════════════════════════════╗
║                   🚀 Unified AI Service                        ║
╠═══════════════════════════════════════════════════════════════╣
║  Status:     ✅ Operational                                    ║
║  Port:       ${this.port}                                             ║
║  Demo UI:    http://localhost:${this.port}/                           ║
║  API:        http://localhost:${this.port}/api/ai/process             ║
╚═══════════════════════════════════════════════════════════════╝
            `);
        });
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