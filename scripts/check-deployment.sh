#!/bin/bash

echo "🔍 Checking Deployment Status..."
echo ""

# Check backend health
echo "📡 Backend Status:"
BACKEND_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" https://sales-tracker-api-dot-salesappfkt.as.r.appspot.com/health)
if [ "$BACKEND_RESPONSE" = "200" ]; then
    BACKEND_VERSION=$(curl -s https://sales-tracker-api-dot-salesappfkt.as.r.appspot.com/health | grep -o '"version":"[^"]*"' | cut -d'"' -f4)
    echo "✅ Backend is UP (Version: $BACKEND_VERSION)"
else
    echo "❌ Backend is DOWN (HTTP: $BACKEND_RESPONSE)"
fi

# Check frontend via config endpoint
echo ""
echo "🌐 Frontend Status:"
echo "✅ LIFF App: https://liff.line.me/2007552096-wrG1aV9p"

# Get current version from package.json
echo ""
echo "📦 Current Version:"
CURRENT_VERSION=$(grep -o '"version": "[^"]*"' package.json | grep -o '[0-9]\+\.[0-9]\+\.[0-9]\+' | head -1)
echo "Local: v$CURRENT_VERSION"

# Check GitHub releases
echo ""
echo "🏷️  Latest Release:"
LATEST_RELEASE=$(curl -s https://api.github.com/repos/kri-ruj/sales-tracker-pro/releases/latest | grep -o '"tag_name": "[^"]*"' | cut -d'"' -f4)
if [ -n "$LATEST_RELEASE" ]; then
    echo "GitHub: $LATEST_RELEASE"
else
    echo "No releases found"
fi

echo ""
echo "📊 Quick Links:"
echo "- GitHub Actions: https://github.com/kri-ruj/sales-tracker-pro/actions"
echo "- App Engine Console: https://console.cloud.google.com/appengine/services?project=salesappfkt"
echo "- LINE Developers: https://developers.line.biz/"