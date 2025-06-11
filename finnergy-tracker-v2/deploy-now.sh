#!/bin/bash

# Finnergy Tracker Pro v2 - Quick Deploy Script

echo "🚀 Deploying Finnergy Tracker Pro v2..."
echo "======================================="

# Use a unique project ID with timestamp
PROJECT_ID="finnergy-pro-v2-$(date +%s)"
echo "📋 Creating new project: $PROJECT_ID"

# Create new project
gcloud projects create $PROJECT_ID --name="Finnergy Tracker Pro v2" || {
    echo "❌ Failed to create project. Trying with existing project..."
    PROJECT_ID="salesappfkt"
}

# Set the project
gcloud config set project $PROJECT_ID

# Enable required APIs
echo "🔧 Enabling required APIs..."
gcloud services enable appengine.googleapis.com --quiet
gcloud services enable firestore.googleapis.com --quiet
gcloud services enable cloudbuild.googleapis.com --quiet

# Check if App Engine app exists
if ! gcloud app describe &> /dev/null; then
    echo "📱 Creating App Engine app..."
    gcloud app create --region=asia-southeast1 --quiet
fi

# Deploy Backend
echo ""
echo "📦 Deploying Backend API..."
cd backend

# Install dependencies
npm install --production

# Create environment config
cat > .env.yaml << EOF
env_variables:
  NODE_ENV: "production"
  LINE_CHANNEL_ACCESS_TOKEN: "$(echo $LINE_CHANNEL_ACCESS_TOKEN)"
  LINE_CHANNEL_SECRET: "$(echo $LINE_CHANNEL_SECRET)"
  FIREBASE_PROJECT_ID: "$PROJECT_ID"
EOF

# Deploy backend
gcloud app deploy app.yaml .env.yaml --service=finnergy-api-v2 --quiet --version=v2

# Clean up
rm -f .env.yaml

# Deploy Frontend
echo ""
echo "🎨 Deploying Frontend..."
cd ../public

# Update API URL
sed -i.bak "s|https://finnergy-api-v2.as.r.appspot.com|https://finnergy-api-v2-dot-$PROJECT_ID.as.r.appspot.com|g" app.js

# Deploy frontend
gcloud app deploy app.yaml --service=finnergy-tracker-v2 --quiet --version=v2

# Restore original app.js
mv app.js.bak app.js

# Set traffic to new version
echo ""
echo "🔄 Routing traffic to new version..."
gcloud app services set-traffic finnergy-tracker-v2 --splits=v2=100 --quiet || true
gcloud app services set-traffic finnergy-api-v2 --splits=v2=100 --quiet || true

echo ""
echo "✅ Deployment Complete!"
echo ""
echo "🔗 Your app URLs:"
echo "   Frontend: https://finnergy-tracker-v2-dot-$PROJECT_ID.as.r.appspot.com"
echo "   Backend API: https://finnergy-api-v2-dot-$PROJECT_ID.as.r.appspot.com"
echo "   Health Check: https://finnergy-api-v2-dot-$PROJECT_ID.as.r.appspot.com/health"
echo ""
echo "📱 LIFF URL: https://liff.line.me/2007552096-wrG1aV9p"
echo ""
echo "⚠️  Next Steps:"
echo "1. Update LIFF endpoint URL in LINE Developers Console to:"
echo "   https://finnergy-tracker-v2-dot-$PROJECT_ID.as.r.appspot.com"
echo "2. Set up Firestore in Firebase Console for project: $PROJECT_ID"