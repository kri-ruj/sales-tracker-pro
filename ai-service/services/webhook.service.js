const EventEmitter = require('events');
const axios = require('axios');
const crypto = require('crypto');
const winston = require('winston');
const { v4: uuidv4 } = require('uuid');
const databaseService = require('./database.service');

const logger = winston.createLogger({
    level: 'info',
    format: winston.format.json(),
    transports: [
        new winston.transports.Console(),
        new winston.transports.File({ filename: 'webhook.log' })
    ]
});

class WebhookService extends EventEmitter {
    constructor() {
        super();
        this.webhooks = new Map(); // In-memory storage for webhooks
        this.deliveryQueue = [];
        this.deliveryHistory = new Map();
        this.retryPolicy = {
            maxRetries: 5,
            initialDelay: 1000, // 1 second
            maxDelay: 60000, // 1 minute
            backoffMultiplier: 2
        };
        
        // Webhook event types
        this.eventTypes = {
            QUERY_STARTED: 'query.started',
            QUERY_COMPLETED: 'query.completed',
            TOOL_EXECUTED: 'tool.executed',
            SESSION_CREATED: 'session.created',
            SESSION_ENDED: 'session.ended',
            ERROR_OCCURRED: 'error.occurred'
        };
        
        // Start delivery worker
        this.startDeliveryWorker();
    }
    
    /**
     * Register a new webhook
     */
    async registerWebhook({
        url,
        events,
        secret,
        headers = {},
        active = true,
        description = '',
        metadata = {}
    }) {
        const webhookId = uuidv4();
        const webhook = {
            id: webhookId,
            url,
            events: Array.isArray(events) ? events : [events],
            secret: secret || this.generateSecret(),
            headers,
            active,
            description,
            metadata,
            createdAt: new Date(),
            updatedAt: new Date(),
            deliveryStats: {
                totalDeliveries: 0,
                successfulDeliveries: 0,
                failedDeliveries: 0,
                lastDeliveryAt: null,
                lastDeliveryStatus: null
            }
        };
        
        this.webhooks.set(webhookId, webhook);
        
        // Save to database
        await databaseService.saveWebhook({
            ...webhook,
            userId: metadata.userId
        });
        
        logger.info('Webhook registered', {
            webhookId,
            url,
            events: webhook.events
        });
        
        return webhook;
    }
    
    /**
     * Update webhook configuration
     */
    async updateWebhook(webhookId, updates) {
        const webhook = this.webhooks.get(webhookId);
        if (!webhook) {
            throw new Error('Webhook not found');
        }
        
        const updatedWebhook = {
            ...webhook,
            ...updates,
            updatedAt: new Date()
        };
        
        this.webhooks.set(webhookId, updatedWebhook);
        
        logger.info('Webhook updated', { webhookId, updates });
        
        return updatedWebhook;
    }
    
    /**
     * Delete a webhook
     */
    async deleteWebhook(webhookId) {
        const webhook = this.webhooks.get(webhookId);
        if (!webhook) {
            throw new Error('Webhook not found');
        }
        
        this.webhooks.delete(webhookId);
        
        logger.info('Webhook deleted', { webhookId });
        
        return { success: true, webhookId };
    }
    
    /**
     * Get webhook by ID
     */
    async getWebhook(webhookId) {
        const webhook = this.webhooks.get(webhookId);
        if (!webhook) {
            throw new Error('Webhook not found');
        }
        
        return webhook;
    }
    
    /**
     * List all webhooks with optional filtering
     */
    async listWebhooks({ event, active } = {}) {
        let webhooks = Array.from(this.webhooks.values());
        
        if (event) {
            webhooks = webhooks.filter(w => w.events.includes(event));
        }
        
        if (active !== undefined) {
            webhooks = webhooks.filter(w => w.active === active);
        }
        
        return webhooks;
    }
    
    /**
     * Trigger a webhook event
     */
    async triggerEvent(eventType, payload) {
        const eventId = uuidv4();
        const event = {
            id: eventId,
            type: eventType,
            payload,
            timestamp: new Date().toISOString()
        };
        
        // Save event to database
        await databaseService.saveWebhookEvent(event);
        
        // Find all webhooks subscribed to this event
        const subscribedWebhooks = Array.from(this.webhooks.values())
            .filter(webhook => 
                webhook.active && 
                webhook.events.includes(eventType)
            );
        
        logger.info('Triggering webhook event', {
            eventType,
            eventId,
            subscriberCount: subscribedWebhooks.length
        });
        
        // Queue deliveries
        for (const webhook of subscribedWebhooks) {
            this.queueDelivery(webhook, event);
        }
        
        return {
            eventId,
            type: eventType,
            subscriberCount: subscribedWebhooks.length
        };
    }
    
