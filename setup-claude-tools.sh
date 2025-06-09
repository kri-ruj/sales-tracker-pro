#!/bin/bash

echo "🚀 Setting up Claude Tools..."
echo "============================"

# Check if TypeScript is installed
if ! command -v tsc &> /dev/null; then
    echo "📦 Installing TypeScript globally..."
    npm install -g typescript
else
    echo "✅ TypeScript already installed"
fi

# Create tsconfig for claude-tools
echo "📝 Creating TypeScript configuration..."
cat > claude-tools/tsconfig.json << EOF
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["ES2020"],
    "outDir": "./dist",
    "rootDir": "./",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true
  },
  "include": ["*.ts"],
  "exclude": ["node_modules", "dist"]
}
EOF

# Compile TypeScript files
echo "🔨 Compiling Claude Tools..."
cd claude-tools
tsc

# Create package.json for claude-tools
echo "📦 Creating package.json for claude-tools..."
cat > package.json << EOF
{
  "name": "@claude/tools",
  "version": "1.0.0",
  "description": "Comprehensive Claude AI toolkit",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "scripts": {
    "build": "tsc",
    "watch": "tsc --watch"
  },
  "keywords": ["claude", "ai", "tools", "automation"],
  "author": "Claude Tools",
  "license": "MIT",
  "dependencies": {
    "events": "^3.3.0"
  }
}
EOF

# Create index file
echo "📄 Creating index file..."
cat > index.ts << EOF
// Claude Tools - Main Export File
export { thinkingFramework } from './thinking-framework';
export { codeReviewSystem } from './code-review-system';
export { docGenerator } from './doc-generator';
export { promptEngineering } from './prompt-engineering-toolkit';
export { collaborationSystem } from './collaboration-system';
export { pluginSystem } from './plugin-system';
export { createVoiceInterface } from './voice-interface';
export { visualProgramming } from './visual-programming';

// Export all types
export * from './thinking-framework';
export * from './code-review-system';
export * from './doc-generator';
export * from './prompt-engineering-toolkit';
export * from './collaboration-system';
export * from './plugin-system';
export * from './voice-interface';
export * from './visual-programming';
EOF

# Recompile with index
tsc

cd ..

echo ""
echo "✨ Claude Tools Setup Complete!"
echo "==============================="
echo ""
echo "📚 Quick Start:"
echo "   1. Import tools in your project:"
echo "      const { thinkingFramework } = require('./claude-tools/dist');"
echo ""
echo "   2. Or use ES6 imports with TypeScript:"
echo "      import { thinkingFramework } from './claude-tools';"
echo ""
echo "   3. Read the examples:"
echo "      node claude-tools-example.js"
echo ""
echo "   4. Check full documentation:"
echo "      open ULTIMATE_CLAUDE_TOOLKIT.md"
echo ""
echo "🎉 Happy coding with Claude!"