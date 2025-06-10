# Plugin System Documentation

## Overview

The Enhanced ReAct Agent Plugin System allows developers to extend the agent's capabilities by creating custom plugins. Plugins can add new tools, integrate with external services, process data, and enhance the agent's functionality.

## Architecture

### Core Components

1. **Plugin Service** (`services/plugin.service.js`)
   - Manages plugin lifecycle (load, enable, disable, uninstall)
   - Provides sandboxed execution environment
   - Handles plugin dependencies and permissions

2. **Plugin CLI** (`cli/plugin-cli.js`)
   - Command-line tool for plugin management
   - Create, install, validate, and manage plugins

3. **Plugin Marketplace** (`plugin-marketplace.html`)
   - Web interface for discovering and installing plugins
   - Browse categories, search, and manage installed plugins

## Plugin Structure

```
my-plugin/
├── plugin.json          # Plugin manifest
├── index.js            # Main plugin file
├── README.md           # Documentation
├── data/               # Plugin data directory
├── storage/            # Plugin storage (auto-created)
└── tests/              # Plugin tests (optional)
```

### Plugin Manifest (plugin.json)

```json
{
    "id": "my-plugin",
    "name": "My Plugin",
    "version": "1.0.0",
    "description": "Plugin description",
    "author": "Your Name",
    "main": "index.js",
    "permissions": ["tools", "http", "cache"],
    "dependencies": {
        "other-plugin": "^1.0.0"
    },
    "configuration": {
        "apiKey": {
            "type": "string",
            "description": "API key for external service",
            "required": false
        }
    }
}
```

## Permissions

Plugins must declare required permissions in their manifest:

- **tools** - Register custom tools with the agent
- **http** - Make HTTP requests
- **database** - Access database service
- **cache** - Use caching service
- **queue** - Access job queue
- **events** - Subscribe to system events
- **routes** - Add API endpoints
- **files** - Limited file system access
- **websocket** - WebSocket connections

## Plugin API

### Basic Plugin Structure

```javascript
class MyPlugin {
    constructor() {
        this.name = 'My Plugin';
        this.api = null;
    }

    async init(api) {
        this.api = api;
        this.logger = api.logger;
        
        // Initialize your plugin
        this.registerTools();
        this.subscribeToEvents();
        
        this.logger.info('Plugin initialized');
    }

    // Lifecycle methods
    async enable() { }
    async disable() { }
    async cleanup() { }
}

module.exports = MyPlugin;
```

### Available APIs

#### Logger
```javascript
this.api.logger.info('Message', { metadata });
this.api.logger.warn('Warning');
this.api.logger.error('Error', error);
```

#### Storage
```javascript
// Plugin-specific storage
await this.api.storage.set('key', value);
const value = await this.api.storage.get('key');
await this.api.storage.delete('key');
const keys = await this.api.storage.list();
```

#### Events
```javascript
// Subscribe to events
this.api.events.on('query:complete', (data) => {
    console.log('Query completed:', data);
});

// Emit events
this.api.events.emit('custom:event', { data });
```

#### Tool Registration
```javascript
this.api.registerTool({
    name: 'myTool',
    description: 'Tool description',
    parameters: {
        type: 'object',
        properties: {
            input: {
                type: 'string',
                description: 'Input parameter'
            }
        },
        required: ['input']
    },
    handler: async ({ input }) => {
        // Tool implementation
        return {
            success: true,
            result: 'Processed: ' + input
        };
    }
});
```

#### Route Registration
```javascript
this.api.registerRoute({
    method: 'GET',
    path: '/status',
    handler: async (req, res) => {
        res.json({ status: 'ok' });
    }
});
```

## Creating a Plugin

### Using the CLI

```bash
# Create a new plugin interactively
react-plugin create

# Or create from template
react-plugin create --template weather-plugin
```

### Manual Creation

1. Create plugin directory structure
2. Write plugin.json manifest
3. Implement plugin class in index.js
4. Add documentation in README.md
5. Test your plugin

## Installing Plugins

### From Local Directory
```bash
react-plugin install ./my-plugin
```

### From Marketplace
```bash
react-plugin install weather-advanced
```

### From Git Repository
```bash
react-plugin install https://github.com/user/plugin.git
```

## Plugin Examples

### Weather Plugin
```javascript
class WeatherPlugin {
    async init(api) {
        this.api = api;
        
        api.registerTool({
            name: 'getWeather',
            description: 'Get weather for a location',
            parameters: {
                type: 'object',
                properties: {
                    location: { type: 'string' }
                },
                required: ['location']
            },
            handler: this.getWeather.bind(this)
        });
    }

    async getWeather({ location }) {
        // Implementation
        return {
            success: true,
            temperature: 22,
            condition: 'Sunny'
        };
    }
}
```

### Database Plugin
```javascript
class DatabasePlugin {
    async init(api) {
        this.api = api;
        this.db = api.database; // Requires 'database' permission
        
        api.registerTool({
            name: 'saveData',
            description: 'Save data to database',
            parameters: {
                type: 'object',
                properties: {
                    key: { type: 'string' },
                    value: { type: 'object' }
                },
                required: ['key', 'value']
            },
            handler: async ({ key, value }) => {
                await this.db.saveData(key, value);
                return { success: true };
            }
        });
    }
}
```

## Security

### Sandboxing

Plugins run in a sandboxed environment with:
- Limited module access
- No access to sensitive APIs without permissions
- Isolated file system access
- Resource usage limits

### Best Practices

1. **Validate Input**: Always validate and sanitize user input
2. **Handle Errors**: Implement proper error handling
3. **Use Permissions**: Only request necessary permissions
4. **Cache Results**: Use caching for expensive operations
5. **Document Tools**: Provide clear descriptions and examples

## CLI Commands

```bash
# List all plugins
react-plugin list

# Install a plugin
react-plugin install <path>

# Uninstall a plugin
react-plugin uninstall <plugin-id>

# Enable/disable a plugin
react-plugin enable <plugin-id>
react-plugin disable <plugin-id>

# Show plugin info
react-plugin info <plugin-id>

# Validate a plugin
react-plugin validate <path>

# Create a new plugin
react-plugin create
```

## Troubleshooting

### Plugin Won't Load
- Check plugin.json syntax
- Verify all required fields
- Check permissions
- Look for errors in logs

### Tool Not Working
- Verify tool registration
- Check parameter definitions
- Test handler function
- Review error messages

### Performance Issues
- Use caching for expensive operations
- Implement rate limiting
- Optimize database queries
- Monitor resource usage

## Publishing Plugins

To share your plugin:

1. Test thoroughly
2. Document all features
3. Create examples
4. Add to plugin registry
5. Share repository URL

## Advanced Topics

### Plugin Dependencies
```json
{
    "dependencies": {
        "weather-core": "^1.0.0",
        "utils-plugin": "~2.1.0"
    }
}
```

### Configuration Schema
```json
{
    "configuration": {
        "apiEndpoint": {
            "type": "string",
            "format": "uri",
            "default": "https://api.example.com",
            "description": "API endpoint URL"
        },
        "timeout": {
            "type": "number",
            "minimum": 1000,
            "maximum": 60000,
            "default": 5000
        }
    }
}
```

### Event Types
- `query:start` - Query execution started
- `query:complete` - Query execution completed
- `tool:execute` - Tool executed
- `session:create` - New session created
- `session:end` - Session ended
- `error:occur` - Error occurred

## Support

For help and support:
- Check the documentation
- Browse example plugins
- Ask in the community forum
- Report issues on GitHub