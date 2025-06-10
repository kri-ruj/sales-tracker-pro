// Test setup file
process.env.NODE_ENV = 'test';
process.env.GEMINI_API_KEY = 'test-api-key';
process.env.JWT_SECRET = 'test-secret';
process.env.DISABLE_REDIS = 'true';
process.env.DISABLE_DATABASE = 'true';

// Mock console methods to reduce noise in tests
global.console = {
    ...console,
    log: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn()
};

// Mock timers
jest.useFakeTimers();