const fs = require('fs').promises;
const path = require('path');
const vm = require('vm');
const semver = require('semver');
const winston = require('winston');
const EventEmitter = require('events');

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

class PluginService extends EventEmitter {
    constructor() {
        super();
        this.plugins = new Map();
        this.pluginDir = path.join(__dirname, '..', 'plugins');
        this.pluginConfigFile = path.join(__dirname, '..', 'plugin-config.json');
        this.pluginRegistry = new Map();
        this.sandboxedModules = ['fs', 'child_process', 'net', 'dgram'];
        this.init();
    }

    async init() {
        try {
            // Ensure plugin directory exists
            await fs.mkdir(this.pluginDir, { recursive: true });
            
            // Load plugin configuration
            await this.loadPluginConfig();
            
            // Load installed plugins
            await this.loadPlugins();
            
            logger.info('Plugin service initialized', {
                pluginDir: this.pluginDir,
                loadedPlugins: this.plugins.size
            });
        } catch (error) {
            logger.error('Failed to initialize plugin service:', error);
        }
    }

    async loadPluginConfig() {
        try {
            const configData = await fs.readFile(this.pluginConfigFile, 'utf-8');
            this.pluginConfig = JSON.parse(configData);
        } catch (error) {
            // Create default config if not exists
            this.pluginConfig = {
                enabled: true,
                autoLoad: true,
                maxPlugins: 50,
                allowedDomains: [],
                blockedPlugins: []
            };
            await this.savePluginConfig();
        }
    }

    async savePluginConfig() {
        await fs.writeFile(
            this.pluginConfigFile,
            JSON.stringify(this.pluginConfig, null, 2)
        );
    }

    async loadPlugins() {
        if (!this.pluginConfig.enabled || !this.pluginConfig.autoLoad) {
            logger.info('Plugin loading disabled');
            return;
        }

        try {
            const entries = await fs.readdir(this.pluginDir, { withFileTypes: true });
            
            for (const entry of entries) {
                if (entry.isDirectory()) {
                    await this.loadPlugin(entry.name);
                }
            }
        } catch (error) {
            logger.error('Failed to load plugins:', error);
        }
    }

    async loadPlugin(pluginName) {
        try {
            const pluginPath = path.join(this.pluginDir, pluginName);
            const manifestPath = path.join(pluginPath, 'plugin.json');
            
            // Check if plugin is blocked
            if (this.pluginConfig.blockedPlugins.includes(pluginName)) {
                logger.warn(`Plugin ${pluginName} is blocked`);
                return;
            }
            
            // Load plugin manifest
            const manifestData = await fs.readFile(manifestPath, 'utf-8');
            const manifest = JSON.parse(manifestData);
            
            // Validate manifest
            this.validateManifest(manifest);
            
            // Check dependencies
            await this.checkDependencies(manifest);
            
            // Load plugin code
            const mainFile = path.join(pluginPath, manifest.main || 'index.js');
            const pluginCode = await fs.readFile(mainFile, 'utf-8');
            
            // Create sandboxed context
            const sandbox = this.createSandbox(manifest, pluginPath);
            
            // Execute plugin in sandbox
            const script = new vm.Script(pluginCode, {
                filename: mainFile,
                displayErrors: true
            });
            
            const context = vm.createContext(sandbox);
            script.runInContext(context);
            
            // Get plugin instance
            const Plugin = sandbox.module.exports;
            const pluginInstance = new Plugin();
            
            // Initialize plugin
            if (typeof pluginInstance.init === 'function') {
                await pluginInstance.init(this.createPluginAPI(manifest));
            }
            
            // Store plugin
            this.plugins.set(manifest.id, {
                manifest,
                instance: pluginInstance,
                path: pluginPath,
                status: 'active',
                loadedAt: new Date()
            });
            
            // Emit event
            this.emit('plugin:loaded', { id: manifest.id, manifest });
            
            logger.info(`Plugin loaded: ${manifest.name} v${manifest.version}`);
            
        } catch (error) {
            logger.error(`Failed to load plugin ${pluginName}:`, error);
            this.emit('plugin:error', { pluginName, error });
        }
    }

