/**
 * Claude-Optimized Code Review and Refactoring System
 * Provides intelligent code analysis, review, and automated refactoring
 */

import { thinkingFramework } from './thinking-framework';

export interface CodeReviewConfig {
  level: 'basic' | 'standard' | 'thorough' | 'ultrathink';
  focus: string[];
  autoFix: boolean;
  suggestRefactoring: boolean;
}

export interface CodeIssue {
  severity: 'error' | 'warning' | 'info' | 'suggestion';
  type: string;
  line: number;
  column: number;
  message: string;
  fix?: CodeFix;
}

export interface CodeFix {
  description: string;
  oldCode: string;
  newCode: string;
  impact: 'safe' | 'moderate' | 'breaking';
}

export interface RefactoringPattern {
  name: string;
  description: string;
  detector: (code: string) => boolean;
  refactor: (code: string) => string;
  benefits: string[];
}

export class CodeReviewSystem {
  private patterns: Map<string, RefactoringPattern> = new Map();
  private reviewHistory: Map<string, any> = new Map();

  constructor() {
    this.initializePatterns();
  }

  private initializePatterns() {
    // Common refactoring patterns
    this.patterns.set('extract-method', {
      name: 'Extract Method',
      description: 'Extract repeated code into a reusable method',
      detector: (code) => this.detectDuplicateCode(code),
      refactor: (code) => this.extractMethod(code),
      benefits: ['Reduces duplication', 'Improves readability', 'Easier testing']
    });

    this.patterns.set('introduce-parameter-object', {
      name: 'Introduce Parameter Object',
      description: 'Group related parameters into an object',
      detector: (code) => this.detectLongParameterList(code),
      refactor: (code) => this.introduceParameterObject(code),
      benefits: ['Cleaner API', 'Easier to extend', 'Better encapsulation']
    });

    this.patterns.set('replace-conditional-with-polymorphism', {
      name: 'Replace Conditional with Polymorphism',
      description: 'Replace complex conditionals with polymorphic behavior',
      detector: (code) => this.detectComplexConditionals(code),
      refactor: (code) => this.replaceWithPolymorphism(code),
      benefits: ['More extensible', 'Follows Open/Closed principle', 'Cleaner code']
    });

    this.patterns.set('extract-interface', {
      name: 'Extract Interface',
      description: 'Extract common interface from similar classes',
      detector: (code) => this.detectSimilarClasses(code),
      refactor: (code) => this.extractInterface(code),
      benefits: ['Better abstraction', 'Looser coupling', 'Easier mocking']
    });

    this.patterns.set('simplify-boolean-expression', {
      name: 'Simplify Boolean Expression',
      description: 'Simplify complex boolean logic',
      detector: (code) => this.detectComplexBooleans(code),
      refactor: (code) => this.simplifyBooleans(code),
      benefits: ['More readable', 'Less error-prone', 'Better performance']
    });
  }

  async reviewCode(code: string, config: CodeReviewConfig): Promise<CodeReviewResult> {
    // Set thinking level based on review config
    const thinkLevel = this.mapConfigToThinkingLevel(config.level);
    thinkingFramework.setLevel(thinkLevel);

    // Perform deep analysis
    const analysis = await thinkingFramework.think(
      `Review this code for: ${config.focus.join(', ')}`,
      { code, config }
    );

    // Extract issues from analysis
    const issues = await this.extractIssues(code, analysis, config);

    // Suggest refactorings if enabled
    const refactorings = config.suggestRefactoring 
      ? await this.suggestRefactorings(code, analysis)
      : [];

    // Generate overall assessment
    const assessment = this.generateAssessment(issues, refactorings, analysis);

    // Apply automatic fixes if enabled
    const fixedCode = config.autoFix 
      ? await this.applyAutoFixes(code, issues)
      : null;

    return {
      originalCode: code,
      fixedCode,
      issues,
      refactorings,
      assessment,
      metrics: this.calculateCodeMetrics(code),
      analysis: analysis.solution
    };
  }

  private mapConfigToThinkingLevel(level: string): 'think' | 'think_hard' | 'think_harder' | 'ultrathink' {
    const mapping: Record<string, any> = {
      'basic': 'think',
      'standard': 'think_hard',
      'thorough': 'think_harder',
      'ultrathink': 'ultrathink'
    };
    return mapping[level] || 'think';
  }

