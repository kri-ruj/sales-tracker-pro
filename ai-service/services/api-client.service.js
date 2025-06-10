const axios = require('axios');
const winston = require('winston');

const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
    ),
    transports: [
        new winston.transports.Console({
            format: winston.format.simple()
        })
    ]
});

class APIClient {
    constructor() {
        this.retryConfig = {
            maxRetries: 3,
            initialDelay: 1000,
            maxDelay: 10000,
            backoffMultiplier: 2
        };
        
        this.timeouts = {
            default: 5000,
            long: 15000
        };
    }

    async callWithRetry(fn, options = {}) {
        const {
            maxRetries = this.retryConfig.maxRetries,
            retryCondition = (error) => {
                // Retry on network errors or 5xx status codes
                return !error.response || (error.response.status >= 500 && error.response.status < 600);
            }
        } = options;

        let lastError;
        
        for (let attempt = 0; attempt < maxRetries; attempt++) {
            try {
                logger.info(`API call attempt ${attempt + 1}/${maxRetries}`);
                const result = await fn();
                
                if (attempt > 0) {
                    logger.info(`API call succeeded after ${attempt + 1} attempts`);
                }
                
                return result;
            } catch (error) {
                lastError = error;
                
                if (!retryCondition(error) || attempt === maxRetries - 1) {
                    logger.error(`API call failed after ${attempt + 1} attempts:`, {
                        error: error.message,
                        status: error.response?.status,
                        data: error.response?.data
                    });
                    throw error;
                }
                
                const delay = this.calculateBackoff(attempt);
                logger.warn(`API call failed, retrying in ${delay}ms...`, {
                    attempt: attempt + 1,
                    error: error.message
                });
                
                await this.sleep(delay);
            }
        }
        
        throw lastError;
    }

    calculateBackoff(attempt) {
        const delay = Math.min(
            this.retryConfig.initialDelay * Math.pow(this.retryConfig.backoffMultiplier, attempt),
            this.retryConfig.maxDelay
        );
        
        // Add jitter to prevent thundering herd
        const jitter = Math.random() * 0.3 * delay;
        return Math.floor(delay + jitter);
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    async get(url, options = {}) {
        return this.callWithRetry(async () => {
            const response = await axios.get(url, {
                timeout: options.timeout || this.timeouts.default,
                ...options
            });
            return response.data;
        }, options);
    }

    async post(url, data, options = {}) {
        return this.callWithRetry(async () => {
            const response = await axios.post(url, data, {
                timeout: options.timeout || this.timeouts.default,
                ...options
            });
            return response.data;
        }, options);
    }

    // Circuit breaker pattern
    createCircuitBreaker(name, options = {}) {
        const state = {
            failures: 0,
            lastFailureTime: null,
            state: 'CLOSED' // CLOSED, OPEN, HALF_OPEN
        };

        const {
            failureThreshold = 5,
            resetTimeout = 60000, // 1 minute
            halfOpenRequests = 3
        } = options;

        return async (fn) => {
            // If circuit is OPEN, check if we should try HALF_OPEN
            if (state.state === 'OPEN') {
                const now = Date.now();
                if (now - state.lastFailureTime > resetTimeout) {
                    state.state = 'HALF_OPEN';
                    state.failures = 0;
                } else {
                    throw new Error(`Circuit breaker ${name} is OPEN`);
                }
            }

            try {
                const result = await fn();
                
                // Success - reset failures
                if (state.state === 'HALF_OPEN') {
                    state.state = 'CLOSED';
                }
                state.failures = 0;
                
                return result;
            } catch (error) {
                state.failures++;
                state.lastFailureTime = Date.now();
                
                if (state.failures >= failureThreshold) {
                    state.state = 'OPEN';
                    logger.error(`Circuit breaker ${name} opened after ${state.failures} failures`);
                }
                
                throw error;
            }
        };
    }
}

module.exports = new APIClient();