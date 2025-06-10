#!/usr/bin/env node

const { Command } = require('commander');
const inquirer = require('inquirer');
const fs = require('fs').promises;
const path = require('path');
const chalk = require('chalk');
const ora = require('ora');
const Table = require('cli-table3');

const program = new Command();
const pluginService = require('../services/plugin.service');

program
    .name('react-plugin')
    .description('CLI tool for managing Enhanced ReAct Agent plugins')
    .version('1.0.0');

// List plugins
program
    .command('list')
    .alias('ls')
    .description('List all installed plugins')
    .action(async () => {
        try {
            const plugins = pluginService.getAllPlugins();
            
            if (plugins.length === 0) {
                console.log(chalk.yellow('No plugins installed'));
                return;
            }

            const table = new Table({
                head: ['ID', 'Name', 'Version', 'Status', 'Author'],
                colWidths: [20, 30, 10, 10, 20]
            });

            plugins.forEach(plugin => {
                table.push([
                    plugin.id,
                    plugin.name,
                    plugin.version,
                    plugin.status === 'active' ? chalk.green(plugin.status) : chalk.red(plugin.status),
                    plugin.author
                ]);
            });

            console.log(table.toString());
        } catch (error) {
            console.error(chalk.red('Error listing plugins:'), error.message);
        }
    });

// Install plugin
program
    .command('install <path>')
    .alias('i')
    .description('Install a plugin from a directory or archive')
    .action(async (pluginPath) => {
        const spinner = ora('Installing plugin...').start();
        
        try {
            const result = await pluginService.installPlugin(pluginPath);
            spinner.succeed(chalk.green(`Plugin ${result.pluginName} installed successfully`));
        } catch (error) {
            spinner.fail(chalk.red('Installation failed'));
            console.error(error.message);
        }
    });

// Uninstall plugin
program
    .command('uninstall <pluginId>')
    .alias('rm')
    .description('Uninstall a plugin')
    .action(async (pluginId) => {
        try {
            const plugin = pluginService.getPlugin(pluginId);
            if (!plugin) {
                console.error(chalk.red(`Plugin ${pluginId} not found`));
                return;
            }

            const { confirm } = await inquirer.prompt([
                {
                    type: 'confirm',
                    name: 'confirm',
                    message: `Are you sure you want to uninstall ${plugin.manifest.name}?`,
                    default: false
                }
            ]);

            if (!confirm) {
                console.log(chalk.yellow('Uninstall cancelled'));
                return;
            }

            const spinner = ora('Uninstalling plugin...').start();
            
            const result = await pluginService.uninstallPlugin(pluginId);
            spinner.succeed(chalk.green(result.message));
        } catch (error) {
            console.error(chalk.red('Uninstall failed:'), error.message);
        }
    });

// Enable plugin
program
    .command('enable <pluginId>')
    .description('Enable a plugin')
    .action(async (pluginId) => {
        try {
            const result = await pluginService.enablePlugin(pluginId);
            console.log(chalk.green(result.message));
        } catch (error) {
            console.error(chalk.red('Failed to enable plugin:'), error.message);
        }
    });

// Disable plugin
program
    .command('disable <pluginId>')
    .description('Disable a plugin')
    .action(async (pluginId) => {
        try {
            const result = await pluginService.disablePlugin(pluginId);
            console.log(chalk.green(result.message));
        } catch (error) {
            console.error(chalk.red('Failed to disable plugin:'), error.message);
        }
    });

