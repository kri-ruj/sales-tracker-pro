/**
 * Visual Programming Interface for Non-Coders
 * Enables drag-and-drop programming with Claude AI assistance
 */

import { EventEmitter } from 'events';
import { thinkingFramework } from './thinking-framework';
import { codeReviewSystem } from './code-review-system';
import { docGenerator } from './doc-generator';
import { promptEngineering } from './prompt-engineering-toolkit';

export interface VisualProgram {
  id: string;
  name: string;
  description: string;
  nodes: ProgramNode[];
  connections: Connection[];
  variables: Variable[];
  metadata: ProgramMetadata;
  version: string;
}

export interface ProgramNode {
  id: string;
  type: NodeType;
  category: NodeCategory;
  position: Position;
  properties: NodeProperties;
  inputs: Port[];
  outputs: Port[];
  state: NodeState;
}

export enum NodeType {
  // Control Flow
  START = 'start',
  END = 'end',
  IF = 'if',
  LOOP = 'loop',
  FOREACH = 'foreach',
  WHILE = 'while',
  SWITCH = 'switch',
  
  // Data Operations
  VARIABLE = 'variable',
  CONSTANT = 'constant',
  MATH = 'math',
  TEXT = 'text',
  LIST = 'list',
  OBJECT = 'object',
  
  // Input/Output
  INPUT = 'input',
  OUTPUT = 'output',
  FILE_READ = 'file_read',
  FILE_WRITE = 'file_write',
  API_CALL = 'api_call',
  DATABASE = 'database',
  
  // Logic
  COMPARE = 'compare',
  LOGIC = 'logic',
  FILTER = 'filter',
  TRANSFORM = 'transform',
  
  // AI Operations
  AI_THINK = 'ai_think',
  AI_GENERATE = 'ai_generate',
  AI_ANALYZE = 'ai_analyze',
  AI_EXTRACT = 'ai_extract',
  
  // Custom
  FUNCTION = 'function',
  COMMENT = 'comment'
}

export enum NodeCategory {
  CONTROL = 'control',
  DATA = 'data',
  IO = 'io',
  LOGIC = 'logic',
  AI = 'ai',
  CUSTOM = 'custom'
}

export interface Position {
  x: number;
  y: number;
}

export interface NodeProperties {
  label: string;
  description?: string;
  config: Record<string, any>;
  validation?: ValidationRule[];
  help?: string;
}

export interface Port {
  id: string;
  name: string;
  type: DataType;
  required: boolean;
  multiple: boolean;
  defaultValue?: any;
  connected?: boolean;
}

export enum DataType {
  ANY = 'any',
  STRING = 'string',
  NUMBER = 'number',
  BOOLEAN = 'boolean',
  ARRAY = 'array',
  OBJECT = 'object',
  DATE = 'date',
  FILE = 'file',
  FLOW = 'flow'
}

export interface NodeState {
  status: 'idle' | 'running' | 'success' | 'error' | 'paused';
  error?: string;
  lastRun?: Date;
  runtime?: number;
}

export interface Connection {
  id: string;
  source: ConnectionEndpoint;
  target: ConnectionEndpoint;
  type: DataType;
  transform?: DataTransform;
}

export interface ConnectionEndpoint {
  nodeId: string;
  portId: string;
}

export interface DataTransform {
  type: 'cast' | 'map' | 'filter' | 'custom';
  config: any;
}

export interface Variable {
  id: string;
  name: string;
  type: DataType;
  value: any;
  scope: 'global' | 'local';
  mutable: boolean;
}

export interface ProgramMetadata {
  created: Date;
  modified: Date;
  author: string;
  tags: string[];
  complexity: 'beginner' | 'intermediate' | 'advanced';
  estimatedRuntime?: number;
}

export interface ValidationRule {
  type: 'required' | 'type' | 'range' | 'pattern' | 'custom';
  config: any;
  message: string;
}

export class VisualProgrammingInterface extends EventEmitter {
  private programs: Map<string, VisualProgram> = new Map();
  private nodeLibrary: NodeLibrary;
  private executor: ProgramExecutor;
  private validator: ProgramValidator;
  private codeGenerator: CodeGenerator;
  private aiAssistant: AIAssistant;
  private activeProgram: VisualProgram | null = null;

  constructor() {
    super();
    this.nodeLibrary = new NodeLibrary();
    this.executor = new ProgramExecutor();
    this.validator = new ProgramValidator();
    this.codeGenerator = new CodeGenerator();
    this.aiAssistant = new AIAssistant();
    this.initialize();
  }

  private initialize() {
    this.initializeBuiltInNodes();
    this.setupEventHandlers();
  }

  private initializeBuiltInNodes() {
    // Register all built-in node types
    this.registerControlFlowNodes();
    this.registerDataNodes();
    this.registerIONodes();
    this.registerLogicNodes();
    this.registerAINodes();
  }

