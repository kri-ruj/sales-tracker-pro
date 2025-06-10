const NodeCache = require('node-cache');
const crypto = require('crypto');
const { EventEmitter } = require('events');

/**
 * Intelligent Caching Service
 * Provides smart caching with TTL, LRU eviction, and pattern-based invalidation
 */
class IntelligentCacheService extends EventEmitter {
    constructor(options = {}) {
        super();
        
        // Cache configuration
        this.config = {
            stdTTL: options.stdTTL || 600, // 10 minutes default
            checkperiod: options.checkperiod || 60, // Check every minute
            maxKeys: options.maxKeys || 1000,
            useClones: false, // For performance
            ...options
        };

        // Initialize caches for different purposes
        this.caches = {
            ai: new NodeCache({ stdTTL: 300, maxKeys: 500 }), // AI responses - 5 min
            api: new NodeCache({ stdTTL: 60, maxKeys: 200 }), // API calls - 1 min
            workflow: new NodeCache({ stdTTL: 1800, maxKeys: 100 }), // Workflows - 30 min
            auth: new NodeCache({ stdTTL: 3600, maxKeys: 50 }), // Auth tokens - 1 hour
            default: new NodeCache(this.config)
        };

        // Cache statistics
        this.stats = {
            hits: 0,
            misses: 0,
            sets: 0,
            deletes: 0,
            evictions: 0
        };

        // Pattern-based invalidation rules
        this.invalidationRules = new Map();
        
        // Setup event listeners
        this.setupEventListeners();
    }

    /**
     * Setup event listeners for cache events
     */
    setupEventListeners() {
        Object.entries(this.caches).forEach(([name, cache]) => {
            cache.on('expired', (key, value) => {
                this.stats.evictions++;
                this.emit('cache:expired', { cache: name, key });
            });

            cache.on('flush', () => {
                this.emit('cache:flushed', { cache: name });
            });
        });
    }

    /**
     * Get value from cache with intelligent key generation
     */
    async get(key, options = {}) {
        const { cache = 'default', transform } = options;
        const cacheKey = this.generateKey(key);
        const targetCache = this.caches[cache] || this.caches.default;

        try {
            const value = targetCache.get(cacheKey);
            
            if (value !== undefined) {
                this.stats.hits++;
                this.emit('cache:hit', { cache, key: cacheKey });
                
                // Apply transformation if provided
                return transform ? transform(value) : value;
            }
            
            this.stats.misses++;
            this.emit('cache:miss', { cache, key: cacheKey });
            return null;
            
        } catch (error) {
            this.emit('cache:error', { cache, key: cacheKey, error });
            return null;
        }
    }

    /**
     * Set value in cache with intelligent TTL
     */
    async set(key, value, options = {}) {
        const {
            cache = 'default',
            ttl,
            tags = [],
            compress = false
        } = options;

        const cacheKey = this.generateKey(key);
        const targetCache = this.caches[cache] || this.caches.default;

        try {
            // Compress large values if requested
            const finalValue = compress ? this.compress(value) : value;
            
            // Set with custom TTL if provided
            const success = ttl 
                ? targetCache.set(cacheKey, finalValue, ttl)
                : targetCache.set(cacheKey, finalValue);

            if (success) {
                this.stats.sets++;
                
                // Store tags for pattern-based invalidation
                if (tags.length > 0) {
                    this.tagKey(cacheKey, tags, cache);
                }
                
                this.emit('cache:set', { cache, key: cacheKey, ttl });
            }
            
            return success;
            
        } catch (error) {
            this.emit('cache:error', { cache, key: cacheKey, error });
            return false;
        }
    }

    /**
     * Delete value from cache
     */
    async delete(key, options = {}) {
        const { cache = 'default' } = options;
        const cacheKey = this.generateKey(key);
        const targetCache = this.caches[cache] || this.caches.default;

        const deleted = targetCache.del(cacheKey);
        if (deleted) {
            this.stats.deletes++;
            this.emit('cache:delete', { cache, key: cacheKey });
        }
        
        return deleted;
    }

    /**
     * Invalidate by pattern or tags
     */
    async invalidate(pattern, options = {}) {
        const { cache, tags } = options;
        let invalidated = 0;

        if (tags && tags.length > 0) {
            // Invalidate by tags
            invalidated = this.invalidateByTags(tags, cache);
        } else if (pattern) {
            // Invalidate by pattern
            invalidated = this.invalidateByPattern(pattern, cache);
        }

        this.emit('cache:invalidated', { pattern, tags, count: invalidated });
        return invalidated;
    }

    /**
     * Generate cache key with hashing for long keys
     */
    generateKey(input) {
        if (typeof input === 'string') {
            // Hash long keys
            if (input.length > 250) {
                return crypto.createHash('sha256').update(input).digest('hex');
            }
            return input;
        }
        
        // For objects, create a deterministic key
        const normalized = JSON.stringify(this.sortObject(input));
        return crypto.createHash('sha256').update(normalized).digest('hex');
    }

