const express = require('express');
const router = express.Router();
const { body, param, query, validationResult } = require('express-validator');
const webhookService = require('../services/webhook.service');
const authService = require('../services/auth.service');
const databaseService = require('../services/database.service');

// Validation middleware
const validate = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    next();
};

// Create webhook validation
const createWebhookValidation = [
    body('url').isURL().withMessage('Valid URL is required'),
    body('events').isArray({ min: 1 }).withMessage('At least one event is required'),
    body('events.*').isIn([
        'query.started',
        'query.completed',
        'tool.executed',
        'session.created',
        'session.ended',
        'error.occurred'
    ]).withMessage('Invalid event type'),
    body('secret').optional().isString(),
    body('headers').optional().isObject(),
    body('active').optional().isBoolean(),
    body('description').optional().isString().isLength({ max: 500 })
];

// Update webhook validation
const updateWebhookValidation = [
    param('webhookId').isUUID(),
    body('url').optional().isURL(),
    body('events').optional().isArray({ min: 1 }),
    body('events.*').optional().isIn([
        'query.started',
        'query.completed',
        'tool.executed',
        'session.created',
        'session.ended',
        'error.occurred'
    ]),
    body('secret').optional().isString(),
    body('headers').optional().isObject(),
    body('active').optional().isBoolean(),
    body('description').optional().isString().isLength({ max: 500 })
];

/**
 * @route POST /api/webhooks
 * @desc Register a new webhook
 * @access Private
 */
router.post('/', 
    authService.authenticateToken,
    createWebhookValidation,
    validate,
    async (req, res) => {
        try {
            const userId = req.user.id;
            const webhookData = {
                ...req.body,
                userId
            };
            
            const webhook = await webhookService.registerWebhook(webhookData);
            
            // Save to database
            await databaseService.saveWebhook({
                ...webhook,
                userId
            });
            
            res.status(201).json({
                success: true,
                webhook: {
                    id: webhook.id,
                    url: webhook.url,
                    events: webhook.events,
                    active: webhook.active,
                    description: webhook.description,
                    createdAt: webhook.createdAt
                }
            });
        } catch (error) {
            console.error('Error creating webhook:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to create webhook'
            });
        }
    }
);

/**
 * @route GET /api/webhooks
 * @desc List all webhooks for authenticated user
 * @access Private
 */
router.get('/',
    authService.authenticateToken,
    [
        query('event').optional().isString(),
        query('active').optional().isBoolean()
    ],
    validate,
    async (req, res) => {
        try {
            const userId = req.user.id;
            const filters = {
                event: req.query.event,
                active: req.query.active === 'true' ? true : req.query.active === 'false' ? false : undefined
            };
            
            const webhooks = await databaseService.listWebhooks(userId, filters);
            
            res.json({
                success: true,
                webhooks: webhooks.map(w => ({
                    id: w.id,
                    url: w.url,
                    events: w.events,
                    active: w.active,
                    description: w.description,
                    createdAt: w.created_at || w.createdAt,
                    updatedAt: w.updated_at || w.updatedAt
                }))
            });
        } catch (error) {
            console.error('Error listing webhooks:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to list webhooks'
            });
        }
    }
);

/**
 * @route GET /api/webhooks/:webhookId
 * @desc Get webhook details
 * @access Private
 */
router.get('/:webhookId',
    authService.authenticateToken,
    [param('webhookId').isUUID()],
    validate,
    async (req, res) => {
        try {
            const { webhookId } = req.params;
            const userId = req.user.id;
            
            const webhook = await webhookService.getWebhook(webhookId);
            
            if (!webhook || webhook.userId !== userId) {
                return res.status(404).json({
                    success: false,
                    error: 'Webhook not found'
                });
            }
            
            res.json({
                success: true,
                webhook: {
                    id: webhook.id,
                    url: webhook.url,
                    events: webhook.events,
                    secret: webhook.secret,
                    active: webhook.active,
                    description: webhook.description,
                    headers: webhook.headers,
                    metadata: webhook.metadata,
                    deliveryStats: webhook.deliveryStats,
                    createdAt: webhook.createdAt,
                    updatedAt: webhook.updatedAt
                }
            });
        } catch (error) {
            console.error('Error getting webhook:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to get webhook'
            });
        }
    }
);

/**
 * @route PUT /api/webhooks/:webhookId
 * @desc Update webhook configuration
 * @access Private
 */
router.put('/:webhookId',
    authService.authenticateToken,
    updateWebhookValidation,
    validate,
    async (req, res) => {
        try {
            const { webhookId } = req.params;
            const userId = req.user.id;
            
            const webhook = await webhookService.getWebhook(webhookId);
            
            if (!webhook || webhook.userId !== userId) {
                return res.status(404).json({
                    success: false,
                    error: 'Webhook not found'
                });
            }
            
            const updated = await webhookService.updateWebhook(webhookId, req.body);
            
            // Update in database
            await databaseService.updateWebhook(webhookId, req.body);
            
            res.json({
                success: true,
                webhook: {
                    id: updated.id,
                    url: updated.url,
                    events: updated.events,
                    active: updated.active,
                    description: updated.description,
                    updatedAt: updated.updatedAt
                }
            });
        } catch (error) {
            console.error('Error updating webhook:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to update webhook'
            });
        }
    }
);

/**
 * @route DELETE /api/webhooks/:webhookId
 * @desc Delete a webhook
 * @access Private
 */
