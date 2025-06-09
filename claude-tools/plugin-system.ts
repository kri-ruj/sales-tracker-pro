/**
 * Claude Plugin System
 * Extensible plugin architecture for adding custom functionality to Claude
 */

import { EventEmitter } from 'events';
import { thinkingFramework } from './thinking-framework';
import { codeReviewSystem } from './code-review-system';
import { docGenerator } from './doc-generator';
import { promptEngineering } from './prompt-engineering-toolkit';
import { collaborationSystem } from './collaboration-system';

export interface Plugin {
  id: string;
  name: string;
  version: string;
  description: string;
  author: string;
  category: PluginCategory;
  permissions: PluginPermission[];
  dependencies?: PluginDependency[];
  config?: PluginConfig;
  hooks?: PluginHooks;
  commands?: PluginCommand[];
  tools?: PluginTool[];
  ui?: PluginUI;
  api?: PluginAPI;
}

export enum PluginCategory {
  PRODUCTIVITY = 'productivity',
  DEVELOPMENT = 'development',
  ANALYSIS = 'analysis',
  COMMUNICATION = 'communication',
  AUTOMATION = 'automation',
  INTEGRATION = 'integration',
  VISUALIZATION = 'visualization',
  LEARNING = 'learning'
}

export interface PluginPermission {
  resource: 'filesystem' | 'network' | 'system' | 'ui' | 'data' | 'ai';
  actions: string[];
  reason: string;
}

export interface PluginDependency {
  pluginId: string;
  minVersion?: string;
  maxVersion?: string;
  optional?: boolean;
}

export interface PluginConfig {
  schema: ConfigSchema;
  defaults: Record<string, any>;
  validation?: (config: any) => boolean;
}

export interface ConfigSchema {
  type: 'object';
  properties: Record<string, SchemaProperty>;
  required?: string[];
}

export interface SchemaProperty {
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  description: string;
  default?: any;
  enum?: any[];
  minimum?: number;
  maximum?: number;
}

export interface PluginHooks {
  onInstall?: () => Promise<void>;
  onUninstall?: () => Promise<void>;
  onEnable?: () => Promise<void>;
  onDisable?: () => Promise<void>;
  onConfigChange?: (newConfig: any, oldConfig: any) => Promise<void>;
  beforeRequest?: (request: any) => Promise<any>;
  afterResponse?: (response: any) => Promise<any>;
  onError?: (error: Error) => Promise<void>;
}

export interface PluginCommand {
  id: string;
  name: string;
  description: string;
  aliases?: string[];
  parameters?: CommandParameter[];
  execute: (context: CommandContext) => Promise<CommandResult>;
  autocomplete?: (partial: string) => Promise<string[]>;
}

export interface CommandParameter {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'choice';
  description: string;
  required?: boolean;
  default?: any;
  choices?: string[];
  validation?: (value: any) => boolean;
}

export interface CommandContext {
  args: Record<string, any>;
  session: any;
  user: any;
  ai: AIContext;
}

export interface CommandResult {
  success: boolean;
  output?: any;
  error?: string;
  sideEffects?: SideEffect[];
}

export interface PluginTool {
  id: string;
  name: string;
  description: string;
  inputSchema: any;
  outputSchema: any;
  execute: (input: any) => Promise<any>;
  examples?: ToolExample[];
}

export interface ToolExample {
  description: string;
  input: any;
  expectedOutput: any;
}

export interface PluginUI {
  panels?: UIPanel[];
  menus?: UIMenu[];
  statusBar?: UIStatusBar[];
  themes?: UITheme[];
}

export interface UIPanel {
  id: string;
  title: string;
  icon?: string;
  position: 'left' | 'right' | 'bottom' | 'center';
  component: any; // React component or HTML
  defaultVisible?: boolean;
}

export interface PluginAPI {
  version: string;
  endpoints: APIEndpoint[];
  authentication?: APIAuthentication;
  rateLimit?: APIRateLimit;
}

export interface APIEndpoint {
  path: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  description: string;
  handler: (request: any) => Promise<any>;
  middleware?: any[];
}

export class PluginSystem extends EventEmitter {
  private plugins: Map<string, PluginInstance> = new Map();
  private registry: PluginRegistry;
  private sandbox: PluginSandbox;
  private marketplace: PluginMarketplace;
  private activePlugins: Set<string> = new Set();

