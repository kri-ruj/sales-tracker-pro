/**
 * Prompt Engineering Toolkit
 * Advanced tools for crafting, testing, and optimizing prompts for Claude
 */

import { thinkingFramework, ThinkingLevel } from './thinking-framework';

export interface PromptTemplate {
  id: string;
  name: string;
  description: string;
  template: string;
  variables: PromptVariable[];
  examples: PromptExample[];
  performance: PromptPerformance;
  tags: string[];
}

export interface PromptVariable {
  name: string;
  type: 'text' | 'number' | 'boolean' | 'array' | 'object';
  required: boolean;
  description: string;
  default?: any;
  validation?: (value: any) => boolean;
}

export interface PromptExample {
  inputs: Record<string, any>;
  expectedOutput: string;
  actualOutput?: string;
  score?: number;
}

export interface PromptPerformance {
  avgTokens: number;
  avgLatency: number;
  successRate: number;
  coherenceScore: number;
  usageCount: number;
}

export interface PromptOptimizationResult {
  original: string;
  optimized: string;
  improvements: string[];
  performanceGain: number;
  tokenReduction: number;
}

export class PromptEngineeringToolkit {
  private templates: Map<string, PromptTemplate> = new Map();
  private promptHistory: Map<string, any> = new Map();
  private optimizationPatterns: Map<string, OptimizationPattern> = new Map();

  constructor() {
    this.initializeTemplates();
    this.initializeOptimizationPatterns();
  }

