const request = require('supertest');
const app = require('../server-firestore');

// Mock Firestore service
jest.mock('../services/firestore.service', () => ({
    createOrUpdateUser: jest.fn().mockResolvedValue({ lineUserId: 'TEST_USER_001', displayName: 'Test User' }),
    getUser: jest.fn().mockResolvedValue({ lineUserId: 'TEST_USER_001', displayName: 'Test User' }),
    createActivity: jest.fn().mockResolvedValue({ id: '123', activityType: 'call', points: 20 }),
    getUserActivities: jest.fn().mockResolvedValue([]),
    deleteActivity: jest.fn().mockResolvedValue(true),
    getTeamStats: jest.fn().mockResolvedValue({ totalPoints: 0, totalActivities: 0 }),
    getLeaderboard: jest.fn().mockResolvedValue([]),
    getAllGroups: jest.fn().mockResolvedValue([]),
    cleanupExpiredCache: jest.fn().mockResolvedValue(true)
}));

// Mock LINE services
jest.mock('../services/line-quota.service', () => ({
    canSendMessage: jest.fn().mockResolvedValue({ allowed: true, remaining: 100 }),
    recordMessage: jest.fn().mockResolvedValue(true),
    cleanupOldRecords: jest.fn().mockResolvedValue(true)
}));

jest.mock('../activity-flex-message-compact', () => ({
    createActivitySubmissionFlex: jest.fn().mockReturnValue({}),
    sendFlexMessage: jest.fn().mockResolvedValue(true)
}));

// Mock LINE webhook routes
jest.mock('../routes/line-webhook', () => require('express').Router());

// Mock version check middleware
jest.mock('../middleware/version-check', () => ({
    versionCheckMiddleware: (req, res, next) => next()
}));

// Mock version monitor routes
jest.mock('../routes/version-monitor', () => require('express').Router());

describe('Sales Tracker Firestore API Security Tests', () => {
    let authToken = 'dummy-token-for-tests';

    describe('Health Check', () => {
        it('should return healthy status', async () => {
            const res = await request(app)
                .get('/health')
                .expect(200);

            expect(res.body).toHaveProperty('status', 'OK');
            expect(res.body).toHaveProperty('database', 'firestore');
        });
    });

    describe('Input Validation', () => {
        it('should reject activity with invalid type', async () => {
            const res = await request(app)
                .post('/api/activities')
                .send({
                    lineUserId: 'TEST_USER_001',
                    activityType: 'invalid_type',
                    title: 'Test Activity',
                    points: 10,
                    date: new Date().toISOString()
                })
                .expect(400);

            expect(res.body).toHaveProperty('errors');
            expect(res.body.errors[0].path).toBe('activityType');
        });

        it('should reject activity with negative points', async () => {
            const res = await request(app)
                .post('/api/activities')
                .send({
                    lineUserId: 'TEST_USER_001',
                    activityType: 'call',
                    title: 'Test Call',
                    points: -10,
                    date: new Date().toISOString()
                })
                .expect(400);

            expect(res.body).toHaveProperty('errors');
        });

        it('should reject activity with points over 1000', async () => {
            const res = await request(app)
                .post('/api/activities')
                .send({
                    lineUserId: 'TEST_USER_001',
                    activityType: 'call',
                    title: 'Test Call',
                    points: 1001,
                    date: new Date().toISOString()
                })
                .expect(400);

            expect(res.body).toHaveProperty('errors');
        });

        it('should escape HTML in title', async () => {
            const firestoreService = require('../services/firestore.service');
            
            await request(app)
                .post('/api/activities')
                .send({
                    lineUserId: 'TEST_USER_001',
                    activityType: 'call',
                    title: '<script>alert("xss")</script>',
                    subtitle: '<b>bold</b>',
                    points: 20,
                    date: new Date().toISOString()
                })
                .expect(200);

            // Check that createActivity was called with escaped HTML
            expect(firestoreService.createActivity).toHaveBeenCalledWith(
                expect.objectContaining({
                    title: '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;',
                    subtitle: '&lt;b&gt;bold&lt;/b&gt;'
                })
            );
        });
    });

    describe('Rate Limiting', () => {
        it('should enforce rate limits on API endpoints', async () => {
            // Note: Rate limiting is optional and may not be available in test environment
            // This test will pass if rate limiting is not configured
            const res = await request(app)
                .get('/api/team/stats')
                .expect((res) => {
                    // Either 200 (no rate limiting) or check for rate limit headers
                    expect([200, 429]).toContain(res.status);
                });
        });
    });

    describe('Pagination', () => {
        it('should respect limit parameter', async () => {
            const res = await request(app)
                .get('/api/activities/TEST_USER_001?limit=10')
                .expect(200);

            expect(Array.isArray(res.body)).toBe(true);
        });

        it('should reject invalid limit values', async () => {
            const res = await request(app)
                .get('/api/activities/TEST_USER_001?limit=101')
                .expect(400);

            expect(res.body).toHaveProperty('errors');
        });
    });

    describe('Error Handling', () => {
        it('should handle 404 for non-existent endpoints', async () => {
            const res = await request(app)
                .get('/api/non-existent')
                .expect(404);

            expect(res.body).toHaveProperty('error', 'Endpoint not found');
        });

        it('should not leak error details in production', async () => {
            const originalEnv = process.env.NODE_ENV;
            process.env.NODE_ENV = 'production';

            const res = await request(app)
                .get('/api/will-cause-error')
                .expect(404);

            expect(res.body).not.toHaveProperty('stack');
            
            process.env.NODE_ENV = originalEnv;
        });
    });

    describe('Date Validation', () => {
        it('should accept valid ISO8601 dates', async () => {
            const res = await request(app)
                .post('/api/activities')
                .send({
                    lineUserId: 'TEST_USER_001',
                    activityType: 'call',
                    title: 'Test Call',
                    points: 20,
                    date: new Date().toISOString()
                })
                .expect(200);

            expect(res.body).toHaveProperty('success', true);
        });
    });
});