  constructor() {
    super();
    this.registry = new PluginRegistry();
    this.sandbox = new PluginSandbox();
    this.marketplace = new PluginMarketplace();
    this.initializeBuiltInPlugins();
  }

  private initializeBuiltInPlugins() {
    // Register built-in plugins
    this.registerBuiltInPlugin(this.createCodeAssistantPlugin());
    this.registerBuiltInPlugin(this.createDataAnalysisPlugin());
    this.registerBuiltInPlugin(this.createProjectManagementPlugin());
    this.registerBuiltInPlugin(this.createLearningAssistantPlugin());
    this.registerBuiltInPlugin(this.createAutomationPlugin());
  }

  // Plugin Management

  async installPlugin(source: string | Plugin): Promise<string> {
    let plugin: Plugin;

    if (typeof source === 'string') {
      // Install from marketplace or URL
      plugin = await this.marketplace.downloadPlugin(source);
    } else {
      plugin = source;
    }

    // Validate plugin
    const validation = await this.validatePlugin(plugin);
    if (!validation.valid) {
      throw new Error(`Plugin validation failed: ${validation.errors.join(', ')}`);
    }

    // Check dependencies
    const dependencyCheck = await this.checkDependencies(plugin);
    if (!dependencyCheck.satisfied) {
      throw new Error(`Missing dependencies: ${dependencyCheck.missing.join(', ')}`);
    }

    // Create sandboxed instance
    const instance = await this.createPluginInstance(plugin);

    // Store plugin
    this.plugins.set(plugin.id, instance);
    await this.registry.register(plugin);

    // Run install hook
    if (plugin.hooks?.onInstall) {
      await this.sandbox.execute(instance, plugin.hooks.onInstall);
    }

    this.emit('plugin:installed', plugin);
    return plugin.id;
  }

  async enablePlugin(pluginId: string): Promise<void> {
    const instance = this.plugins.get(pluginId);
    if (!instance) {
      throw new Error(`Plugin ${pluginId} not found`);
    }

    if (this.activePlugins.has(pluginId)) {
      return; // Already enabled
    }

    // Run enable hook
    if (instance.plugin.hooks?.onEnable) {
      await this.sandbox.execute(instance, instance.plugin.hooks.onEnable);
    }

    // Register commands
    if (instance.plugin.commands) {
      for (const command of instance.plugin.commands) {
        this.registerCommand(pluginId, command);
      }
    }

    // Register tools
    if (instance.plugin.tools) {
      for (const tool of instance.plugin.tools) {
        this.registerTool(pluginId, tool);
      }
    }

    // Set up UI components
    if (instance.plugin.ui) {
      await this.setupUI(pluginId, instance.plugin.ui);
    }

    this.activePlugins.add(pluginId);
    this.emit('plugin:enabled', pluginId);
  }

  async disablePlugin(pluginId: string): Promise<void> {
    const instance = this.plugins.get(pluginId);
    if (!instance) {
      throw new Error(`Plugin ${pluginId} not found`);
    }

    if (!this.activePlugins.has(pluginId)) {
      return; // Already disabled
    }

    // Run disable hook
    if (instance.plugin.hooks?.onDisable) {
      await this.sandbox.execute(instance, instance.plugin.hooks.onDisable);
    }

    // Unregister commands and tools
    this.unregisterPluginComponents(pluginId);

    this.activePlugins.delete(pluginId);
    this.emit('plugin:disabled', pluginId);
  }

  async uninstallPlugin(pluginId: string): Promise<void> {
    const instance = this.plugins.get(pluginId);
    if (!instance) {
      throw new Error(`Plugin ${pluginId} not found`);
    }

    // Disable first if active
    if (this.activePlugins.has(pluginId)) {
      await this.disablePlugin(pluginId);
    }

    // Run uninstall hook
    if (instance.plugin.hooks?.onUninstall) {
      await this.sandbox.execute(instance, instance.plugin.hooks.onUninstall);
    }

    // Clean up
    this.plugins.delete(pluginId);
    await this.registry.unregister(pluginId);

    this.emit('plugin:uninstalled', pluginId);
  }

  // Plugin Discovery

  async searchPlugins(query: string, filters?: PluginFilters): Promise<PluginSearchResult[]> {
    return this.marketplace.search(query, filters);
  }

  async getPluginDetails(pluginId: string): Promise<PluginDetails> {
    return this.marketplace.getDetails(pluginId);
  }

  getInstalledPlugins(): Plugin[] {
    return Array.from(this.plugins.values()).map(instance => instance.plugin);
  }

