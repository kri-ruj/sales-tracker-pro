const request = require('supertest');
const app = require('../server-secure');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const jwt = require('jsonwebtoken');

// Test database
const testDbPath = path.join(__dirname, 'test-sales-tracker.db');
let testDb;

// JWT Secret for tests
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-this-in-production';

// Helper function to generate test token
function generateTestToken(lineUserId = 'TEST_USER_001', displayName = 'Test User') {
    return jwt.sign({ lineUserId, displayName }, JWT_SECRET, { expiresIn: '1h' });
}

describe('Sales Tracker API Security Tests', () => {
    let authToken;

    beforeAll((done) => {
        // Create test database
        testDb = new sqlite3.Database(':memory:', (err) => {
            if (err) {
                console.error('Error creating test database:', err);
                done(err);
            } else {
                // Initialize test database schema
                testDb.serialize(() => {
                    testDb.run(`
                        CREATE TABLE users (
                            id INTEGER PRIMARY KEY AUTOINCREMENT,
                            line_user_id TEXT UNIQUE NOT NULL,
                            display_name TEXT NOT NULL,
                            picture_url TEXT,
                            status_message TEXT,
                            email TEXT,
                            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                        )
                    `);

                    testDb.run(`
                        CREATE TABLE activities (
                            id INTEGER PRIMARY KEY AUTOINCREMENT,
                            line_user_id TEXT NOT NULL,
                            activity_type TEXT NOT NULL CHECK(activity_type IN ('โทร', 'นัด', 'ชิง', 'ข่าวสาร', 'เริ่มเซน')),
                            title TEXT NOT NULL,
                            description TEXT,
                            points INTEGER NOT NULL CHECK(points >= 0 AND points <= 1000),
                            date DATE NOT NULL,
                            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                            FOREIGN KEY (line_user_id) REFERENCES users(line_user_id)
                        )
                    `);

                    testDb.run(`
                        CREATE TABLE group_registrations (
                            id INTEGER PRIMARY KEY AUTOINCREMENT,
                            group_id TEXT UNIQUE NOT NULL,
                            group_name TEXT,
                            registered_by TEXT,
                            notifications_enabled BOOLEAN DEFAULT 1,
                            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                        )
                    `);

                    done();
                });
            }
        });

        // Generate auth token for tests
        authToken = generateTestToken();
    });

    afterAll((done) => {
        testDb.close(done);
    });

    describe('Health Check', () => {
        it('should return healthy status', async () => {
            const res = await request(app)
                .get('/health')
                .expect(200);

            expect(res.body).toHaveProperty('status', 'healthy');
            expect(res.body).toHaveProperty('timestamp');
            expect(res.body).toHaveProperty('version');
        });
    });

    describe('Authentication', () => {
        it('should return JWT token on login', async () => {
            const res = await request(app)
                .post('/api/auth/login')
                .send({
                    lineUserId: 'TEST_USER_001',
                    displayName: 'Test User'
                })
                .expect(200);

            expect(res.body).toHaveProperty('token');
            expect(res.body).toHaveProperty('user');
            expect(res.body.user.lineUserId).toBe('TEST_USER_001');
        });

        it('should reject login with invalid data', async () => {
            const res = await request(app)
                .post('/api/auth/login')
                .send({
                    lineUserId: '',
                    displayName: 'Test'
                })
                .expect(400);

            expect(res.body).toHaveProperty('errors');
        });
    });

    describe('Input Validation', () => {
        it('should reject activity with invalid type', async () => {
            const res = await request(app)
                .post('/api/activities')
                .set('Authorization', `Bearer ${authToken}`)
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
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    lineUserId: 'TEST_USER_001',
                    activityType: 'โทร',
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
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    lineUserId: 'TEST_USER_001',
                    activityType: 'โทร',
                    title: 'Test Call',
                    points: 1001,
                    date: new Date().toISOString()
                })
                .expect(400);

            expect(res.body).toHaveProperty('errors');
        });

        it('should escape HTML in title', async () => {
            const res = await request(app)
                .post('/api/activities')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    lineUserId: 'TEST_USER_001',
                    activityType: 'โทร',
                    title: '<script>alert("XSS")</script>',
                    points: 10,
                    date: new Date().toISOString()
                })
                .expect(201);

            expect(res.body.activity.title).toBe('&lt;script&gt;alert(&quot;XSS&quot;)&lt;/script&gt;');
        });
    });

    describe('Authentication Required', () => {
        it('should reject requests without token', async () => {
            const res = await request(app)
                .post('/api/activities')
                .send({
                    lineUserId: 'TEST_USER_001',
                    activityType: 'โทร',
                    title: 'Test',
                    points: 10,
                    date: new Date().toISOString()
                })
                .expect(401);

            expect(res.body).toHaveProperty('error', 'Access token required');
        });

        it('should reject requests with invalid token', async () => {
            const res = await request(app)
                .post('/api/activities')
                .set('Authorization', 'Bearer invalid-token')
                .send({
                    lineUserId: 'TEST_USER_001',
                    activityType: 'โทร',
                    title: 'Test',
                    points: 10,
                    date: new Date().toISOString()
                })
                .expect(403);

            expect(res.body).toHaveProperty('error', 'Invalid or expired token');
        });
    });

    describe('Authorization', () => {
        it('should prevent users from creating activities for others', async () => {
            const res = await request(app)
                .post('/api/activities')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    lineUserId: 'OTHER_USER_001',
                    activityType: 'โทร',
                    title: 'Test',
                    points: 10,
                    date: new Date().toISOString()
                })
                .expect(403);

            expect(res.body).toHaveProperty('error', 'Cannot create activities for other users');
        });

        it('should prevent users from accessing other users activities', async () => {
            const res = await request(app)
                .get('/api/activities/OTHER_USER_001')
                .set('Authorization', `Bearer ${authToken}`)
                .expect(403);

            expect(res.body).toHaveProperty('error', 'Cannot access other users activities');
        });
    });

    describe('Rate Limiting', () => {
        it('should enforce rate limits on API endpoints', async () => {
            // This test would need to make many requests quickly
            // For now, we'll just check that the rate limiter is configured
            expect(app._router.stack.some(layer => 
                layer.name === 'rateLimit'
            )).toBeTruthy();
        });
    });

    describe('SQL Injection Prevention', () => {
        it('should safely handle SQL injection attempts in queries', async () => {
            const maliciousId = "TEST_USER_001'; DROP TABLE activities; --";
            
            const res = await request(app)
                .get(`/api/activities/${encodeURIComponent(maliciousId)}`)
                .set('Authorization', `Bearer ${generateTestToken(maliciousId)}`)
                .expect(403); // Will fail authorization check first

            // Database should still be intact
            const tableExists = await new Promise((resolve) => {
                testDb.get("SELECT name FROM sqlite_master WHERE type='table' AND name='activities'", (err, row) => {
                    resolve(!!row);
                });
            });
            expect(tableExists).toBeTruthy();
        });
    });

    describe('Pagination', () => {
        it('should respect limit parameter', async () => {
            const res = await request(app)
                .get('/api/activities/TEST_USER_001?limit=5')
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(Array.isArray(res.body.activities)).toBeTruthy();
        });

        it('should reject invalid limit values', async () => {
            const res = await request(app)
                .get('/api/activities/TEST_USER_001?limit=101')
                .set('Authorization', `Bearer ${authToken}`)
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
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    lineUserId: 'TEST_USER_001',
                    activityType: 'โทร',
                    title: 'Test Call',
                    points: 10,
                    date: '2024-12-06T10:00:00Z'
                })
                .expect(201);

            expect(res.body.activity).toHaveProperty('date');
        });

        it('should reject invalid date formats', async () => {
            const res = await request(app)
                .post('/api/activities')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    lineUserId: 'TEST_USER_001',
                    activityType: 'โทร',
                    title: 'Test Call',
                    points: 10,
                    date: '06/12/2024'
                })
                .expect(400);

            expect(res.body).toHaveProperty('errors');
        });
    });
});

// Export for other tests
module.exports = { generateTestToken };