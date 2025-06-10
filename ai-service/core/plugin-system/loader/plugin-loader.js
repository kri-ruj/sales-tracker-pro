/**
 * Plugin Loader
 * Handles dynamic loading and management of plugins
 */

const path = require('path');
const fs = require('fs').promises;
const vm = require('vm');
const { BasePlugin } = require('../base/base-plugin');
const { PluginEvents, PluginPermissions } = require('../interfaces/plugin.interface');
const PluginValidator = require('../security/plugin-validator');
const PluginSandbox = require('../security/plugin-sandbox');

class PluginLoader {
    constructor(config = {}) {
        this.pluginsPath = config.pluginsPath || path.join(process.cwd(), 'plugins');
        this.plugins = new Map();
        this.pluginRegistry = new Map();
        this.enabledPlugins = new Set();
        this.logger = config.logger || console;
        this.context = null;
        this.validator = new PluginValidator();
        this.sandboxes = new Map();
        
        // Plugin discovery options
        this.discoveryOptions = {
            recursive: true,
            fileExtensions: ['.js', '.ts'],
            ignorePatterns: ['node_modules', 'test', '__tests__', '.git']
        };
    }
    
    /**
     * Initialize the plugin loader with context
     */
    async initialize(context) {
        this.context = context;
        
        // Ensure plugins directory exists
        await fs.mkdir(this.pluginsPath, { recursive: true });
        
        // Load plugin registry
        await this.loadRegistry();
        
        this.logger.info('Plugin loader initialized', {
            pluginsPath: this.pluginsPath
        });
    }
    
    /**
     * Discover all available plugins
     */
    async discoverPlugins() {
        const plugins = [];
        
        try {
            const entries = await fs.readdir(this.pluginsPath, { withFileTypes: true });
            
            for (const entry of entries) {
                if (entry.isDirectory()) {
                    const pluginPath = path.join(this.pluginsPath, entry.name);
                    
                    // Check if it's a valid plugin directory
                    if (await this.isValidPluginDirectory(pluginPath)) {
                        const metadata = await this.loadPluginMetadata(pluginPath);
                        if (metadata) {
                            plugins.push({
                                name: metadata.name,
                                path: pluginPath,
                                metadata
                            });
                        }
                    }
                }
            }
            
            // Also check for single-file plugins
            const files = entries.filter(e => e.isFile() && 
                this.discoveryOptions.fileExtensions.some(ext => e.name.endsWith(ext))
            );
            
            for (const file of files) {
                const filePath = path.join(this.pluginsPath, file.name);
                const metadata = await this.extractMetadataFromFile(filePath);
                
                if (metadata) {
                    plugins.push({
                        name: metadata.name,
                        path: filePath,
                        metadata,
                        singleFile: true
                    });
                }
            }
            
        } catch (error) {
            this.logger.error('Failed to discover plugins', { error: error.message });
        }
        
        return plugins;
    }
    
    /**
     * Load a plugin
     */
    async loadPlugin(pluginName, options = {}) {
        try {
            // Check if already loaded
            if (this.plugins.has(pluginName)) {
                this.logger.warn(`Plugin already loaded: ${pluginName}`);
                return this.plugins.get(pluginName);
            }
            
            // Find plugin info
            const pluginInfo = await this.findPlugin(pluginName);
            if (!pluginInfo) {
                throw new Error(`Plugin not found: ${pluginName}`);
            }
            
            // Validate plugin
            const validation = await this.validator.validatePlugin(pluginInfo);
            if (!validation.valid) {
                throw new Error(`Plugin validation failed: ${validation.errors.join(', ')}`);
            }
            
            // Check permissions
            if (pluginInfo.metadata.permissions) {
                const permissionCheck = await this.checkPermissions(pluginInfo.metadata.permissions);
                if (!permissionCheck.granted) {
                    throw new Error(`Permission denied: ${permissionCheck.missing.join(', ')}`);
                }
            }
            
            // Create plugin sandbox
            const sandbox = new PluginSandbox({
                name: pluginName,
                permissions: pluginInfo.metadata.permissions || [],
                resources: pluginInfo.metadata.resources || {}
            });
            
            // Load plugin code
            const PluginClass = await this.loadPluginCode(pluginInfo, sandbox);
            
            // Instantiate plugin
            const plugin = new PluginClass();
            
            // Verify it extends BasePlugin
            if (!(plugin instanceof BasePlugin)) {
                throw new Error('Plugin must extend BasePlugin');
            }
            
            // Create plugin context with sandboxed services
            const pluginContext = this.createPluginContext(plugin, sandbox);
            
            // Initialize plugin
            await plugin.onLoad(pluginContext);
            
            // Store plugin
            this.plugins.set(pluginName, plugin);
            this.sandboxes.set(pluginName, sandbox);
            
            // Update registry
            await this.updateRegistry(pluginName, {
                loaded: true,
                loadedAt: new Date().toISOString(),
                version: plugin.metadata.version
            });
            
            this.logger.info(`Plugin loaded: ${pluginName}`);
            
            return plugin;
            
        } catch (error) {
            this.logger.error(`Failed to load plugin: ${pluginName}`, {
                error: error.message
            });
            throw error;
        }
    }
    