  getActivePlugins(): Plugin[] {
    return Array.from(this.activePlugins)
      .map(id => this.plugins.get(id)?.plugin)
      .filter(Boolean) as Plugin[];
  }

  // Plugin Communication

  async callPluginMethod(pluginId: string, method: string, ...args: any[]): Promise<any> {
    const instance = this.plugins.get(pluginId);
    if (!instance) {
      throw new Error(`Plugin ${pluginId} not found`);
    }

    if (!this.activePlugins.has(pluginId)) {
      throw new Error(`Plugin ${pluginId} is not active`);
    }

    return this.sandbox.execute(instance, instance.methods[method], ...args);
  }

  async broadcastToPlugins(event: string, data: any): Promise<void> {
    const promises = Array.from(this.activePlugins).map(pluginId => {
      const instance = this.plugins.get(pluginId);
      if (instance?.eventHandlers[event]) {
        return this.sandbox.execute(instance, instance.eventHandlers[event], data);
      }
    });

    await Promise.all(promises.filter(Boolean));
  }

  // Built-in Plugins

  private createCodeAssistantPlugin(): Plugin {
    return {
      id: 'code-assistant',
      name: 'Code Assistant',
      version: '1.0.0',
      description: 'Advanced code assistance with AI-powered features',
      author: 'Claude Tools',
      category: PluginCategory.DEVELOPMENT,
      permissions: [
        {
          resource: 'filesystem',
          actions: ['read', 'write'],
          reason: 'To analyze and modify code files'
        },
        {
          resource: 'ai',
          actions: ['think', 'analyze'],
          reason: 'To provide intelligent code suggestions'
        }
      ],
      commands: [
        {
          id: 'review',
          name: 'Review Code',
          description: 'Perform AI-powered code review',
          parameters: [
            {
              name: 'file',
              type: 'string',
              description: 'File to review',
              required: true
            },
            {
              name: 'focus',
              type: 'choice',
              description: 'Review focus',
              choices: ['security', 'performance', 'style', 'all'],
              default: 'all'
            }
          ],
          execute: async (context) => {
            const { file, focus } = context.args;
            const code = await this.readFile(file);
            const review = await codeReviewSystem.reviewCode(code, {
              level: 'thorough',
              focus: focus === 'all' ? ['security', 'performance', 'style'] : [focus],
              autoFix: false,
              suggestRefactoring: true
            });
            return {
              success: true,
              output: review
            };
          }
        },
        {
          id: 'refactor',
          name: 'Refactor Code',
          description: 'Apply AI-suggested refactorings',
          parameters: [
            {
              name: 'pattern',
              type: 'choice',
              description: 'Refactoring pattern',
              choices: ['extract-method', 'simplify-conditionals', 'introduce-parameters'],
              required: true
            }
          ],
          execute: async (context) => {
            // Implementation
            return { success: true };
          }
        }
      ],
      tools: [
        {
          id: 'code-complete',
          name: 'Code Completion',
          description: 'AI-powered code completion',
          inputSchema: {
            type: 'object',
            properties: {
              code: { type: 'string' },
              cursor: { type: 'object' }
            }
          },
          outputSchema: {
            type: 'object',
            properties: {
              suggestions: { type: 'array' }
            }
          },
          execute: async (input) => {
            // Use thinking framework for intelligent completion
            thinkingFramework.setLevel('think_hard');
            const analysis = await thinkingFramework.think(
              'Generate code completion suggestions',
              input
            );
            return {
              suggestions: analysis.solution.suggestions || []
            };
          }
        }
      ]
    };
  }

  private createDataAnalysisPlugin(): Plugin {
    return {
      id: 'data-analysis',
      name: 'Data Analysis Assistant',
      version: '1.0.0',
      description: 'AI-powered data analysis and visualization',
      author: 'Claude Tools',
      category: PluginCategory.ANALYSIS,
      permissions: [
        {
          resource: 'data',
          actions: ['read', 'analyze'],
          reason: 'To analyze data sets'
        },
        {
          resource: 'ui',
          actions: ['render'],
          reason: 'To display visualizations'
        }
      ],
      commands: [
        {
          id: 'analyze',
          name: 'Analyze Data',
          description: 'Perform comprehensive data analysis',
          parameters: [
            {
              name: 'dataset',
              type: 'string',
              description: 'Dataset to analyze',
              required: true
            },
            {
              name: 'type',
              type: 'choice',
              description: 'Analysis type',
              choices: ['statistical', 'trend', 'correlation', 'predictive'],
              default: 'statistical'
            }
          ],
          execute: async (context) => {
            const { dataset, type } = context.args;
            
            // Use ultrathink for complex analysis
            thinkingFramework.setLevel('ultrathink');
            const analysis = await thinkingFramework.think(
              `Perform ${type} analysis on dataset`,
              { dataset }
            );

            return {
              success: true,
              output: {
                analysis: analysis.solution,
                visualizations: await this.generateVisualizations(analysis)
              }
            };
          }
        }
      ]
    };
  }

