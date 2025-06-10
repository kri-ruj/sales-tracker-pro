const authService = require('../services/auth.service');

describe('AuthService', () => {
    let testUser;

    beforeEach(async () => {
        // Clear any existing test users
        authService.users.clear();
        authService.apiKeys.clear();
        authService.sessions.clear();
    });

    describe('createUser', () => {
        it('should create a new user successfully', async () => {
            const userData = {
                username: 'testuser',
                password: 'testpass123',
                email: 'test@example.com'
            };

            const user = await authService.createUser(userData);

            expect(user).toBeDefined();
            expect(user.username).toBe(userData.username);
            expect(user.email).toBe(userData.email);
            expect(user.apiKey).toBeDefined();
            expect(user.password).toBeUndefined(); // Password should not be returned
        });

        it('should not create duplicate users', async () => {
            const userData = {
                username: 'testuser',
                password: 'testpass123',
                email: 'test@example.com'
            };

            await authService.createUser(userData);
            
            await expect(authService.createUser(userData))
                .rejects.toThrow('User already exists');
        });
    });

    describe('login', () => {
        beforeEach(async () => {
            testUser = await authService.createUser({
                username: 'testuser',
                password: 'testpass123',
                email: 'test@example.com'
            });
        });

        it('should login with correct credentials', async () => {
            const result = await authService.login({
                username: 'testuser',
                password: 'testpass123'
            });

            expect(result.token).toBeDefined();
            expect(result.sessionId).toBeDefined();
            expect(result.user.username).toBe('testuser');
        });

        it('should fail login with incorrect password', async () => {
            await expect(authService.login({
                username: 'testuser',
                password: 'wrongpass'
            })).rejects.toThrow('Invalid credentials');
        });

        it('should fail login with non-existent user', async () => {
            await expect(authService.login({
                username: 'nonexistent',
                password: 'anypass'
            })).rejects.toThrow('Invalid credentials');
        });
    });

    describe('verifyToken', () => {
        it('should verify valid token', async () => {
            const loginResult = await authService.login({
                username: 'demo',
                password: 'demo123'
            });

            const decoded = await authService.verifyToken(loginResult.token);
            expect(decoded.username).toBe('demo');
            expect(decoded.userId).toBeDefined();
        });

        it('should reject invalid token', async () => {
            await expect(authService.verifyToken('invalid-token'))
                .rejects.toThrow('Invalid token');
        });
    });

    describe('verifyApiKey', () => {
        beforeEach(async () => {
            testUser = await authService.createUser({
                username: 'testuser',
                password: 'testpass123',
                email: 'test@example.com'
            });
        });

        it('should verify valid API key', async () => {
            const result = await authService.verifyApiKey(testUser.apiKey);
            expect(result.username).toBe('testuser');
            expect(result.userId).toBeDefined();
        });

        it('should reject invalid API key', async () => {
            await expect(authService.verifyApiKey('invalid-key'))
                .rejects.toThrow('Invalid API key');
        });
    });

    describe('rate limiting', () => {
        it('should limit requests per user', async () => {
            const limiter = authService.createUserRateLimiter({
                windowMs: 1000,
                max: 2
            });

            const mockReq = { user: { userId: 'test-user' } };
            const mockRes = {
                status: jest.fn().mockReturnThis(),
                json: jest.fn()
            };
            const mockNext = jest.fn();

            // First two requests should pass
            limiter(mockReq, mockRes, mockNext);
            expect(mockNext).toHaveBeenCalledTimes(1);
            
            limiter(mockReq, mockRes, mockNext);
            expect(mockNext).toHaveBeenCalledTimes(2);

            // Third request should be blocked
            limiter(mockReq, mockRes, mockNext);
            expect(mockRes.status).toHaveBeenCalledWith(429);
            expect(mockRes.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    error: 'Too many requests'
                })
            );
        });
    });
});