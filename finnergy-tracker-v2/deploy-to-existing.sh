#!/bin/bash

# Deploy Finnergy Tracker Pro v2 to existing GCP project

echo "🚀 Deploying Finnergy Tracker Pro v2 to salesappfkt..."
echo "======================================================"

PROJECT_ID="salesappfkt"
gcloud config set project $PROJECT_ID

# Deploy Backend
echo ""
echo "📦 Deploying Backend API..."
cd backend

# Install dependencies
echo "Installing dependencies..."
npm install --production

# Create environment config (using existing LINE credentials)
cat > .env.yaml << EOF
env_variables:
  NODE_ENV: "production"
  FIREBASE_PROJECT_ID: "$PROJECT_ID"
EOF

# Deploy backend as new service
echo "Deploying backend service..."
gcloud app deploy app.yaml --service=finnergy-api-v2 --quiet

# Clean up
rm -f .env.yaml

# Deploy Frontend
echo ""
echo "🎨 Deploying Frontend..."
cd ../public

# Update API URL to use new backend service
cp app.js app.js.backup
sed -i '' "s|https://finnergy-api-v2.as.r.appspot.com|https://finnergy-api-v2-dot-salesappfkt.as.r.appspot.com|g" app.js

# Deploy frontend as new service
echo "Deploying frontend service..."
gcloud app deploy app.yaml --service=finnergy-v2 --quiet

# Restore original app.js
mv app.js.backup app.js

echo ""
echo "✅ Deployment Complete!"
echo ""
echo "🔗 Your NEW app URLs:"
echo "   Frontend: https://finnergy-v2-dot-salesappfkt.as.r.appspot.com"
echo "   Backend API: https://finnergy-api-v2-dot-salesappfkt.as.r.appspot.com"
echo "   Health Check: https://finnergy-api-v2-dot-salesappfkt.as.r.appspot.com/health"
echo ""
echo "📱 You can create a new LIFF app pointing to:"
echo "   https://finnergy-v2-dot-salesappfkt.as.r.appspot.com"
echo ""
echo "✨ Your original app remains at:"
echo "   https://frontend-dot-salesappfkt.as.r.appspot.com"