// Show plugin info
program
    .command('info <pluginId>')
    .description('Show detailed information about a plugin')
    .action(async (pluginId) => {
        try {
            const plugin = pluginService.getPlugin(pluginId);
            if (!plugin) {
                console.error(chalk.red(`Plugin ${pluginId} not found`));
                return;
            }

            console.log(chalk.bold('\nPlugin Information:'));
            console.log(chalk.gray('─'.repeat(50)));
            console.log(`${chalk.bold('ID:')} ${plugin.manifest.id}`);
            console.log(`${chalk.bold('Name:')} ${plugin.manifest.name}`);
            console.log(`${chalk.bold('Version:')} ${plugin.manifest.version}`);
            console.log(`${chalk.bold('Author:')} ${plugin.manifest.author}`);
            console.log(`${chalk.bold('Description:')} ${plugin.manifest.description}`);
            console.log(`${chalk.bold('Status:')} ${plugin.status === 'active' ? chalk.green(plugin.status) : chalk.red(plugin.status)}`);
            console.log(`${chalk.bold('Loaded At:')} ${plugin.loadedAt}`);
            
            if (plugin.manifest.permissions && plugin.manifest.permissions.length > 0) {
                console.log(`${chalk.bold('Permissions:')} ${plugin.manifest.permissions.join(', ')}`);
            }
            
            if (plugin.manifest.dependencies && Object.keys(plugin.manifest.dependencies).length > 0) {
                console.log(`${chalk.bold('Dependencies:')}`);
                Object.entries(plugin.manifest.dependencies).forEach(([dep, version]) => {
                    console.log(`  - ${dep}: ${version}`);
                });
            }
            
            console.log(chalk.gray('─'.repeat(50)));
        } catch (error) {
            console.error(chalk.red('Error getting plugin info:'), error.message);
        }
    });

