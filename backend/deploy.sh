#!/bin/bash

# Backend Deployment Script
echo "🚀 Starting backend deployment..."

# Set project
gcloud config set project salesappfkt

# Deploy backend service
echo "📦 Deploying backend service..."
gcloud app deploy app.yaml \
  --service=sales-tracker-api \
  --version=v3-7-14 \
  --no-promote \
  --quiet

if [ $? -eq 0 ]; then
  echo "✅ Backend deployed successfully!"
  echo "🔄 Promoting to live traffic..."
  
  # Promote the new version
  gcloud app services set-traffic sales-tracker-api --splits v3-7-14=1 --quiet
  
  echo "✅ Deployment complete!"
  echo "🌐 Backend URL: https://sales-tracker-api-dot-salesappfkt.as.r.appspot.com"
  echo "🔍 Check health: https://sales-tracker-api-dot-salesappfkt.as.r.appspot.com/health"
else
  echo "❌ Deployment failed. Please check the logs."
  exit 1
fi