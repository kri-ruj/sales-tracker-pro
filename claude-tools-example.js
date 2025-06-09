#!/usr/bin/env node

/**
 * Claude Tools Example Usage
 * Demonstrates how to use the powerful Claude toolkit
 */

// Note: In a real implementation, you would compile the TypeScript files first
// For now, this shows the conceptual usage

console.log('🚀 Claude Tools Example\n');

// Example 1: Using Thinking Framework
console.log('1️⃣ Thinking Framework Example:');
console.log('----------------------------');
console.log(`
// Import the thinking framework
import { thinkingFramework } from './claude-tools/thinking-framework';

// Simple thinking
const result = await thinkingFramework.think(
  "How can I optimize my sales process?"
);
console.log(result.solution);

// Advanced thinking with ultrathink
thinkingFramework.setLevel('ultrathink');
const complexResult = await thinkingFramework.think(
  "Design a complete sales automation system",
  { 
    requirements: ['CRM integration', 'AI-powered insights', 'Mobile app'],
    constraints: ['Budget: $50k', 'Timeline: 3 months']
  }
);
console.log(complexResult);
`);

// Example 2: Code Review
console.log('\n2️⃣ Code Review Example:');
console.log('----------------------');
console.log(`
// Import code review system
import { codeReviewSystem } from './claude-tools/code-review-system';

const myCode = \`
function processData(data) {
  var result = [];
  for (var i = 0; i < data.length; i++) {
    if (data[i] > 10) {
      result.push(data[i] * 2);
    }
  }
  return result;
}
\`;

const review = await codeReviewSystem.reviewCode(myCode, {
  level: 'thorough',
  focus: ['performance', 'style', 'best-practices'],
  autoFix: true,
  suggestRefactoring: true
});

console.log('Issues found:', review.issues);
console.log('Fixed code:', review.fixedCode);
console.log('Refactoring suggestions:', review.refactorings);
`);

// Example 3: Documentation Generation
console.log('\n3️⃣ Documentation Generator Example:');
console.log('----------------------------------');
console.log(`
// Import documentation generator
import { docGenerator } from './claude-tools/doc-generator';

const docs = await docGenerator.generateDocumentation({
  name: 'My Awesome Project',
  files: [
    { path: 'index.js', content: yourCode },
    { path: 'utils.js', content: utilsCode }
  ]
}, {
  style: 'detailed',
  format: 'markdown',
  audience: 'developer',
  includeExamples: true,
  includeDiagrams: true
});

// Save the documentation
fs.writeFileSync('README.md', docs.sections.map(s => s.content).join('\\n\\n'));
`);

// Example 4: Visual Programming
console.log('\n4️⃣ Visual Programming Example:');
console.log('-----------------------------');
console.log(`
// Import visual programming
import { visualProgramming } from './claude-tools/visual-programming';

// Create a program without writing code!
const program = visualProgramming.createProgram('Email Automation');

// Add nodes
const trigger = program.addNode('input', {x: 100, y: 100}, {
  label: 'New Lead Trigger',
  config: { source: 'webhook' }
});

const ai = program.addNode('ai_generate', {x: 300, y: 100}, {
  label: 'Generate Email',
  config: { template: 'sales_outreach' }
});

const send = program.addNode('output', {x: 500, y: 100}, {
  label: 'Send Email',
  config: { service: 'smtp' }
});

// Connect nodes
program.connect(
  {nodeId: trigger.id, portId: 'output'},
  {nodeId: ai.id, portId: 'input'}
);
program.connect(
  {nodeId: ai.id, portId: 'output'},
  {nodeId: send.id, portId: 'input'}
);

// Run the program
const result = await program.runProgram({
  lead: { name: 'John Doe', email: 'john@example.com' }
});
`);

// Example 5: Voice Interface
console.log('\n5️⃣ Voice Interface Example:');
console.log('--------------------------');
console.log(`
// Import voice interface
import { createVoiceInterface } from './claude-tools/voice-interface';

// Create voice interface
const voice = createVoiceInterface({
  language: 'en',
  voice: { style: 'friendly' },
  continuousListening: true,
  wakeWord: 'hey claude'
});

// Start session
await voice.startSession();

// Handle voice commands
voice.on('transcript:final', async (text) => {
  console.log('User said:', text);
  
  if (text.includes('review my code')) {
    const review = await codeReviewSystem.reviewCode(currentCode);
    await voice.speak(\`I found \${review.issues.length} issues in your code.\`);
  }
});

// Natural conversation
await voice.speak("Hello! I'm Claude. How can I help you today?");
`);

// Example 6: Prompt Engineering
console.log('\n6️⃣ Prompt Engineering Example:');
console.log('------------------------------');
console.log(`
// Import prompt engineering toolkit
import { promptEngineering } from './claude-tools/prompt-engineering-toolkit';

// Build from template
const prompt = await promptEngineering.buildPrompt('chain-of-thought', {
  problem_type: 'customer churn analysis',
  context: 'SaaS business with 1000 customers',
  step1: 'Identify churn indicators',
  step2: 'Analyze customer behavior patterns',
  step3: 'Predict at-risk customers',
  conclusion: 'actionable retention strategies'
});

console.log('Generated prompt:', prompt);

// Optimize existing prompt
const optimized = await promptEngineering.optimizePrompt(
  "help me write better emails to customers",
  ['clarity', 'efficiency']
);

console.log('Optimized:', optimized.optimized);
console.log('Improvements:', optimized.improvements);

// Generate variations for A/B testing
const variations = await promptEngineering.generateVariations(prompt, 5);
variations.forEach(v => console.log(\`\${v.strategy}: \${v.prompt.substring(0, 50)}...\`));
`);

// Power User Example
console.log('\n🔥 Power User: Complete AI Pipeline');
console.log('-----------------------------------');
console.log(`
async function buildAIFeature(description) {
  // 1. Think deeply about the problem
  thinkingFramework.setLevel('ultrathink');
  const analysis = await thinkingFramework.think(description);
  
  // 2. Create visual program
  const program = await visualProgramming.convertNaturalLanguageToProgram(
    analysis.solution.implementation
  );
  
  // 3. Generate code
  const code = await visualProgramming.generateCode('typescript');
  
  // 4. Review and fix code
  const review = await codeReviewSystem.reviewCode(code, {
    level: 'ultrathink',
    autoFix: true
  });
  
  // 5. Generate documentation
  const docs = await docGenerator.generateDocumentation({
    name: analysis.solution.name,
    files: [{path: 'main.ts', content: review.fixedCode}]
  });
  
  // 6. Create usage examples with optimized prompts
  const examplePrompt = await promptEngineering.buildPrompt('few-shot', {
    task: 'API usage examples',
    examples: docs.sections.find(s => s.id === 'usage').examples
  });
  
  return {
    analysis,
    code: review.fixedCode,
    documentation: docs,
    examples: examplePrompt
  };
}

// Use it!
const feature = await buildAIFeature(
  "Build a recommendation engine that learns from user behavior"
);
`);

console.log('\n📚 Next Steps:');
console.log('--------------');
console.log('1. Install TypeScript: npm install -g typescript');
console.log('2. Compile the tools: tsc claude-tools/*.ts');
console.log('3. Import in your project and start building!');
console.log('4. Check ULTIMATE_CLAUDE_TOOLKIT.md for complete documentation');
console.log('\nHappy coding with Claude! 🚀');