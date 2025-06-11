#!/bin/bash

# Setup script for GCP Firestore and Secret Manager
# Run this script to configure your GCP project for Firestore

echo "🚀 Setting up GCP Firestore for Sales Tracker Pro"
echo "================================================"

PROJECT_ID="salesappfkt"

# Check if gcloud is installed
if ! command -v gcloud &> /dev/null; then
    echo "❌ gcloud CLI is not installed. Please install it first:"
    echo "   https://cloud.google.com/sdk/docs/install"
    exit 1
fi

# Set the project
echo "📋 Setting project to $PROJECT_ID..."
gcloud config set project $PROJECT_ID

# Enable required APIs
echo "🔧 Enabling required GCP APIs..."
gcloud services enable firestore.googleapis.com
gcloud services enable secretmanager.googleapis.com
gcloud services enable appengine.googleapis.com

# Create Firestore database (Native mode)
echo "🗄️  Creating Firestore database in Native mode..."
gcloud firestore databases create --location=asia-southeast1 --type=firestore-native || echo "Firestore database may already exist"

# Create secrets in Secret Manager
echo "🔐 Setting up Secret Manager secrets..."
echo ""
echo "You need to add your LINE credentials to Secret Manager."
echo "Get these from LINE Developers Console:"
echo "https://developers.line.biz/console/"
echo ""

# Function to create or update secret
create_secret() {
    local secret_name=$1
    local prompt_message=$2
    
    # Check if secret exists
    if gcloud secrets describe $secret_name &>/dev/null; then
        echo "Secret '$secret_name' already exists."
        read -p "Do you want to update it? (y/N): " update_choice
        if [[ $update_choice =~ ^[Yy]$ ]]; then
            read -s -p "$prompt_message: " secret_value
            echo
            echo "$secret_value" | gcloud secrets versions add $secret_name --data-file=-
            echo "✅ Updated $secret_name"
        fi
    else
        read -s -p "$prompt_message: " secret_value
        echo
        echo "$secret_value" | gcloud secrets create $secret_name --data-file=-
        echo "✅ Created $secret_name"
    fi
}

# Create LINE secrets
create_secret "line-channel-access-token" "Enter your LINE Channel Access Token"
create_secret "line-channel-secret" "Enter your LINE Channel Secret"

# Grant App Engine service account access to secrets
echo "🔑 Granting App Engine access to secrets..."
PROJECT_NUMBER=$(gcloud projects describe $PROJECT_ID --format="value(projectNumber)")
SERVICE_ACCOUNT="${PROJECT_ID}@appspot.gserviceaccount.com"

gcloud secrets add-iam-policy-binding line-channel-access-token \
    --member="serviceAccount:${SERVICE_ACCOUNT}" \
    --role="roles/secretmanager.secretAccessor"

gcloud secrets add-iam-policy-binding line-channel-secret \
    --member="serviceAccount:${SERVICE_ACCOUNT}" \
    --role="roles/secretmanager.secretAccessor"

# Create Firestore indexes
echo "📊 Creating Firestore indexes..."
cat > firestore.indexes.json << 'EOF'
{
  "indexes": [
    {
      "collectionGroup": "activities",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "userId", "order": "ASCENDING" },
        { "fieldPath": "timestamp", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "activities",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "timestamp", "order": "DESCENDING" }
      ]
    }
  ]
}
EOF

# Deploy indexes
gcloud firestore indexes create --project=$PROJECT_ID < firestore.indexes.json
rm firestore.indexes.json

echo ""
echo "✅ GCP Firestore setup complete!"
echo ""
echo "Next steps:"
echo "1. Run the data migration (if you have existing SQLite data):"
echo "   npm run setup:firestore"
echo ""
echo "2. Deploy the backend:"
echo "   npm run deploy:gcp"
echo ""
echo "3. Update your LINE webhook URL to:"
echo "   https://sales-tracker-api-dot-salesappfkt.as.r.appspot.com/webhook"
echo ""
echo "🎉 Your backend is now configured to use Firestore!"