  private async extractIssues(code: string, analysis: any, config: CodeReviewConfig): Promise<CodeIssue[]> {
    const issues: CodeIssue[] = [];

    // Security issues
    if (config.focus.includes('security')) {
      issues.push(...this.detectSecurityIssues(code));
    }

    // Performance issues
    if (config.focus.includes('performance')) {
      issues.push(...this.detectPerformanceIssues(code));
    }

    // Code style issues
    if (config.focus.includes('style')) {
      issues.push(...this.detectStyleIssues(code));
    }

    // Best practices
    if (config.focus.includes('best-practices')) {
      issues.push(...this.detectBestPracticeViolations(code));
    }

    // Bug detection
    if (config.focus.includes('bugs')) {
      issues.push(...this.detectPotentialBugs(code));
    }

    return issues;
  }

  private detectSecurityIssues(code: string): CodeIssue[] {
    const issues: CodeIssue[] = [];
    const lines = code.split('\n');

    lines.forEach((line, index) => {
      // SQL Injection
      if (line.match(/query.*\+.*['"]/i) || line.match(/exec\(.*\+/i)) {
        issues.push({
          severity: 'error',
          type: 'security/sql-injection',
          line: index + 1,
          column: 0,
          message: 'Potential SQL injection vulnerability. Use parameterized queries.',
          fix: {
            description: 'Use parameterized query',
            oldCode: line,
            newCode: '// Use prepared statements or query builders',
            impact: 'safe'
          }
        });
      }

      // XSS
      if (line.match(/innerHTML\s*=/) || line.match(/document\.write/)) {
        issues.push({
          severity: 'warning',
          type: 'security/xss',
          line: index + 1,
          column: line.indexOf('innerHTML'),
          message: 'Potential XSS vulnerability. Sanitize user input.',
          fix: {
            description: 'Use textContent or sanitize HTML',
            oldCode: line,
            newCode: line.replace('innerHTML', 'textContent'),
            impact: 'moderate'
          }
        });
      }

      // Hardcoded secrets
      if (line.match(/password\s*=\s*['"]\w+['"]/) || line.match(/api[_-]?key\s*=\s*['"]/i)) {
        issues.push({
          severity: 'error',
          type: 'security/hardcoded-secret',
          line: index + 1,
          column: 0,
          message: 'Hardcoded secret detected. Use environment variables.',
          fix: {
            description: 'Move to environment variable',
            oldCode: line,
            newCode: '// Use process.env.SECRET_NAME',
            impact: 'safe'
          }
        });
      }
    });

    return issues;
  }

  private detectPerformanceIssues(code: string): CodeIssue[] {
    const issues: CodeIssue[] = [];
    const lines = code.split('\n');

    lines.forEach((line, index) => {
      // N+1 queries
      if (line.match(/for.*await.*fetch|query/)) {
        issues.push({
          severity: 'warning',
          type: 'performance/n-plus-one',
          line: index + 1,
          column: 0,
          message: 'Potential N+1 query problem. Consider batch loading.',
        });
      }

      // Inefficient array operations
      if (line.match(/\.filter\(.*\)\.map\(/)) {
        issues.push({
          severity: 'info',
          type: 'performance/array-chain',
          line: index + 1,
          column: 0,
          message: 'Consider using reduce() for better performance.',
          fix: {
            description: 'Combine filter and map into reduce',
            oldCode: line,
            newCode: '// Use array.reduce() instead',
            impact: 'safe'
          }
        });
      }

      // Missing memoization
      if (line.match(/function.*expensive|calculate|compute/i)) {
        issues.push({
          severity: 'suggestion',
          type: 'performance/memoization',
          line: index + 1,
          column: 0,
          message: 'Consider memoizing this expensive function.',
        });
      }
    });

    return issues;
  }

  private async suggestRefactorings(code: string, analysis: any): Promise<RefactoringSuggestion[]> {
    const suggestions: RefactoringSuggestion[] = [];

    for (const [name, pattern] of this.patterns) {
      if (pattern.detector(code)) {
        const preview = await this.generateRefactoringPreview(code, pattern);
        suggestions.push({
          pattern: name,
          description: pattern.description,
          benefits: pattern.benefits,
          preview,
          confidence: this.calculateRefactoringConfidence(code, pattern)
        });
      }
    }

    return suggestions.sort((a, b) => b.confidence - a.confidence);
  }

  private calculateCodeMetrics(code: string): CodeMetrics {
    const lines = code.split('\n');
    const nonEmptyLines = lines.filter(l => l.trim().length > 0);
    const functions = code.match(/function\s+\w+|=>\s*{|class\s+\w+/g) || [];
    
    return {
      linesOfCode: lines.length,
      cyclomaticComplexity: this.calculateCyclomaticComplexity(code),
      maintainabilityIndex: this.calculateMaintainabilityIndex(code),
      cognitiveComplexity: this.calculateCognitiveComplexity(code),
      testCoverage: this.estimateTestCoverage(code),
      duplicateCodeRatio: this.calculateDuplicationRatio(code),
      commentRatio: this.calculateCommentRatio(code),
      functionsCount: functions.length,
      averageFunctionLength: nonEmptyLines.length / Math.max(1, functions.length)
    };
  }

  private generateAssessment(issues: CodeIssue[], refactorings: RefactoringSuggestion[], analysis: any): CodeAssessment {
    const severityCounts = {
      error: issues.filter(i => i.severity === 'error').length,
      warning: issues.filter(i => i.severity === 'warning').length,
      info: issues.filter(i => i.severity === 'info').length,
      suggestion: issues.filter(i => i.severity === 'suggestion').length
    };

    const score = Math.max(0, 100 - (severityCounts.error * 10) - (severityCounts.warning * 5) - (severityCounts.info * 2));

    return {
      overallScore: score,
      grade: this.scoreToGrade(score),
      summary: this.generateSummary(severityCounts, refactorings),
      strengths: this.identifyStrengths(analysis),
      improvements: this.identifyImprovements(issues, refactorings),
      severityCounts,
      topIssues: issues.slice(0, 5),
      recommendedActions: this.generateRecommendedActions(issues, refactorings)
    };
  }

  private scoreToGrade(score: number): string {
    if (score >= 90) return 'A';
    if (score >= 80) return 'B';
    if (score >= 70) return 'C';
    if (score >= 60) return 'D';
    return 'F';
  }

  // Helper methods
  private detectDuplicateCode(code: string): boolean {
    // Simplified duplicate detection
    const lines = code.split('\n');
    const lineSet = new Set(lines.filter(l => l.trim().length > 10));
    return lines.length - lineSet.size > 5;
  }

  private detectLongParameterList(code: string): boolean {
    const functionMatches = code.match(/function.*\(([^)]+)\)/g) || [];
    return functionMatches.some(match => {
      const params = match.split(',');
      return params.length > 4;
    });
  }

  private detectComplexConditionals(code: string): boolean {
    const conditionals = code.match(/if.*{[\s\S]*?}/g) || [];
    return conditionals.some(cond => {
      const lines = cond.split('\n');
      return lines.length > 10 || cond.includes('else if') && cond.split('else if').length > 3;
    });
  }

  private detectSimilarClasses(code: string): boolean {
    const classes = code.match(/class\s+\w+/g) || [];
    return classes.length > 2;
  }

  private detectComplexBooleans(code: string): boolean {
    return /if.*&&.*\|\|.*&&/.test(code) || /return.*&&.*\|\|.*&&/.test(code);
  }

  private extractMethod(code: string): string {
    // Simplified extraction
    return code; // Would implement actual extraction logic
  }

  private introduceParameterObject(code: string): string {
    // Simplified parameter object introduction
    return code; // Would implement actual refactoring
  }

  private replaceWithPolymorphism(code: string): string {
    // Simplified polymorphism replacement
    return code; // Would implement actual refactoring
  }

  private extractInterface(code: string): string {
    // Simplified interface extraction
    return code; // Would implement actual extraction
  }

  private simplifyBooleans(code: string): string {
    // Simplified boolean simplification
    return code.replace(/!!/, '').replace(/=== true/, '').replace(/=== false/, '!');
  }

  private detectStyleIssues(code: string): CodeIssue[] {
    return []; // Would implement style checking
  }

  private detectBestPracticeViolations(code: string): CodeIssue[] {
    return []; // Would implement best practice checking
  }

  private detectPotentialBugs(code: string): CodeIssue[] {
    return []; // Would implement bug detection
  }

  private async applyAutoFixes(code: string, issues: CodeIssue[]): Promise<string> {
    let fixedCode = code;
    const safeIssues = issues.filter(i => i.fix?.impact === 'safe');
    
    for (const issue of safeIssues) {
      if (issue.fix) {
        fixedCode = fixedCode.replace(issue.fix.oldCode, issue.fix.newCode);
      }
    }
    
    return fixedCode;
  }

  private async generateRefactoringPreview(code: string, pattern: RefactoringPattern): Promise<string> {
    return pattern.refactor(code);
  }

  private calculateRefactoringConfidence(code: string, pattern: RefactoringPattern): number {
    return 0.8; // Simplified confidence calculation
  }

  private calculateCyclomaticComplexity(code: string): number {
    const decisionPoints = (code.match(/if|while|for|case|catch|\?|&&|\|\|/g) || []).length;
    return decisionPoints + 1;
  }

  private calculateMaintainabilityIndex(code: string): number {
    const complexity = this.calculateCyclomaticComplexity(code);
    const lines = code.split('\n').length;
    return Math.max(0, 171 - 5.2 * Math.log(complexity) - 0.23 * Math.log(lines));
  }

  private calculateCognitiveComplexity(code: string): number {
    return this.calculateCyclomaticComplexity(code) * 1.2; // Simplified
  }

  private estimateTestCoverage(code: string): number {
    return 0; // Would need actual test information
  }

  private calculateDuplicationRatio(code: string): number {
    const lines = code.split('\n');
    const uniqueLines = new Set(lines.filter(l => l.trim().length > 10));
    return 1 - (uniqueLines.size / lines.length);
  }

  private calculateCommentRatio(code: string): number {
    const totalLines = code.split('\n').length;
    const commentLines = (code.match(/\/\/|\/\*|\*/g) || []).length;
    return commentLines / totalLines;
  }

  private generateSummary(severityCounts: any, refactorings: RefactoringSuggestion[]): string {
    return `Found ${severityCounts.error} errors, ${severityCounts.warning} warnings. ${refactorings.length} refactoring opportunities available.`;
  }

  private identifyStrengths(analysis: any): string[] {
    return ['Good structure', 'Clear naming']; // Would analyze actual strengths
  }

  private identifyImprovements(issues: CodeIssue[], refactorings: RefactoringSuggestion[]): string[] {
    const improvements = [];
    if (issues.some(i => i.type.includes('security'))) improvements.push('Address security vulnerabilities');
    if (issues.some(i => i.type.includes('performance'))) improvements.push('Optimize performance bottlenecks');
    if (refactorings.length > 0) improvements.push('Apply suggested refactorings');
    return improvements;
  }

  private generateRecommendedActions(issues: CodeIssue[], refactorings: RefactoringSuggestion[]): string[] {
    const actions = [];
    const errors = issues.filter(i => i.severity === 'error');
    if (errors.length > 0) actions.push(`Fix ${errors.length} critical errors immediately`);
    if (refactorings.length > 0) actions.push(`Consider ${refactorings[0].description}`);
    return actions;
  }
}

// Type definitions
export interface CodeReviewResult {
  originalCode: string;
  fixedCode: string | null;
  issues: CodeIssue[];
  refactorings: RefactoringSuggestion[];
  assessment: CodeAssessment;
  metrics: CodeMetrics;
  analysis: any;
}

export interface RefactoringSuggestion {
  pattern: string;
  description: string;
  benefits: string[];
  preview: string;
  confidence: number;
}

export interface CodeAssessment {
  overallScore: number;
  grade: string;
  summary: string;
  strengths: string[];
  improvements: string[];
  severityCounts: any;
  topIssues: CodeIssue[];
  recommendedActions: string[];
}

export interface CodeMetrics {
  linesOfCode: number;
  cyclomaticComplexity: number;
  maintainabilityIndex: number;
  cognitiveComplexity: number;
  testCoverage: number;
  duplicateCodeRatio: number;
  commentRatio: number;
  functionsCount: number;
  averageFunctionLength: number;
}

// Export singleton instance
export const codeReviewSystem = new CodeReviewSystem();