  // Program Management

  createProgram(name: string, description?: string): VisualProgram {
    const program: VisualProgram = {
      id: this.generateId(),
      name,
      description: description || '',
      nodes: [this.createStartNode()],
      connections: [],
      variables: [],
      metadata: {
        created: new Date(),
        modified: new Date(),
        author: 'user',
        tags: [],
        complexity: 'beginner'
      },
      version: '1.0.0'
    };

    this.programs.set(program.id, program);
    this.activeProgram = program;
    this.emit('program:created', program);

    return program;
  }

  loadProgram(programId: string): VisualProgram {
    const program = this.programs.get(programId);
    if (!program) {
      throw new Error(`Program ${programId} not found`);
    }

    this.activeProgram = program;
    this.emit('program:loaded', program);
    return program;
  }

  saveProgram(program?: VisualProgram): void {
    const programToSave = program || this.activeProgram;
    if (!programToSave) {
      throw new Error('No program to save');
    }

    programToSave.metadata.modified = new Date();
    this.programs.set(programToSave.id, programToSave);
    this.emit('program:saved', programToSave);
  }

  // Node Operations

  addNode(type: NodeType, position: Position, properties?: Partial<NodeProperties>): ProgramNode {
    if (!this.activeProgram) {
      throw new Error('No active program');
    }

    const nodeTemplate = this.nodeLibrary.getNodeTemplate(type);
    const node: ProgramNode = {
      id: this.generateNodeId(),
      type,
      category: nodeTemplate.category,
      position,
      properties: {
        label: properties?.label || nodeTemplate.defaultLabel,
        description: properties?.description,
        config: { ...nodeTemplate.defaultConfig, ...properties?.config },
        validation: properties?.validation || nodeTemplate.validation,
        help: properties?.help || nodeTemplate.help
      },
      inputs: this.createPorts(nodeTemplate.inputs),
      outputs: this.createPorts(nodeTemplate.outputs),
      state: {
        status: 'idle'
      }
    };

    this.activeProgram.nodes.push(node);
    this.emit('node:added', { node, program: this.activeProgram });

    return node;
  }

  removeNode(nodeId: string): void {
    if (!this.activeProgram) {
      throw new Error('No active program');
    }

    // Remove node
    this.activeProgram.nodes = this.activeProgram.nodes.filter(n => n.id !== nodeId);
    
    // Remove connected connections
    this.activeProgram.connections = this.activeProgram.connections.filter(
      c => c.source.nodeId !== nodeId && c.target.nodeId !== nodeId
    );

    this.emit('node:removed', { nodeId, program: this.activeProgram });
  }

  updateNode(nodeId: string, updates: Partial<ProgramNode>): void {
    if (!this.activeProgram) {
      throw new Error('No active program');
    }

    const node = this.activeProgram.nodes.find(n => n.id === nodeId);
    if (!node) {
      throw new Error(`Node ${nodeId} not found`);
    }

    Object.assign(node, updates);
    this.emit('node:updated', { node, program: this.activeProgram });
  }

  // Connection Operations

  connect(source: ConnectionEndpoint, target: ConnectionEndpoint): Connection {
    if (!this.activeProgram) {
      throw new Error('No active program');
    }

    // Validate connection
    const validation = this.validator.validateConnection(
      this.activeProgram,
      source,
      target
    );

    if (!validation.valid) {
      throw new Error(`Invalid connection: ${validation.error}`);
    }

    const connection: Connection = {
      id: this.generateId(),
      source,
      target,
      type: validation.dataType!
    };

    this.activeProgram.connections.push(connection);
    this.emit('connection:added', { connection, program: this.activeProgram });

    return connection;
  }

  disconnect(connectionId: string): void {
    if (!this.activeProgram) {
      throw new Error('No active program');
    }

    this.activeProgram.connections = this.activeProgram.connections.filter(
      c => c.id !== connectionId
    );

    this.emit('connection:removed', { connectionId, program: this.activeProgram });
  }

  // Execution

  async runProgram(program?: VisualProgram, inputs?: Record<string, any>): Promise<ExecutionResult> {
    const programToRun = program || this.activeProgram;
    if (!programToRun) {
      throw new Error('No program to run');
    }

    // Validate program before execution
    const validation = this.validator.validateProgram(programToRun);
    if (!validation.valid) {
      throw new Error(`Program validation failed: ${validation.errors.join(', ')}`);
    }

    // Execute program
    this.emit('execution:started', { program: programToRun });
    
    try {
      const result = await this.executor.execute(programToRun, inputs || {});
      this.emit('execution:completed', { program: programToRun, result });
      return result;
    } catch (error) {
      this.emit('execution:error', { program: programToRun, error });
      throw error;
    }
  }

