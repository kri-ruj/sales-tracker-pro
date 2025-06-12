#!/bin/bash

echo "🚀 Deploying to GitHub Pages..."
echo "=============================="

# Create a new directory for GitHub deployment
mkdir -p finnergy-v2-deploy
cd finnergy-v2-deploy

# Copy all frontend files
cp ../public/* .

# Update API URL to use the existing working backend
sed -i '' "s|https://finnergy-api-v2-dot-salesappfkt.as.r.appspot.com|https://sales-tracker-api-dot-salesappfkt.as.r.appspot.com|g" app.js

# Initialize git repo
git init

# Create GitHub repository using gh CLI
echo "Creating GitHub repository..."
gh repo create finnergy-tracker-v2 --public --source=. --remote=origin --description="Modern sales tracker with glassmorphism UI" || echo "Repo might already exist"

# Add all files
git add -A
git commit -m "Initial deployment of Finnergy Tracker Pro v2"

# Push to GitHub
git branch -M main
git push -u origin main --force

# Enable GitHub Pages
echo "Enabling GitHub Pages..."
gh api repos/{owner}/finnergy-tracker-v2/pages -X POST -f source='{"branch":"main","path":"/"}' 2>/dev/null || echo "Pages might already be enabled"

# Get the GitHub Pages URL
GITHUB_USER=$(gh api user --jq .login)
echo ""
echo "✅ Deployment Complete!"
echo ""
echo "🔗 Your app is now live at:"
echo "   https://${GITHUB_USER}.github.io/finnergy-tracker-v2"
echo ""
echo "Note: It may take 2-3 minutes for the site to be accessible."