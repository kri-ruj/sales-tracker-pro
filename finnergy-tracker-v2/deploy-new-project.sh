#!/bin/bash

# Deploy Finnergy Tracker Pro v2 to NEW GCP project

echo "🚀 Creating NEW project for Finnergy Tracker Pro v2..."
echo "======================================================"

# Create unique project ID
PROJECT_ID="finnergy-pro-2024"
echo "📋 Using project ID: $PROJECT_ID"

# Create new project
echo "Creating new GCP project..."
gcloud projects create $PROJECT_ID --name="Finnergy Tracker Pro V2" 2>/dev/null || {
    echo "Project might already exist, continuing..."
}

# Set the project
gcloud config set project $PROJECT_ID

# Link billing account (you need to replace with your billing account ID)
echo "🔗 Linking billing account..."
# Get billing accounts
echo "Available billing accounts:"
gcloud billing accounts list
echo ""
echo "Please run: gcloud billing projects link $PROJECT_ID --billing-account=YOUR_BILLING_ACCOUNT_ID"
echo "Press Enter to continue after linking billing..."
read

# Enable required APIs
echo "🔧 Enabling required APIs..."
gcloud services enable appengine.googleapis.com --quiet
gcloud services enable firestore.googleapis.com --quiet
gcloud services enable cloudbuild.googleapis.com --quiet

# Create App Engine app
echo "📱 Creating App Engine app..."
gcloud app create --region=asia-southeast1 --quiet || echo "App Engine app already exists"

# Create Firestore database
echo "🗄️ Creating Firestore database..."
gcloud firestore databases create --region=asia-southeast1 --quiet || echo "Firestore already exists"

# Deploy Backend
echo ""
echo "📦 Deploying Backend API..."
cd backend

# Install dependencies
echo "Installing dependencies..."
npm install --production

# Create environment config
cat > .env.yaml << EOF
env_variables:
  NODE_ENV: "production"
  FIREBASE_PROJECT_ID: "$PROJECT_ID"
  LINE_CHANNEL_ACCESS_TOKEN: "YOUR_LINE_TOKEN"
  LINE_CHANNEL_SECRET: "YOUR_LINE_SECRET"
EOF

# Deploy backend
echo "Deploying backend service..."
gcloud app deploy app.yaml .env.yaml --service=finnergy-api-v2 --quiet

# Clean up
rm -f .env.yaml

# Deploy Frontend
echo ""
echo "🎨 Deploying Frontend..."
cd ../public

# Update API URL
cp app.js app.js.backup
sed -i '' "s|https://finnergy-api-v2.as.r.appspot.com|https://finnergy-api-v2-dot-$PROJECT_ID.as.r.appspot.com|g" app.js

# Deploy frontend
echo "Deploying frontend service..."
gcloud app deploy app.yaml --service=default --quiet

# Restore original app.js
mv app.js.backup app.js

echo ""
echo "✅ Deployment Complete!"
echo ""
echo "🔗 Your NEW Finnergy v2 URLs:"
echo "   Frontend: https://$PROJECT_ID.as.r.appspot.com"
echo "   Backend API: https://finnergy-api-v2-dot-$PROJECT_ID.as.r.appspot.com"
echo "   Health Check: https://finnergy-api-v2-dot-$PROJECT_ID.as.r.appspot.com/health"
echo ""
echo "📱 Create a NEW LIFF app in LINE Developers Console:"
echo "   1. Create new LIFF app"
echo "   2. Set endpoint URL: https://$PROJECT_ID.as.r.appspot.com"
echo "   3. Get new LIFF ID and update in app.js"
echo ""
echo "🔑 Don't forget to:"
echo "   1. Set LINE credentials in App Engine environment variables"
echo "   2. Configure Firestore security rules"
echo ""
echo "✨ This is completely separate from your original app!"