  async debugProgram(breakpoints?: string[]): Promise<DebugSession> {
    if (!this.activeProgram) {
      throw new Error('No active program');
    }

    const session = await this.executor.createDebugSession(this.activeProgram, breakpoints);
    
    session.on('breakpoint', (nodeId) => {
      this.emit('debug:breakpoint', { nodeId, session });
    });

    session.on('step', (nodeId) => {
      this.emit('debug:step', { nodeId, session });
    });

    return session;
  }

  // Code Generation

  async generateCode(language: CodeLanguage, options?: CodeGenOptions): Promise<string> {
    if (!this.activeProgram) {
      throw new Error('No active program');
    }

    const code = await this.codeGenerator.generate(this.activeProgram, language, options);
    
    // Review generated code
    const review = await codeReviewSystem.reviewCode(code, {
      level: 'standard',
      focus: ['bugs', 'performance'],
      autoFix: true,
      suggestRefactoring: false
    });

    return review.fixedCode || code;
  }

  async exportProgram(format: ExportFormat): Promise<string | Blob> {
    if (!this.activeProgram) {
      throw new Error('No active program');
    }

    switch (format) {
      case 'json':
        return JSON.stringify(this.activeProgram, null, 2);
      
      case 'code':
        return this.generateCode('javascript');
      
      case 'documentation':
        return this.generateDocumentation();
      
      case 'image':
        return this.generateDiagram();
      
      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  }

  // AI Assistance

  async suggestNextNode(context?: SuggestionContext): Promise<NodeSuggestion[]> {
    if (!this.activeProgram) {
      throw new Error('No active program');
    }

    return this.aiAssistant.suggestNextNode(this.activeProgram, context);
  }

  async explainProgram(): Promise<ProgramExplanation> {
    if (!this.activeProgram) {
      throw new Error('No active program');
    }

    return this.aiAssistant.explainProgram(this.activeProgram);
  }

  async optimizeProgram(): Promise<OptimizationSuggestion[]> {
    if (!this.activeProgram) {
      throw new Error('No active program');
    }

    return this.aiAssistant.optimizeProgram(this.activeProgram);
  }

  async convertNaturalLanguageToProgram(description: string): Promise<VisualProgram> {
    const program = await this.aiAssistant.naturalLanguageToProgram(description);
    this.programs.set(program.id, program);
    this.activeProgram = program;
    return program;
  }

  // Templates and Examples

  getTemplates(category?: string): ProgramTemplate[] {
    return this.nodeLibrary.getTemplates(category);
  }

  loadTemplate(templateId: string): VisualProgram {
    const template = this.nodeLibrary.getTemplate(templateId);
    const program = this.createProgram(template.name, template.description);
    
    // Copy template nodes and connections
    program.nodes = [...template.nodes];
    program.connections = [...template.connections];
    program.variables = [...template.variables];
    
    this.emit('template:loaded', { template, program });
    return program;
  }

  // Private Methods

  private registerControlFlowNodes() {
    this.nodeLibrary.registerNode({
      type: NodeType.IF,
      category: NodeCategory.CONTROL,
      defaultLabel: 'If Condition',
      defaultConfig: {
        condition: ''
      },
      inputs: [
        { name: 'flow', type: DataType.FLOW, required: true },
        { name: 'condition', type: DataType.BOOLEAN, required: true }
      ],
      outputs: [
        { name: 'true', type: DataType.FLOW },
        { name: 'false', type: DataType.FLOW }
      ],
      validation: [
        { type: 'required', config: { field: 'condition' }, message: 'Condition is required' }
      ],
      help: 'Branches execution based on a condition'
    });

    this.nodeLibrary.registerNode({
      type: NodeType.LOOP,
      category: NodeCategory.CONTROL,
      defaultLabel: 'Loop',
      defaultConfig: {
        iterations: 10
      },
      inputs: [
        { name: 'flow', type: DataType.FLOW, required: true },
        { name: 'count', type: DataType.NUMBER, required: false }
      ],
      outputs: [
        { name: 'loop', type: DataType.FLOW },
        { name: 'done', type: DataType.FLOW },
        { name: 'index', type: DataType.NUMBER }
      ],
      help: 'Repeats execution a specified number of times'
    });
  }

  private registerDataNodes() {
    this.nodeLibrary.registerNode({
      type: NodeType.VARIABLE,
      category: NodeCategory.DATA,
      defaultLabel: 'Variable',
      defaultConfig: {
        name: 'myVariable',
        type: DataType.STRING,
        value: ''
      },
      inputs: [
        { name: 'value', type: DataType.ANY, required: false }
      ],
      outputs: [
        { name: 'value', type: DataType.ANY }
      ],
      help: 'Stores and retrieves a value'
    });

    this.nodeLibrary.registerNode({
      type: NodeType.MATH,
      category: NodeCategory.DATA,
      defaultLabel: 'Math Operation',
      defaultConfig: {
        operation: 'add'
      },
      inputs: [
        { name: 'a', type: DataType.NUMBER, required: true },
        { name: 'b', type: DataType.NUMBER, required: true }
      ],
      outputs: [
        { name: 'result', type: DataType.NUMBER }
      ],
      help: 'Performs mathematical operations'
    });
  }

  private registerIONodes() {
    this.nodeLibrary.registerNode({
      type: NodeType.INPUT,
      category: NodeCategory.IO,
      defaultLabel: 'User Input',
      defaultConfig: {
        prompt: 'Enter a value:',
        type: DataType.STRING
      },
      inputs: [
        { name: 'flow', type: DataType.FLOW, required: true }
      ],
      outputs: [
        { name: 'flow', type: DataType.FLOW },
        { name: 'value', type: DataType.ANY }
      ],
      help: 'Gets input from the user'
    });

    this.nodeLibrary.registerNode({
      type: NodeType.OUTPUT,
      category: NodeCategory.IO,
      defaultLabel: 'Display Output',
      defaultConfig: {
        format: 'text'
      },
      inputs: [
        { name: 'flow', type: DataType.FLOW, required: true },
        { name: 'value', type: DataType.ANY, required: true }
      ],
      outputs: [
        { name: 'flow', type: DataType.FLOW }
      ],
      help: 'Displays output to the user'
    });
  }

  private registerLogicNodes() {
    this.nodeLibrary.registerNode({
      type: NodeType.COMPARE,
      category: NodeCategory.LOGIC,
      defaultLabel: 'Compare',
      defaultConfig: {
        operator: 'equals'
      },
      inputs: [
        { name: 'a', type: DataType.ANY, required: true },
        { name: 'b', type: DataType.ANY, required: true }
      ],
      outputs: [
        { name: 'result', type: DataType.BOOLEAN }
      ],
      help: 'Compares two values'
    });
  }

  private registerAINodes() {
    this.nodeLibrary.registerNode({
      type: NodeType.AI_THINK,
      category: NodeCategory.AI,
      defaultLabel: 'AI Think',
      defaultConfig: {
        level: 'think_hard',
        prompt: ''
      },
      inputs: [
        { name: 'flow', type: DataType.FLOW, required: true },
        { name: 'context', type: DataType.ANY, required: false }
      ],
      outputs: [
        { name: 'flow', type: DataType.FLOW },
        { name: 'result', type: DataType.OBJECT }
      ],
      help: 'Uses AI to analyze and solve problems'
    });

    this.nodeLibrary.registerNode({
      type: NodeType.AI_GENERATE,
      category: NodeCategory.AI,
      defaultLabel: 'AI Generate',
      defaultConfig: {
        type: 'text',
        template: ''
      },
      inputs: [
        { name: 'flow', type: DataType.FLOW, required: true },
        { name: 'prompt', type: DataType.STRING, required: true },
        { name: 'data', type: DataType.ANY, required: false }
      ],
      outputs: [
        { name: 'flow', type: DataType.FLOW },
        { name: 'generated', type: DataType.STRING }
      ],
      help: 'Generates content using AI'
    });
  }

  private createStartNode(): ProgramNode {
    return {
      id: 'start',
      type: NodeType.START,
      category: NodeCategory.CONTROL,
      position: { x: 100, y: 100 },
      properties: {
        label: 'Start',
        config: {}
      },
      inputs: [],
      outputs: [
        { id: 'flow', name: 'flow', type: DataType.FLOW, required: false, multiple: false }
      ],
      state: { status: 'idle' }
    };
  }

  private createPorts(portTemplates: PortTemplate[]): Port[] {
    return portTemplates.map(template => ({
      id: this.generateId(),
      ...template,
      connected: false
    }));
  }

  private setupEventHandlers() {
    this.executor.on('node:executing', (nodeId) => {
      this.updateNodeState(nodeId, { status: 'running' });
    });

    this.executor.on('node:completed', (nodeId) => {
      this.updateNodeState(nodeId, { status: 'success' });
    });

    this.executor.on('node:error', (nodeId, error) => {
      this.updateNodeState(nodeId, { status: 'error', error: error.message });
    });
  }

  private updateNodeState(nodeId: string, state: Partial<NodeState>) {
    if (!this.activeProgram) return;

    const node = this.activeProgram.nodes.find(n => n.id === nodeId);
    if (node) {
      Object.assign(node.state, state);
      this.emit('node:state:changed', { nodeId, state });
    }
  }

  private async generateDocumentation(): Promise<string> {
    if (!this.activeProgram) {
      throw new Error('No active program');
    }

    const docConfig = {
      style: 'tutorial' as any,
      format: 'markdown' as any,
      audience: 'user' as any,
      includeExamples: true,
      includeDiagrams: true,
      includeTests: false,
      language: 'en'
    };

    const doc = await docGenerator.generateDocumentation(
      {
        name: this.activeProgram.name,
        files: [{
          path: 'program.json',
          content: JSON.stringify(this.activeProgram)
        }]
      },
      docConfig
    );

    return doc.sections.map(s => s.content).join('\n\n');
  }

  private generateDiagram(): Blob {
    // Generate visual diagram of the program
    // Would create actual image blob
    return new Blob(['diagram'], { type: 'image/png' });
  }

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateNodeId(): string {
    return `node-${this.generateId()}`;
  }
}

// Supporting Classes

class NodeLibrary {
  private nodeTemplates: Map<NodeType, NodeTemplate> = new Map();
  private programTemplates: Map<string, ProgramTemplate> = new Map();