  private initializeTemplates() {
    // Chain of Thought Template
    this.templates.set('chain-of-thought', {
      id: 'chain-of-thought',
      name: 'Chain of Thought Reasoning',
      description: 'Guide Claude through step-by-step reasoning',
      template: `<thinking>
Let me work through this {{problem_type}} step by step.

First, I need to understand: {{context}}

Breaking this down:
1. {{step1}}
2. {{step2}}
3. {{step3}}

Key considerations:
- {{consideration1}}
- {{consideration2}}

Potential approaches:
{{approaches}}
</thinking>

Based on my analysis, {{conclusion}}`,
      variables: [
        { name: 'problem_type', type: 'text', required: true, description: 'Type of problem to solve' },
        { name: 'context', type: 'text', required: true, description: 'Problem context' },
        { name: 'step1', type: 'text', required: false, description: 'First step', default: 'Identify the core issue' },
        { name: 'step2', type: 'text', required: false, description: 'Second step', default: 'Analyze constraints' },
        { name: 'step3', type: 'text', required: false, description: 'Third step', default: 'Generate solutions' },
        { name: 'consideration1', type: 'text', required: false, description: 'Key consideration', default: 'Performance implications' },
        { name: 'consideration2', type: 'text', required: false, description: 'Another consideration', default: 'Edge cases' },
        { name: 'approaches', type: 'text', required: false, description: 'Possible approaches', default: 'Multiple solution paths...' },
        { name: 'conclusion', type: 'text', required: true, description: 'Expected conclusion format' }
      ],
      examples: [],
      performance: { avgTokens: 500, avgLatency: 2000, successRate: 0.92, coherenceScore: 0.88, usageCount: 0 },
      tags: ['reasoning', 'analysis', 'problem-solving']
    });

    // Few-Shot Learning Template
    this.templates.set('few-shot', {
      id: 'few-shot',
      name: 'Few-Shot Learning',
      description: 'Teach Claude by example',
      template: `I'll help you with {{task}}. Here are some examples:

{{#examples}}
Example {{index}}:
Input: {{input}}
Output: {{output}}

{{/examples}}

Now for your input: {{user_input}}

Following the pattern from the examples:`,
      variables: [
        { name: 'task', type: 'text', required: true, description: 'Task description' },
        { name: 'examples', type: 'array', required: true, description: 'Array of example objects' },
        { name: 'user_input', type: 'text', required: true, description: 'User input to process' }
      ],
      examples: [],
      performance: { avgTokens: 300, avgLatency: 1500, successRate: 0.89, coherenceScore: 0.91, usageCount: 0 },
      tags: ['learning', 'examples', 'pattern-matching']
    });

    // Role-Based Template
    this.templates.set('role-based', {
      id: 'role-based',
      name: 'Role-Based Interaction',
      description: 'Claude assumes a specific role or persona',
      template: `As {{role}} with expertise in {{expertise}}, I'll {{action}}.

My approach will be:
- {{approach1}}
- {{approach2}}
- {{approach3}}

{{#constraints}}
Important constraints:
{{constraints}}
{{/constraints}}

Let me {{task}}:`,
      variables: [
        { name: 'role', type: 'text', required: true, description: 'Role to assume' },
        { name: 'expertise', type: 'text', required: true, description: 'Areas of expertise' },
        { name: 'action', type: 'text', required: true, description: 'Primary action' },
        { name: 'approach1', type: 'text', required: false, description: 'First approach', default: 'Professional and thorough' },
        { name: 'approach2', type: 'text', required: false, description: 'Second approach', default: 'Evidence-based' },
        { name: 'approach3', type: 'text', required: false, description: 'Third approach', default: 'Clear communication' },
        { name: 'constraints', type: 'text', required: false, description: 'Any constraints to consider' },
        { name: 'task', type: 'text', required: true, description: 'Specific task to perform' }
      ],
      examples: [],
      performance: { avgTokens: 400, avgLatency: 1800, successRate: 0.91, coherenceScore: 0.93, usageCount: 0 },
      tags: ['role-play', 'expertise', 'persona']
    });

    // Structured Output Template
    this.templates.set('structured-output', {
      id: 'structured-output',
      name: 'Structured Output',
      description: 'Generate responses in specific formats',
      template: `I'll provide the {{output_type}} in the following format:

{{format_specification}}

{{#requirements}}
Requirements:
{{requirements}}
{{/requirements}}

Here's the {{output_type}}:

{{output_wrapper_start}}
{{content}}
{{output_wrapper_end}}`,
      variables: [
        { name: 'output_type', type: 'text', required: true, description: 'Type of output (JSON, XML, etc.)' },
        { name: 'format_specification', type: 'text', required: true, description: 'Format specification' },
        { name: 'requirements', type: 'text', required: false, description: 'Specific requirements' },
        { name: 'output_wrapper_start', type: 'text', required: false, description: 'Output wrapper start', default: '```json' },
        { name: 'content', type: 'text', required: true, description: 'Content template' },
        { name: 'output_wrapper_end', type: 'text', required: false, description: 'Output wrapper end', default: '```' }
      ],
      examples: [],
      performance: { avgTokens: 350, avgLatency: 1600, successRate: 0.94, coherenceScore: 0.96, usageCount: 0 },
      tags: ['structured', 'format', 'output']
    });

    // Creative Writing Template
    this.templates.set('creative-writing', {
      id: 'creative-writing',
      name: 'Creative Writing',
      description: 'Generate creative content with specific parameters',
      template: `I'll create {{content_type}} with the following characteristics:
- Style: {{style}}
- Tone: {{tone}}
- Length: {{length}}
{{#additional_params}}
- {{additional_params}}
{{/additional_params}}

{{#inspiration}}
Drawing inspiration from: {{inspiration}}
{{/inspiration}}

---

{{creative_output}}`,
      variables: [
        { name: 'content_type', type: 'text', required: true, description: 'Type of content' },
        { name: 'style', type: 'text', required: true, description: 'Writing style' },
        { name: 'tone', type: 'text', required: true, description: 'Tone of writing' },
        { name: 'length', type: 'text', required: true, description: 'Desired length' },
        { name: 'additional_params', type: 'text', required: false, description: 'Additional parameters' },
        { name: 'inspiration', type: 'text', required: false, description: 'Sources of inspiration' },
        { name: 'creative_output', type: 'text', required: true, description: 'The creative output placeholder' }
      ],
      examples: [],
      performance: { avgTokens: 600, avgLatency: 2500, successRate: 0.87, coherenceScore: 0.85, usageCount: 0 },
      tags: ['creative', 'writing', 'content']
    });
  }