    validateManifest(manifest) {
        const required = ['id', 'name', 'version', 'author'];
        
        for (const field of required) {
            if (!manifest[field]) {
                throw new Error(`Missing required field: ${field}`);
            }
        }
        
        // Validate version
        if (!semver.valid(manifest.version)) {
            throw new Error(`Invalid version: ${manifest.version}`);
        }
        
        // Validate permissions
        if (manifest.permissions) {
            const allowedPermissions = [
                'database', 'cache', 'queue', 'http', 'websocket',
                'files', 'tools', 'events', 'routes'
            ];
            
            for (const perm of manifest.permissions) {
                if (!allowedPermissions.includes(perm)) {
                    throw new Error(`Invalid permission: ${perm}`);
                }
            }
        }
    }

    async checkDependencies(manifest) {
        if (!manifest.dependencies) return;
        
        for (const [depId, depVersion] of Object.entries(manifest.dependencies)) {
            const plugin = this.plugins.get(depId);
            
            if (!plugin) {
                throw new Error(`Missing dependency: ${depId}`);
            }
            
            if (!semver.satisfies(plugin.manifest.version, depVersion)) {
                throw new Error(
                    `Dependency version mismatch: ${depId} requires ${depVersion}, found ${plugin.manifest.version}`
                );
            }
        }
    }

    createSandbox(manifest, pluginPath) {
        const sandbox = {
            console,
            Buffer,
            setTimeout,
            setInterval,
            clearTimeout,
            clearInterval,
            Promise,
            process: {
                env: {},
                version: process.version,
                platform: process.platform,
                arch: process.arch
            },
            __dirname: pluginPath,
            __filename: path.join(pluginPath, manifest.main || 'index.js'),
            module: { exports: {} },
            exports: {},
            require: this.createSafeRequire(manifest, pluginPath)
        };
        
        // Add globals based on permissions
        if (manifest.permissions?.includes('http')) {
            sandbox.fetch = require('node-fetch');
        }
        
        return sandbox;
    }

    createSafeRequire(manifest, pluginPath) {
        return (moduleName) => {
            // Block dangerous modules
            if (this.sandboxedModules.includes(moduleName)) {
                throw new Error(`Access denied to module: ${moduleName}`);
            }
            
            // Allow specific modules based on permissions
            if (moduleName === 'fs' && manifest.permissions?.includes('files')) {
                // Return limited fs API
                return this.createLimitedFS(pluginPath);
            }
            
            // Allow built-in modules
            if (moduleName.startsWith('node:') || !moduleName.includes('/')) {
                try {
                    return require(moduleName);
                } catch (error) {
                    throw new Error(`Cannot require module: ${moduleName}`);
                }
            }
            
            // Allow local requires within plugin directory
            const resolvedPath = path.resolve(pluginPath, moduleName);
            if (!resolvedPath.startsWith(pluginPath)) {
                throw new Error(`Access denied to path: ${moduleName}`);
            }
            
            return require(resolvedPath);
        };
    }

    createLimitedFS(pluginPath) {
        const safeDir = path.join(pluginPath, 'data');
        
        return {
            readFile: async (filename, encoding) => {
                const filepath = path.join(safeDir, path.basename(filename));
                return fs.readFile(filepath, encoding);
            },
            writeFile: async (filename, data, encoding) => {
                await fs.mkdir(safeDir, { recursive: true });
                const filepath = path.join(safeDir, path.basename(filename));
                return fs.writeFile(filepath, data, encoding);
            },
            readdir: async () => {
                await fs.mkdir(safeDir, { recursive: true });
                return fs.readdir(safeDir);
            },
            unlink: async (filename) => {
                const filepath = path.join(safeDir, path.basename(filename));
                return fs.unlink(filepath);
            }
        };
    }

