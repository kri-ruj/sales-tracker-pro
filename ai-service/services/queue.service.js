const Bull = require('bull');
const { createBullBoard } = require('@bull-board/api');
const { BullAdapter } = require('@bull-board/api/bullAdapter');
const { ExpressAdapter } = require('@bull-board/express');
const winston = require('winston');

// Logger setup
const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
    ),
    transports: [
        new winston.transports.Console()
    ]
});

class QueueService {
    constructor() {
        this.queues = {};
        this.serverAdapter = new ExpressAdapter();
        this.serverAdapter.setBasePath('/admin/queues');
        
        // Initialize queues
        this.initQueues();
        
        // Setup Bull Board
        this.setupBullBoard();
    }
    
    initQueues() {
        // Check if Redis is disabled
        const isRedisDisabled = process.env.DISABLE_REDIS === 'true';
        
        if (isRedisDisabled) {
            // Create mock queues for development/testing
            logger.info('Redis disabled - using in-memory mock queues');
            this.queues = {
                aiProcessing: this.createMockQueue('ai-processing'),
                fileProcessing: this.createMockQueue('file-processing'),
                exportJobs: this.createMockQueue('export-jobs'),
                emailNotifications: this.createMockQueue('email-notifications')
            };
        } else {
            // Configure Redis connection
            const redisConfig = {
                redis: {
                    host: process.env.REDIS_HOST || 'localhost',
                    port: process.env.REDIS_PORT || 6379,
                    password: process.env.REDIS_PASSWORD
                }
            };
            
            // Create queues
            this.queues.aiProcessing = new Bull('ai-processing', redisConfig);
            this.queues.fileProcessing = new Bull('file-processing', redisConfig);
            this.queues.exportJobs = new Bull('export-jobs', redisConfig);
            this.queues.emailNotifications = new Bull('email-notifications', redisConfig);
            
            // Setup processors
            this.setupProcessors();
            
            // Setup event handlers
            this.setupEventHandlers();
        }
        
        logger.info('Queue service initialized');
    }
    
    createMockQueue(name) {
        // Create a mock queue that implements Bull interface
        const jobs = new Map();
        let jobCounter = 0;
        
        return {
            name,
            
            add: async (data, options = {}) => {
                const jobId = ++jobCounter;
                const job = {
                    id: jobId,
                    data,
                    options,
                    timestamp: Date.now(),
                    progress: () => 0,
                    getState: async () => 'completed',
                    attemptsMade: 0
                };
                jobs.set(jobId, job);
                logger.info(`Mock job added to ${name}`, { jobId, data });
                
                // Simulate immediate processing
                setTimeout(() => {
                    logger.info(`Mock job completed in ${name}`, { jobId });
                }, 100);
                
                return job;
            },
            
            getJob: async (jobId) => jobs.get(jobId),
            
            getJobCounts: async () => ({
                waiting: 0,
                active: 0,
                completed: jobs.size,
                failed: 0,
                delayed: 0,
                paused: 0
            }),
            
            isPaused: async () => false,
            pause: async () => {},
            resume: async () => {},
            clean: async () => { jobs.clear(); },
            close: async () => {},
            
            on: (event, handler) => {},
            process: (handler) => {}
        };
    }
    
    setupBullBoard() {
        // Only setup Bull Board if Redis is enabled
        if (process.env.DISABLE_REDIS !== 'true') {
            const bullBoard = createBullBoard({
                queues: Object.values(this.queues).map(queue => new BullAdapter(queue)),
                serverAdapter: this.serverAdapter
            });
        }
    }
    
    setupProcessors() {
        // AI Processing Queue - for long-running AI tasks
        this.queues.aiProcessing.process(async (job) => {
            const { userId, sessionId, query, agent } = job.data;
            logger.info('Processing AI job', { jobId: job.id, userId, query });
            
            try {
                // Update job progress
                job.progress(10);
                
                // Process the query (this would be the actual AI processing)
                const result = await this.processAIQuery(job.data);
                
                job.progress(100);
                return result;
            } catch (error) {
                logger.error('AI processing failed', { jobId: job.id, error: error.message });
                throw error;
            }
        });
        
        // File Processing Queue - for file operations
        this.queues.fileProcessing.process(async (job) => {
            const { operation, filePath, content } = job.data;
            logger.info('Processing file job', { jobId: job.id, operation, filePath });
            
            try {
                job.progress(20);
                
                switch (operation) {
                    case 'analyze':
                        return await this.analyzeFile(filePath);
                    case 'convert':
                        return await this.convertFile(filePath, job.data.targetFormat);
                    case 'compress':
                        return await this.compressFile(filePath);
                    default:
                        throw new Error(`Unknown operation: ${operation}`);
                }
            } catch (error) {
                logger.error('File processing failed', { jobId: job.id, error: error.message });
                throw error;
            }
        });
        
        // Export Jobs Queue - for exporting conversations
        this.queues.exportJobs.process(async (job) => {
            const { userId, sessionId, format } = job.data;
            logger.info('Processing export job', { jobId: job.id, userId, format });
            
            try {
                job.progress(30);
                
                // Export conversation based on format
                switch (format) {
                    case 'pdf':
                        return await this.exportToPDF(userId, sessionId);
                    case 'json':
                        return await this.exportToJSON(userId, sessionId);
                    case 'markdown':
                        return await this.exportToMarkdown(userId, sessionId);
                    default:
                        throw new Error(`Unknown format: ${format}`);
                }
            } catch (error) {
                logger.error('Export job failed', { jobId: job.id, error: error.message });
                throw error;
            }
        });
        
        // Email Notifications Queue
        this.queues.emailNotifications.process(async (job) => {
            const { to, subject, body, template } = job.data;
            logger.info('Sending email', { jobId: job.id, to, subject });
            
            try {
                // In production, integrate with email service
                // For now, just log
                logger.info('Email would be sent', { to, subject, template });
                return { sent: true, messageId: `msg-${job.id}` };
            } catch (error) {
                logger.error('Email sending failed', { jobId: job.id, error: error.message });
                throw error;
            }
        });
    }
    