  registerNode(template: NodeTemplate): void {
    this.nodeTemplates.set(template.type, template);
  }

  getNodeTemplate(type: NodeType): NodeTemplate {
    const template = this.nodeTemplates.get(type);
    if (!template) {
      throw new Error(`Node type ${type} not found`);
    }
    return template;
  }

  getTemplates(category?: string): ProgramTemplate[] {
    const templates = Array.from(this.programTemplates.values());
    if (category) {
      return templates.filter(t => t.category === category);
    }
    return templates;
  }

  getTemplate(templateId: string): ProgramTemplate {
    const template = this.programTemplates.get(templateId);
    if (!template) {
      throw new Error(`Template ${templateId} not found`);
    }
    return template;
  }
}

class ProgramExecutor extends EventEmitter {
  async execute(program: VisualProgram, inputs: Record<string, any>): Promise<ExecutionResult> {
    const context = new ExecutionContext(program, inputs);
    const startNode = program.nodes.find(n => n.type === NodeType.START);
    
    if (!startNode) {
      throw new Error('No start node found');
    }

    await this.executeNode(startNode, context);

    return {
      success: true,
      outputs: context.getOutputs(),
      variables: context.getVariables(),
      executionTime: context.getExecutionTime()
    };
  }

  private async executeNode(node: ProgramNode, context: ExecutionContext): Promise<any> {
    this.emit('node:executing', node.id);
    const startTime = Date.now();

    try {
      let result: any;

      switch (node.type) {
        case NodeType.IF:
          result = await this.executeIfNode(node, context);
          break;
        case NodeType.LOOP:
          result = await this.executeLoopNode(node, context);
          break;
        case NodeType.VARIABLE:
          result = await this.executeVariableNode(node, context);
          break;
        case NodeType.AI_THINK:
          result = await this.executeAIThinkNode(node, context);
          break;
        default:
          result = await this.executeGenericNode(node, context);
      }

      const runtime = Date.now() - startTime;
      this.emit('node:completed', node.id, { result, runtime });
      
      return result;
    } catch (error) {
      this.emit('node:error', node.id, error);
      throw error;
    }
  }