  private initializeOptimizationPatterns() {
    // Token Reduction Pattern
    this.optimizationPatterns.set('token-reduction', {
      name: 'Token Reduction',
      description: 'Reduce token usage while maintaining clarity',
      detector: (prompt: string) => prompt.length > 500,
      optimizer: this.reduceTokens.bind(this),
      metrics: ['token_count', 'clarity_score']
    });

    // Clarity Enhancement Pattern
    this.optimizationPatterns.set('clarity-enhancement', {
      name: 'Clarity Enhancement',
      description: 'Improve prompt clarity and specificity',
      detector: (prompt: string) => this.detectVagueness(prompt),
      optimizer: this.enhanceClarity.bind(this),
      metrics: ['specificity_score', 'ambiguity_score']
    });

    // Context Optimization Pattern
    this.optimizationPatterns.set('context-optimization', {
      name: 'Context Optimization',
      description: 'Optimize context placement and relevance',
      detector: (prompt: string) => prompt.includes('context') || prompt.length > 1000,
      optimizer: this.optimizeContext.bind(this),
      metrics: ['context_relevance', 'information_density']
    });

    // Instruction Clarification Pattern
    this.optimizationPatterns.set('instruction-clarification', {
      name: 'Instruction Clarification',
      description: 'Make instructions more explicit and actionable',
      detector: (prompt: string) => this.detectUnclearInstructions(prompt),
      optimizer: this.clarifyInstructions.bind(this),
      metrics: ['instruction_clarity', 'actionability']
    });
  }

  // Main Methods

