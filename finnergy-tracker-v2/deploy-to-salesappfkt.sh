#!/bin/bash

# Deploy Finnergy v2 to existing salesappfkt project as new services

echo "🚀 Deploying Finnergy v2 to salesappfkt project..."
echo "=================================================="

PROJECT_ID="salesappfkt"
gcloud config set project $PROJECT_ID

# Deploy Backend
echo ""
echo "📦 Deploying Backend API v2..."
cd backend

# Create minimal env config
cat > .env.yaml << EOF
env_variables:
  NODE_ENV: "production"
EOF

# Deploy backend as v2 service
echo "Deploying backend..."
gcloud app deploy app.yaml .env.yaml --quiet --project=$PROJECT_ID

# Clean up
rm -f .env.yaml

# Deploy Frontend
echo ""
echo "🎨 Deploying Frontend v2..."
cd ../public

# Update API URL
cp app.js app.js.backup
sed -i '' "s|https://finnergy-api-v2.as.r.appspot.com|https://finnergy-api-v2-dot-salesappfkt.as.r.appspot.com|g" app.js

# Deploy frontend
echo "Deploying frontend..."
gcloud app deploy app.yaml --quiet --project=$PROJECT_ID

# Restore original
mv app.js.backup app.js

echo ""
echo "✅ Deployment Complete!"
echo ""
echo "🔗 Your Finnergy v2 URLs:"
echo "   Frontend: https://finnergy-tracker-v2-dot-salesappfkt.as.r.appspot.com"
echo "   Backend: https://finnergy-api-v2-dot-salesappfkt.as.r.appspot.com"
echo ""
echo "🎨 Open your new glassmorphism UI app now!"