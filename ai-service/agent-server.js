const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const AgentWorkflowService = require('./services/agent-workflow.service');
const IntelligentCacheService = require('./services/intelligent-cache.service');
const GoogleAuthService = require('./services/google-auth.service');
require('dotenv').config();

/**
 * Enhanced Agent Server with Workflows and Caching
 */
class EnhancedAgentServer {
    constructor() {
        this.app = express();
        this.port = process.env.AGENT_PORT || 3004;
        
        // Initialize services
        this.cache = new IntelligentCacheService({
            stdTTL: 300,
            maxKeys: 1000
        });
        
        this.workflow = new AgentWorkflowService();
        this.googleAuth = new GoogleAuthService();
        
        // Initialize Gemini
        this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        this.model = this.genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
        
        this.setupMiddleware();
        this.setupRoutes();
        this.setupWorkflowListeners();
    }

    setupMiddleware() {
        this.app.use(helmet());
        this.app.use(cors());
        this.app.use(express.json({ limit: '10mb' }));
        this.app.use(express.static('demo'));
        
        // Request logging
        this.app.use((req, res, next) => {
            console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
            next();
        });
    }

    setupRoutes() {
        // Health check
        this.app.get('/health', (req, res) => {
            res.json({
                status: 'healthy',
                service: 'Enhanced Agent Server',
                features: {
                    workflows: true,
                    caching: true,
                    googleAuth: true,
                    ai: true
                },
                stats: {
                    cache: this.cache.getStats(),
                    workflows: this.workflow.listWorkflows().length
                }
            });
        });

        // Agent chat with caching
        this.app.post('/agent/chat', async (req, res) => {
            try {
                const { message, context = {}, useCache = true } = req.body;
                
                if (!message) {
                    return res.status(400).json({ error: 'Message required' });
                }

                let response;
                
                if (useCache) {
                    // Try to get cached response
                    response = await this.cache.getOrSet(
                        { type: 'chat', message, context },
                        async () => {
                            const result = await this.model.generateContent(message);
                            return result.response.text();
                        },
                        { cache: 'ai', ttl: 300 }
                    );
                } else {
                    const result = await this.model.generateContent(message);
                    response = result.response.text();
                }

                res.json({
                    success: true,
                    response,
                    cached: useCache
                });

            } catch (error) {
                console.error('[Agent] Chat error:', error);
                res.status(500).json({ error: error.message });
            }
        });

        // Workflow endpoints
        this.app.get('/workflows', (req, res) => {
            const workflows = this.workflow.listWorkflows();
            res.json({
                success: true,
                workflows,
                count: workflows.length
            });
        });

        this.app.post('/workflows/:id/execute', async (req, res) => {
            try {
                const { id } = req.params;
                const { inputs = {}, context = {} } = req.body;
                
                // Check cache for completed workflows
                const cacheKey = { workflow: id, inputs };
                const cached = await this.cache.get(cacheKey, { cache: 'workflow' });
                
                if (cached) {
                    return res.json({
                        success: true,
                        cached: true,
                        execution: cached
                    });
                }
                
                // Execute workflow
                const execution = await this.workflow.executeWorkflow(id, inputs, context);
                
                // Cache successful executions
                if (execution.status === 'completed') {
                    await this.cache.set(cacheKey, execution, { 
                        cache: 'workflow',
                        ttl: 1800,
                        tags: ['workflow', `workflow:${id}`]
                    });
                }
                
                res.json({
                    success: true,
                    cached: false,
                    execution
                });
                
            } catch (error) {
                console.error('[Workflow] Execution error:', error);
                res.status(500).json({ error: error.message });
            }
        });

        this.app.get('/workflows/:executionId/status', (req, res) => {
            const status = this.workflow.getExecutionStatus(req.params.executionId);
            
            if (!status) {
                return res.status(404).json({ error: 'Execution not found' });
            }
            
            res.json({
                success: true,
                status
            });
        });

        // Google Auth endpoints
        this.app.get('/auth/google/status', async (req, res) => {
            try {
                const client = await this.googleAuth.getAuthClient();
                const hasAuth = !!client;
                
                res.json({
                    success: true,
                    authenticated: hasAuth,
                    scopes: hasAuth ? this.googleAuth.SCOPES : []
                });
            } catch (error) {
                res.json({
                    success: false,
                    authenticated: false,
                    error: error.message
                });
            }
        });

        this.app.post('/auth/google/setup', async (req, res) => {
            try {
                await this.googleAuth.initialize();
                res.json({
                    success: true,
                    message: 'Google authentication initialized'
                });
            } catch (error) {
                res.status(500).json({
                    success: false,
                    error: error.message
                });
            }
        });

        // Cache management endpoints
        this.app.get('/cache/stats', (req, res) => {
            res.json({
                success: true,
                stats: this.cache.getStats()
            });
        });

        this.app.delete('/cache/invalidate', async (req, res) => {
            const { pattern, tags, cache } = req.body;
            
            const invalidated = await this.cache.invalidate(pattern, { tags, cache });
            
            res.json({
                success: true,
                invalidated
            });
        });

        this.app.delete('/cache/clear', (req, res) => {
            const { cache } = req.query;
            this.cache.clear(cache);
            
            res.json({
                success: true,
                message: cache ? `Cache '${cache}' cleared` : 'All caches cleared'
            });
        });

        // Advanced agent endpoint with tool execution
        this.app.post('/agent/execute', async (req, res) => {
            try {
                const { task, tools = [], context = {} } = req.body;
                
                if (!task) {
                    return res.status(400).json({ error: 'Task required' });
                }

                // Create a workflow on the fly for complex tasks
                const dynamicWorkflow = {
                    id: `dynamic_${Date.now()}`,
                    name: 'Dynamic Task Execution',
                    description: task,
                    steps: tools.map((tool, index) => ({
                        id: `step_${index}`,
                        name: tool.name,
                        action: tool.action,
                        params: tool.params || {},
                        output: `result_${index}`
                    }))
                };

                // Register and execute
                this.workflow.registerWorkflow(dynamicWorkflow);
                const execution = await this.workflow.executeWorkflow(
                    dynamicWorkflow.id,
                    context,
                    { userId: context.userId }
                );

                res.json({
                    success: true,
                    execution
                });

            } catch (error) {
                console.error('[Agent] Execute error:', error);
                res.status(500).json({ error: error.message });
            }
        });

        // Root endpoint
        this.app.get('/', (req, res) => {
            res.json({
                service: 'Enhanced Agent Server',
                version: '2.0',
                endpoints: {
                    chat: '/agent/chat',
                    workflows: '/workflows',
                    execute: '/agent/execute',
                    cache: '/cache/stats',
                    auth: '/auth/google/status'
                }
            });
        });
    }

