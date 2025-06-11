#!/bin/bash

# Setup Google Secret Manager for Sales Tracker Pro
# This script creates secrets in Google Secret Manager

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🔐 Google Secret Manager Setup${NC}"
echo "================================="

# Check if gcloud is installed
if ! command -v gcloud &> /dev/null; then
    echo -e "${RED}❌ gcloud CLI is not installed${NC}"
    exit 1
fi

# Set project
PROJECT_ID="salesappfkt"
gcloud config set project $PROJECT_ID

echo -e "\n${YELLOW}📋 Setting up secrets for project: $PROJECT_ID${NC}"

# Enable Secret Manager API
echo -e "\n${YELLOW}Enabling Secret Manager API...${NC}"
gcloud services enable secretmanager.googleapis.com

# Function to create or update a secret
create_or_update_secret() {
    SECRET_NAME=$1
    SECRET_VALUE=$2
    
    # Check if secret exists
    if gcloud secrets describe $SECRET_NAME &>/dev/null; then
        echo -e "${YELLOW}Updating secret: $SECRET_NAME${NC}"
        echo -n "$SECRET_VALUE" | gcloud secrets versions add $SECRET_NAME --data-file=-
    else
        echo -e "${GREEN}Creating secret: $SECRET_NAME${NC}"
        echo -n "$SECRET_VALUE" | gcloud secrets create $SECRET_NAME --data-file=- --replication-policy="automatic"
    fi
}

# Read current values from backend/app.yaml
echo -e "\n${YELLOW}Reading current configuration...${NC}"

LINE_ACCESS_TOKEN=$(grep "LINE_CHANNEL_ACCESS_TOKEN:" backend/app.yaml | cut -d'"' -f2)
LINE_SECRET=$(grep "LINE_CHANNEL_SECRET:" backend/app.yaml | cut -d'"' -f2)

# Create secrets
echo -e "\n${YELLOW}Creating/updating secrets...${NC}"

create_or_update_secret "line-channel-access-token" "$LINE_ACCESS_TOKEN"
create_or_update_secret "line-channel-secret" "$LINE_SECRET"

# Create admin token for version sync endpoint
ADMIN_TOKEN=$(openssl rand -hex 32)
create_or_update_secret "admin-token" "$ADMIN_TOKEN"
echo -e "${GREEN}Generated admin token: $ADMIN_TOKEN${NC}"

# Grant App Engine service account access to secrets
echo -e "\n${YELLOW}Granting permissions...${NC}"

SERVICE_ACCOUNT="${PROJECT_ID}@appspot.gserviceaccount.com"

# Grant access to each secret
for SECRET in "line-channel-access-token" "line-channel-secret" "admin-token"; do
    gcloud secrets add-iam-policy-binding $SECRET \
        --member="serviceAccount:${SERVICE_ACCOUNT}" \
        --role="roles/secretmanager.secretAccessor"
done

# Create a new app.yaml without secrets
echo -e "\n${YELLOW}Creating secure app.yaml...${NC}"

cat > backend/app.yaml.secure << EOF
runtime: nodejs20
service: sales-tracker-api

# Environment variables (non-sensitive only)
env_variables:
  NODE_ENV: production
  USE_SECRET_MANAGER: "true"

# Automatic scaling configuration
automatic_scaling:
  min_instances: 0
  max_instances: 10
  target_cpu_utilization: 0.6
  target_throughput_utilization: 0.6

# Resource allocation
resources:
  cpu: 1
  memory_gb: 0.5
  disk_size_gb: 10

# Network settings
network:
  session_affinity: false

# Health checks
readiness_check:
  path: "/health"
  check_interval_sec: 5
  timeout_sec: 4
  failure_threshold: 2
  success_threshold: 2

liveness_check:
  path: "/health"
  check_interval_sec: 30
  timeout_sec: 4
  failure_threshold: 4
  success_threshold: 2

# Handlers for static files and API routes
handlers:
- url: /.*
  script: auto
  secure: always
  redirect_http_response_code: 301
EOF

echo -e "${GREEN}✅ Created secure app.yaml (backend/app.yaml.secure)${NC}"

# Summary
echo -e "\n${GREEN}✅ Secret Manager setup complete!${NC}"
echo -e "\n${BLUE}Summary:${NC}"
echo "1. Secret Manager API enabled"
echo "2. Secrets created:"
echo "   - line-channel-access-token"
echo "   - line-channel-secret"
echo "   - admin-token"
echo "3. Permissions granted to App Engine service account"
echo "4. Created secure app.yaml without hardcoded secrets"

echo -e "\n${YELLOW}Next steps:${NC}"
echo "1. Replace backend/app.yaml with backend/app.yaml.secure"
echo "2. Update server.js to use Secret Manager (already done in server-firestore.js)"
echo "3. Test locally with: GOOGLE_APPLICATION_CREDENTIALS=path/to/key.json npm run dev"
echo "4. Deploy with: gcloud app deploy backend/app.yaml.secure"

echo -e "\n${YELLOW}Admin token for version sync:${NC}"
echo "$ADMIN_TOKEN"
echo "(Save this token securely for admin operations)"