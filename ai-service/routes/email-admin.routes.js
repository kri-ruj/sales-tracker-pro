const express = require('express');
const router = express.Router();
const { body, query, validationResult } = require('express-validator');
const emailValidator = require('email-validator');

/**
 * Email Admin Routes
 * Provides admin interface for email management
 */
module.exports = (enhancedEmailService, authMiddleware) => {
    // Middleware to check admin permissions
    const adminOnly = (req, res, next) => {
        if (!req.user || !req.user.isAdmin) {
            return res.status(403).json({ error: 'Admin access required' });
        }
        next();
    };
    
    /**
     * Get email dashboard stats
     */
    router.get('/dashboard', authMiddleware, adminOnly, async (req, res) => {
        try {
            // Get analytics for the last 30 days
            const startDate = new Date();
            startDate.setDate(startDate.getDate() - 30);
            
            const analytics = await enhancedEmailService.getEmailAnalytics({
                startDate,
                endDate: new Date()
            });
            
            // Get provider status
            const providers = enhancedEmailService.transporters.keys();
            const providerStatus = {};
            
            for (const provider of providers) {
                const testResult = await enhancedEmailService.testConfiguration(provider);
                providerStatus[provider] = {
                    active: provider === enhancedEmailService.activeProvider,
                    status: testResult.success ? 'online' : 'offline',
                    error: testResult.error
                };
            }
            
            res.json({
                analytics,
                providers: providerStatus,
                activeProvider: enhancedEmailService.activeProvider,
                templates: Array.from(enhancedEmailService.templates.keys())
            });
        } catch (error) {
            console.error('Dashboard error:', error);
            res.status(500).json({ error: error.message });
        }
    });
    
    /**
     * Get email logs with filtering
     */
    router.get('/logs', 
        authMiddleware, 
        adminOnly,
        [
            query('startDate').optional().isISO8601(),
            query('endDate').optional().isISO8601(),
            query('email').optional().isEmail(),
            query('template').optional().isString(),
            query('status').optional().isIn(['sent', 'failed', 'bounced', 'pending']),
            query('page').optional().isInt({ min: 1 }).default(1),
            query('limit').optional().isInt({ min: 1, max: 100 }).default(50)
        ],
        async (req, res) => {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({ errors: errors.array() });
            }
            
            try {
                const filters = {
                    startDate: req.query.startDate,
                    endDate: req.query.endDate,
                    email: req.query.email,
                    template: req.query.template,
                    status: req.query.status
                };
                
                const analytics = await enhancedEmailService.getEmailAnalytics(filters);
                
                // Paginate results
                const page = parseInt(req.query.page) || 1;
                const limit = parseInt(req.query.limit) || 50;
                const startIndex = (page - 1) * limit;
                const endIndex = startIndex + limit;
                
                const paginatedLogs = analytics.logs.slice(startIndex, endIndex);
                
                res.json({
                    ...analytics,
                    logs: paginatedLogs,
                    pagination: {
                        page,
                        limit,
                        total: analytics.logs.length,
                        pages: Math.ceil(analytics.logs.length / limit)
                    }
                });
            } catch (error) {
                console.error('Logs error:', error);
                res.status(500).json({ error: error.message });
            }
        }
    );
    
    /**
     * Send test email
     */
    router.post('/test',
        authMiddleware,
        adminOnly,
        [
            body('to').isEmail().withMessage('Valid email required'),
            body('template').optional().isString(),
            body('provider').optional().isString()
        ],
        async (req, res) => {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({ errors: errors.array() });
            }
            
            try {
                const { to, template, provider } = req.body;
                
                if (template) {
                    // Send template email
                    const result = await enhancedEmailService.sendTemplateEmail(
                        template,
                        {
                            name: 'Test User',
                            company: 'AI Agent System',
                            sessionId: 'test-123',
                            duration: '5m 30s',
                            queries: [
                                { query: 'Test query 1', status: 'completed' },
                                { query: 'Test query 2', status: 'completed' }
                            ],
                            errorType: 'Test Error',
                            errorMessage: 'This is a test error',
                            timestamp: new Date().toISOString(),
                            stackTrace: 'Test stack trace',
                            queryId: 'test-query-123',
                            query: 'Test query',
                            processingTime: '2.5s',
                            toolsUsed: 'testTool1, testTool2',
                            result: 'Test result',
                            weekStart: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toLocaleDateString(),
                            weekEnd: new Date().toLocaleDateString(),
                            stats: {
                                totalQueries: 100,
                                successful: 95,
                                failed: 5,
                                avgResponseTime: '1.8s'
                            },
                            topTools: [
                                { name: 'Tool 1', count: 50 },
                                { name: 'Tool 2', count: 30 }
                            ],
                            topQueries: [
                                { type: 'Type 1', count: 60 },
                                { type: 'Type 2', count: 40 }
                            ],
                            ctaUrl: 'https://example.com'
                        },
                        to,
                        { provider }
                    );
                    
                    res.json({
                        success: true,
                        result
                    });
                } else {
                    // Send simple test email
                    const result = await enhancedEmailService.sendEmail(
                        to,
                        'Test Email from AI Agent System',
                        {
                            html: `
                                <h1>Test Email</h1>
                                <p>This is a test email from the AI Agent Email System.</p>
                                <p>Provider: ${provider || enhancedEmailService.activeProvider}</p>
                                <p>Time: ${new Date().toISOString()}</p>
                                <a href="https://example.com">Test Link</a>
                            `,
                            text: `Test Email\n\nThis is a test email from the AI Agent Email System.\nProvider: ${provider || enhancedEmailService.activeProvider}\nTime: ${new Date().toISOString()}`
                        },
                        { provider }
                    );
                    
                    res.json({
                        success: true,
                        result
                    });
                }
            } catch (error) {
                console.error('Test email error:', error);
                res.status(500).json({ error: error.message });
            }
        }
    );
    
    /**
     * Get email templates
     */
    router.get('/templates', authMiddleware, adminOnly, async (req, res) => {
        try {
            const templates = {};
            
            for (const [name, template] of enhancedEmailService.templates) {
                templates[name] = {
                    name,
                    subject: template.subject,
                    hasHtml: !!template.mjml,
                    hasText: !!template.text,
                    variables: extractVariables(template.subject + template.mjml + template.text)
                };
            }
            
            res.json(templates);
        } catch (error) {
            console.error('Templates error:', error);
            res.status(500).json({ error: error.message });
        }
    });
    
    /**
     * Preview email template
     */
    router.post('/templates/preview',
        authMiddleware,
        adminOnly,
        [
            body('template').isString().withMessage('Template name required'),
            body('variables').optional().isObject()
        ],
        async (req, res) => {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({ errors: errors.array() });
            }
            
            try {
                const { template, variables = {} } = req.body;
                
                const compiledTemplate = enhancedEmailService.compiledTemplates.get(template);
                if (!compiledTemplate) {
                    return res.status(404).json({ error: 'Template not found' });
                }
                
                // Add default variables for preview
                const defaultVariables = {
                    name: variables.name || 'John Doe',
                    company: variables.company || 'AI Agent System',
                    email: variables.email || 'user@example.com',
                    ...variables
                };
                
                // Compile subject
                const subject = compiledTemplate.subject(defaultVariables);
                
                // Compile HTML
                const mjml2html = require('mjml');
                const mjmlResult = mjml2html(compiledTemplate.html);
                const htmlTemplate = require('handlebars').compile(mjmlResult.html);
                const html = htmlTemplate(defaultVariables);
                
                // Compile text
                const text = compiledTemplate.text(defaultVariables);
                
                res.json({
                    template,
                    preview: {
                        subject,
                        html,
                        text
                    }
                });
            } catch (error) {
                console.error('Preview error:', error);
                res.status(500).json({ error: error.message });
            }
        }
    );
    
    /**
     * Get user preferences
     */
    router.get('/preferences/:email',
        authMiddleware,
        adminOnly,
        async (req, res) => {
            try {
                const email = req.params.email;
                
                if (!emailValidator.validate(email)) {
                    return res.status(400).json({ error: 'Invalid email address' });
                }
                
                const preferences = await enhancedEmailService.getUserPreferences(email);
                
                if (!preferences) {
                    return res.status(404).json({ error: 'User preferences not found' });
                }
                
                res.json(preferences);
            } catch (error) {
                console.error('Preferences error:', error);
                res.status(500).json({ error: error.message });
            }
        }
    );
    
    /**
     * Update user preferences
     */
    router.put('/preferences/:email',
        authMiddleware,
        adminOnly,
        [
            body('notifications_enabled').optional().isBoolean(),
            body('welcome_emails').optional().isBoolean(),
            body('session_summaries').optional().isBoolean(),
            body('error_notifications').optional().isBoolean(),
            body('query_completions').optional().isBoolean(),
            body('weekly_reports').optional().isBoolean(),
            body('marketing_emails').optional().isBoolean(),
            body('preferred_time').optional().matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/),
            body('timezone').optional().isString()
        ],
        async (req, res) => {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({ errors: errors.array() });
            }
            
            try {
                const email = req.params.email;
                
                if (!emailValidator.validate(email)) {
                    return res.status(400).json({ error: 'Invalid email address' });
                }
                
                await enhancedEmailService.updateUserPreferences(email, req.body);
                
                res.json({
                    success: true,
                    message: 'Preferences updated successfully'
                });
            } catch (error) {
                console.error('Update preferences error:', error);
                res.status(500).json({ error: error.message });
            }
        }
    );
    
    /**
     * Get bounce statistics
     */
    router.get('/bounces', authMiddleware, adminOnly, async (req, res) => {
        try {
            const bounces = await enhancedEmailService.databaseService.query(
                `SELECT email, COUNT(*) as count, MAX(bounced_at) as last_bounce
                 FROM email_bounces
                 GROUP BY email
                 ORDER BY count DESC
                 LIMIT 100`
            );
            
            const recentBounces = await enhancedEmailService.databaseService.query(
                `SELECT * FROM email_bounces
                 ORDER BY bounced_at DESC
                 LIMIT 50`
            );
            
            res.json({
                topBounces: bounces,
                recentBounces
            });
        } catch (error) {
            console.error('Bounces error:', error);
            res.status(500).json({ error: error.message });
        }
    });
    
    /**
     * Resend email
     */
    router.post('/resend/:messageId',
        authMiddleware,
        adminOnly,
        async (req, res) => {
            try {
                const messageId = req.params.messageId;
                
                // Get original email
                const result = await enhancedEmailService.databaseService.query(
                    'SELECT * FROM email_logs WHERE message_id = ?',
                    [messageId]
                );
                
                if (!result || result.length === 0) {
                    return res.status(404).json({ error: 'Email not found' });
                }
                
                const originalEmail = result[0];
                const metadata = JSON.parse(originalEmail.metadata || '{}');
                
                // Resend email
                const resendResult = await enhancedEmailService.sendEmail(
                    originalEmail.to_email,
                    originalEmail.subject + ' (Resent)',
                    {
                        html: metadata.html || '<p>Original content not available</p>',
                        text: metadata.text || 'Original content not available'
                    },
                    {
                        provider: originalEmail.provider,
                        metadata: {
                            ...metadata,
                            resent: true,
                            originalMessageId: messageId
                        }
                    }
                );
                
                res.json({
                    success: true,
                    result: resendResult
                });
            } catch (error) {
                console.error('Resend error:', error);
                res.status(500).json({ error: error.message });
            }
        }
    );
    
    /**
     * Send bulk email
     */
    router.post('/bulk',
        authMiddleware,
        adminOnly,
        [
            body('recipients').isArray().withMessage('Recipients array required'),
            body('recipients.*.email').isEmail().withMessage('Valid email required'),
            body('recipients.*.name').optional().isString(),
            body('template').isString().withMessage('Template required'),
            body('variables').optional().isObject(),
            body('batchSize').optional().isInt({ min: 1, max: 100 }).default(50)
        ],
        async (req, res) => {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({ errors: errors.array() });
            }
            
            try {
                const { recipients, template, variables = {}, batchSize } = req.body;
                
                // Prepare emails
                const emails = recipients.map(recipient => ({
                    to: recipient.email,
                    template,
                    variables: {
                        ...variables,
                        name: recipient.name || 'User',
                        email: recipient.email
                    }
                }));
                
                // Send bulk emails
                const result = await enhancedEmailService.sendBulkEmails(emails, {
                    batchSize
                });
                
                res.json({
                    success: true,
                    result
                });
            } catch (error) {
                console.error('Bulk email error:', error);
                res.status(500).json({ error: error.message });
            }
        }
    );
    
    /**
     * Change active provider
     */
    router.put('/provider',
        authMiddleware,
        adminOnly,
        [
            body('provider').isString().withMessage('Provider required')
        ],
        async (req, res) => {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({ errors: errors.array() });
            }
            
            try {
                const { provider } = req.body;
                
                if (!enhancedEmailService.transporters.has(provider)) {
                    return res.status(400).json({ error: 'Provider not configured' });
                }
                
                // Test provider first
                const testResult = await enhancedEmailService.testConfiguration(provider);
                if (!testResult.success) {
                    return res.status(400).json({ 
                        error: 'Provider test failed', 
                        details: testResult.error 
                    });
                }
                
                enhancedEmailService.activeProvider = provider;
                
                res.json({
                    success: true,
                    message: `Active provider changed to ${provider}`
                });
            } catch (error) {
                console.error('Provider change error:', error);
                res.status(500).json({ error: error.message });
            }
        }
    );
    
    // Helper function to extract variables from template
    function extractVariables(text) {
        const regex = /\{\{([^}]+)\}\}/g;
        const variables = new Set();
        let match;
        
        while ((match = regex.exec(text)) !== null) {
            const variable = match[1].trim();
            // Handle nested variables and helpers
            const mainVariable = variable.split(/[\s.#]/)[0];
            if (mainVariable && !['if', 'unless', 'each', 'with'].includes(mainVariable)) {
                variables.add(mainVariable);
            }
        }
        
        return Array.from(variables);
    }
    
    return router;
};