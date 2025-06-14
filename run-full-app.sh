#!/bin/bash

echo "🚀 Starting Sales Tracker Pro - Full Stack"
echo "=========================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if backend is already running
if lsof -i :10000 > /dev/null 2>&1; then
    echo -e "${YELLOW}⚠️  Backend is already running on port 10000${NC}"
else
    # Start backend
    echo -e "${BLUE}🔧 Starting backend server...${NC}"
    cd backend
    npm start > ../backend.log 2>&1 &
    BACKEND_PID=$!
    cd ..
    
    # Wait for backend to start
    echo -e "${BLUE}⏳ Waiting for backend to start...${NC}"
    sleep 3
    
    # Check if backend started successfully
    if curl -s http://localhost:10000/health > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Backend is running on http://localhost:10000${NC}"
    else
        echo -e "${YELLOW}⚠️  Backend may still be starting up...${NC}"
    fi
fi

# Start frontend
echo ""
echo -e "${BLUE}🌐 Starting frontend server...${NC}"
npx http-server -p 8000 -c-1 > frontend.log 2>&1 &
FRONTEND_PID=$!

# Wait a moment
sleep 2

echo ""
echo -e "${GREEN}✨ Sales Tracker Pro is ready!${NC}"
echo ""
echo "📱 Frontend: http://localhost:8000"
echo "🔧 Backend API: http://localhost:10000/api"
echo "🧪 Test Page: http://localhost:8000/test-full-app.html"
echo ""
echo "📊 The app now features:"
echo "   • Modern glassmorphism UI with animated backgrounds"
echo "   • Real backend integration with Firestore database"
echo "   • Activity tracking and points system"
echo "   • Team leaderboard"
echo "   • Achievement system"
echo ""
echo "Press Ctrl+C to stop all services"
echo ""

# Function to cleanup on exit
cleanup() {
    echo ""
    echo "🛑 Stopping services..."
    if [ ! -z "$BACKEND_PID" ]; then
        kill $BACKEND_PID 2>/dev/null
    fi
    if [ ! -z "$FRONTEND_PID" ]; then
        kill $FRONTEND_PID 2>/dev/null
    fi
    echo "👋 Goodbye!"
    exit 0
}

# Set up trap to cleanup on Ctrl+C
trap cleanup INT

# Keep script running
while true; do
    sleep 1
done