    createPluginAPI(manifest) {
        const api = {
            logger: this.createPluginLogger(manifest.id),
            events: this.createPluginEvents(manifest),
            storage: this.createPluginStorage(manifest.id)
        };
        
        // Add services based on permissions
        if (manifest.permissions?.includes('database')) {
            api.database = require('./database.service');
        }
        
        if (manifest.permissions?.includes('cache')) {
            api.cache = require('./cache.service');
        }
        
        if (manifest.permissions?.includes('queue')) {
            api.queue = require('./queue.service');
        }
        
        if (manifest.permissions?.includes('tools')) {
            api.registerTool = this.createToolRegistrar(manifest);
        }
        
        if (manifest.permissions?.includes('routes')) {
            api.registerRoute = this.createRouteRegistrar(manifest);
        }
        
        return api;
    }

    createPluginLogger(pluginId) {
        return {
            info: (message, meta) => logger.info(`[${pluginId}] ${message}`, meta),
            warn: (message, meta) => logger.warn(`[${pluginId}] ${message}`, meta),
            error: (message, meta) => logger.error(`[${pluginId}] ${message}`, meta),
            debug: (message, meta) => logger.debug(`[${pluginId}] ${message}`, meta)
        };
    }

    createPluginEvents(manifest) {
        const allowedEvents = [
            'query:start', 'query:complete', 'tool:execute',
            'session:create', 'session:end', 'error:occur'
        ];
        
        return {
            on: (event, handler) => {
                if (!allowedEvents.includes(event)) {
                    throw new Error(`Event not allowed: ${event}`);
                }
                this.on(`plugin:${manifest.id}:${event}`, handler);
            },
            emit: (event, data) => {
                if (!allowedEvents.includes(event)) {
                    throw new Error(`Event not allowed: ${event}`);
                }
                this.emit(`plugin:${manifest.id}:${event}`, data);
            }
        };
    }

    createPluginStorage(pluginId) {
        const storageDir = path.join(this.pluginDir, pluginId, 'storage');
        
        return {
            get: async (key) => {
                try {
                    const filepath = path.join(storageDir, `${key}.json`);
                    const data = await fs.readFile(filepath, 'utf-8');
                    return JSON.parse(data);
                } catch (error) {
                    return null;
                }
            },
            set: async (key, value) => {
                await fs.mkdir(storageDir, { recursive: true });
                const filepath = path.join(storageDir, `${key}.json`);
                await fs.writeFile(filepath, JSON.stringify(value, null, 2));
            },
            delete: async (key) => {
                const filepath = path.join(storageDir, `${key}.json`);
                await fs.unlink(filepath).catch(() => {});
            },
            list: async () => {
                try {
                    const files = await fs.readdir(storageDir);
                    return files
                        .filter(f => f.endsWith('.json'))
                        .map(f => f.replace('.json', ''));
                } catch (error) {
                    return [];
                }
            }
        };
    }

    createToolRegistrar(manifest) {
        return (toolDefinition) => {
            // Validate tool definition
            if (!toolDefinition.name || !toolDefinition.description || !toolDefinition.handler) {
                throw new Error('Invalid tool definition');
            }
            
            // Prefix tool name with plugin ID to avoid conflicts
            const toolName = `${manifest.id}_${toolDefinition.name}`;
            
            // Register tool
            this.emit('tool:register', {
                pluginId: manifest.id,
                name: toolName,
                description: toolDefinition.description,
                parameters: toolDefinition.parameters,
                handler: async (args) => {
                    try {
                        // Execute tool handler in plugin context
                        return await toolDefinition.handler(args);
                    } catch (error) {
                        logger.error(`Plugin tool error: ${toolName}`, error);
                        return {
                            success: false,
                            error: error.message
                        };
                    }
                }
            });
            
            logger.info(`Tool registered: ${toolName} by ${manifest.id}`);
        };
    }

