/**
 * Base Tool Interface
 * Provides common functionality for all tool integrations
 */
class BaseTool {
    constructor(config) {
        this.name = config.name;
        this.description = config.description;
        this.category = config.category || 'general';
        this.version = config.version || '1.0.0';
        this.parameters = config.parameters || {};
        this.requiresAuth = config.requiresAuth || false;
        this.timeout = config.timeout || 30000;
        this.retryable = config.retryable || false;
        this.maxRetries = config.maxRetries || 3;
        
        // Initialize logger
        this.logger = {
            info: (message, data) => console.log(`[${this.name}] INFO:`, message, data || ''),
            error: (message, data) => console.error(`[${this.name}] ERROR:`, message, data || ''),
            warn: (message, data) => console.warn(`[${this.name}] WARN:`, message, data || ''),
            debug: (message, data) => console.debug(`[${this.name}] DEBUG:`, message, data || '')
        };
        
        // Initialize if needed
        if (this.initialize && typeof this.initialize === 'function') {
            this.initialize().catch(err => {
                this.logger.error('Failed to initialize tool', { error: err.message });
            });
        }
    }
    
    /**
     * Validate parameters
     */
    validateParameters(parameters) {
        const errors = [];
        
        for (const [key, config] of Object.entries(this.parameters)) {
            const value = parameters[key];
            
            // Check required parameters
            if (config.required && (value === undefined || value === null)) {
                errors.push(`Missing required parameter: ${key}`);
                continue;
            }
            
            // Skip validation if not required and not provided
            if (!config.required && (value === undefined || value === null)) {
                continue;
            }
            
            // Type validation
            if (config.type && typeof value !== config.type) {
                errors.push(`Parameter ${key} must be of type ${config.type}`);
            }
            
            // Custom validation
            if (config.validate && typeof config.validate === 'function') {
                const validationResult = config.validate(value);
                if (validationResult !== true) {
                    errors.push(`Parameter ${key} validation failed: ${validationResult}`);
                }
            }
        }
        
        return errors;
    }
    
    /**
     * Execute with retries
     */
    async executeWithRetries(parameters, context, retryCount = 0) {
        try {
            return await this.execute(parameters, context);
        } catch (error) {
            if (this.retryable && retryCount < this.maxRetries) {
                this.logger.warn(`Retrying operation (${retryCount + 1}/${this.maxRetries})`, {
                    error: error.message
                });
                
                // Exponential backoff
                const delay = Math.pow(2, retryCount) * 1000;
                await new Promise(resolve => setTimeout(resolve, delay));
                
                return this.executeWithRetries(parameters, context, retryCount + 1);
            }
            throw error;
        }
    }
    
    /**
     * Run the tool
     */
    async run(parameters = {}, context = {}) {
        const startTime = Date.now();
        
        try {
            // Validate parameters
            const validationErrors = this.validateParameters(parameters);
            if (validationErrors.length > 0) {
                throw new Error(`Validation failed: ${validationErrors.join(', ')}`);
            }
            
            // Execute with timeout
            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => reject(new Error('Operation timed out')), this.timeout);
            });
            
            const executePromise = this.retryable 
                ? this.executeWithRetries(parameters, context)
                : this.execute(parameters, context);
            
            const result = await Promise.race([executePromise, timeoutPromise]);
            
            const duration = Date.now() - startTime;
            this.logger.info('Tool execution completed', { duration });
            
            return {
                success: true,
                data: result,
                metadata: {
                    tool: this.name,
                    version: this.version,
                    duration
                }
            };
        } catch (error) {
            const duration = Date.now() - startTime;
            this.logger.error('Tool execution failed', { 
                error: error.message,
                duration 
            });
            
            return {
                success: false,
                error: error.message,
                metadata: {
                    tool: this.name,
                    version: this.version,
                    duration
                }
            };
        }
    }
    
    /**
     * Execute method to be implemented by child classes
     */
    async execute(parameters, context) {
        throw new Error('Execute method must be implemented by child class');
    }
}

module.exports = BaseTool;