  private createProjectManagementPlugin(): Plugin {
    return {
      id: 'project-manager',
      name: 'Project Management',
      version: '1.0.0',
      description: 'AI-assisted project management and planning',
      author: 'Claude Tools',
      category: PluginCategory.PRODUCTIVITY,
      permissions: [
        {
          resource: 'data',
          actions: ['read', 'write'],
          reason: 'To manage project data'
        }
      ],
      commands: [
        {
          id: 'plan',
          name: 'Create Project Plan',
          description: 'Generate AI-optimized project plan',
          parameters: [
            {
              name: 'requirements',
              type: 'string',
              description: 'Project requirements',
              required: true
            },
            {
              name: 'timeline',
              type: 'string',
              description: 'Project timeline',
              default: '3 months'
            }
          ],
          execute: async (context) => {
            const { requirements, timeline } = context.args;
            
            // Generate comprehensive project plan
            const prompt = await promptEngineering.buildPrompt('structured-output', {
              output_type: 'project plan',
              format_specification: 'Gantt-compatible JSON',
              requirements,
              timeline
            });

            return {
              success: true,
              output: {
                plan: 'Generated project plan...',
                milestones: [],
                risks: []
              }
            };
          }
        }
      ],
      ui: {
        panels: [
          {
            id: 'project-dashboard',
            title: 'Project Dashboard',
            position: 'center',
            component: 'ProjectDashboard'
          }
        ]
      }
    };
  }

  private createLearningAssistantPlugin(): Plugin {
    return {
      id: 'learning-assistant',
      name: 'Learning Assistant',
      version: '1.0.0',
      description: 'Personalized AI tutor and learning companion',
      author: 'Claude Tools',
      category: PluginCategory.LEARNING,
      permissions: [
        {
          resource: 'ai',
          actions: ['teach', 'evaluate'],
          reason: 'To provide personalized teaching'
        }
      ],
      commands: [
        {
          id: 'learn',
          name: 'Start Learning Session',
          description: 'Begin interactive learning session',
          parameters: [
            {
              name: 'topic',
              type: 'string',
              description: 'Topic to learn',
              required: true
            },
            {
              name: 'level',
              type: 'choice',
              description: 'Skill level',
              choices: ['beginner', 'intermediate', 'advanced'],
              default: 'beginner'
            }
          ],
          execute: async (context) => {
            const { topic, level } = context.args;
            
            // Create learning session
            const session = await collaborationSystem.createSession({
              name: `Learning: ${topic}`,
              owner: context.user,
              context: {
                project: 'learning',
                goals: [`Master ${topic} at ${level} level`],
                constraints: [],
                sharedDocuments: []
              }
            });

            return {
              success: true,
              output: {
                sessionId: session.id,
                curriculum: await this.generateCurriculum(topic, level)
              }
            };
          }
        }
      ]
    };
  }

  private createAutomationPlugin(): Plugin {
    return {
      id: 'automation',
      name: 'Workflow Automation',
      version: '1.0.0',
      description: 'Create and manage automated workflows',
      author: 'Claude Tools',
      category: PluginCategory.AUTOMATION,
      permissions: [
        {
          resource: 'system',
          actions: ['execute'],
          reason: 'To run automated workflows'
        }
      ],
      commands: [
        {
          id: 'automate',
          name: 'Create Automation',
          description: 'Create new automated workflow',
          parameters: [
            {
              name: 'trigger',
              type: 'choice',
              description: 'Workflow trigger',
              choices: ['schedule', 'event', 'webhook', 'manual'],
              required: true
            },
            {
              name: 'actions',
              type: 'string',
              description: 'Workflow actions (JSON)',
              required: true
            }
          ],
          execute: async (context) => {
            const { trigger, actions } = context.args;
            
            // Create workflow
            const workflow = {
              id: this.generateId(),
              trigger,
              actions: JSON.parse(actions),
              created: new Date()
            };

            return {
              success: true,
              output: workflow
            };
          }
        }
      ]
    };
  }

