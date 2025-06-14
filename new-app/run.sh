#!/bin/bash

echo "🚀 Sales Tracker Pro - Clean Architecture Demo"
echo "============================================"
echo ""

# Install backend dependencies
echo "📦 Installing backend dependencies..."
cd backend
npm install
cd ..

# Install frontend dependencies
echo "📦 Installing frontend dependencies..."
cd frontend
npm install
cd ..

# Start backend
echo ""
echo "🔧 Starting backend server..."
cd backend
npm start &
BACKEND_PID=$!
cd ..

# Wait for backend
sleep 3

# Start frontend
echo "🎨 Starting frontend..."
cd frontend
npm run dev &
FRONTEND_PID=$!
cd ..

echo ""
echo "✨ Application is running!"
echo ""
echo "📱 Frontend: http://localhost:3000"
echo "🔧 Backend API: http://localhost:3001"
echo ""
echo "Features:"
echo "- Non-monolithic architecture"
echo "- Separate backend and frontend"
echo "- Simple in-memory database"
echo "- React components"
echo "- RESTful API"
echo "- Real-time updates on activity creation"
echo ""
echo "Press Ctrl+C to stop"

# Cleanup
cleanup() {
    echo ""
    echo "Stopping servers..."
    kill $BACKEND_PID 2>/dev/null
    kill $FRONTEND_PID 2>/dev/null
    exit
}

trap cleanup EXIT INT TERM

# Keep running
while true; do
    sleep 1
done