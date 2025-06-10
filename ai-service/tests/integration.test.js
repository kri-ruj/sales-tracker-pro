const request = require('supertest');
const io = require('socket.io-client');

// Mock environment
process.env.GEMINI_API_KEY = 'test-key';
process.env.JWT_SECRET = 'test-secret';
process.env.DISABLE_REDIS = 'true';
process.env.DISABLE_DATABASE = 'true';

const EnhancedReActServer = require('../react-agent-enhanced').EnhancedReActServer;

describe('Integration Tests', () => {
    let server;
    let app;
    let authToken;
    let socketClient;
    const baseURL = 'http://localhost:3001';

    beforeAll(async () => {
        // Start server
        const serverInstance = new EnhancedReActServer();
        server = serverInstance.server;
        app = serverInstance.app;
        
        // Start listening
        await new Promise((resolve) => {
            server.listen(3001, resolve);
        });
    });

    afterAll(async () => {
        // Close connections
        if (socketClient) {
            socketClient.close();
        }
        
        // Close server
        await new Promise((resolve) => {
            server.close(resolve);
        });
    });

    describe('Authentication Flow', () => {
        test('should register a new user', async () => {
            const response = await request(app)
                .post('/auth/register')
                .send({
                    username: 'testuser',
                    password: 'testpass123',
                    email: 'test@example.com'
                });

            expect(response.status).toBe(201);
            expect(response.body.success).toBe(true);
            expect(response.body.user).toHaveProperty('userId');
        });

        test('should login with credentials', async () => {
            const response = await request(app)
                .post('/auth/login')
                .send({
                    username: 'demo',
                    password: 'demo123'
                });

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.token).toBeDefined();
            
            authToken = response.body.token;
        });

        test('should reject invalid credentials', async () => {
            const response = await request(app)
                .post('/auth/login')
                .send({
                    username: 'demo',
                    password: 'wrongpassword'
                });

            expect(response.status).toBe(401);
            expect(response.body.success).toBe(false);
        });
    });

    describe('Protected Endpoints', () => {
        test('should reject requests without authentication', async () => {
            const response = await request(app)
                .post('/api/react')
                .send({ query: 'test' });

            expect(response.status).toBe(401);
        });

        test('should accept requests with valid token', async () => {
            const response = await request(app)
                .get('/api/chat/sessions')
                .set('Authorization', `Bearer ${authToken}`);

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
        });
    });

    describe('API Endpoints', () => {
        test('GET /health should return server status', async () => {
            const response = await request(app).get('/health');

            expect(response.status).toBe(200);
            expect(response.body.status).toBe('healthy');
            expect(response.body.uptime).toBeGreaterThan(0);
        });

        test('POST /api/react should validate input', async () => {
            const response = await request(app)
                .post('/api/react')
                .set('Authorization', `Bearer ${authToken}`)
                .send({ query: '' });

            expect(response.status).toBe(400);
            expect(response.body.errors).toBeDefined();
        });

        test('GET /api/chat/sessions should return user sessions', async () => {
            const response = await request(app)
                .get('/api/chat/sessions')
                .set('Authorization', `Bearer ${authToken}`);

            expect(response.status).toBe(200);
            expect(response.body.sessions).toBeInstanceOf(Array);
        });

        test('GET /api/queue/stats should return queue statistics', async () => {
            const response = await request(app)
                .get('/api/queue/stats')
                .set('Authorization', `Bearer ${authToken}`);

            expect(response.status).toBe(200);
            expect(response.body.stats).toBeDefined();
        });
    });

    describe('WebSocket Connection', () => {
        beforeEach((done) => {
            socketClient = io(baseURL, {
                transports: ['websocket'],
                forceNew: true
            });
            
            socketClient.on('connect', done);
        });

        afterEach(() => {
            if (socketClient) {
                socketClient.close();
            }
        });

        test('should authenticate via WebSocket', (done) => {
            socketClient.emit('authenticate', { token: authToken });

            socketClient.on('authenticated', (result) => {
                expect(result.success).toBe(true);
                expect(result.sessionId).toBeDefined();
                expect(result.userId).toBeDefined();
                done();
            });
        });

        test('should reject invalid WebSocket authentication', (done) => {
            socketClient.emit('authenticate', { token: 'invalid-token' });

            socketClient.on('authenticated', (result) => {
                expect(result.success).toBe(false);
                expect(result.error).toBeDefined();
                done();
            });
        });

        test('should handle WebSocket queries', (done) => {
            // First authenticate
            socketClient.emit('authenticate', { token: authToken });

            socketClient.on('authenticated', (result) => {
                if (result.success) {
                    // Send query
                    socketClient.emit('query', {
                        query: 'What is 2+2?',
                        sessionId: 'test-session'
                    });
                }
            });

            socketClient.on('query-start', (data) => {
                expect(data.query).toBe('What is 2+2?');
            });

            socketClient.on('query-complete', (data) => {
                expect(data.result).toBeDefined();
                done();
            });

            socketClient.on('query-error', (data) => {
                // Also acceptable if Gemini API is not available
                expect(data.error).toBeDefined();
                done();
            });
        });
    });

    describe('Rate Limiting', () => {
        test('should rate limit excessive requests', async () => {
            const requests = [];
            
            // Make 101 requests (limit is 100)
            for (let i = 0; i < 101; i++) {
                requests.push(
                    request(app)
                        .get('/health')
                        .set('X-Forwarded-For', '1.2.3.4')
                );
            }

            const responses = await Promise.all(requests);
            const tooManyRequests = responses.filter(r => r.status === 429);
            
            expect(tooManyRequests.length).toBeGreaterThan(0);
        });
    });

    describe('Security Headers', () => {
        test('should include security headers', async () => {
            const response = await request(app).get('/health');

            expect(response.headers).toHaveProperty('x-dns-prefetch-control');
            expect(response.headers).toHaveProperty('x-frame-options');
            expect(response.headers).toHaveProperty('x-content-type-options');
        });
    });

    describe('Input Validation', () => {
        test('should sanitize HTML in queries', async () => {
            const response = await request(app)
                .post('/api/react')
                .set('Authorization', `Bearer ${authToken}`)
                .send({ 
                    query: '<script>alert("xss")</script>Hello' 
                });

            expect(response.status).toBe(200);
            // The query should be escaped
            expect(response.body).not.toContain('<script>');
        });

        test('should validate query length', async () => {
            const longQuery = 'a'.repeat(1001);
            const response = await request(app)
                .post('/api/react')
                .set('Authorization', `Bearer ${authToken}`)
                .send({ query: longQuery });

            expect(response.status).toBe(400);
            expect(response.body.errors).toBeDefined();
        });
    });

    describe('Session Management', () => {
        let sessionId;

        test('should create a new session', async () => {
            const response = await request(app)
                .post('/api/react')
                .set('Authorization', `Bearer ${authToken}`)
                .send({ 
                    query: 'Hello AI',
                    sessionId: 'test-session-123'
                });

            sessionId = 'test-session-123';
            expect(response.status).toBe(200);
        });

        test('should retrieve session history', async () => {
            const response = await request(app)
                .get(`/api/chat/history?sessionId=${sessionId}`)
                .set('Authorization', `Bearer ${authToken}`);

            expect(response.status).toBe(200);
            expect(response.body.history).toBeInstanceOf(Array);
        });
    });

    describe('Queue Management', () => {
        test('should queue an AI job', async () => {
            const response = await request(app)
                .post('/api/queue/ai')
                .set('Authorization', `Bearer ${authToken}`)
                .send({ 
                    query: 'Complex calculation',
                    priority: 'high'
                });

            expect(response.body.success).toBe(true);
            expect(response.body.jobId).toBeDefined();
        });

        test('should queue an export job', async () => {
            const response = await request(app)
                .post('/api/queue/export')
                .set('Authorization', `Bearer ${authToken}`)
                .send({ 
                    sessionId: 'test-session',
                    format: 'pdf'
                });

            expect(response.body.success).toBe(true);
            expect(response.body.jobId).toBeDefined();
        });
    });
});