    /**
     * Sort object keys for deterministic hashing
     */
    sortObject(obj) {
        if (obj === null || typeof obj !== 'object') return obj;
        if (Array.isArray(obj)) return obj.map(item => this.sortObject(item));
        
        return Object.keys(obj)
            .sort()
            .reduce((sorted, key) => {
                sorted[key] = this.sortObject(obj[key]);
                return sorted;
            }, {});
    }

    /**
     * Compress value for storage
     */
    compress(value) {
        // Simple compression by removing whitespace from JSON
        if (typeof value === 'object') {
            return JSON.stringify(value);
        }
        return value;
    }

    /**
     * Tag a key for pattern-based invalidation
     */
    tagKey(key, tags, cache) {
        tags.forEach(tag => {
            if (!this.invalidationRules.has(tag)) {
                this.invalidationRules.set(tag, new Set());
            }
            this.invalidationRules.get(tag).add({ key, cache });
        });
    }

    /**
     * Invalidate by tags
     */
    invalidateByTags(tags, targetCache) {
        let invalidated = 0;
        
        tags.forEach(tag => {
            const keys = this.invalidationRules.get(tag);
            if (keys) {
                keys.forEach(({ key, cache }) => {
                    if (!targetCache || cache === targetCache) {
                        const cacheInstance = this.caches[cache] || this.caches.default;
                        if (cacheInstance.del(key)) {
                            invalidated++;
                        }
                    }
                });
                this.invalidationRules.delete(tag);
            }
        });
        
        return invalidated;
    }

    /**
     * Invalidate by pattern
     */
    invalidateByPattern(pattern, targetCache) {
        let invalidated = 0;
        const regex = new RegExp(pattern);
        
        const cachesToCheck = targetCache 
            ? [this.caches[targetCache] || this.caches.default]
            : Object.values(this.caches);
        
        cachesToCheck.forEach(cache => {
            const keys = cache.keys();
            keys.forEach(key => {
                if (regex.test(key)) {
                    if (cache.del(key)) {
                        invalidated++;
                    }
                }
            });
        });
        
        return invalidated;
    }

    /**
     * Get or set with loader function
     */
    async getOrSet(key, loader, options = {}) {
        // Try to get from cache first
        const cached = await this.get(key, options);
        if (cached !== null) {
            return cached;
        }

        // Load fresh value
        try {
            const value = await loader();
            
            // Cache the result
            await this.set(key, value, options);
            
            return value;
        } catch (error) {
            this.emit('cache:loader:error', { key, error });
            throw error;
        }
    }

    /**
     * Batch get operation
     */
    async mget(keys, options = {}) {
        const { cache = 'default' } = options;
        const targetCache = this.caches[cache] || this.caches.default;
        
        const results = {};
        const cacheKeys = keys.map(key => ({
            original: key,
            cached: this.generateKey(key)
        }));

        const cachedValues = targetCache.mget(cacheKeys.map(k => k.cached));
        
        cacheKeys.forEach(({ original, cached }, index) => {
            results[original] = cachedValues[cached];
        });
        
        return results;
    }

    /**
     * Batch set operation
     */
    async mset(entries, options = {}) {
        const promises = [];
        
        for (const [key, value] of Object.entries(entries)) {
            promises.push(this.set(key, value, options));
        }
        
        const results = await Promise.all(promises);
        return results.every(r => r === true);
    }

    /**
     * Clear specific cache or all caches
     */
    clear(cacheName) {
        if (cacheName && this.caches[cacheName]) {
            this.caches[cacheName].flushAll();
            this.emit('cache:cleared', { cache: cacheName });
        } else {
            Object.entries(this.caches).forEach(([name, cache]) => {
                cache.flushAll();
            });
            this.emit('cache:cleared', { cache: 'all' });
        }
    }

    /**
     * Get cache statistics
     */
    getStats() {
        const cacheStats = {};
        
        Object.entries(this.caches).forEach(([name, cache]) => {
            cacheStats[name] = {
                keys: cache.keys().length,
                hits: cache.getStats().hits,
                misses: cache.getStats().misses,
                ksize: cache.getStats().ksize,
                vsize: cache.getStats().vsize
            };
        });
        
        return {
            ...this.stats,
            caches: cacheStats,
            hitRate: this.stats.hits / (this.stats.hits + this.stats.misses) || 0
        };
    }

    /**
     * Warmup cache with preloaded data
     */
    async warmup(data, options = {}) {
        const promises = [];
        
        for (const [key, value] of Object.entries(data)) {
            promises.push(this.set(key, value, options));
        }
        
        const results = await Promise.all(promises);
        const success = results.filter(r => r === true).length;
        
        this.emit('cache:warmup', { total: results.length, success });
        return success;
    }

    /**
     * Create a cache-aware function wrapper
     */
    wrap(fn, options = {}) {
        const {
            keyGenerator = (...args) => JSON.stringify(args),
            ttl,
            cache = 'default'
        } = options;

        return async (...args) => {
            const key = keyGenerator(...args);
            
            return this.getOrSet(
                key,
                () => fn(...args),
                { cache, ttl }
            );
        };
    }
}

module.exports = IntelligentCacheService;