  private async executeIfNode(node: ProgramNode, context: ExecutionContext): Promise<void> {
    const condition = await context.getInputValue(node, 'condition');
    const nextPort = condition ? 'true' : 'false';
    
    const nextNode = context.getNextNode(node, nextPort);
    if (nextNode) {
      await this.executeNode(nextNode, context);
    }
  }

  private async executeLoopNode(node: ProgramNode, context: ExecutionContext): Promise<void> {
    const count = await context.getInputValue(node, 'count') || node.properties.config.iterations;
    
    for (let i = 0; i < count; i++) {
      context.setOutputValue(node, 'index', i);
      
      const loopNode = context.getNextNode(node, 'loop');
      if (loopNode) {
        await this.executeNode(loopNode, context);
      }
    }
    
    const doneNode = context.getNextNode(node, 'done');
    if (doneNode) {
      await this.executeNode(doneNode, context);
    }
  }

  private async executeVariableNode(node: ProgramNode, context: ExecutionContext): Promise<any> {
    const inputValue = await context.getInputValue(node, 'value');
    const varName = node.properties.config.name;
    
    if (inputValue !== undefined) {
      context.setVariable(varName, inputValue);
    }
    
    const value = context.getVariable(varName) ?? node.properties.config.value;
    context.setOutputValue(node, 'value', value);
    
    return value;
  }

  private async executeAIThinkNode(node: ProgramNode, context: ExecutionContext): Promise<any> {
    const prompt = node.properties.config.prompt;
    const contextData = await context.getInputValue(node, 'context');
    const level = node.properties.config.level;
    
    thinkingFramework.setLevel(level);
    const result = await thinkingFramework.think(prompt, contextData);
    
    context.setOutputValue(node, 'result', result);
    
    const nextNode = context.getNextNode(node, 'flow');
    if (nextNode) {
      await this.executeNode(nextNode, context);
    }
    
    return result;
  }

