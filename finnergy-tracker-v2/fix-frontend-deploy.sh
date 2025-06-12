#!/bin/bash

echo "🔧 Fixing Frontend Deployment..."
echo "================================"

cd public

# Ensure we're in the right directory
echo "Current directory: $(pwd)"
echo "Files:"
ls -la

# Update API URL
sed -i '' "s|https://finnergy-api-v2.as.r.appspot.com|https://finnergy-api-v2-dot-salesappfkt.as.r.appspot.com|g" app.js

# Deploy frontend with explicit project
echo ""
echo "📦 Deploying frontend to finnergy-tracker-v2 service..."
gcloud app deploy app.yaml \
  --project=salesappfkt \
  --service=finnergy-tracker-v2 \
  --version=v2 \
  --quiet

# Also deploy to default service for a clean URL
echo ""
echo "📦 Also deploying to finnergy-v2 service..."
gcloud app deploy app.yaml \
  --project=salesappfkt \
  --service=finnergy-v2 \
  --version=v2 \
  --quiet

echo ""
echo "✅ Frontend deployment fixed!"
echo ""
echo "🔗 Try these URLs:"
echo "   https://finnergy-tracker-v2-dot-salesappfkt.as.r.appspot.com"
echo "   https://finnergy-v2-dot-salesappfkt.as.r.appspot.com"