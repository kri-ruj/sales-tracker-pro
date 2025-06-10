/**
 * Base Plugin Class
 * Provides common functionality for all plugins
 */

const { IPlugin, IPluginTool, PluginEvents } = require('../interfaces/plugin.interface');
const BaseTool = require('../../registry/tool-interface');
const path = require('path');
const fs = require('fs').promises;

class BasePlugin extends IPlugin {
    constructor(metadata) {
        super();
        
        // Initialize metadata
        this.metadata = Object.assign(this.metadata, metadata);
        
        // Plugin state
        this.enabled = false;
        this.loaded = false;
        this.context = null;
        this.tools = new Map();
        this.eventHandlers = new Map();
        this.routes = [];
        
        // Storage path for plugin data
        this.storagePath = null;
        
        // Performance tracking
        this.metrics = {
            loadTime: 0,
            toolCalls: new Map(),
            errors: [],
            lastError: null
        };
    }
    
    /**
     * Initialize plugin with context
     */
    async initialize(context) {
        this.context = context;
        this.storagePath = path.join(context.storage.basePath, this.metadata.name);
        
        // Ensure storage directory exists
        await fs.mkdir(this.storagePath, { recursive: true });
        
        // Set up logger with plugin prefix
        this.logger = {
            info: (msg, data) => context.logger.info(`[${this.metadata.name}] ${msg}`, data),
            error: (msg, data) => context.logger.error(`[${this.metadata.name}] ${msg}`, data),
            warn: (msg, data) => context.logger.warn(`[${this.metadata.name}] ${msg}`, data),
            debug: (msg, data) => context.logger.debug(`[${this.metadata.name}] ${msg}`, data)
        };
    }
    
    /**
     * Default lifecycle implementations
     */
    async onLoad(context) {
        const startTime = Date.now();
        
        try {
            await this.initialize(context);
            
            // Register tools
            await this.registerTools();
            
            // Set up event handlers
            this.setupEventHandlers();
            
            // Load plugin configuration
            this.config = await this.loadConfig();
            
            this.loaded = true;
            this.metrics.loadTime = Date.now() - startTime;
            
            this.logger.info('Plugin loaded successfully', {
                loadTime: this.metrics.loadTime,
                toolCount: this.tools.size
            });
            
            // Emit loaded event
            this.context.events.emit(PluginEvents.PLUGIN_LOADED, {
                plugin: this.metadata.name,
                version: this.metadata.version
            });
            
        } catch (error) {
            this.handleError('Failed to load plugin', error);
            throw error;
        }
    }
    
    async onEnable(context) {
        if (!this.loaded) {
            throw new Error('Plugin must be loaded before enabling');
        }
        
        try {
            // Enable all tools
            for (const tool of this.tools.values()) {
                if (tool.onEnable) {
                    await tool.onEnable();
                }
            }
            
            // Subscribe to events
            this.subscribeToEvents();
            
            this.enabled = true;
            
            this.logger.info('Plugin enabled');
            
            this.context.events.emit(PluginEvents.PLUGIN_ENABLED, {
                plugin: this.metadata.name
            });
            
        } catch (error) {
            this.handleError('Failed to enable plugin', error);
            throw error;
        }
    }
    
    async onDisable(context) {
        try {
            // Unsubscribe from events
            this.unsubscribeFromEvents();
            
            // Disable all tools
            for (const tool of this.tools.values()) {
                if (tool.onDisable) {
                    await tool.onDisable();
                }
            }
            
            this.enabled = false;
            
            this.logger.info('Plugin disabled');
            
            this.context.events.emit(PluginEvents.PLUGIN_DISABLED, {
                plugin: this.metadata.name
            });
            
        } catch (error) {
            this.handleError('Failed to disable plugin', error);
            throw error;
        }
    }
    
    async onUnload(context) {
        try {
            // Disable first if still enabled
            if (this.enabled) {
                await this.onDisable(context);
            }
            
            // Clean up resources
            await this.cleanup();
            
            // Clear tools
            this.tools.clear();
            
            this.loaded = false;
            
            this.logger.info('Plugin unloaded');
            
            this.context.events.emit(PluginEvents.PLUGIN_UNLOADED, {
                plugin: this.metadata.name
            });
            
        } catch (error) {
            this.handleError('Failed to unload plugin', error);
            throw error;
        }
    }
    