  private async executeGenericNode(node: ProgramNode, context: ExecutionContext): Promise<any> {
    // Generic node execution
    const nextNode = context.getNextNode(node, 'flow');
    if (nextNode) {
      await this.executeNode(nextNode, context);
    }
  }

  async createDebugSession(program: VisualProgram, breakpoints?: string[]): Promise<DebugSession> {
    return new DebugSession(program, this, breakpoints);
  }
}

class ExecutionContext {
  private program: VisualProgram;
  private inputs: Record<string, any>;
  private variables: Map<string, any> = new Map();
  private outputs: Map<string, any> = new Map();
  private nodeOutputs: Map<string, Map<string, any>> = new Map();
  private startTime: number;

  constructor(program: VisualProgram, inputs: Record<string, any>) {
    this.program = program;
    this.inputs = inputs;
    this.startTime = Date.now();
    
    // Initialize global variables
    program.variables.forEach(v => {
      if (v.scope === 'global') {
        this.variables.set(v.name, v.value);
      }
    });
  }

  async getInputValue(node: ProgramNode, inputName: string): Promise<any> {
    const input = node.inputs.find(i => i.name === inputName);
    if (!input) return undefined;
    
    // Find connection to this input
    const connection = this.program.connections.find(
      c => c.target.nodeId === node.id && c.target.portId === input.id
    );
    
    if (!connection) {
      return input.defaultValue;
    }
    
    // Get value from source node output
    const sourceOutputs = this.nodeOutputs.get(connection.source.nodeId);
    if (sourceOutputs) {
      return sourceOutputs.get(connection.source.portId);
    }
    
    return undefined;
  }

  setOutputValue(node: ProgramNode, outputName: string, value: any): void {
    const output = node.outputs.find(o => o.name === outputName);
    if (!output) return;
    
    if (!this.nodeOutputs.has(node.id)) {
      this.nodeOutputs.set(node.id, new Map());
    }
    
    this.nodeOutputs.get(node.id)!.set(output.id, value);
  }

  getNextNode(node: ProgramNode, outputName: string): ProgramNode | null {
    const output = node.outputs.find(o => o.name === outputName);
    if (!output) return null;
    
    const connection = this.program.connections.find(
      c => c.source.nodeId === node.id && c.source.portId === output.id
    );
    
    if (!connection) return null;
    
    return this.program.nodes.find(n => n.id === connection.target.nodeId) || null;
  }

  setVariable(name: string, value: any): void {
    this.variables.set(name, value);
  }

  getVariable(name: string): any {
    return this.variables.get(name);
  }

  getOutputs(): Record<string, any> {
    return Object.fromEntries(this.outputs);
  }

  getVariables(): Record<string, any> {
    return Object.fromEntries(this.variables);
  }

  getExecutionTime(): number {
    return Date.now() - this.startTime;
  }
}

class DebugSession extends EventEmitter {
  private program: VisualProgram;
  private executor: ProgramExecutor;
  private breakpoints: Set<string>;
  private paused: boolean = false;
  private currentNode: string | null = null;

  constructor(program: VisualProgram, executor: ProgramExecutor, breakpoints?: string[]) {
    super();
    this.program = program;
    this.executor = executor;
    this.breakpoints = new Set(breakpoints || []);
  }

  async start(inputs: Record<string, any>): Promise<ExecutionResult> {
    // Execute with debugging
    return this.executor.execute(this.program, inputs);
  }

  pause(): void {
    this.paused = true;
  }

  resume(): void {
    this.paused = false;
    this.emit('resumed');
  }

  step(): void {
    // Step to next node
    this.emit('step', this.currentNode);
  }

  addBreakpoint(nodeId: string): void {
    this.breakpoints.add(nodeId);
  }

  removeBreakpoint(nodeId: string): void {
    this.breakpoints.delete(nodeId);
  }

  getState(): DebugState {
    return {
      paused: this.paused,
      currentNode: this.currentNode,
      breakpoints: Array.from(this.breakpoints)
    };
  }
}

class ProgramValidator {
  validateProgram(program: VisualProgram): ValidationResult {
    const errors: string[] = [];

    // Check for start node
    if (!program.nodes.find(n => n.type === NodeType.START)) {
      errors.push('Program must have a start node');
    }

    // Check for orphaned nodes
    const connectedNodes = new Set<string>();
    program.connections.forEach(c => {
      connectedNodes.add(c.source.nodeId);
      connectedNodes.add(c.target.nodeId);
    });

    program.nodes.forEach(node => {
      if (node.type !== NodeType.START && !connectedNodes.has(node.id)) {
        errors.push(`Node ${node.properties.label} is not connected`);
      }
    });

    // Validate connections
    program.connections.forEach(connection => {
      const validation = this.validateConnection(program, connection.source, connection.target);
      if (!validation.valid) {
        errors.push(validation.error!);
      }
    });

    return {
      valid: errors.length === 0,
      errors
    };
  }