router.delete('/:webhookId',
    authService.authenticateToken,
    [param('webhookId').isUUID()],
    validate,
    async (req, res) => {
        try {
            const { webhookId } = req.params;
            const userId = req.user.id;
            
            const webhook = await webhookService.getWebhook(webhookId);
            
            if (!webhook || webhook.userId !== userId) {
                return res.status(404).json({
                    success: false,
                    error: 'Webhook not found'
                });
            }
            
            await webhookService.deleteWebhook(webhookId);
            await databaseService.deleteWebhook(webhookId);
            
            res.json({
                success: true,
                message: 'Webhook deleted successfully'
            });
        } catch (error) {
            console.error('Error deleting webhook:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to delete webhook'
            });
        }
    }
);

/**
 * @route POST /api/webhooks/:webhookId/test
 * @desc Test a webhook configuration
 * @access Private
 */
router.post('/:webhookId/test',
    authService.authenticateToken,
    [param('webhookId').isUUID()],
    validate,
    async (req, res) => {
        try {
            const { webhookId } = req.params;
            const userId = req.user.id;
            
            const webhook = await webhookService.getWebhook(webhookId);
            
            if (!webhook || webhook.userId !== userId) {
                return res.status(404).json({
                    success: false,
                    error: 'Webhook not found'
                });
            }
            
            const result = await webhookService.testWebhook(webhookId);
            
            res.json({
                success: true,
                test: result
            });
        } catch (error) {
            console.error('Error testing webhook:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to test webhook'
            });
        }
    }
);

/**
 * @route GET /api/webhooks/:webhookId/deliveries
 * @desc Get webhook delivery history
 * @access Private
 */
router.get('/:webhookId/deliveries',
    authService.authenticateToken,
    [
        param('webhookId').isUUID(),
        query('limit').optional().isInt({ min: 1, max: 1000 }),
        query('status').optional().isIn(['success', 'failed'])
    ],
    validate,
    async (req, res) => {
        try {
            const { webhookId } = req.params;
            const userId = req.user.id;
            const limit = parseInt(req.query.limit) || 100;
            const status = req.query.status;
            
            const webhook = await webhookService.getWebhook(webhookId);
            
            if (!webhook || webhook.userId !== userId) {
                return res.status(404).json({
                    success: false,
                    error: 'Webhook not found'
                });
            }
            
            const deliveries = await webhookService.getDeliveryHistory(webhookId, {
                limit,
                status
            });
            
            res.json({
                success: true,
                deliveries
            });
        } catch (error) {
            console.error('Error getting webhook deliveries:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to get webhook deliveries'
            });
        }
    }
);

/**
 * @route GET /api/webhooks/:webhookId/stats
 * @desc Get webhook statistics
 * @access Private
 */
router.get('/:webhookId/stats',
    authService.authenticateToken,
    [param('webhookId').isUUID()],
    validate,
    async (req, res) => {
        try {
            const { webhookId } = req.params;
            const userId = req.user.id;
            
            const webhook = await webhookService.getWebhook(webhookId);
            
            if (!webhook || webhook.userId !== userId) {
                return res.status(404).json({
                    success: false,
                    error: 'Webhook not found'
                });
            }
            
            const stats = await webhookService.getWebhookStats(webhookId);
            
            res.json({
                success: true,
                stats
            });
        } catch (error) {
            console.error('Error getting webhook stats:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to get webhook statistics'
            });
        }
    }
);

/**
 * @route POST /api/webhooks/:webhookId/pause
 * @desc Pause a webhook
 * @access Private
 */
router.post('/:webhookId/pause',
    authService.authenticateToken,
    [param('webhookId').isUUID()],
    validate,
    async (req, res) => {
        try {
            const { webhookId } = req.params;
            const userId = req.user.id;
            
            const webhook = await webhookService.getWebhook(webhookId);
            
            if (!webhook || webhook.userId !== userId) {
                return res.status(404).json({
                    success: false,
                    error: 'Webhook not found'
                });
            }
            
            await webhookService.pauseWebhook(webhookId);
            await databaseService.updateWebhook(webhookId, { active: false });
            
            res.json({
                success: true,
                message: 'Webhook paused successfully'
            });
        } catch (error) {
            console.error('Error pausing webhook:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to pause webhook'
            });
        }
    }
);

/**
 * @route POST /api/webhooks/:webhookId/resume
 * @desc Resume a webhook
 * @access Private
 */
router.post('/:webhookId/resume',
    authService.authenticateToken,
    [param('webhookId').isUUID()],
    validate,
    async (req, res) => {
        try {
            const { webhookId } = req.params;
            const userId = req.user.id;
            
            const webhook = await webhookService.getWebhook(webhookId);
            
            if (!webhook || webhook.userId !== userId) {
                return res.status(404).json({
                    success: false,
                    error: 'Webhook not found'
                });
            }
            
            await webhookService.resumeWebhook(webhookId);
            await databaseService.updateWebhook(webhookId, { active: true });
            
            res.json({
                success: true,
                message: 'Webhook resumed successfully'
            });
        } catch (error) {
            console.error('Error resuming webhook:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to resume webhook'
            });
        }
    }
);

/**
 * @route GET /api/webhooks/events/types
 * @desc Get available webhook event types
 * @access Private
 */
router.get('/events/types',
    authService.authenticateToken,
    async (req, res) => {
        try {
            res.json({
                success: true,
                eventTypes: webhookService.eventTypes
            });
        } catch (error) {
            console.error('Error getting event types:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to get event types'
            });
        }
    }
);

module.exports = router;