    /**
     * Queue a webhook delivery
     */
    queueDelivery(webhook, event) {
        const delivery = {
            id: uuidv4(),
            webhookId: webhook.id,
            webhook,
            event,
            attempts: 0,
            nextRetryAt: new Date(),
            createdAt: new Date()
        };
        
        this.deliveryQueue.push(delivery);
        
        logger.info('Webhook delivery queued', {
            deliveryId: delivery.id,
            webhookId: webhook.id,
            eventType: event.type
        });
    }
    
    /**
     * Process delivery queue
     */
    async startDeliveryWorker() {
        setInterval(async () => {
            const now = new Date();
            const pendingDeliveries = this.deliveryQueue.filter(
                d => d.nextRetryAt <= now
            );
            
            for (const delivery of pendingDeliveries) {
                await this.processDelivery(delivery);
            }
        }, 1000); // Check every second
    }
    
    /**
     * Process a single delivery
     */
    async processDelivery(delivery) {
        delivery.attempts++;
        
        try {
            const signature = this.generateSignature(
                delivery.event,
                delivery.webhook.secret
            );
            
            const headers = {
                'Content-Type': 'application/json',
                'X-Webhook-Event': delivery.event.type,
                'X-Webhook-Signature': signature,
                'X-Webhook-Delivery': delivery.id,
                'X-Webhook-Timestamp': delivery.event.timestamp,
                ...delivery.webhook.headers
            };
            
            const response = await axios.post(
                delivery.webhook.url,
                delivery.event,
                {
                    headers,
                    timeout: 30000, // 30 seconds
                    maxRedirects: 5,
                    validateStatus: (status) => status < 500 // Don't throw on 4xx errors
                }
            );
            
            // Success
            this.handleDeliverySuccess(delivery, response);
            
        } catch (error) {
            // Failure
            this.handleDeliveryFailure(delivery, error);
        }
    }
    
    /**
     * Handle successful delivery
     */
    handleDeliverySuccess(delivery, response) {
        const webhook = this.webhooks.get(delivery.webhookId);
        if (webhook) {
            webhook.deliveryStats.totalDeliveries++;
            webhook.deliveryStats.successfulDeliveries++;
            webhook.deliveryStats.lastDeliveryAt = new Date();
            webhook.deliveryStats.lastDeliveryStatus = 'success';
        }
        
        // Record in history
        this.recordDelivery(delivery, 'success', {
            statusCode: response.status,
            headers: response.headers,
            data: response.data
        });
        
        // Remove from queue
        const index = this.deliveryQueue.indexOf(delivery);
        if (index > -1) {
            this.deliveryQueue.splice(index, 1);
        }
        
        logger.info('Webhook delivered successfully', {
            deliveryId: delivery.id,
            webhookId: delivery.webhookId,
            attempts: delivery.attempts,
            statusCode: response.status
        });
    }
    
    /**
     * Handle delivery failure
     */
    handleDeliveryFailure(delivery, error) {
        const webhook = this.webhooks.get(delivery.webhookId);
        
        // Check if should retry
        if (delivery.attempts < this.retryPolicy.maxRetries) {
            // Calculate next retry time with exponential backoff
            const delay = Math.min(
                this.retryPolicy.initialDelay * 
                Math.pow(this.retryPolicy.backoffMultiplier, delivery.attempts - 1),
                this.retryPolicy.maxDelay
            );
            
            delivery.nextRetryAt = new Date(Date.now() + delay);
            
            logger.warn('Webhook delivery failed, will retry', {
                deliveryId: delivery.id,
                webhookId: delivery.webhookId,
                attempt: delivery.attempts,
                nextRetryIn: delay,
                error: error.message
            });
            
        } else {
            // Max retries reached
            if (webhook) {
                webhook.deliveryStats.totalDeliveries++;
                webhook.deliveryStats.failedDeliveries++;
                webhook.deliveryStats.lastDeliveryAt = new Date();
                webhook.deliveryStats.lastDeliveryStatus = 'failed';
            }
            
            // Record in history
            this.recordDelivery(delivery, 'failed', {
                error: error.message,
                attempts: delivery.attempts
            });
            
            // Remove from queue
            const index = this.deliveryQueue.indexOf(delivery);
            if (index > -1) {
                this.deliveryQueue.splice(index, 1);
            }
            
            logger.error('Webhook delivery failed permanently', {
                deliveryId: delivery.id,
                webhookId: delivery.webhookId,
                attempts: delivery.attempts,
                error: error.message
            });
        }
    }
    
