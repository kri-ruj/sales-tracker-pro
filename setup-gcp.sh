#!/bin/bash

# 🚀 Sales Tracker GCP Setup Script
# This script sets up your complete GCP infrastructure with CI/CD

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PROJECT_ID="sales-tracker-$(date +%Y%m%d)"
REGION="asia-southeast1"
SERVICE_ACCOUNT="github-actions"

echo -e "${BLUE}🚀 Sales Tracker GCP Setup${NC}"
echo "=================================="
echo "Project ID: $PROJECT_ID"
echo "Region: $REGION"
echo ""

# Function to print status
print_status() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Check if gcloud is installed
if ! command -v gcloud &> /dev/null; then
    print_error "Google Cloud CLI not found. Please install it first:"
    echo "https://cloud.google.com/sdk/docs/install"
    exit 1
fi

# Check if logged in
if ! gcloud auth list --filter=status:ACTIVE --format="value(account)" | head -n 1 > /dev/null; then
    print_warning "Please login to Google Cloud first"
    gcloud auth login
fi

# Step 1: Create and configure GCP project
echo -e "${BLUE}📋 Step 1: Setting up GCP Project${NC}"

# Create project
gcloud projects create $PROJECT_ID --name="Sales Tracker" 2>/dev/null || {
    print_warning "Project might already exist, continuing..."
}

# Set project
gcloud config set project $PROJECT_ID
print_status "Project $PROJECT_ID configured"

# Enable billing (if not already enabled)
echo "⚠️  Please enable billing for project $PROJECT_ID in the GCP Console"
echo "   https://console.cloud.google.com/billing/linkedaccount?project=$PROJECT_ID"
read -p "Press Enter when billing is enabled..."

# Enable required APIs
print_status "Enabling required APIs..."
gcloud services enable \
    appengine.googleapis.com \
    cloudbuild.googleapis.com \
    sql-component.googleapis.com \
    sqladmin.googleapis.com \
    firebase.googleapis.com \
    compute.googleapis.com \
    cloudresourcemanager.googleapis.com

# Step 2: Initialize App Engine
echo -e "${BLUE}📋 Step 2: Initializing App Engine${NC}"
gcloud app create --region=$REGION 2>/dev/null || {
    print_warning "App Engine already initialized"
}
print_status "App Engine initialized in $REGION"

# Step 3: Create service account for CI/CD
echo -e "${BLUE}📋 Step 3: Setting up CI/CD Service Account${NC}"

# Create service account
gcloud iam service-accounts create $SERVICE_ACCOUNT \
    --display-name="GitHub Actions CI/CD" 2>/dev/null || {
    print_warning "Service account already exists"
}

# Add required roles
ROLES=(
    "roles/appengine.deployer"
    "roles/cloudsql.admin"
    "roles/firebase.admin"
    "roles/cloudkms.cryptoKeyEncrypterDecrypter"
    "roles/storage.admin"
    "roles/cloudbuild.builds.editor"
)

for role in "${ROLES[@]}"; do
    gcloud projects add-iam-policy-binding $PROJECT_ID \
        --member="serviceAccount:$SERVICE_ACCOUNT@$PROJECT_ID.iam.gserviceaccount.com" \
        --role="$role" --quiet
done

print_status "Service account roles configured"

# Generate service account key
SERVICE_ACCOUNT_KEY_FILE="github-actions-key.json"
gcloud iam service-accounts keys create $SERVICE_ACCOUNT_KEY_FILE \
    --iam-account=$SERVICE_ACCOUNT@$PROJECT_ID.iam.gserviceaccount.com

print_status "Service account key generated: $SERVICE_ACCOUNT_KEY_FILE"

# Step 4: Initialize Firebase
echo -e "${BLUE}📋 Step 4: Setting up Firebase${NC}"

if ! command -v firebase &> /dev/null; then
    print_warning "Installing Firebase CLI..."
    npm install -g firebase-tools
fi

# Update .firebaserc with actual project ID
cat > .firebaserc << EOF
{
  "projects": {
    "default": "$PROJECT_ID"
  },
  "targets": {
    "$PROJECT_ID": {
      "hosting": {
        "production": [
          "$PROJECT_ID"
        ]
      }
    }
  },
  "etags": {}
}
EOF

print_status "Firebase configuration updated"

# Step 5: Setup Cloud SQL (optional)
echo -e "${BLUE}📋 Step 5: Setting up Cloud SQL Database${NC}"
read -p "Do you want to create a Cloud SQL instance? (y/n): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    DB_PASSWORD=$(openssl rand -base64 32)
    
    gcloud sql instances create sales-tracker-db \
        --database-version=POSTGRES_14 \
        --tier=db-f1-micro \
        --region=$REGION \
        --root-password="$DB_PASSWORD" \
        --storage-size=10GB \
        --storage-type=SSD \
        --backup-start-time=03:00 \
        --maintenance-window-day=SUN \
        --maintenance-window-hour=3
    
    gcloud sql databases create sales_tracker_prod \
        --instance=sales-tracker-db
    
    print_status "Cloud SQL instance created"
    echo "Database password: $DB_PASSWORD"
    echo "Save this password for your environment variables!"
else
    print_warning "Skipping Cloud SQL setup"
fi

# Step 6: Update GitHub workflow with project ID
echo -e "${BLUE}📋 Step 6: Updating GitHub Actions Workflow${NC}"

# Update workflow file with actual project ID
sed -i.bak "s/\${{ secrets.GCP_PROJECT_ID }}/$PROJECT_ID/g" .github/workflows/deploy-gcp.yml

print_status "GitHub Actions workflow updated"

# Step 7: Display setup completion
echo ""
echo -e "${GREEN}🎉 GCP Setup Complete!${NC}"
echo "================================="
echo ""
echo -e "${BLUE}📋 Next Steps:${NC}"
echo ""
echo "1. Add these GitHub Secrets to your repository:"
echo "   Go to: https://github.com/YOUR_USERNAME/sales-tracker-pro/settings/secrets/actions"
echo ""
echo "   Secrets to add:"
echo "   - GCP_PROJECT_ID: $PROJECT_ID"
echo "   - GCP_SA_KEY: [paste contents of $SERVICE_ACCOUNT_KEY_FILE]"
echo "   - LINE_CHANNEL_ACCESS_TOKEN: [your LINE bot token]"
echo "   - LINE_CHANNEL_SECRET: [your LINE bot secret]"
if [[ $REPLY =~ ^[Yy]$ ]]; then
echo "   - DB_ROOT_PASSWORD: $DB_PASSWORD"
fi
echo ""
echo "2. Firebase Service Account:"
echo "   - Go to: https://console.firebase.google.com/project/$PROJECT_ID/settings/serviceaccounts/adminsdk"
echo "   - Generate new private key"
echo "   - Add as FIREBASE_SERVICE_ACCOUNT secret"
echo ""
echo "3. Your URLs after deployment:"
echo "   - Frontend: https://$PROJECT_ID.web.app"
echo "   - Backend: https://sales-tracker-api-dot-$PROJECT_ID.uc.r.appspot.com"
echo ""
echo "4. Push to GitHub to trigger automatic deployment!"
echo ""
echo -e "${YELLOW}⚠️  Important files created:${NC}"
echo "   - $SERVICE_ACCOUNT_KEY_FILE (add to GitHub secrets)"
echo "   - .firebaserc (already committed)"
if [[ $REPLY =~ ^[Yy]$ ]]; then
echo "   - Database password: $DB_PASSWORD"
fi
echo ""
echo -e "${GREEN}🚀 Your Sales Tracker is ready for cloud deployment!${NC}"