    /**
     * Enable a plugin
     */
    async enablePlugin(pluginName) {
        const plugin = this.plugins.get(pluginName);
        if (!plugin) {
            throw new Error(`Plugin not loaded: ${pluginName}`);
        }
        
        if (this.enabledPlugins.has(pluginName)) {
            this.logger.warn(`Plugin already enabled: ${pluginName}`);
            return;
        }
        
        try {
            await plugin.onEnable(this.context);
            this.enabledPlugins.add(pluginName);
            
            // Register plugin tools with the agent
            await this.registerPluginTools(plugin);
            
            // Update registry
            await this.updateRegistry(pluginName, {
                enabled: true,
                enabledAt: new Date().toISOString()
            });
            
            this.logger.info(`Plugin enabled: ${pluginName}`);
            
        } catch (error) {
            this.logger.error(`Failed to enable plugin: ${pluginName}`, {
                error: error.message
            });
            throw error;
        }
    }
    
    /**
     * Disable a plugin
     */
    async disablePlugin(pluginName) {
        const plugin = this.plugins.get(pluginName);
        if (!plugin) {
            throw new Error(`Plugin not loaded: ${pluginName}`);
        }
        
        if (!this.enabledPlugins.has(pluginName)) {
            this.logger.warn(`Plugin not enabled: ${pluginName}`);
            return;
        }
        
        try {
            await plugin.onDisable(this.context);
            this.enabledPlugins.delete(pluginName);
            
            // Unregister plugin tools
            await this.unregisterPluginTools(plugin);
            
            // Update registry
            await this.updateRegistry(pluginName, {
                enabled: false,
                disabledAt: new Date().toISOString()
            });
            
            this.logger.info(`Plugin disabled: ${pluginName}`);
            
        } catch (error) {
            this.logger.error(`Failed to disable plugin: ${pluginName}`, {
                error: error.message
            });
            throw error;
        }
    }
    
    /**
     * Unload a plugin
     */
    async unloadPlugin(pluginName) {
        const plugin = this.plugins.get(pluginName);
        if (!plugin) {
            this.logger.warn(`Plugin not loaded: ${pluginName}`);
            return;
        }
        
        try {
            // Disable first if enabled
            if (this.enabledPlugins.has(pluginName)) {
                await this.disablePlugin(pluginName);
            }
            
            // Unload plugin
            await plugin.onUnload(this.context);
            
            // Clean up sandbox
            const sandbox = this.sandboxes.get(pluginName);
            if (sandbox) {
                await sandbox.cleanup();
                this.sandboxes.delete(pluginName);
            }
            
            // Remove from maps
            this.plugins.delete(pluginName);
            
            // Update registry
            await this.updateRegistry(pluginName, {
                loaded: false,
                unloadedAt: new Date().toISOString()
            });
            
            this.logger.info(`Plugin unloaded: ${pluginName}`);
            
        } catch (error) {
            this.logger.error(`Failed to unload plugin: ${pluginName}`, {
                error: error.message
            });
            throw error;
        }
    }
    
    /**
     * Reload a plugin
     */
    async reloadPlugin(pluginName) {
        this.logger.info(`Reloading plugin: ${pluginName}`);
        
        const wasEnabled = this.enabledPlugins.has(pluginName);
        
        // Unload the plugin
        await this.unloadPlugin(pluginName);
        
        // Clear require cache if it's a Node.js module
        this.clearRequireCache(pluginName);
        
        // Load the plugin again
        await this.loadPlugin(pluginName);
        
        // Re-enable if it was enabled
        if (wasEnabled) {
            await this.enablePlugin(pluginName);
        }
        
        this.logger.info(`Plugin reloaded: ${pluginName}`);
    }
    
