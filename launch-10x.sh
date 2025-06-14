#!/bin/bash

echo "🚀 Sales Tracker Pro 10X - Ultimate Edition"
echo "=========================================="
echo ""

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
PURPLE='\033[0;35m'
NC='\033[0m'

# ASCII Art Logo
echo -e "${PURPLE}"
cat << "EOF"
   _____ _______ _____    __  ____   _  __
  / ____|__   __|  __ \  /_ |/ __ \ | |/ /
 | (___    | |  | |__) |  | | |  | || ' / 
  \___ \   | |  |  ___/   | | |  | ||  <  
  ____) |  | |  | |       | | |__| || . \ 
 |_____/   |_|  |_|       |_|\____/ |_|\_\
                                           
            Sales Tracker Pro              
EOF
echo -e "${NC}"

# Check Node.js
echo -e "${BLUE}🔍 Checking environment...${NC}"
if ! command -v node &> /dev/null; then
    echo -e "${YELLOW}⚠️  Node.js is not installed${NC}"
    exit 1
fi

# Start Backend
echo -e "${BLUE}🔧 Starting backend server...${NC}"
cd backend
if lsof -i :10000 > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Backend already running${NC}"
else
    npm start > ../backend-10x.log 2>&1 &
    BACKEND_PID=$!
    echo "Backend PID: $BACKEND_PID"
    sleep 3
fi
cd ..

# Start Frontend
echo -e "${BLUE}🌐 Starting frontend server...${NC}"
if lsof -i :8000 > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Frontend already running${NC}"
else
    npx http-server -p 8000 -c-1 > frontend-10x.log 2>&1 &
    FRONTEND_PID=$!
    echo "Frontend PID: $FRONTEND_PID"
    sleep 2
fi

# Display URLs
echo ""
echo -e "${GREEN}✨ Sales Tracker Pro 10X is ready!${NC}"
echo ""
echo -e "${PURPLE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "${BLUE}📱 10X Enhanced App:${NC} http://localhost:8000/app-10x.html"
echo -e "${BLUE}🎨 Glassmorphism App:${NC} http://localhost:8000"
echo -e "${BLUE}🔧 Backend API:${NC} http://localhost:10000/api"
echo -e "${BLUE}🧪 Test Suite:${NC} ./run-10x-tests.sh"
echo ""
echo -e "${PURPLE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "${GREEN}✨ 10X Features Include:${NC}"
echo "   • 🤖 AI-powered insights and predictions"
echo "   • 🎯 Advanced gamification with achievements"
echo "   • 📊 Real-time analytics dashboard"
echo "   • 🎙️ Voice input commands"
echo "   • 👥 Team collaboration tools"
echo "   • 📱 Offline support with sync"
echo "   • 🔔 Smart notifications"
echo "   • 📈 Performance tracking"
echo "   • 🏆 Leaderboards and competitions"
echo "   • 💾 Data export capabilities"
echo ""
echo -e "${PURPLE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "${YELLOW}⌨️  Keyboard Shortcuts:${NC}"
echo "   • Cmd/Ctrl + K: Quick add activity"
echo "   • Cmd/Ctrl + /: Voice input"
echo "   • Esc: Close modals"
echo ""
echo -e "${BLUE}🎯 Quick Actions:${NC}"
echo "   1. Open app in browser"
echo "   2. Click 'Quick Add' to add activities"
echo "   3. Check AI insights in Analytics"
echo "   4. View achievements and badges"
echo "   5. Collaborate with team members"
echo ""
echo -e "${GREEN}Press Ctrl+C to stop all services${NC}"
echo ""

# Open in browser
echo -e "${BLUE}Opening in browser...${NC}"
sleep 1
if command -v open &> /dev/null; then
    open http://localhost:8000/app-10x.html
elif command -v xdg-open &> /dev/null; then
    xdg-open http://localhost:8000/app-10x.html
fi

# Cleanup function
cleanup() {
    echo ""
    echo -e "${YELLOW}🛑 Stopping services...${NC}"
    if [ ! -z "$BACKEND_PID" ]; then
        kill $BACKEND_PID 2>/dev/null
    fi
    if [ ! -z "$FRONTEND_PID" ]; then
        kill $FRONTEND_PID 2>/dev/null
    fi
    echo -e "${GREEN}👋 Thanks for using Sales Tracker Pro 10X!${NC}"
    exit 0
}

# Set up trap
trap cleanup INT

# Keep running
while true; do
    sleep 1
done