    setupWorkflowListeners() {
        // Log workflow events
        this.workflow.on('workflow:started', ({ executionId, workflowId }) => {
            console.log(`[Workflow] Started: ${workflowId} (${executionId})`);
        });

        this.workflow.on('workflow:completed', ({ executionId }) => {
            console.log(`[Workflow] Completed: ${executionId}`);
        });

        this.workflow.on('workflow:failed', ({ executionId, error }) => {
            console.error(`[Workflow] Failed: ${executionId}`, error);
        });

        // Cache events
        this.cache.on('cache:hit', ({ cache, key }) => {
            console.log(`[Cache] Hit in ${cache}: ${key.substring(0, 20)}...`);
        });

        this.cache.on('cache:miss', ({ cache, key }) => {
            console.log(`[Cache] Miss in ${cache}: ${key.substring(0, 20)}...`);
        });
    }

    async start() {
        // Initialize Google Auth if credentials exist
        try {
            await this.googleAuth.initialize();
            console.log('[Auth] Google authentication initialized');
        } catch (error) {
            console.log('[Auth] Google auth not configured, some features will be limited');
        }

        this.app.listen(this.port, () => {
            console.log(`
╔═══════════════════════════════════════════════════════════════╗
║                 🤖 Enhanced Agent Server                       ║
╠═══════════════════════════════════════════════════════════════╣
║  Status:     ✅ Running                                        ║
║  Port:       ${this.port}                                             ║
║  Features:                                                     ║
║    • Agentic Workflows                                        ║
║    • Intelligent Caching                                      ║
║    • Google Integration                                       ║
║    • Dynamic Task Execution                                   ║
║                                                               ║
║  Endpoints:  http://localhost:${this.port}/                           ║
╚═══════════════════════════════════════════════════════════════╝
            `);
        });
    }
}

// Start server
if (require.main === module) {
    const server = new EnhancedAgentServer();
    server.start().catch(console.error);
}

module.exports = EnhancedAgentServer;