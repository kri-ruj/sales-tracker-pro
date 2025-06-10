#!/bin/bash

echo "🚀 Deploying Frontend to Google Cloud Storage..."

# Configuration
BUCKET_NAME="salesappfkt-frontend"
PROJECT_ID="salesappfkt"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Check if gcloud is authenticated
echo -e "${YELLOW}Checking Google Cloud authentication...${NC}"
if ! gcloud auth list --filter=status:ACTIVE --format="value(account)" | grep -q .; then
    echo -e "${RED}❌ Not logged in to Google Cloud${NC}"
    echo "Please run: gcloud auth login"
    exit 1
fi

# Set project
gcloud config set project $PROJECT_ID

# Create bucket if it doesn't exist
echo -e "${YELLOW}Checking Cloud Storage bucket...${NC}"
if ! gsutil ls -b gs://$BUCKET_NAME &> /dev/null; then
    echo "Creating bucket gs://$BUCKET_NAME..."
    gsutil mb -p $PROJECT_ID -c STANDARD -l ASIA-SOUTHEAST1 gs://$BUCKET_NAME
    
    # Make bucket public
    gsutil iam ch allUsers:objectViewer gs://$BUCKET_NAME
    
    # Set website configuration
    gsutil web set -m index.html -e 404.html gs://$BUCKET_NAME
fi

# Upload files
echo -e "${YELLOW}Uploading files...${NC}"
gsutil -m rsync -r -d \
    -x "node_modules/|backend/|ai-service/|\.git/|\.firebase/|.*\.md$|.*\.sh$|package.*\.json$|firebase\.json$|app\.yaml$" \
    . gs://$BUCKET_NAME

# Set cache headers
gsutil -m setmeta -h "Cache-Control:public, max-age=3600" gs://$BUCKET_NAME/*.js
gsutil -m setmeta -h "Cache-Control:public, max-age=3600" gs://$BUCKET_NAME/*.css
gsutil -m setmeta -h "Cache-Control:public, max-age=86400" gs://$BUCKET_NAME/*.png
gsutil -m setmeta -h "Cache-Control:public, max-age=86400" gs://$BUCKET_NAME/*.jpg
gsutil -m setmeta -h "Cache-Control:no-cache" gs://$BUCKET_NAME/index.html
gsutil -m setmeta -h "Cache-Control:no-cache" gs://$BUCKET_NAME/sw.js

echo -e "${GREEN}✅ Deployment complete!${NC}"
echo ""
echo "🌐 Your app is live at:"
echo "   https://storage.googleapis.com/$BUCKET_NAME/index.html"
echo ""
echo "📱 Access via LIFF:"
echo "   https://liff.line.me/2007552096-wrG1aV9p"
echo ""
echo "💡 To set up custom domain, use Cloud CDN or Cloud Load Balancing"