  validateConnection(
    program: VisualProgram,
    source: ConnectionEndpoint,
    target: ConnectionEndpoint
  ): ConnectionValidation {
    const sourceNode = program.nodes.find(n => n.id === source.nodeId);
    const targetNode = program.nodes.find(n => n.id === target.nodeId);

    if (!sourceNode || !targetNode) {
      return { valid: false, error: 'Invalid node reference' };
    }

    const sourcePort = sourceNode.outputs.find(p => p.id === source.portId);
    const targetPort = targetNode.inputs.find(p => p.id === target.portId);

    if (!sourcePort || !targetPort) {
      return { valid: false, error: 'Invalid port reference' };
    }

    // Check data type compatibility
    if (sourcePort.type !== DataType.ANY && 
        targetPort.type !== DataType.ANY && 
        sourcePort.type !== targetPort.type) {
      return { 
        valid: false, 
        error: `Type mismatch: ${sourcePort.type} cannot connect to ${targetPort.type}` 
      };
    }

    // Check if port is already connected (for single connection ports)
    if (!targetPort.multiple) {
      const existingConnection = program.connections.find(
        c => c.target.nodeId === target.nodeId && c.target.portId === target.portId
      );
      if (existingConnection) {
        return { valid: false, error: 'Port already connected' };
      }
    }

    return { 
      valid: true, 
      dataType: sourcePort.type !== DataType.ANY ? sourcePort.type : targetPort.type 
    };
  }
}

class CodeGenerator {
  async generate(
    program: VisualProgram,
    language: CodeLanguage,
    options?: CodeGenOptions
  ): Promise<string> {
    switch (language) {
      case 'javascript':
        return this.generateJavaScript(program, options);
      case 'python':
        return this.generatePython(program, options);
      case 'typescript':
        return this.generateTypeScript(program, options);
      default:
        throw new Error(`Unsupported language: ${language}`);
    }
  }

  private generateJavaScript(program: VisualProgram, options?: CodeGenOptions): string {
    let code = '// Generated from visual program: ' + program.name + '\n\n';
    
    // Generate variables
    program.variables.forEach(v => {
      code += `let ${v.name} = ${JSON.stringify(v.value)};\n`;
    });
    
    code += '\n';
    
    // Generate main function
    code += 'async function main() {\n';
    
    // Generate node code
    // This is simplified - real implementation would traverse the graph
    program.nodes.forEach(node => {
      if (node.type === NodeType.VARIABLE) {
        // Variable nodes handled above
      } else if (node.type === NodeType.OUTPUT) {
        code += `  console.log(${node.properties.config.value || 'output'});\n`;
      }
    });
    
    code += '}\n\n';
    code += 'main().catch(console.error);\n';
    
    return code;
  }

  private generatePython(program: VisualProgram, options?: CodeGenOptions): string {
    let code = '# Generated from visual program: ' + program.name + '\n\n';
    
    // Generate imports
    code += 'import asyncio\n\n';
    
    // Generate variables
    program.variables.forEach(v => {
      code += `${v.name} = ${JSON.stringify(v.value)}\n`;
    });
    
    code += '\n';
    
    // Generate main function
    code += 'async def main():\n';
    
    // Generate node code
    program.nodes.forEach(node => {
      if (node.type === NodeType.OUTPUT) {
        code += `    print(${node.properties.config.value || 'output'})\n`;
      }
    });
    
    code += '\n';
    code += 'if __name__ == "__main__":\n';
    code += '    asyncio.run(main())\n';
    
    return code;
  }

  private generateTypeScript(program: VisualProgram, options?: CodeGenOptions): string {
    // Similar to JavaScript but with types
    return this.generateJavaScript(program, options);
  }
}

class AIAssistant {
  async suggestNextNode(
    program: VisualProgram,
    context?: SuggestionContext
  ): Promise<NodeSuggestion[]> {
    // Analyze program structure
    const analysis = await thinkingFramework.think(
      'Suggest the next logical node for this visual program',
      { program, context }
    );

    // Generate suggestions
    const suggestions: NodeSuggestion[] = [
      {
        type: NodeType.OUTPUT,
        reason: 'Display the result to the user',
        confidence: 0.9,
        position: this.calculateSuggestedPosition(program)
      }
    ];

    return suggestions;
  }

  async explainProgram(program: VisualProgram): Promise<ProgramExplanation> {
    const prompt = await promptEngineering.buildPrompt('structured-output', {
      output_type: 'program explanation',
      format_specification: 'Clear, user-friendly explanation',
      content: JSON.stringify(program)
    });

    const analysis = await thinkingFramework.think(prompt, { program });

    return {
      summary: analysis.solution.summary || 'This program processes data',
      steps: analysis.solution.steps || [],
      purpose: analysis.solution.purpose || 'Data processing',
      inputs: analysis.solution.inputs || [],
      outputs: analysis.solution.outputs || []
    };
  }