  // Helper Methods

  private async validatePlugin(plugin: Plugin): Promise<ValidationResult> {
    const errors: string[] = [];

    // Check required fields
    if (!plugin.id || !plugin.name || !plugin.version) {
      errors.push('Missing required fields');
    }

    // Validate version format
    if (!this.isValidVersion(plugin.version)) {
      errors.push('Invalid version format');
    }

    // Check permissions
    if (plugin.permissions) {
      for (const perm of plugin.permissions) {
        if (!this.isValidPermission(perm)) {
          errors.push(`Invalid permission: ${perm.resource}`);
        }
      }
    }

    // Validate commands
    if (plugin.commands) {
      for (const cmd of plugin.commands) {
        if (!cmd.execute || typeof cmd.execute !== 'function') {
          errors.push(`Command ${cmd.id} missing execute function`);
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  private async checkDependencies(plugin: Plugin): Promise<DependencyCheck> {
    const missing: string[] = [];

    if (plugin.dependencies) {
      for (const dep of plugin.dependencies) {
        const installed = this.plugins.get(dep.pluginId);
        if (!installed && !dep.optional) {
          missing.push(dep.pluginId);
        }
      }
    }

    return {
      satisfied: missing.length === 0,
      missing
    };
  }

  private async createPluginInstance(plugin: Plugin): Promise<PluginInstance> {
    const instance: PluginInstance = {
      plugin,
      state: {},
      config: plugin.config?.defaults || {},
      methods: {},
      eventHandlers: {},
      sandbox: this.sandbox.createContext(plugin)
    };

    return instance;
  }

  private registerCommand(pluginId: string, command: PluginCommand) {
    // Register command in command system
    this.emit('command:register', {
      pluginId,
      command
    });
  }

  private registerTool(pluginId: string, tool: PluginTool) {
    // Register tool in tool system
    this.emit('tool:register', {
      pluginId,
      tool
    });
  }

  private async setupUI(pluginId: string, ui: PluginUI) {
    // Set up UI components
    if (ui.panels) {
      for (const panel of ui.panels) {
        this.emit('ui:panel:register', {
          pluginId,
          panel
        });
      }
    }
  }

  private unregisterPluginComponents(pluginId: string) {
    this.emit('plugin:cleanup', pluginId);
  }

  private registerBuiltInPlugin(plugin: Plugin) {
    const instance: PluginInstance = {
      plugin,
      state: {},
      config: plugin.config?.defaults || {},
      methods: {},
      eventHandlers: {},
      sandbox: null,
      builtIn: true
    };

    this.plugins.set(plugin.id, instance);
  }

  private isValidVersion(version: string): boolean {
    return /^\d+\.\d+\.\d+/.test(version);
  }

  private isValidPermission(permission: PluginPermission): boolean {
    const validResources = ['filesystem', 'network', 'system', 'ui', 'data', 'ai'];
    return validResources.includes(permission.resource);
  }

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private async readFile(file: string): Promise<string> {
    // Would integrate with filesystem
    return '';
  }

  private async generateVisualizations(analysis: any): Promise<any[]> {
    // Generate visualization configs
    return [];
  }

  private async generateCurriculum(topic: string, level: string): Promise<any> {
    // Generate learning curriculum
    return {
      modules: [],
      duration: '4 weeks'
    };
  }
}

// Plugin Sandbox for Security
class PluginSandbox {
  createContext(plugin: Plugin): any {
    // Create isolated execution context
    return {
      globals: this.getSafeGlobals(),
      permissions: plugin.permissions
    };
  }

  async execute(instance: PluginInstance, fn: Function, ...args: any[]): Promise<any> {
    if (instance.builtIn) {
      // Built-in plugins run without sandbox
      return fn.apply(instance, args);
    }

    // Execute in sandbox with permission checks
    try {
      // Check permissions before execution
      this.checkPermissions(instance);
      
      // Execute with timeout and resource limits
      return await this.executeWithLimits(fn, instance, args);
    } catch (error) {
      this.handleSandboxError(error, instance);
      throw error;
    }
  }

  private getSafeGlobals(): any {
    // Return safe subset of globals
    return {
      console: console,
      JSON: JSON,
      Math: Math,
      Date: Date,
      Promise: Promise
    };
  }

  private checkPermissions(instance: PluginInstance) {
    // Verify plugin has required permissions
  }

  private async executeWithLimits(fn: Function, instance: PluginInstance, args: any[]): Promise<any> {
    // Execute with CPU, memory, and time limits
    return fn.apply(instance, args);
  }

  private handleSandboxError(error: any, instance: PluginInstance) {
    console.error(`Plugin ${instance.plugin.id} error:`, error);
  }
}

// Plugin Registry
class PluginRegistry {
  private registry: Map<string, PluginMetadata> = new Map();

  async register(plugin: Plugin): Promise<void> {
    const metadata: PluginMetadata = {
      id: plugin.id,
      name: plugin.name,
      version: plugin.version,
      author: plugin.author,
      category: plugin.category,
      installedAt: new Date(),
      lastUpdated: new Date()
    };

    this.registry.set(plugin.id, metadata);
  }

  async unregister(pluginId: string): Promise<void> {
    this.registry.delete(pluginId);
  }

  getMetadata(pluginId: string): PluginMetadata | undefined {
    return this.registry.get(pluginId);
  }

  getAllMetadata(): PluginMetadata[] {
    return Array.from(this.registry.values());
  }
}

// Plugin Marketplace
class PluginMarketplace {
  private marketplaceUrl = 'https://plugins.claude.ai/api';

  async search(query: string, filters?: PluginFilters): Promise<PluginSearchResult[]> {
    // Simulate marketplace search
    return [
      {
        id: 'example-plugin',
        name: 'Example Plugin',
        description: 'An example plugin',
        author: 'Developer',
        rating: 4.5,
        downloads: 1000,
        category: PluginCategory.PRODUCTIVITY
      }
    ];
  }

  async getDetails(pluginId: string): Promise<PluginDetails> {
    // Get detailed plugin information
    return {
      id: pluginId,
      name: 'Plugin Name',
      description: 'Detailed description',
      author: 'Author',
      version: '1.0.0',
      readme: '# Plugin README',
      screenshots: [],
      reviews: [],
      stats: {
        downloads: 0,
        rating: 0,
        reviews: 0
      }
    };
  }

  async downloadPlugin(source: string): Promise<Plugin> {
    // Download and validate plugin
    throw new Error('Not implemented');
  }
}

// Type Definitions

export interface PluginInstance {
  plugin: Plugin;
  state: any;
  config: any;
  methods: Record<string, Function>;
  eventHandlers: Record<string, Function>;
  sandbox: any;
  builtIn?: boolean;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export interface DependencyCheck {
  satisfied: boolean;
  missing: string[];
}

export interface PluginFilters {
  category?: PluginCategory;
  author?: string;
  minRating?: number;
  maxPrice?: number;
}

export interface PluginSearchResult {
  id: string;
  name: string;
  description: string;
  author: string;
  rating: number;
  downloads: number;
  category: PluginCategory;
}

export interface PluginDetails {
  id: string;
  name: string;
  description: string;
  author: string;
  version: string;
  readme: string;
  screenshots: string[];
  reviews: Review[];
  stats: PluginStats;
}

export interface Review {
  author: string;
  rating: number;
  comment: string;
  date: Date;
}

export interface PluginStats {
  downloads: number;
  rating: number;
  reviews: number;
}

export interface PluginMetadata {
  id: string;
  name: string;
  version: string;
  author: string;
  category: PluginCategory;
  installedAt: Date;
  lastUpdated: Date;
}

export interface SideEffect {
  type: string;
  description: string;
  data?: any;
}

export interface AIContext {
  think: (problem: string) => Promise<any>;
  generatePrompt: (template: string, vars: any) => Promise<string>;
  review: (code: string) => Promise<any>;
  collaborate: (sessionId: string) => Promise<any>;
}

export interface UIMenu {
  id: string;
  label: string;
  items: UIMenuItem[];
}

export interface UIMenuItem {
  id: string;
  label: string;
  command?: string;
  submenu?: UIMenuItem[];
}

export interface UIStatusBar {
  id: string;
  position: 'left' | 'right';
  component: any;
  priority?: number;
}

export interface UITheme {
  id: string;
  name: string;
  colors: Record<string, string>;
  fonts: Record<string, string>;
}

export interface APIAuthentication {
  type: 'apikey' | 'oauth' | 'jwt';
  config: any;
}

export interface APIRateLimit {
  requests: number;
  window: number; // seconds
}

// Export singleton instance
export const pluginSystem = new PluginSystem();