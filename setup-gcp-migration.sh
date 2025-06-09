#!/bin/bash

# GCP Migration Setup Script
# This script helps you set up your GCP environment

echo "🚀 GCP Migration Setup Script"
echo "============================"

# Check if gcloud is installed
if ! command -v gcloud &> /dev/null; then
    echo "❌ gcloud CLI not found. Please install it first:"
    echo "   Mac: brew install google-cloud-sdk"
    echo "   Others: https://cloud.google.com/sdk/docs/install"
    exit 1
fi

# Check if firebase is installed
if ! command -v firebase &> /dev/null; then
    echo "❌ Firebase CLI not found. Installing..."
    npm install -g firebase-tools
fi

echo ""
echo "📋 Prerequisites Checklist:"
echo "1. Have you created a GCP project? (y/n)"
read -r created_project

if [ "$created_project" != "y" ]; then
    echo "👉 Please create a project at https://console.cloud.google.com"
    exit 1
fi

echo "2. Enter your GCP Project ID:"
read -r PROJECT_ID

# Validate project ID
if [ -z "$PROJECT_ID" ]; then
    echo "❌ Project ID cannot be empty"
    exit 1
fi

echo ""
echo "🔧 Setting up GCP environment..."

# Set project
gcloud config set project "$PROJECT_ID"

# Enable required APIs
echo "📡 Enabling required APIs..."
gcloud services enable appengine.googleapis.com
gcloud services enable cloudbuild.googleapis.com  
gcloud services enable firebase.googleapis.com

# Check if App Engine app exists
echo "🌍 Checking App Engine..."
if ! gcloud app describe &> /dev/null; then
    echo "Creating App Engine app..."
    echo "Choose your region:"
    echo "1) asia-southeast1 (Singapore)"
    echo "2) us-central (Iowa)"
    echo "3) europe-west (Belgium)"
    read -r region_choice
    
    case $region_choice in
        1) REGION="asia-southeast1";;
        2) REGION="us-central";;
        3) REGION="europe-west";;
        *) REGION="asia-southeast1";;
    esac
    
    gcloud app create --region="$REGION"
else
    echo "✅ App Engine app already exists"
fi

# Update frontend configuration
echo ""
echo "📝 Updating frontend configuration..."
sed -i.bak "s|https://sales-tracker-backend.onrender.com|https://sales-tracker-api-dot-${PROJECT_ID}.uc.r.appspot.com|g" index.html
echo "✅ Frontend updated to use GCP backend URL"

# Re-enable GCP workflow
if [ -f ".github/workflows/deploy-gcp.yml.disabled" ]; then
    mv .github/workflows/deploy-gcp.yml.disabled .github/workflows/deploy-gcp.yml
    echo "✅ GCP workflow re-enabled"
fi

# Create firebase.json if it doesn't exist
if [ ! -f "firebase.json" ]; then
    echo "📦 Creating Firebase configuration..."
    cat > firebase.json << EOF
{
  "hosting": {
    "public": "dist",
    "ignore": [
      "firebase.json",
      "**/.*",
      "**/node_modules/**"
    ],
    "rewrites": [
      {
        "source": "**",
        "destination": "/index.html"
      }
    ],
    "headers": [
      {
        "source": "**/*.@(js|css|html)",
        "headers": [
          {
            "key": "Cache-Control",
            "value": "max-age=3600"
          }
        ]
      }
    ]
  }
}
EOF
    echo "✅ firebase.json created"
fi

# Create .firebaserc
cat > .firebaserc << EOF
{
  "projects": {
    "default": "$PROJECT_ID"
  }
}
EOF

echo ""
echo "📋 Next Steps:"
echo "============="
echo ""
echo "1. Add these secrets to GitHub (Settings → Secrets → Actions):"
echo "   - GCP_PROJECT_ID: $PROJECT_ID"
echo "   - GCP_SA_KEY: (Create service account and download JSON key)"
echo "   - FIREBASE_SERVICE_ACCOUNT: (Same as GCP_SA_KEY)"
echo "   - LINE_CHANNEL_ACCESS_TOKEN: (Your LINE token)"
echo "   - LINE_CHANNEL_SECRET: (Your LINE secret)"
echo ""
echo "2. To create service account:"
echo "   gcloud iam service-accounts create github-actions --display-name=\"GitHub Actions\""
echo "   gcloud projects add-iam-policy-binding $PROJECT_ID --member=\"serviceAccount:github-actions@$PROJECT_ID.iam.gserviceaccount.com\" --role=\"roles/appengine.appAdmin\""
echo "   gcloud projects add-iam-policy-binding $PROJECT_ID --member=\"serviceAccount:github-actions@$PROJECT_ID.iam.gserviceaccount.com\" --role=\"roles/cloudbuild.builds.editor\""
echo "   gcloud projects add-iam-policy-binding $PROJECT_ID --member=\"serviceAccount:github-actions@$PROJECT_ID.iam.gserviceaccount.com\" --role=\"roles/firebase.admin\""
echo "   gcloud iam service-accounts keys create key.json --iam-account=github-actions@$PROJECT_ID.iam.gserviceaccount.com"
echo ""
echo "3. After adding secrets, push to deploy:"
echo "   git add ."
echo "   git commit -m \"Migrate to GCP\""
echo "   git push origin main"
echo ""
echo "🎉 Your apps will be available at:"
echo "   Frontend: https://$PROJECT_ID.web.app"
echo "   Backend: https://sales-tracker-api-dot-$PROJECT_ID.uc.r.appspot.com"