    /**
     * Record delivery in history
     */
    async recordDelivery(delivery, status, details) {
        const record = {
            id: delivery.id,
            webhookId: delivery.webhookId,
            eventType: delivery.event.type,
            eventId: delivery.event.id,
            status,
            attempts: delivery.attempts,
            details,
            createdAt: delivery.createdAt,
            completedAt: new Date()
        };
        
        // Store last 1000 deliveries per webhook
        if (!this.deliveryHistory.has(delivery.webhookId)) {
            this.deliveryHistory.set(delivery.webhookId, []);
        }
        
        const history = this.deliveryHistory.get(delivery.webhookId);
        history.unshift(record);
        
        if (history.length > 1000) {
            history.pop();
        }
        
        // Save to database
        await databaseService.saveWebhookDelivery({
            id: delivery.id,
            webhookId: delivery.webhookId,
            eventType: delivery.event.type,
            eventId: delivery.event.id,
            status,
            attempts: delivery.attempts,
            responseStatus: details.statusCode || null,
            responseData: details.data || null,
            errorMessage: details.error || null,
            deliveredAt: status === 'success' ? new Date() : null
        });
    }
    
    /**
     * Get delivery history for a webhook
     */
    async getDeliveryHistory(webhookId, { limit = 100, status } = {}) {
        let history = this.deliveryHistory.get(webhookId) || [];
        
        if (status) {
            history = history.filter(h => h.status === status);
        }
        
        return history.slice(0, limit);
    }
    
    /**
     * Test a webhook configuration
     */
    async testWebhook(webhookId) {
        const webhook = this.webhooks.get(webhookId);
        if (!webhook) {
            throw new Error('Webhook not found');
        }
        
        const testEvent = {
            id: uuidv4(),
            type: 'webhook.test',
            payload: {
                message: 'This is a test webhook delivery',
                timestamp: new Date().toISOString()
            },
            timestamp: new Date().toISOString()
        };
        
        try {
            const signature = this.generateSignature(testEvent, webhook.secret);
            
            const response = await axios.post(
                webhook.url,
                testEvent,
                {
                    headers: {
                        'Content-Type': 'application/json',
                        'X-Webhook-Event': 'webhook.test',
                        'X-Webhook-Signature': signature,
                        'X-Webhook-Timestamp': testEvent.timestamp,
                        ...webhook.headers
                    },
                    timeout: 10000,
                    validateStatus: (status) => status < 500
                }
            );
            
            return {
                success: true,
                statusCode: response.status,
                headers: response.headers,
                data: response.data
            };
            
        } catch (error) {
            return {
                success: false,
                error: error.message,
                statusCode: error.response?.status,
                data: error.response?.data
            };
        }
    }
    
    /**
     * Generate webhook signature
     */
    generateSignature(payload, secret) {
        const payloadString = JSON.stringify(payload);
        return crypto
            .createHmac('sha256', secret)
            .update(payloadString)
            .digest('hex');
    }
    
    /**
     * Generate a random secret
     */
    generateSecret() {
        return crypto.randomBytes(32).toString('hex');
    }
    
    /**
     * Verify webhook signature
     */
    verifySignature(payload, signature, secret) {
        const expectedSignature = this.generateSignature(payload, secret);
        return crypto.timingSafeEqual(
            Buffer.from(signature),
            Buffer.from(expectedSignature)
        );
    }
    
    /**
     * Get webhook statistics
     */
    async getWebhookStats(webhookId) {
        const webhook = this.webhooks.get(webhookId);
        if (!webhook) {
            throw new Error('Webhook not found');
        }
        
        const pendingDeliveries = this.deliveryQueue.filter(
            d => d.webhookId === webhookId
        ).length;
        
        const recentDeliveries = (this.deliveryHistory.get(webhookId) || [])
            .slice(0, 100);
        
        const successRate = webhook.deliveryStats.totalDeliveries > 0
            ? (webhook.deliveryStats.successfulDeliveries / 
               webhook.deliveryStats.totalDeliveries) * 100
            : 0;
        
        return {
            webhook: {
                id: webhook.id,
                url: webhook.url,
                events: webhook.events,
                active: webhook.active,
                createdAt: webhook.createdAt
            },
            stats: {
                ...webhook.deliveryStats,
                pendingDeliveries,
                successRate: successRate.toFixed(2) + '%'
            },
            recentDeliveries: recentDeliveries.slice(0, 10)
        };
    }
    
    /**
     * Pause a webhook
     */
    async pauseWebhook(webhookId) {
        return this.updateWebhook(webhookId, { active: false });
    }
    
    /**
     * Resume a webhook
     */
    async resumeWebhook(webhookId) {
        return this.updateWebhook(webhookId, { active: true });
    }
    
    /**
     * Clear delivery history for a webhook
     */
    async clearDeliveryHistory(webhookId) {
        this.deliveryHistory.delete(webhookId);
        return { success: true, webhookId };
    }
    
    /**
     * Get all pending deliveries
     */
    async getPendingDeliveries() {
        return this.deliveryQueue.map(d => ({
            id: d.id,
            webhookId: d.webhookId,
            eventType: d.event.type,
            attempts: d.attempts,
            nextRetryAt: d.nextRetryAt,
            createdAt: d.createdAt
        }));
    }
}

module.exports = new WebhookService();