  async buildPrompt(templateId: string, variables: Record<string, any>): Promise<string> {
    const template = this.templates.get(templateId);
    if (!template) {
      throw new Error(`Template ${templateId} not found`);
    }

    // Validate variables
    this.validateVariables(template, variables);

    // Build prompt
    let prompt = template.template;

    // Replace variables
    for (const [key, value] of Object.entries(variables)) {
      const pattern = new RegExp(`{{${key}}}`, 'g');
      prompt = prompt.replace(pattern, value);

      // Handle conditional sections
      const conditionalPattern = new RegExp(`{{#${key}}}([\\s\\S]*?){{/${key}}}`, 'g');
      if (value) {
        prompt = prompt.replace(conditionalPattern, '$1');
      } else {
        prompt = prompt.replace(conditionalPattern, '');
      }
    }

    // Apply defaults for missing optional variables
    for (const variable of template.variables) {
      if (!variables[variable.name] && variable.default !== undefined) {
        const pattern = new RegExp(`{{${variable.name}}}`, 'g');
        prompt = prompt.replace(pattern, variable.default);
      }
    }

    // Clean up any remaining placeholders
    prompt = prompt.replace(/{{[^}]+}}/g, '');
    prompt = prompt.replace(/{{#[^}]+}}[\s\S]*?{{\/[^}]+}}/g, '');

    // Update usage statistics
    template.performance.usageCount++;

    return prompt.trim();
  }

  async optimizePrompt(prompt: string, goals: string[] = ['clarity', 'efficiency']): Promise<PromptOptimizationResult> {
    const original = prompt;
    let optimized = prompt;
    const improvements: string[] = [];
    let totalTokenReduction = 0;

    // Set thinking level for optimization
    thinkingFramework.setLevel('think_harder');

    // Analyze prompt with thinking framework
    const analysis = await thinkingFramework.think(
      `Optimize this prompt for ${goals.join(', ')}: ${prompt}`,
      { goals, promptLength: prompt.length }
    );

    // Apply optimization patterns
    for (const [patternName, pattern] of this.optimizationPatterns) {
      if (pattern.detector(optimized)) {
        const result = await pattern.optimizer(optimized, analysis);
        if (result.improved) {
          optimized = result.prompt;
          improvements.push(`Applied ${pattern.name}: ${result.improvement}`);
          totalTokenReduction += result.tokenReduction || 0;
        }
      }
    }

    // Calculate performance gain
    const performanceGain = this.calculatePerformanceGain(original, optimized, analysis);

    return {
      original,
      optimized,
      improvements,
      performanceGain,
      tokenReduction: totalTokenReduction
    };
  }

  async testPrompt(prompt: string, testCases: TestCase[]): Promise<TestResult> {
    const results: TestCaseResult[] = [];
    let totalScore = 0;

    for (const testCase of testCases) {
      const startTime = Date.now();
      
      // Simulate prompt execution (in real implementation, would call Claude)
      const response = await this.simulatePromptExecution(prompt, testCase.input);
      
      const latency = Date.now() - startTime;
      const score = this.evaluateResponse(response, testCase.expectedOutput, testCase.criteria);
      
      results.push({
        testCase,
        response,
        score,
        latency,
        passed: score >= (testCase.passingScore || 0.7)
      });
      
      totalScore += score;
    }

    const avgScore = totalScore / testCases.length;
    const avgLatency = results.reduce((sum, r) => sum + r.latency, 0) / results.length;

    return {
      prompt,
      results,
      summary: {
        totalTests: testCases.length,
        passed: results.filter(r => r.passed).length,
        failed: results.filter(r => !r.passed).length,
        averageScore: avgScore,
        averageLatency: avgLatency
      },
      recommendations: this.generateTestRecommendations(results)
    };
  }

  async generateVariations(basePrompt: string, count: number = 5): Promise<PromptVariation[]> {
    const variations: PromptVariation[] = [];

    // Set ultrathink for creative variations
    thinkingFramework.setLevel('ultrathink');

    const analysis = await thinkingFramework.think(
      `Generate ${count} variations of this prompt, each optimized for different goals: ${basePrompt}`,
      { basePrompt, count }
    );

    // Variation strategies
    const strategies = [
      { name: 'concise', modifier: this.makeConcise.bind(this) },
      { name: 'detailed', modifier: this.makeDetailed.bind(this) },
      { name: 'creative', modifier: this.makeCreative.bind(this) },
      { name: 'formal', modifier: this.makeFormal.bind(this) },
      { name: 'conversational', modifier: this.makeConversational.bind(this) },
      { name: 'structured', modifier: this.makeStructured.bind(this) },
      { name: 'example-driven', modifier: this.addExamples.bind(this) }
    ];

    for (let i = 0; i < Math.min(count, strategies.length); i++) {
      const strategy = strategies[i];
      const variedPrompt = await strategy.modifier(basePrompt, analysis);
      
      variations.push({
        id: `var-${i + 1}`,
        name: `${strategy.name} version`,
        prompt: variedPrompt,
        strategy: strategy.name,
        changes: this.identifyChanges(basePrompt, variedPrompt),
        estimatedPerformance: this.estimatePerformance(variedPrompt)
      });
    }

    return variations;
  }

  createPromptChain(prompts: ChainedPrompt[]): PromptChain {
    return {
      id: `chain-${Date.now()}`,
      prompts,
      execute: async (initialInput: any) => {
        let currentInput = initialInput;
        const results: any[] = [];

        for (const chainedPrompt of prompts) {
          const prompt = await this.buildPrompt(
            chainedPrompt.templateId || 'custom',
            { ...chainedPrompt.variables, previousOutput: currentInput }
          );

          const response = await this.simulatePromptExecution(prompt, currentInput);
          results.push(response);

          if (chainedPrompt.transformer) {
            currentInput = chainedPrompt.transformer(response);
          } else {
            currentInput = response;
          }
        }

        return {
          finalOutput: currentInput,
          intermediateResults: results
        };
      }
    };
  }

  // Optimization Methods

  private async reduceTokens(prompt: string, analysis: any): Promise<OptimizationResult> {
    // Remove redundancies
    let optimized = prompt
      .replace(/\b(\w+)\s+\1\b/gi, '$1') // Remove duplicate words
      .replace(/\s+/g, ' ') // Normalize whitespace
      .replace(/\n{3,}/g, '\n\n'); // Reduce multiple newlines

    // Simplify verbose phrases
    const verboseToSimple: Record<string, string> = {
      'in order to': 'to',
      'due to the fact that': 'because',
      'at this point in time': 'now',
      'in the event that': 'if',
      'for the purpose of': 'to',
      'with regard to': 'about',
      'in spite of the fact that': 'although'
    };

    for (const [verbose, simple] of Object.entries(verboseToSimple)) {
      optimized = optimized.replace(new RegExp(verbose, 'gi'), simple);
    }

    const tokenReduction = Math.round((prompt.length - optimized.length) / 4); // Rough token estimate

    return {
      prompt: optimized,
      improved: optimized !== prompt,
      improvement: `Reduced by approximately ${tokenReduction} tokens`,
      tokenReduction
    };
  }

  private async enhanceClarity(prompt: string, analysis: any): Promise<OptimizationResult> {
    let optimized = prompt;

    // Add structure markers
    if (!prompt.includes(':') && prompt.length > 100) {
      optimized = 'Task: ' + optimized;
    }

    // Clarify pronouns
    optimized = optimized.replace(/\bit\b/g, '[the subject]');
    optimized = optimized.replace(/\bthey\b/g, '[the items]');

    // Add specificity to vague terms
    const vagueToSpecific: Record<string, string> = {
      'things': 'items',
      'stuff': 'content',
      'good': 'effective',
      'bad': 'ineffective',
      'big': 'large',
      'small': 'compact'
    };

    for (const [vague, specific] of Object.entries(vagueToSpecific)) {
      optimized = optimized.replace(new RegExp(`\\b${vague}\\b`, 'gi'), specific);
    }

    return {
      prompt: optimized,
      improved: optimized !== prompt,
      improvement: 'Enhanced clarity by adding structure and specificity'
    };
  }

  private async optimizeContext(prompt: string, analysis: any): Promise<OptimizationResult> {
    // Move important context to the beginning
    const lines = prompt.split('\n');
    const contextLines = lines.filter(line => 
      line.toLowerCase().includes('context') || 
      line.toLowerCase().includes('background') ||
      line.toLowerCase().includes('given')
    );
    const otherLines = lines.filter(line => !contextLines.includes(line));

    const optimized = [...contextLines, '', ...otherLines].join('\n').trim();

    return {
      prompt: optimized,
      improved: optimized !== prompt,
      improvement: 'Reorganized context for better relevance'
    };
  }

  private async clarifyInstructions(prompt: string, analysis: any): Promise<OptimizationResult> {
    let optimized = prompt;

    // Add action verbs if missing
    if (!prompt.match(/^(create|write|analyze|explain|generate|list|describe|compare)/i)) {
      optimized = 'Please ' + optimized;
    }

    // Add output format specification if missing
    if (!prompt.includes('format') && !prompt.includes('structure')) {
      optimized += '\n\nProvide your response in a clear, structured format.';
    }

    return {
      prompt: optimized,
      improved: optimized !== prompt,
      improvement: 'Clarified instructions with action verbs and format specification'
    };
  }

  // Helper Methods

  private validateVariables(template: PromptTemplate, variables: Record<string, any>) {
    for (const varDef of template.variables) {
      if (varDef.required && !(varDef.name in variables)) {
        throw new Error(`Required variable '${varDef.name}' not provided`);
      }

      if (varDef.name in variables && varDef.validation) {
        if (!varDef.validation(variables[varDef.name])) {
          throw new Error(`Variable '${varDef.name}' failed validation`);
        }
      }
    }
  }

  private detectVagueness(prompt: string): boolean {
    const vagueWords = ['thing', 'stuff', 'it', 'they', 'some', 'good', 'bad', 'nice'];
    const words = prompt.toLowerCase().split(/\s+/);
    const vagueCount = words.filter(word => vagueWords.includes(word)).length;
    return vagueCount > 2;
  }

  private detectUnclearInstructions(prompt: string): boolean {
    const hasActionVerb = /^(create|write|analyze|explain|generate|list|describe|compare)/i.test(prompt);
    const hasOutputSpec = prompt.includes('format') || prompt.includes('structure') || prompt.includes('provide');
    return !hasActionVerb || !hasOutputSpec;
  }

  private calculatePerformanceGain(original: string, optimized: string, analysis: any): number {
    const tokenReduction = (original.length - optimized.length) / original.length;
    const clarityImprovement = this.detectVagueness(original) && !this.detectVagueness(optimized) ? 0.2 : 0;
    const structureImprovement = optimized.includes(':') && !original.includes(':') ? 0.1 : 0;
    
    return Math.min(1, Math.max(0, tokenReduction + clarityImprovement + structureImprovement));
  }

  private async simulatePromptExecution(prompt: string, input: any): Promise<string> {
    // In real implementation, this would call Claude API
    // For now, return a simulated response
    return `Simulated response for: ${prompt.substring(0, 50)}...`;
  }

  private evaluateResponse(response: string, expected: string, criteria: EvaluationCriteria[]): number {
    let totalScore = 0;
    let totalWeight = 0;

    for (const criterion of criteria) {
      const score = this.evaluateCriterion(response, expected, criterion);
      totalScore += score * criterion.weight;
      totalWeight += criterion.weight;
    }

    return totalWeight > 0 ? totalScore / totalWeight : 0;
  }

  private evaluateCriterion(response: string, expected: string, criterion: EvaluationCriteria): number {
    switch (criterion.type) {
      case 'exact_match':
        return response.trim() === expected.trim() ? 1 : 0;
      case 'contains':
        return response.includes(expected) ? 1 : 0;
      case 'similarity':
        return this.calculateSimilarity(response, expected);
      case 'length':
        const lengthRatio = response.length / expected.length;
        return 1 - Math.abs(1 - lengthRatio);
      case 'custom':
        return criterion.evaluator ? criterion.evaluator(response, expected) : 0;
      default:
        return 0;
    }
  }

  private calculateSimilarity(text1: string, text2: string): number {
    // Simple word-based similarity
    const words1 = new Set(text1.toLowerCase().split(/\s+/));
    const words2 = new Set(text2.toLowerCase().split(/\s+/));
    const intersection = new Set([...words1].filter(x => words2.has(x)));
    const union = new Set([...words1, ...words2]);
    return intersection.size / union.size;
  }

  private generateTestRecommendations(results: TestCaseResult[]): string[] {
    const recommendations: string[] = [];
    
    const failedTests = results.filter(r => !r.passed);
    if (failedTests.length > 0) {
      recommendations.push(`${failedTests.length} tests failed. Consider revising the prompt for better clarity.`);
    }

    const avgLatency = results.reduce((sum, r) => sum + r.latency, 0) / results.length;
    if (avgLatency > 3000) {
      recommendations.push('High average latency detected. Consider optimizing prompt length.');
    }

    const lowScores = results.filter(r => r.score < 0.5);
    if (lowScores.length > 0) {
      recommendations.push('Some responses scored poorly. Add more specific instructions or examples.');
    }

    return recommendations;
  }

  private identifyChanges(original: string, modified: string): string[] {
    const changes: string[] = [];
    
    if (modified.length < original.length * 0.8) {
      changes.push('Significantly shortened');
    } else if (modified.length > original.length * 1.2) {
      changes.push('Expanded with additional detail');
    }

    if (modified.includes('Example:') && !original.includes('Example:')) {
      changes.push('Added examples');
    }

    if (modified.split('\n').length > original.split('\n').length + 2) {
      changes.push('Added structure with line breaks');
    }

    return changes;
  }

  private estimatePerformance(prompt: string): PromptPerformance {
    const tokenEstimate = Math.round(prompt.length / 4);
    const complexityScore = this.calculateComplexity(prompt);
    
    return {
      avgTokens: tokenEstimate,
      avgLatency: tokenEstimate * 4, // Rough estimate
      successRate: Math.max(0.7, 1 - complexityScore * 0.2),
      coherenceScore: 0.85,
      usageCount: 0
    };
  }

  private calculateComplexity(prompt: string): number {
    const factors = {
      length: prompt.length / 1000,
      sentences: (prompt.match(/[.!?]+/g) || []).length / 10,
      technicalTerms: (prompt.match(/\b[A-Z][a-z]+[A-Z]\w*/g) || []).length / 5,
      nesting: (prompt.match(/\{|\[|\(/g) || []).length / 10
    };
    
    return Math.min(1, Object.values(factors).reduce((a, b) => a + b, 0) / 4);
  }

  // Variation Modifiers

  private async makeConcise(prompt: string, analysis: any): Promise<string> {
    return prompt
      .split(' ')
      .filter(word => !['the', 'a', 'an', 'very', 'really', 'quite'].includes(word.toLowerCase()))
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private async makeDetailed(prompt: string, analysis: any): Promise<string> {
    return `${prompt}

Please provide a comprehensive response that includes:
- Detailed explanations for each point
- Relevant examples where applicable
- Potential edge cases or exceptions
- Best practices and recommendations`;
  }

  private async makeCreative(prompt: string, analysis: any): Promise<string> {
    return `Approach this creatively: ${prompt}

Feel free to:
- Think outside conventional boundaries
- Propose innovative solutions
- Use analogies or metaphors
- Consider unconventional perspectives`;
  }

  private async makeFormal(prompt: string, analysis: any): Promise<string> {
    return `Formal Request: ${prompt}

Please ensure your response:
- Maintains professional tone
- Uses precise terminology
- Follows standard conventions
- Provides structured output`;
  }

  private async makeConversational(prompt: string, analysis: any): Promise<string> {
    return `Hey! ${prompt}

Feel free to be conversational and friendly in your response. Explain things like you're talking to a colleague.`;
  }

  private async makeStructured(prompt: string, analysis: any): Promise<string> {
    return `${prompt}

Please structure your response as follows:
1. Overview
2. Main Points
3. Supporting Details
4. Conclusion/Summary`;
  }

  private async addExamples(prompt: string, analysis: any): Promise<string> {
    return `${prompt}

Please include:
- At least 2-3 concrete examples
- Code snippets if applicable
- Real-world scenarios
- Step-by-step walkthroughs`;
  }
}

// Type Definitions

export interface OptimizationPattern {
  name: string;
  description: string;
  detector: (prompt: string) => boolean;
  optimizer: (prompt: string, analysis: any) => Promise<OptimizationResult>;
  metrics: string[];
}

export interface OptimizationResult {
  prompt: string;
  improved: boolean;
  improvement: string;
  tokenReduction?: number;
}

export interface TestCase {
  name: string;
  input: any;
  expectedOutput: string;
  criteria: EvaluationCriteria[];
  passingScore?: number;
}

export interface EvaluationCriteria {
  type: 'exact_match' | 'contains' | 'similarity' | 'length' | 'custom';
  weight: number;
  evaluator?: (response: string, expected: string) => number;
}

export interface TestCaseResult {
  testCase: TestCase;
  response: string;
  score: number;
  latency: number;
  passed: boolean;
}

export interface TestResult {
  prompt: string;
  results: TestCaseResult[];
  summary: {
    totalTests: number;
    passed: number;
    failed: number;
    averageScore: number;
    averageLatency: number;
  };
  recommendations: string[];
}

export interface PromptVariation {
  id: string;
  name: string;
  prompt: string;
  strategy: string;
  changes: string[];
  estimatedPerformance: PromptPerformance;
}

export interface ChainedPrompt {
  templateId?: string;
  prompt?: string;
  variables: Record<string, any>;
  transformer?: (output: any) => any;
}

export interface PromptChain {
  id: string;
  prompts: ChainedPrompt[];
  execute: (initialInput: any) => Promise<{
    finalOutput: any;
    intermediateResults: any[];
  }>;
}

// Export singleton instance
export const promptEngineering = new PromptEngineeringToolkit();