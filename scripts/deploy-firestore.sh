#!/bin/bash
# Deploy Sales Tracker Pro to GCP

echo "🚀 Deploying Sales Tracker Pro to GCP"
echo "===================================="

# Navigate to backend
cd backend

# Install dependencies
echo "📦 Installing dependencies..."
npm install --production

# Deploy to App Engine
echo "☁️  Deploying to App Engine..."
CLOUDSDK_PYTHON=/usr/bin/python3 gcloud app deploy app.yaml.secure \
  --project=salesappfkt \
  --quiet \
  --version=firestore

echo "✅ Deployment complete!"
echo "Backend URL: https://sales-tracker-api-dot-salesappfkt.as.r.appspot.com"
