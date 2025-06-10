const Redis = require('ioredis');
const winston = require('winston');

// Logger setup
const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
    ),
    transports: [
        new winston.transports.File({ filename: 'error.log', level: 'error' }),
        new winston.transports.File({ filename: 'combined.log' }),
        new winston.transports.Console({
            format: winston.format.simple()
        })
    ]
});

class CacheService {
    constructor() {
        this.redis = null;
        this.enabled = true;
        this.ttl = {
            weather: 300,        // 5 minutes
            crypto: 60,          // 1 minute
            country: 86400,      // 1 day
            search: 1800,        // 30 minutes
            currency: 3600,      // 1 hour
            default: 300         // 5 minutes
        };
        
        this.init();
    }

    async init() {
        // Check if Redis should be disabled
        if (process.env.DISABLE_REDIS === 'true') {
            logger.info('Redis caching disabled by configuration');
            this.enabled = false;
            return;
        }

        try {
            // Configure Redis connection
            const redisConfig = {
                host: process.env.REDIS_HOST || 'localhost',
                port: process.env.REDIS_PORT || 6379,
                retryStrategy: (times) => {
                    // Stop retrying after 3 attempts
                    if (times > 3) {
                        logger.info('Redis unavailable after 3 attempts, disabling cache');
                        this.enabled = false;
                        return null;
                    }
                    const delay = Math.min(times * 50, 2000);
                    return delay;
                },
                maxRetriesPerRequest: 1,
                enableOfflineQueue: false,
                lazyConnect: true
            };

            // Add password if provided
            if (process.env.REDIS_PASSWORD) {
                redisConfig.password = process.env.REDIS_PASSWORD;
            }

            this.redis = new Redis(redisConfig);

            // Suppress noisy error logs
            this.redis.on('error', (err) => {
                // Only log the first error
                if (this.enabled) {
                    logger.info(`Redis not available: ${err.message}. Caching disabled.`);
                    this.enabled = false;
                }
            });

            // Try to connect
            await this.redis.connect();
            
            // Test connection
            await this.redis.ping();
            this.enabled = true;
            logger.info('Redis connected successfully, caching enabled');
            
        } catch (error) {
            // Redis not available, but that's okay
            logger.info(`Redis not available: ${error.message}. Running without cache.`);
            this.enabled = false;
            
            // Close the connection to prevent further errors
            if (this.redis) {
                this.redis.disconnect();
                this.redis = null;
            }
        }
    }

    generateKey(type, params) {
        const paramStr = Object.keys(params)
            .sort()
            .map(k => `${k}:${params[k]}`)
            .join(':');
        return `ai:${type}:${paramStr}`;
    }

    async get(type, params) {
        if (!this.enabled) return null;

        try {
            const key = this.generateKey(type, params);
            const cached = await this.redis.get(key);
            
            if (cached) {
                logger.info(`Cache hit for ${type}`, { params });
                return JSON.parse(cached);
            }
            
            logger.info(`Cache miss for ${type}`, { params });
            return null;
        } catch (error) {
            logger.error('Cache get error:', error);
            return null;
        }
    }

    async set(type, params, value) {
        if (!this.enabled) return;

        try {
            const key = this.generateKey(type, params);
            const ttl = this.ttl[type] || this.ttl.default;
            
            await this.redis.setex(key, ttl, JSON.stringify(value));
            logger.info(`Cached ${type} for ${ttl}s`, { params });
        } catch (error) {
            logger.error('Cache set error:', error);
        }
    }

    async invalidate(type, params) {
        if (!this.enabled) return;

        try {
            const key = this.generateKey(type, params);
            await this.redis.del(key);
            logger.info(`Invalidated cache for ${type}`, { params });
        } catch (error) {
            logger.error('Cache invalidate error:', error);
        }
    }

    async flush() {
        if (!this.enabled) return;

        try {
            await this.redis.flushdb();
            logger.info('Cache flushed');
        } catch (error) {
            logger.error('Cache flush error:', error);
        }
    }

    async getStats() {
        if (!this.enabled) return { enabled: false };

        try {
            const info = await this.redis.info('stats');
            const keyCount = await this.redis.dbsize();
            
            return {
                enabled: true,
                keys: keyCount,
                info: info
            };
        } catch (error) {
            logger.error('Failed to get cache stats:', error);
            return { enabled: false, error: error.message };
        }
    }
}

module.exports = new CacheService();