// Create new plugin
program
    .command('create')
    .description('Create a new plugin from template')
    .action(async () => {
        try {
            const answers = await inquirer.prompt([
                {
                    type: 'input',
                    name: 'id',
                    message: 'Plugin ID (lowercase, no spaces):',
                    validate: (input) => {
                        if (!input || !/^[a-z0-9-]+$/.test(input)) {
                            return 'ID must be lowercase letters, numbers, and hyphens only';
                        }
                        return true;
                    }
                },
                {
                    type: 'input',
                    name: 'name',
                    message: 'Plugin Name:',
                    validate: (input) => input.length > 0 || 'Name is required'
                },
                {
                    type: 'input',
                    name: 'description',
                    message: 'Description:',
                    validate: (input) => input.length > 0 || 'Description is required'
                },
                {
                    type: 'input',
                    name: 'author',
                    message: 'Author:',
                    validate: (input) => input.length > 0 || 'Author is required'
                },
                {
                    type: 'checkbox',
                    name: 'permissions',
                    message: 'Select permissions:',
                    choices: [
                        { name: 'Tools - Register custom tools', value: 'tools' },
                        { name: 'HTTP - Make HTTP requests', value: 'http' },
                        { name: 'Database - Access database', value: 'database' },
                        { name: 'Cache - Use caching', value: 'cache' },
                        { name: 'Queue - Access job queue', value: 'queue' },
                        { name: 'Events - Subscribe to events', value: 'events' },
                        { name: 'Routes - Add API routes', value: 'routes' },
                        { name: 'Files - Read/write files', value: 'files' }
                    ]
                }
            ]);

            const pluginDir = path.join(process.cwd(), answers.id);
            await fs.mkdir(pluginDir, { recursive: true });

            // Create plugin.json
            const manifest = {
                id: answers.id,
                name: answers.name,
                version: '1.0.0',
                description: answers.description,
                author: answers.author,
                main: 'index.js',
                permissions: answers.permissions,
                dependencies: {},
                configuration: {}
            };

            await fs.writeFile(
                path.join(pluginDir, 'plugin.json'),
                JSON.stringify(manifest, null, 2)
            );

            // Create index.js template
            const template = `class ${toPascalCase(answers.id)}Plugin {
    constructor() {
        this.name = '${answers.name}';
        this.api = null;
    }

    async init(api) {
        this.api = api;
        this.logger = api.logger;
        
        // Register your tools, routes, and event handlers here
        ${answers.permissions.includes('tools') ? 'this.registerTools();' : ''}
        ${answers.permissions.includes('events') ? 'this.subscribeToEvents();' : ''}
        
        this.logger.info('${answers.name} initialized');
    }

    ${answers.permissions.includes('tools') ? `registerTools() {
        // Example tool registration
        this.api.registerTool({
            name: 'exampleTool',
            description: 'An example tool',
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
            handler: this.exampleHandler.bind(this)
        });
    }

    async exampleHandler({ input }) {
        try {
            // Your tool logic here
            return {
                success: true,
                result: \`Processed: \${input}\`
            };
        } catch (error) {
            this.logger.error('Tool error:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }` : ''}

    ${answers.permissions.includes('events') ? `subscribeToEvents() {
        // Example event subscription
        this.api.events.on('query:complete', (data) => {
            this.logger.info('Query completed', data);
        });
    }` : ''}

    // Lifecycle methods
    async enable() {
        this.logger.info('${answers.name} enabled');
    }

    async disable() {
        this.logger.info('${answers.name} disabled');
    }

    async cleanup() {
        this.logger.info('${answers.name} cleaned up');
    }
}

module.exports = ${toPascalCase(answers.id)}Plugin;`;

            await fs.writeFile(
                path.join(pluginDir, 'index.js'),
                template
            );

            // Create README
            const readme = `# ${answers.name}

${answers.description}

## Installation

\`\`\`bash
react-plugin install ${answers.id}
\`\`\`

## Configuration

Edit the plugin configuration in \`plugin.json\` as needed.

## Development

1. Implement your plugin logic in \`index.js\`
2. Test your plugin locally
3. Install using the CLI tool

## Permissions

This plugin requires the following permissions:
${answers.permissions.map(p => `- ${p}`).join('\n')}
`;

            await fs.writeFile(
                path.join(pluginDir, 'README.md'),
                readme
            );

            console.log(chalk.green(`\n✨ Plugin created successfully at ${pluginDir}`));
            console.log(chalk.gray('\nNext steps:'));
            console.log(chalk.gray('1. cd ' + answers.id));
            console.log(chalk.gray('2. Edit index.js to implement your plugin'));
            console.log(chalk.gray('3. Test your plugin'));
            console.log(chalk.gray('4. Install with: react-plugin install .'));

        } catch (error) {
            console.error(chalk.red('Failed to create plugin:'), error.message);
        }
    });

// Validate plugin
program
    .command('validate <path>')
    .description('Validate a plugin before installation')
    .action(async (pluginPath) => {
        try {
            const manifestPath = path.join(pluginPath, 'plugin.json');
            const manifestData = await fs.readFile(manifestPath, 'utf-8');
            const manifest = JSON.parse(manifestData);

            console.log(chalk.bold('\nValidating plugin...'));
            
            const issues = [];
            
            // Check required fields
            const required = ['id', 'name', 'version', 'author'];
            for (const field of required) {
                if (!manifest[field]) {
                    issues.push(`Missing required field: ${field}`);
                }
            }
            
            // Check version format
            if (manifest.version && !/^\d+\.\d+\.\d+$/.test(manifest.version)) {
                issues.push('Invalid version format (should be x.y.z)');
            }
            
            // Check main file exists
            const mainFile = path.join(pluginPath, manifest.main || 'index.js');
            try {
                await fs.access(mainFile);
            } catch {
                issues.push(`Main file not found: ${manifest.main || 'index.js'}`);
            }
            
            // Check permissions
            if (manifest.permissions) {
                const validPermissions = [
                    'database', 'cache', 'queue', 'http', 'websocket',
                    'files', 'tools', 'events', 'routes'
                ];
                
                for (const perm of manifest.permissions) {
                    if (!validPermissions.includes(perm)) {
                        issues.push(`Invalid permission: ${perm}`);
                    }
                }
            }
            
            if (issues.length === 0) {
                console.log(chalk.green('✓ Plugin is valid'));
            } else {
                console.log(chalk.red('✗ Plugin validation failed:'));
                issues.forEach(issue => {
                    console.log(chalk.red(`  - ${issue}`));
                });
            }
            
        } catch (error) {
            console.error(chalk.red('Validation error:'), error.message);
        }
    });

// Helper functions
function toPascalCase(str) {
    return str
        .split('-')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join('');
}

// Parse command line arguments
program.parse(process.argv);

// Show help if no command provided
if (!process.argv.slice(2).length) {
    program.outputHelp();
}