    /**
     * Get all loaded plugins
     */
    getLoadedPlugins() {
        const plugins = [];
        
        for (const [name, plugin] of this.plugins) {
            plugins.push({
                name,
                metadata: plugin.metadata,
                enabled: this.enabledPlugins.has(name),
                health: plugin.getHealth()
            });
        }
        
        return plugins;
    }
    
    /**
     * Get plugin by name
     */
    getPlugin(pluginName) {
        return this.plugins.get(pluginName);
    }
    
    /**
     * Check if plugin is loaded
     */
    isLoaded(pluginName) {
        return this.plugins.has(pluginName);
    }
    
    /**
     * Check if plugin is enabled
     */
    isEnabled(pluginName) {
        return this.enabledPlugins.has(pluginName);
    }
    
    /**
     * Private helper methods
     */
    
    async isValidPluginDirectory(dirPath) {
        try {
            // Check for package.json or plugin.json
            const packageJsonPath = path.join(dirPath, 'package.json');
            const pluginJsonPath = path.join(dirPath, 'plugin.json');
            
            const [hasPackageJson, hasPluginJson] = await Promise.all([
                this.fileExists(packageJsonPath),
                this.fileExists(pluginJsonPath)
            ]);
            
            return hasPackageJson || hasPluginJson;
        } catch {
            return false;
        }
    }
    
    async loadPluginMetadata(pluginPath) {
        try {
            // Try plugin.json first
            const pluginJsonPath = path.join(pluginPath, 'plugin.json');
            if (await this.fileExists(pluginJsonPath)) {
                const content = await fs.readFile(pluginJsonPath, 'utf8');
                return JSON.parse(content);
            }
            
            // Fall back to package.json
            const packageJsonPath = path.join(pluginPath, 'package.json');
            if (await this.fileExists(packageJsonPath)) {
                const content = await fs.readFile(packageJsonPath, 'utf8');
                const pkg = JSON.parse(content);
                
                // Extract plugin metadata from package.json
                return pkg.plugin || {
                    name: pkg.name,
                    version: pkg.version,
                    description: pkg.description,
                    author: pkg.author,
                    license: pkg.license
                };
            }
        } catch (error) {
            this.logger.error('Failed to load plugin metadata', {
                path: pluginPath,
                error: error.message
            });
        }
        
        return null;
    }
    
    async extractMetadataFromFile(filePath) {
        try {
            const content = await fs.readFile(filePath, 'utf8');
            
            // Look for metadata comment block
            const metadataRegex = /\/\*\*\s*@plugin\s*([\s\S]*?)\*\//;
            const match = content.match(metadataRegex);
            
            if (match) {
                // Parse metadata from comment
                const metadataText = match[1];
                const metadata = {};
                
                const lines = metadataText.split('\n');
                for (const line of lines) {
                    const propertyMatch = line.match(/@(\w+)\s+(.+)/);
                    if (propertyMatch) {
                        metadata[propertyMatch[1]] = propertyMatch[2].trim();
                    }
                }
                
                return metadata;
            }
        } catch (error) {
            this.logger.error('Failed to extract metadata from file', {
                path: filePath,
                error: error.message
            });
        }
        
        return null;
    }
    
    async findPlugin(pluginName) {
        // Check registry first
        const registryEntry = this.pluginRegistry.get(pluginName);
        if (registryEntry && registryEntry.path) {
            return registryEntry;
        }
        
        // Discover plugins and find by name
        const plugins = await this.discoverPlugins();
        return plugins.find(p => p.name === pluginName);
    }
    
    async loadPluginCode(pluginInfo, sandbox) {
        const { path: pluginPath, singleFile } = pluginInfo;
        
        if (singleFile) {
            // Load single file plugin
            return await this.loadSingleFilePlugin(pluginPath, sandbox);
        } else {
            // Load directory plugin
            return await this.loadDirectoryPlugin(pluginPath, sandbox);
        }
    }
    
