const webhookService = require('../services/webhook.service');
const crypto = require('crypto');

describe('Webhook Service', () => {
    let testWebhook;

    beforeEach(async () => {
        // Clear any existing webhooks
        webhookService.webhooks.clear();
        webhookService.deliveryQueue.length = 0;
        webhookService.deliveryHistory.clear();
    });

    describe('Webhook Registration', () => {
        it('should register a new webhook', async () => {
            const webhookData = {
                url: 'https://example.com/webhook',
                events: ['query.started', 'query.completed'],
                description: 'Test webhook',
                metadata: { userId: 'test-user' }
            };

            const webhook = await webhookService.registerWebhook(webhookData);

            expect(webhook).toBeDefined();
            expect(webhook.id).toBeDefined();
            expect(webhook.url).toBe(webhookData.url);
            expect(webhook.events).toEqual(webhookData.events);
            expect(webhook.active).toBe(true);
            expect(webhook.secret).toBeDefined();
        });

        it('should generate a secret if not provided', async () => {
            const webhook = await webhookService.registerWebhook({
                url: 'https://example.com/webhook',
                events: ['query.started']
            });

            expect(webhook.secret).toBeDefined();
            expect(webhook.secret.length).toBe(64); // 32 bytes in hex
        });
    });

    describe('Webhook Management', () => {
        beforeEach(async () => {
            testWebhook = await webhookService.registerWebhook({
                url: 'https://example.com/webhook',
                events: ['query.started'],
                metadata: { userId: 'test-user' }
            });
        });

        it('should update webhook configuration', async () => {
            const updates = {
                events: ['query.completed', 'error.occurred'],
                active: false
            };

            const updated = await webhookService.updateWebhook(testWebhook.id, updates);

            expect(updated.events).toEqual(updates.events);
            expect(updated.active).toBe(false);
        });

        it('should delete a webhook', async () => {
            const result = await webhookService.deleteWebhook(testWebhook.id);

            expect(result.success).toBe(true);
            expect(webhookService.webhooks.has(testWebhook.id)).toBe(false);
        });

        it('should list webhooks with filters', async () => {
            // Create additional webhooks
            await webhookService.registerWebhook({
                url: 'https://example2.com/webhook',
                events: ['tool.executed'],
                active: false
            });

            const activeWebhooks = await webhookService.listWebhooks({ active: true });
            const toolWebhooks = await webhookService.listWebhooks({ event: 'tool.executed' });

            expect(activeWebhooks.length).toBe(1);
            expect(toolWebhooks.length).toBe(1);
        });
    });

    describe('Event Triggering', () => {
        beforeEach(async () => {
            testWebhook = await webhookService.registerWebhook({
                url: 'https://example.com/webhook',
                events: ['query.started', 'query.completed'],
                metadata: { userId: 'test-user' }
            });
        });

        it('should trigger events for subscribed webhooks', async () => {
            const result = await webhookService.triggerEvent('query.started', {
                sessionId: 'test-session',
                query: 'Test query'
            });

            expect(result.eventId).toBeDefined();
            expect(result.type).toBe('query.started');
            expect(result.subscriberCount).toBe(1);
            expect(webhookService.deliveryQueue.length).toBe(1);
        });

        it('should not trigger events for unsubscribed webhooks', async () => {
            const result = await webhookService.triggerEvent('tool.executed', {
                tool: 'searchWeb'
            });

            expect(result.subscriberCount).toBe(0);
            expect(webhookService.deliveryQueue.length).toBe(0);
        });

        it('should not trigger events for inactive webhooks', async () => {
            await webhookService.updateWebhook(testWebhook.id, { active: false });

            const result = await webhookService.triggerEvent('query.started', {
                sessionId: 'test-session'
            });

            expect(result.subscriberCount).toBe(0);
        });
    });

    describe('Signature Generation and Verification', () => {
        it('should generate consistent signatures', () => {
            const payload = { test: 'data' };
            const secret = 'test-secret';

            const sig1 = webhookService.generateSignature(payload, secret);
            const sig2 = webhookService.generateSignature(payload, secret);

            expect(sig1).toBe(sig2);
        });

        it('should verify valid signatures', () => {
            const payload = { test: 'data' };
            const secret = 'test-secret';
            const signature = webhookService.generateSignature(payload, secret);

            const isValid = webhookService.verifySignature(payload, signature, secret);

            expect(isValid).toBe(true);
        });

        it('should reject invalid signatures', () => {
            const payload = { test: 'data' };
            const secret = 'test-secret';
            const invalidSignature = 'invalid-signature';

            const isValid = webhookService.verifySignature(payload, invalidSignature, secret);

            expect(isValid).toBe(false);
        });
    });

    describe('Webhook Statistics', () => {
        beforeEach(async () => {
            testWebhook = await webhookService.registerWebhook({
                url: 'https://example.com/webhook',
                events: ['query.started'],
                metadata: { userId: 'test-user' }
            });
        });

        it('should track delivery statistics', async () => {
            // Simulate successful delivery
            testWebhook.deliveryStats.totalDeliveries = 10;
            testWebhook.deliveryStats.successfulDeliveries = 8;
            testWebhook.deliveryStats.failedDeliveries = 2;

            const stats = await webhookService.getWebhookStats(testWebhook.id);

            expect(stats.stats.totalDeliveries).toBe(10);
            expect(stats.stats.successfulDeliveries).toBe(8);
            expect(stats.stats.failedDeliveries).toBe(2);
            expect(stats.stats.successRate).toBe('80.00%');
        });
    });

    describe('Event Types', () => {
        it('should have all required event types', () => {
            const eventTypes = webhookService.eventTypes;

            expect(eventTypes.QUERY_STARTED).toBe('query.started');
            expect(eventTypes.QUERY_COMPLETED).toBe('query.completed');
            expect(eventTypes.TOOL_EXECUTED).toBe('tool.executed');
            expect(eventTypes.SESSION_CREATED).toBe('session.created');
            expect(eventTypes.SESSION_ENDED).toBe('session.ended');
            expect(eventTypes.ERROR_OCCURRED).toBe('error.occurred');
        });
    });
});

// Export for use in integration tests
module.exports = {
    webhookService
};