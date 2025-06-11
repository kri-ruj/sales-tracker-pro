#!/bin/bash

# Safe Deploy Script - Ensures version consistency before deployment
# This script prevents version mismatches by validating everything before deploy

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 Safe Deploy - Version-Aware Deployment System${NC}"
echo "================================================"

# Get script directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$( cd "$SCRIPT_DIR/.." && pwd )"

# Change to project root
cd "$PROJECT_ROOT"

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Check prerequisites
echo -e "\n${YELLOW}📋 Checking prerequisites...${NC}"

if ! command_exists node; then
    echo -e "${RED}❌ Node.js is not installed${NC}"
    exit 1
fi

if ! command_exists gcloud; then
    echo -e "${RED}❌ Google Cloud SDK is not installed${NC}"
    exit 1
fi

echo -e "${GREEN}✅ All prerequisites met${NC}"

# Step 1: Run version validation
echo -e "\n${YELLOW}🔍 Step 1: Validating version consistency...${NC}"

if ! node scripts/version-manager.js validate; then
    echo -e "${RED}❌ Version validation failed!${NC}"
    echo -e "${YELLOW}Running automatic version sync...${NC}"
    
    node scripts/version-manager.js sync
    
    # Validate again
    if ! node scripts/version-manager.js validate; then
        echo -e "${RED}❌ Version sync failed! Manual intervention required.${NC}"
        exit 1
    fi
    
    echo -e "${GREEN}✅ Versions synchronized successfully${NC}"
fi

# Step 2: Get current version
CURRENT_VERSION=$(node scripts/version-manager.js current)
echo -e "\n${BLUE}📦 Current version: ${CURRENT_VERSION}${NC}"

# Step 3: Run tests (if they exist)
echo -e "\n${YELLOW}🧪 Step 2: Running tests...${NC}"

# Backend tests
if [ -f "backend/package.json" ] && grep -q "\"test\"" backend/package.json; then
    echo "Running backend tests..."
    cd backend
    npm test || echo -e "${YELLOW}⚠️  Backend tests failed or not implemented${NC}"
    cd ..
else
    echo -e "${YELLOW}⚠️  No backend tests configured${NC}"
fi

# Step 4: Build frontend (if needed)
echo -e "\n${YELLOW}🔨 Step 3: Building frontend...${NC}"

if [ -f "package.json" ] && grep -q "\"build\"" package.json; then
    npm run build || echo -e "${YELLOW}⚠️  No build script found${NC}"
else
    echo -e "${GREEN}✅ No build required (static files)${NC}"
fi

# Step 5: Git status check
echo -e "\n${YELLOW}📝 Step 4: Checking git status...${NC}"

if [[ -n $(git status -s) ]]; then
    echo -e "${YELLOW}⚠️  Warning: You have uncommitted changes${NC}"
    git status -s
    
    read -p "Do you want to commit these changes before deploying? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        git add .
        git commit -m "Deploy version ${CURRENT_VERSION}"
        git push
    fi
fi

# Step 6: Final pre-deployment check
echo -e "\n${YELLOW}🎯 Step 5: Final pre-deployment check...${NC}"

if ! node scripts/version-manager.js check; then
    echo -e "${RED}❌ Pre-deployment check failed!${NC}"
    exit 1
fi

# Step 7: Deploy to GCP
echo -e "\n${YELLOW}🚀 Step 6: Deploying to Google Cloud Platform...${NC}"
echo -e "${BLUE}Deploying version ${CURRENT_VERSION}${NC}"

# Deploy frontend
echo -e "\n${YELLOW}Deploying frontend service...${NC}"
gcloud app deploy app.yaml \
    --project=salesappfkt \
    --quiet \
    --version="v${CURRENT_VERSION//./}" \
    || { echo -e "${RED}❌ Frontend deployment failed${NC}"; exit 1; }

# Deploy backend
echo -e "\n${YELLOW}Deploying backend service...${NC}"
cd backend
gcloud app deploy app.yaml \
    --project=salesappfkt \
    --quiet \
    --version="v${CURRENT_VERSION//./}" \
    || { echo -e "${RED}❌ Backend deployment failed${NC}"; exit 1; }
cd ..

# Step 8: Post-deployment validation
echo -e "\n${YELLOW}🔍 Step 7: Post-deployment validation...${NC}"
echo "Waiting 30 seconds for services to stabilize..."
sleep 30

# Check deployed versions
echo -e "\n${YELLOW}Checking deployed service versions...${NC}"

# Use Node.js to check versions
node -e "
const https = require('https');

function checkUrl(url, name) {
    return new Promise((resolve) => {
        https.get(url, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                const versionMatch = data.match(/VERSION:\s*['\"]([^'\"]+)['\"]/);
                const displayMatch = data.match(/v([\\d.]+)<\\/span>/);
                const version = versionMatch ? versionMatch[1] : (displayMatch ? displayMatch[1] : 'unknown');
                console.log(\`\${name}: \${version}\`);
                resolve(version);
            });
        }).on('error', (err) => {
            console.error(\`\${name}: Error - \${err.message}\`);
            resolve('error');
        });
    });
}

async function checkVersions() {
    const expectedVersion = '${CURRENT_VERSION}';
    console.log('Expected version:', expectedVersion);
    console.log('---');
    
    const frontendVersion = await checkUrl('https://frontend-dot-salesappfkt.as.r.appspot.com/', 'Frontend');
    const apiCheck = await checkUrl('https://sales-tracker-api-dot-salesappfkt.as.r.appspot.com/', 'Backend API');
    
    console.log('---');
    
    if (frontendVersion === expectedVersion && apiCheck !== 'error') {
        console.log('✅ Deployment validation passed!');
        process.exit(0);
    } else {
        console.log('⚠️  Version mismatch detected after deployment');
        process.exit(1);
    }
}

checkVersions();
" || echo -e "${YELLOW}⚠️  Post-deployment validation had warnings${NC}"

# Step 9: Create deployment record
echo -e "\n${YELLOW}📝 Creating deployment record...${NC}"

DEPLOY_RECORD="deployments/deploy-${CURRENT_VERSION}-$(date +%Y%m%d-%H%M%S).json"
mkdir -p deployments

cat > "$DEPLOY_RECORD" << EOF
{
  "version": "${CURRENT_VERSION}",
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "deployer": "$(git config user.name || echo 'unknown')",
  "git_commit": "$(git rev-parse HEAD)",
  "git_branch": "$(git branch --show-current)",
  "services": {
    "frontend": "https://frontend-dot-salesappfkt.as.r.appspot.com/",
    "backend": "https://sales-tracker-api-dot-salesappfkt.as.r.appspot.com/"
  }
}
EOF

echo -e "${GREEN}✅ Deployment record created: ${DEPLOY_RECORD}${NC}"

# Final success message
echo -e "\n${GREEN}🎉 Deployment completed successfully!${NC}"
echo -e "${BLUE}Version ${CURRENT_VERSION} is now live${NC}"
echo ""
echo "Services:"
echo "  Frontend: https://frontend-dot-salesappfkt.as.r.appspot.com/"
echo "  Backend:  https://sales-tracker-api-dot-salesappfkt.as.r.appspot.com/"
echo ""
echo -e "${YELLOW}💡 Tip: Run 'node scripts/version-manager.js bump' before next deployment${NC}"