    async loadSingleFilePlugin(filePath, sandbox) {
        const code = await fs.readFile(filePath, 'utf8');
        
        // Run in sandbox
        return sandbox.execute(code, {
            filename: path.basename(filePath),
            require: this.createSandboxedRequire(sandbox)
        });
    }
    
    async loadDirectoryPlugin(dirPath, sandbox) {
        // Look for main entry point
        const packageJsonPath = path.join(dirPath, 'package.json');
        let mainFile = 'index.js';
        
        if (await this.fileExists(packageJsonPath)) {
            const pkg = JSON.parse(await fs.readFile(packageJsonPath, 'utf8'));
            mainFile = pkg.main || mainFile;
        }
        
        const mainPath = path.join(dirPath, mainFile);
        
        // Use Node's require for directory plugins
        // This allows them to have dependencies
        return require(mainPath);
    }
    
    createPluginContext(plugin, sandbox) {
        return sandbox.createContext({
            logger: this.context.logger,
            cache: this.context.cache,
            database: this.context.database,
            queue: this.context.queue,
            auth: this.context.auth,
            webhook: this.context.webhook,
            config: this.context.config,
            events: this.context.events,
            storage: {
                basePath: path.join(this.pluginsPath, '.storage')
            },
            http: this.context.http,
            metrics: this.context.metrics
        });
    }
    
    createSandboxedRequire(sandbox) {
        return (moduleName) => {
            // Only allow specific modules
            const allowedModules = [
                'path', 'url', 'querystring', 'crypto',
                'util', 'events', 'stream', 'buffer'
            ];
            
            if (allowedModules.includes(moduleName)) {
                return require(moduleName);
            }
            
            throw new Error(`Module not allowed: ${moduleName}`);
        };
    }
    
    async checkPermissions(requestedPermissions) {
        // TODO: Implement permission checking
        // For now, grant all permissions
        return {
            granted: true,
            missing: []
        };
    }
    
    async registerPluginTools(plugin) {
        const tools = plugin.getTools();
        
        for (const tool of tools) {
            // Register tool with the agent
            await this.context.agent.registerTool({
                ...tool,
                execute: async (params, context) => {
                    return await plugin.executeTool(tool.name, params, context);
                }
            });
        }
    }
    
    async unregisterPluginTools(plugin) {
        const tools = plugin.getTools();
        
        for (const tool of tools) {
            // Unregister tool from the agent
            await this.context.agent.unregisterTool(`${plugin.metadata.name}.${tool.name}`);
        }
    }
    
    clearRequireCache(pluginName) {
        // Clear Node.js require cache for hot reloading
        const pluginInfo = this.pluginRegistry.get(pluginName);
        if (!pluginInfo) return;
        
        const resolvedPath = require.resolve(pluginInfo.path);
        delete require.cache[resolvedPath];
        
        // Also clear any child modules
        Object.keys(require.cache).forEach(key => {
            if (key.startsWith(path.dirname(resolvedPath))) {
                delete require.cache[key];
            }
        });
    }
    
    async fileExists(filePath) {
        try {
            await fs.access(filePath);
            return true;
        } catch {
            return false;
        }
    }
    
    /**
     * Registry management
     */
    
    async loadRegistry() {
        try {
            const registryPath = path.join(this.pluginsPath, '.registry.json');
            if (await this.fileExists(registryPath)) {
                const content = await fs.readFile(registryPath, 'utf8');
                const registry = JSON.parse(content);
                
                for (const [name, entry] of Object.entries(registry)) {
                    this.pluginRegistry.set(name, entry);
                }
            }
        } catch (error) {
            this.logger.error('Failed to load plugin registry', {
                error: error.message
            });
        }
    }
    
    async saveRegistry() {
        try {
            const registryPath = path.join(this.pluginsPath, '.registry.json');
            const registry = Object.fromEntries(this.pluginRegistry);
            await fs.writeFile(registryPath, JSON.stringify(registry, null, 2));
        } catch (error) {
            this.logger.error('Failed to save plugin registry', {
                error: error.message
            });
        }
    }
    
    async updateRegistry(pluginName, updates) {
        const entry = this.pluginRegistry.get(pluginName) || {};
        Object.assign(entry, updates, {
            lastUpdated: new Date().toISOString()
        });
        
        this.pluginRegistry.set(pluginName, entry);
        await this.saveRegistry();
    }
}

module.exports = PluginLoader;