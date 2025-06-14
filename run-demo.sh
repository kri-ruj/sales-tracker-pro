#!/bin/bash

# Sales Tracker Pro - Simple Demo Runner

echo "🚀 Sales Tracker Pro - Demo"
echo "==========================="
echo ""

# Check if backend server is already set up
if [ ! -f "backend/.env" ]; then
    echo "📝 Creating backend .env file..."
    cat > backend/.env <<EOF
PORT=10000
LINE_CHANNEL_ACCESS_TOKEN=demo-token
LINE_CHANNEL_SECRET=demo-secret
NODE_ENV=development
ENABLE_DEMO_MODE=true
EOF
fi

# Start backend
echo "🔧 Starting backend server..."
cd backend
npm start &
BACKEND_PID=$!
cd ..

echo "⏳ Waiting for backend to start..."
sleep 5

# Check if backend is running
if curl -s http://localhost:10000/health > /dev/null 2>&1; then
    echo "✅ Backend running on http://localhost:10000"
else
    echo "❌ Backend failed to start"
    kill $BACKEND_PID 2>/dev/null
    exit 1
fi

# Start frontend
echo "🎨 Starting frontend..."
python3 -m http.server 8000 &
FRONTEND_PID=$!

echo ""
echo "✨ Demo is running!"
echo ""
echo "📱 Frontend: http://localhost:8000"
echo "🔧 Backend API: http://localhost:10000"
echo ""
echo "Demo Features:"
echo "- Login with Demo Mode"
echo "- Track activities and earn points"
echo "- View leaderboard"
echo "- Mobile-responsive design"
echo ""
echo "Press Ctrl+C to stop"
echo ""

# Cleanup function
cleanup() {
    echo ""
    echo "🛑 Stopping servers..."
    kill $BACKEND_PID 2>/dev/null
    kill $FRONTEND_PID 2>/dev/null
    exit
}

trap cleanup EXIT INT TERM

# Keep running
while true; do
    sleep 1
done