    /**
     * Tool management
     */
    registerTool(tool) {
        if (!(tool instanceof BasePluginTool)) {
            throw new Error('Tool must extend BasePluginTool');
        }
        
        // Set plugin context on tool
        tool.plugin = this;
        tool.context = this.context;
        
        this.tools.set(tool.name, tool);
        
        this.logger.debug(`Registered tool: ${tool.name}`);
    }
    
    getTools() {
        return Array.from(this.tools.values()).map(tool => ({
            name: tool.name,
            description: tool.description,
            parameters: tool.parameters,
            category: tool.category || this.metadata.category,
            plugin: this.metadata.name,
            examples: tool.examples || []
        }));
    }
    
    async executeTool(toolName, parameters, context) {
        const tool = this.tools.get(toolName);
        if (!tool) {
            throw new Error(`Tool not found: ${toolName}`);
        }
        
        const startTime = Date.now();
        
        try {
            // Update metrics
            const toolMetrics = this.metrics.toolCalls.get(toolName) || {
                calls: 0,
                errors: 0,
                totalDuration: 0
            };
            toolMetrics.calls++;
            
            // Execute tool
            const result = await tool.run(parameters, context);
            
            // Update metrics
            const duration = Date.now() - startTime;
            toolMetrics.totalDuration += duration;
            this.metrics.toolCalls.set(toolName, toolMetrics);
            
            // Emit event
            this.context.events.emit(PluginEvents.TOOL_EXECUTED, {
                plugin: this.metadata.name,
                tool: toolName,
                duration,
                success: result.success
            });
            
            return result;
            
        } catch (error) {
            // Update error metrics
            const toolMetrics = this.metrics.toolCalls.get(toolName) || {
                calls: 0,
                errors: 0,
                totalDuration: 0
            };
            toolMetrics.errors++;
            this.metrics.toolCalls.set(toolName, toolMetrics);
            
            this.handleError(`Tool execution failed: ${toolName}`, error);
            
            // Emit error event
            this.context.events.emit(PluginEvents.TOOL_ERROR, {
                plugin: this.metadata.name,
                tool: toolName,
                error: error.message
            });
            
            throw error;
        }
    }
    
    /**
     * Event handling
     */
    setupEventHandlers() {
        // Override to set up event handlers
    }
    
    subscribeToEvents() {
        const subscriptions = this.getEventSubscriptions();
        
        for (const { event, handler } of subscriptions) {
            const wrappedHandler = async (...args) => {
                try {
                    await handler.call(this, ...args);
                } catch (error) {
                    this.handleError(`Event handler error for ${event}`, error);
                }
            };
            
            this.eventHandlers.set(event, wrappedHandler);
            this.context.events.on(event, wrappedHandler);
        }
    }
    
    unsubscribeFromEvents() {
        for (const [event, handler] of this.eventHandlers) {
            this.context.events.off(event, handler);
        }
        this.eventHandlers.clear();
    }
    
    /**
     * Configuration management
     */
    async loadConfig() {
        try {
            const configPath = path.join(this.storagePath, 'config.json');
            const configData = await fs.readFile(configPath, 'utf8');
            return JSON.parse(configData);
        } catch (error) {
            // Return default config if file doesn't exist
            return this.getDefaultConfig();
        }
    }
    
    async saveConfig(config) {
        const configPath = path.join(this.storagePath, 'config.json');
        await fs.writeFile(configPath, JSON.stringify(config, null, 2));
        this.config = config;
    }
    
    getDefaultConfig() {
        return {
            enabled: true,
            settings: {}
        };
    }
    
    async onConfigChange(newConfig, oldConfig) {
        // Validate new config
        const validation = this.validateConfig(newConfig);
        if (!validation.valid) {
            throw new Error(`Invalid configuration: ${validation.errors.join(', ')}`);
        }
        
        // Save new config
        await this.saveConfig(newConfig);
        
        this.logger.info('Configuration updated');
    }
    