    setupEventHandlers() {
        Object.entries(this.queues).forEach(([name, queue]) => {
            queue.on('completed', (job, result) => {
                logger.info(`Job completed in ${name}`, { 
                    jobId: job.id, 
                    duration: Date.now() - job.timestamp 
                });
            });
            
            queue.on('failed', (job, err) => {
                logger.error(`Job failed in ${name}`, { 
                    jobId: job.id, 
                    error: err.message,
                    attempts: job.attemptsMade
                });
            });
            
            queue.on('stalled', (job) => {
                logger.warn(`Job stalled in ${name}`, { jobId: job.id });
            });
        });
    }
    
    // Queue Management Methods
    async addAIJob(data, options = {}) {
        const defaultOptions = {
            attempts: 3,
            backoff: {
                type: 'exponential',
                delay: 2000
            },
            removeOnComplete: true,
            removeOnFail: false
        };
        
        const job = await this.queues.aiProcessing.add(data, {
            ...defaultOptions,
            ...options
        });
        
        logger.info('AI job added', { jobId: job.id, userId: data.userId });
        return job;
    }
    
    async addFileJob(data, options = {}) {
        const job = await this.queues.fileProcessing.add(data, {
            attempts: 2,
            backoff: 1000,
            ...options
        });
        
        logger.info('File job added', { jobId: job.id, operation: data.operation });
        return job;
    }
    
    async addExportJob(data, options = {}) {
        const job = await this.queues.exportJobs.add(data, {
            attempts: 3,
            timeout: 300000, // 5 minutes
            ...options
        });
        
        logger.info('Export job added', { jobId: job.id, format: data.format });
        return job;
    }
    
    async addEmailJob(data, options = {}) {
        const job = await this.queues.emailNotifications.add(data, {
            attempts: 5,
            backoff: {
                type: 'fixed',
                delay: 5000
            },
            ...options
        });
        
        logger.info('Email job added', { jobId: job.id, to: data.to });
        return job;
    }
    
    // Job Status Methods
    async getJobStatus(queueName, jobId) {
        const queue = this.queues[queueName];
        if (!queue) {
            throw new Error(`Queue ${queueName} not found`);
        }
        
        const job = await queue.getJob(jobId);
        if (!job) {
            return null;
        }
        
        const state = await job.getState();
        const progress = job.progress();
        
        return {
            id: job.id,
            state,
            progress,
            data: job.data,
            result: job.returnvalue,
            failedReason: job.failedReason,
            createdAt: new Date(job.timestamp),
            processedAt: job.processedOn ? new Date(job.processedOn) : null,
            finishedAt: job.finishedOn ? new Date(job.finishedOn) : null
        };
    }
    
    async getQueueStats() {
        const stats = {};
        
        for (const [name, queue] of Object.entries(this.queues)) {
            const counts = await queue.getJobCounts();
            const isPaused = await queue.isPaused();
            
            stats[name] = {
                ...counts,
                isPaused
            };
        }
        
        return stats;
    }
    
    // Queue Control Methods
    async pauseQueue(queueName) {
        const queue = this.queues[queueName];
        if (queue) {
            await queue.pause();
            logger.info(`Queue ${queueName} paused`);
        }
    }
    
    async resumeQueue(queueName) {
        const queue = this.queues[queueName];
        if (queue) {
            await queue.resume();
            logger.info(`Queue ${queueName} resumed`);
        }
    }
    
    async cleanQueue(queueName, grace = 0) {
        const queue = this.queues[queueName];
        if (queue) {
            await queue.clean(grace);
            logger.info(`Queue ${queueName} cleaned`);
        }
    }
    
    // Processing Methods (placeholders - implement based on needs)
    async processAIQuery(data) {
        // Simulate long-running AI processing
        await new Promise(resolve => setTimeout(resolve, 5000));
        return { processed: true, result: 'AI processing complete' };
    }
    
    async analyzeFile(filePath) {
        // Implement file analysis
        return { analyzed: true, filePath };
    }
    
    async convertFile(filePath, targetFormat) {
        // Implement file conversion
        return { converted: true, filePath, targetFormat };
    }
    
    async compressFile(filePath) {
        // Implement file compression
        return { compressed: true, filePath };
    }
    
    async exportToPDF(userId, sessionId) {
        // Implement PDF export
        return { exported: true, format: 'pdf', userId, sessionId };
    }
    
    async exportToJSON(userId, sessionId) {
        // Implement JSON export
        return { exported: true, format: 'json', userId, sessionId };
    }
    
    async exportToMarkdown(userId, sessionId) {
        // Implement Markdown export
        return { exported: true, format: 'markdown', userId, sessionId };
    }
    
    // Express Router
    getRouter() {
        return this.serverAdapter.getRouter();
    }
    
    // Cleanup
    async close() {
        for (const [name, queue] of Object.entries(this.queues)) {
            await queue.close();
            logger.info(`Queue ${name} closed`);
        }
    }
}

module.exports = new QueueService();