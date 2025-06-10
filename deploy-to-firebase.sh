#!/bin/bash

echo "🚀 Deploying to Firebase Hosting..."

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if user is logged in
echo -e "${YELLOW}Checking Firebase authentication...${NC}"
if ! firebase projects:list &> /dev/null; then
    echo -e "${RED}❌ Not logged in to Firebase${NC}"
    echo "Please run: firebase login"
    exit 1
fi

# Get the project ID from .firebaserc
PROJECT_ID=$(grep -o '"default": "[^"]*"' .firebaserc | grep -o '"[^"]*"$' | tr -d '"')

if [ -z "$PROJECT_ID" ]; then
    echo -e "${RED}❌ No Firebase project found in .firebaserc${NC}"
    echo "Please run: firebase init hosting"
    exit 1
fi

echo -e "${GREEN}✅ Using Firebase project: $PROJECT_ID${NC}"

# Deploy to Firebase Hosting
echo -e "${YELLOW}Deploying to Firebase Hosting...${NC}"
firebase deploy --only hosting --project "$PROJECT_ID"

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Deployment successful!${NC}"
    echo ""
    echo "🌐 Your app is live at:"
    echo "   https://$PROJECT_ID.web.app"
    echo "   https://$PROJECT_ID.firebaseapp.com"
    echo ""
    echo "📱 Access via LIFF:"
    echo "   https://liff.line.me/2007552096-wrG1aV9p"
else
    echo -e "${RED}❌ Deployment failed${NC}"
    exit 1
fi