    /**
     * Storage helpers
     */
    async readData(filename) {
        const filePath = path.join(this.storagePath, filename);
        return await fs.readFile(filePath, 'utf8');
    }
    
    async writeData(filename, data) {
        const filePath = path.join(this.storagePath, filename);
        await fs.writeFile(filePath, data, 'utf8');
    }
    
    async dataExists(filename) {
        const filePath = path.join(this.storagePath, filename);
        try {
            await fs.access(filePath);
            return true;
        } catch {
            return false;
        }
    }
    
    /**
     * Health and monitoring
     */
    async getHealth() {
        const health = {
            status: 'healthy',
            details: {
                enabled: this.enabled,
                loaded: this.loaded,
                toolCount: this.tools.size,
                lastError: this.metrics.lastError
            }
        };
        
        // Check if there are recent errors
        const recentErrors = this.metrics.errors.filter(
            e => Date.now() - e.timestamp < 300000 // Last 5 minutes
        );
        
        if (recentErrors.length > 5) {
            health.status = 'degraded';
            health.details.recentErrorCount = recentErrors.length;
        }
        
        return health;
    }
    
    async getMetrics() {
        const toolStats = {};
        
        for (const [toolName, metrics] of this.metrics.toolCalls) {
            toolStats[toolName] = {
                calls: metrics.calls,
                errors: metrics.errors,
                errorRate: metrics.calls > 0 ? (metrics.errors / metrics.calls) * 100 : 0,
                avgDuration: metrics.calls > 0 ? metrics.totalDuration / metrics.calls : 0
            };
        }
        
        return {
            loadTime: this.metrics.loadTime,
            tools: toolStats,
            totalErrors: this.metrics.errors.length,
            recentErrors: this.metrics.errors.slice(-10)
        };
    }
    
    /**
     * Error handling
     */
    handleError(message, error) {
        this.logger.error(message, { error: error.message, stack: error.stack });
        
        this.metrics.errors.push({
            message,
            error: error.message,
            timestamp: Date.now()
        });
        
        this.metrics.lastError = {
            message,
            error: error.message,
            timestamp: Date.now()
        };
        
        // Keep only last 100 errors
        if (this.metrics.errors.length > 100) {
            this.metrics.errors = this.metrics.errors.slice(-100);
        }
    }
    
    /**
     * Cleanup
     */
    async cleanup() {
        // Override to clean up plugin resources
    }
}

/**
 * Base Plugin Tool Class
 */
class BasePluginTool extends IPluginTool {
    constructor(config) {
        super();
        Object.assign(this, config);
        
        this.plugin = null;  // Set by plugin when registered
        this.context = null; // Set by plugin when registered
    }
    
    async run(parameters, context) {
        // Validate parameters
        const validation = this.validateParameters(parameters);
        if (!validation.valid) {
            throw new Error(`Invalid parameters: ${validation.errors.join(', ')}`);
        }
        
        // Execute tool
        return await this.execute(parameters, context);
    }
    
    validateParameters(parameters) {
        const errors = [];
        
        // Check required parameters
        for (const [key, config] of Object.entries(this.parameters.properties || {})) {
            if (this.parameters.required?.includes(key) && !(key in parameters)) {
                errors.push(`Missing required parameter: ${key}`);
            }
            
            // Type validation
            if (key in parameters && config.type) {
                const value = parameters[key];
                const actualType = Array.isArray(value) ? 'array' : typeof value;
                
                if (actualType !== config.type) {
                    errors.push(`Parameter ${key} must be of type ${config.type}`);
                }
            }
        }
        
        return {
            valid: errors.length === 0,
            errors
        };
    }
    
    // Helper methods for tools
    
    async cacheGet(key) {
        return await this.context.cache.get(`${this.plugin.metadata.name}:${this.name}:${key}`);
    }
    
    async cacheSet(key, value, ttl) {
        return await this.context.cache.set(
            `${this.plugin.metadata.name}:${this.name}:${key}`,
            value,
            ttl
        );
    }
    
    async httpGet(url, options = {}) {
        return await this.context.http.get(url, options);
    }
    
    async httpPost(url, data, options = {}) {
        return await this.context.http.post(url, data, options);
    }
}

module.exports = {
    BasePlugin,
    BasePluginTool
};