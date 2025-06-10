/**
 * Plugin Interface Definition
 * Defines the contract that all plugins must implement
 */

/**
 * Plugin metadata interface
 */
class PluginMetadata {
    constructor() {
        this.name = '';          // Unique plugin identifier
        this.displayName = '';   // Human-readable name
        this.version = '';       // Semantic version (e.g., '1.0.0')
        this.description = '';   // Plugin description
        this.author = '';        // Author name
        this.email = '';         // Contact email
        this.homepage = '';      // Plugin homepage/documentation
        this.repository = '';    // Source repository
        this.license = '';       // License identifier
        this.category = '';      // Plugin category
        this.tags = [];         // Search tags
        this.icon = '';         // Icon URL or base64
        this.screenshots = [];   // Screenshot URLs
        this.dependencies = {}; // Required npm packages
        this.peerDependencies = {}; // Required peer dependencies
        this.minAgentVersion = ''; // Minimum agent version required
        this.maxAgentVersion = ''; // Maximum agent version supported
    }
}

/**
 * Plugin configuration schema
 */
class PluginConfig {
    constructor() {
        this.enabled = true;
        this.settings = {};      // Plugin-specific settings
        this.permissions = [];   // Required permissions
        this.resources = {       // Resource limits
            maxMemory: '128MB',
            maxCpu: '10%',
            maxDiskSpace: '100MB',
            networkAccess: false,
            fileSystemAccess: 'restricted'
        };
    }
}

/**
 * Base Plugin Interface
 */
class IPlugin {
    constructor() {
        if (new.target === IPlugin) {
            throw new TypeError("Cannot instantiate abstract class IPlugin");
        }
        
        this.metadata = new PluginMetadata();
        this.config = new PluginConfig();
    }
    
    /**
     * Plugin lifecycle methods
     */
    
    // Called when plugin is loaded
    async onLoad(context) {
        throw new Error('onLoad method must be implemented');
    }
    
    // Called when plugin is enabled
    async onEnable(context) {
        throw new Error('onEnable method must be implemented');
    }
    
    // Called when plugin is disabled
    async onDisable(context) {
        throw new Error('onDisable method must be implemented');
    }
    
    // Called when plugin is unloaded
    async onUnload(context) {
        throw new Error('onUnload method must be implemented');
    }
    
    // Called when plugin configuration changes
    async onConfigChange(newConfig, oldConfig) {
        // Optional: Override to handle config changes
    }
    
    /**
     * Tool registration methods
     */
    
    // Register tools with the agent
    async registerTools() {
        throw new Error('registerTools method must be implemented');
    }
    
    // Get all tools provided by this plugin
    getTools() {
        return [];
    }
    
    /**
     * Event handling
     */
    
    // Subscribe to agent events
    getEventSubscriptions() {
        return [];
    }
    
    // Handle agent events
    async handleEvent(eventName, eventData) {
        // Override to handle specific events
    }
    
    /**
     * API routes
     */
    
    // Register custom API routes
    getApiRoutes() {
        return [];
    }
    
    /**
     * Validation
     */
    
    // Validate plugin configuration
    validateConfig(config) {
        return { valid: true, errors: [] };
    }
    
    // Check if plugin is compatible with current environment
    async checkCompatibility(environment) {
        return { compatible: true, issues: [] };
    }
    
    /**
     * Health and monitoring
     */
    
    // Get plugin health status
    async getHealth() {
        return { 
            status: 'healthy', 
            details: {} 
        };
    }
    
    // Get plugin metrics
    async getMetrics() {
        return {
            toolCalls: {},
            errors: 0,
            performance: {}
        };
    }
}

/**
 * Plugin Tool Interface
 */
class IPluginTool {
    constructor() {
        if (new.target === IPluginTool) {
            throw new TypeError("Cannot instantiate abstract class IPluginTool");
        }
        
        this.name = '';
        this.description = '';
        this.parameters = {};
        this.category = '';
        this.examples = [];
    }
    
    // Execute the tool
    async execute(parameters, context) {
        throw new Error('execute method must be implemented');
    }
    
    // Validate parameters
    validateParameters(parameters) {
        return { valid: true, errors: [] };
    }
}

/**
 * Plugin Context Interface
 * Provides access to agent services and APIs
 */
class IPluginContext {
    constructor() {
        this.logger = null;         // Logger service
        this.cache = null;          // Cache service
        this.database = null;       // Database service
        this.queue = null;          // Queue service
        this.auth = null;           // Auth service
        this.webhook = null;        // Webhook service
        this.config = null;         // Config service
        this.events = null;         // Event emitter
        this.storage = null;        // Plugin storage
        this.http = null;           // HTTP client
        this.metrics = null;        // Metrics service
    }
}

/**
 * Plugin Events
 */
const PluginEvents = {
    // Lifecycle events
    PLUGIN_LOADED: 'plugin:loaded',
    PLUGIN_ENABLED: 'plugin:enabled',
    PLUGIN_DISABLED: 'plugin:disabled',
    PLUGIN_UNLOADED: 'plugin:unloaded',
    PLUGIN_ERROR: 'plugin:error',
    
    // Tool events
    TOOL_REGISTERED: 'tool:registered',
    TOOL_EXECUTED: 'tool:executed',
    TOOL_ERROR: 'tool:error',
    
    // System events
    AGENT_READY: 'agent:ready',
    QUERY_STARTED: 'query:started',
    QUERY_COMPLETED: 'query:completed',
    SESSION_CREATED: 'session:created',
    SESSION_ENDED: 'session:ended'
};

/**
 * Plugin Permissions
 */
const PluginPermissions = {
    // Resource access
    CACHE_READ: 'cache:read',
    CACHE_WRITE: 'cache:write',
    DATABASE_READ: 'database:read',
    DATABASE_WRITE: 'database:write',
    QUEUE_READ: 'queue:read',
    QUEUE_WRITE: 'queue:write',
    
    // Network access
    NETWORK_HTTP: 'network:http',
    NETWORK_WEBSOCKET: 'network:websocket',
    
    // File system access
    FS_READ: 'fs:read',
    FS_WRITE: 'fs:write',
    
    // API access
    API_ROUTES: 'api:routes',
    API_MIDDLEWARE: 'api:middleware',
    
    // Event access
    EVENTS_SUBSCRIBE: 'events:subscribe',
    EVENTS_EMIT: 'events:emit',
    
    // Tool access
    TOOLS_REGISTER: 'tools:register',
    TOOLS_EXECUTE: 'tools:execute'
};

module.exports = {
    IPlugin,
    IPluginTool,
    IPluginContext,
    PluginMetadata,
    PluginConfig,
    PluginEvents,
    PluginPermissions
};