  async optimizeProgram(program: VisualProgram): Promise<OptimizationSuggestion[]> {
    thinkingFramework.setLevel('think_harder');
    const analysis = await thinkingFramework.think(
      'Analyze this visual program for optimization opportunities',
      { program }
    );

    const suggestions: OptimizationSuggestion[] = [];

    // Check for redundant nodes
    const nodeUsage = new Map<string, number>();
    program.connections.forEach(c => {
      nodeUsage.set(c.source.nodeId, (nodeUsage.get(c.source.nodeId) || 0) + 1);
      nodeUsage.set(c.target.nodeId, (nodeUsage.get(c.target.nodeId) || 0) + 1);
    });

    // Suggest optimizations based on analysis
    if (analysis.solution.optimizations) {
      suggestions.push(...analysis.solution.optimizations);
    }

    return suggestions;
  }

  async naturalLanguageToProgram(description: string): Promise<VisualProgram> {
    // Use ultrathink for complex program generation
    thinkingFramework.setLevel('ultrathink');
    
    const analysis = await thinkingFramework.think(
      'Convert this natural language description into a visual program',
      { description }
    );

    // Generate program structure
    const program: VisualProgram = {
      id: this.generateId(),
      name: analysis.solution.name || 'Generated Program',
      description: description,
      nodes: [],
      connections: [],
      variables: [],
      metadata: {
        created: new Date(),
        modified: new Date(),
        author: 'AI',
        tags: ['generated'],
        complexity: 'beginner'
      },
      version: '1.0.0'
    };

    // Add nodes based on analysis
    if (analysis.solution.nodes) {
      program.nodes = analysis.solution.nodes;
    } else {
      // Default simple program
      program.nodes = [
        {
          id: 'start',
          type: NodeType.START,
          category: NodeCategory.CONTROL,
          position: { x: 100, y: 100 },
          properties: { label: 'Start', config: {} },
          inputs: [],
          outputs: [{ id: 'out1', name: 'flow', type: DataType.FLOW, required: false, multiple: false }],
          state: { status: 'idle' }
        }
      ];
    }

    return program;
  }

  private calculateSuggestedPosition(program: VisualProgram): Position {
    // Find rightmost node
    let maxX = 0;
    let avgY = 0;
    
    program.nodes.forEach(node => {
      if (node.position.x > maxX) {
        maxX = node.position.x;
        avgY = node.position.y;
      }
    });

    return {
      x: maxX + 200,
      y: avgY
    };
  }

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Type Definitions

export interface NodeTemplate {
  type: NodeType;
  category: NodeCategory;
  defaultLabel: string;
  defaultConfig: Record<string, any>;
  inputs: PortTemplate[];
  outputs: PortTemplate[];
  validation?: ValidationRule[];
  help?: string;
}

export interface PortTemplate {
  name: string;
  type: DataType;
  required: boolean;
  multiple?: boolean;
  defaultValue?: any;
}

export interface ProgramTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  nodes: ProgramNode[];
  connections: Connection[];
  variables: Variable[];
}

export interface ExecutionResult {
  success: boolean;
  outputs: Record<string, any>;
  variables: Record<string, any>;
  executionTime: number;
  error?: string;
}

export interface DebugState {
  paused: boolean;
  currentNode: string | null;
  breakpoints: string[];
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export interface ConnectionValidation {
  valid: boolean;
  error?: string;
  dataType?: DataType;
}

export enum CodeLanguage {
  JAVASCRIPT = 'javascript',
  PYTHON = 'python',
  TYPESCRIPT = 'typescript'
}

export interface CodeGenOptions {
  style?: 'compact' | 'readable';
  includeComments?: boolean;
  asyncAwait?: boolean;
}

export enum ExportFormat {
  JSON = 'json',
  CODE = 'code',
  DOCUMENTATION = 'documentation',
  IMAGE = 'image'
}

export interface SuggestionContext {
  lastAction?: string;
  selectedNode?: string;
  cursorPosition?: Position;
}

export interface NodeSuggestion {
  type: NodeType;
  reason: string;
  confidence: number;
  position: Position;
}

export interface ProgramExplanation {
  summary: string;
  steps: string[];
  purpose: string;
  inputs: string[];
  outputs: string[];
}

export interface OptimizationSuggestion {
  type: 'remove' | 'replace' | 'merge' | 'reorder';
  nodeIds: string[];
  reason: string;
  impact: 'performance' | 'readability' | 'correctness';
  suggestion: string;
}

// Export singleton instance
export const visualProgramming = new VisualProgrammingInterface();