    createRouteRegistrar(manifest) {
        return (routeDefinition) => {
            // Validate route definition
            if (!routeDefinition.method || !routeDefinition.path || !routeDefinition.handler) {
                throw new Error('Invalid route definition');
            }
            
            // Prefix route with plugin ID
            const routePath = `/plugins/${manifest.id}${routeDefinition.path}`;
            
            // Register route
            this.emit('route:register', {
                pluginId: manifest.id,
                method: routeDefinition.method,
                path: routePath,
                middleware: routeDefinition.middleware || [],
                handler: routeDefinition.handler
            });
            
            logger.info(`Route registered: ${routeDefinition.method} ${routePath} by ${manifest.id}`);
        };
    }

    // Plugin management methods
    
    async installPlugin(pluginPath) {
        try {
            // Extract plugin name from path
            const pluginName = path.basename(pluginPath);
            const targetPath = path.join(this.pluginDir, pluginName);
            
            // Copy plugin to plugins directory
            await this.copyDirectory(pluginPath, targetPath);
            
            // Load the plugin
            await this.loadPlugin(pluginName);
            
            return {
                success: true,
                pluginName,
                message: 'Plugin installed successfully'
            };
        } catch (error) {
            logger.error('Failed to install plugin:', error);
            throw error;
        }
    }

    async uninstallPlugin(pluginId) {
        try {
            const plugin = this.plugins.get(pluginId);
            if (!plugin) {
                throw new Error(`Plugin not found: ${pluginId}`);
            }
            
            // Call plugin cleanup
            if (plugin.instance.cleanup) {
                await plugin.instance.cleanup();
            }
            
            // Remove from registry
            this.plugins.delete(pluginId);
            
            // Remove plugin directory
            await this.removeDirectory(plugin.path);
            
            // Emit event
            this.emit('plugin:uninstalled', { id: pluginId });
            
            return {
                success: true,
                message: 'Plugin uninstalled successfully'
            };
        } catch (error) {
            logger.error('Failed to uninstall plugin:', error);
            throw error;
        }
    }

    async enablePlugin(pluginId) {
        const plugin = this.plugins.get(pluginId);
        if (!plugin) {
            throw new Error(`Plugin not found: ${pluginId}`);
        }
        
        plugin.status = 'active';
        
        if (plugin.instance.enable) {
            await plugin.instance.enable();
        }
        
        this.emit('plugin:enabled', { id: pluginId });
        
        return {
            success: true,
            message: 'Plugin enabled successfully'
        };
    }

    async disablePlugin(pluginId) {
        const plugin = this.plugins.get(pluginId);
        if (!plugin) {
            throw new Error(`Plugin not found: ${pluginId}`);
        }
        
        plugin.status = 'disabled';
        
        if (plugin.instance.disable) {
            await plugin.instance.disable();
        }
        
        this.emit('plugin:disabled', { id: pluginId });
        
        return {
            success: true,
            message: 'Plugin disabled successfully'
        };
    }

    getPlugin(pluginId) {
        return this.plugins.get(pluginId);
    }

    getAllPlugins() {
        const plugins = [];
        
        for (const [id, plugin] of this.plugins) {
            plugins.push({
                id,
                name: plugin.manifest.name,
                version: plugin.manifest.version,
                author: plugin.manifest.author,
                description: plugin.manifest.description,
                status: plugin.status,
                loadedAt: plugin.loadedAt,
                permissions: plugin.manifest.permissions || []
            });
        }
        
        return plugins;
    }

    // Utility methods
    
    async copyDirectory(src, dest) {
        await fs.mkdir(dest, { recursive: true });
        const entries = await fs.readdir(src, { withFileTypes: true });
        
        for (const entry of entries) {
            const srcPath = path.join(src, entry.name);
            const destPath = path.join(dest, entry.name);
            
            if (entry.isDirectory()) {
                await this.copyDirectory(srcPath, destPath);
            } else {
                await fs.copyFile(srcPath, destPath);
            }
        }
    }

    async removeDirectory(dir) {
        const entries = await fs.readdir(dir, { withFileTypes: true });
        
        for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);
            
            if (entry.isDirectory()) {
                await this.removeDirectory(fullPath);
            } else {
                await fs.unlink(fullPath);
            }
        }
        
        await fs.rmdir(dir);
    }
}

module.exports = new PluginService();