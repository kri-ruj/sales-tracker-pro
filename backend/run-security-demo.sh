#!/bin/bash

echo "🔒 FINNERGY Sales Tracker - Security Demo Setup"
echo "================================================"

# Check if in backend directory
if [ ! -f "package.json" ]; then
    echo "❌ Please run this script from the backend directory"
    exit 1
fi

# Check if dependencies are installed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

# Install chalk for colored output (optional)
if ! npm list chalk >/dev/null 2>&1; then
    echo "🎨 Installing chalk for colored output..."
    npm install --save-dev chalk
fi

# Run database migration
echo ""
echo "📊 Running database migration..."
node migrate-to-secure.js

# Start the secure server in background
echo ""
echo "🚀 Starting secure server..."
npm run start:secure &
SERVER_PID=$!

# Wait for server to start
echo "⏳ Waiting for server to start..."
sleep 3

# Check if server is running
if ! curl -s http://localhost:10000/health > /dev/null; then
    echo "❌ Server failed to start!"
    kill $SERVER_PID 2>/dev/null
    exit 1
fi

echo "✅ Server is running!"
echo ""
echo "🎬 Starting security demo..."
echo ""
sleep 2

# Run the demo
node demo-secure-api.js

# Stop the server
echo ""
echo "🛑 Stopping server..."
kill $SERVER_PID 2>/dev/null

echo ""
echo "✅ Demo complete!"
echo ""
echo "To run the secure server manually:"
echo "  npm run dev:secure    # Development with auto-reload"
echo "  npm run start:secure  # Production"
echo ""
echo "To run tests:"
echo "  npm test              # Run all tests"
echo "  npm run test:coverage # With coverage report"