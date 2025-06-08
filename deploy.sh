#!/bin/bash

# Sales Tracker Pro - Quick Deployment Script
echo "🚀 Sales Tracker Pro - Quick Deploy"
echo "===================================="

# Check if we're in the right directory
if [ ! -f "index.html" ]; then
    echo "❌ Error: index.html not found. Please run this script from the deploy directory."
    exit 1
fi

# Function to display menu
show_menu() {
    echo ""
    echo "Select deployment option:"
    echo "1) 🟢 Vercel (Recommended)"
    echo "2) 🔵 Netlify"
    echo "3) 🟣 Railway"
    echo "4) 📚 GitHub Pages Setup"
    echo "5) 🌐 Local Preview"
    echo "6) ❌ Exit"
    echo ""
}

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Deploy to Vercel
deploy_vercel() {
    echo "🟢 Deploying to Vercel..."
    
    if ! command_exists vercel; then
        echo "📦 Installing Vercel CLI..."
        npm install -g vercel
    fi
    
    echo "🚀 Starting Vercel deployment..."
    vercel --prod
    
    if [ $? -eq 0 ]; then
        echo "✅ Successfully deployed to Vercel!"
        echo "🔗 Your app is now live and ready to use!"
    else
        echo "❌ Vercel deployment failed"
    fi
}

# Deploy to Netlify
deploy_netlify() {
    echo "🔵 Deploying to Netlify..."
    
    if ! command_exists netlify; then
        echo "📦 Installing Netlify CLI..."
        npm install -g netlify-cli
    fi
    
    echo "🚀 Starting Netlify deployment..."
    netlify deploy --prod --dir .
    
    if [ $? -eq 0 ]; then
        echo "✅ Successfully deployed to Netlify!"
        echo "🔗 Your app is now live and ready to use!"
    else
        echo "❌ Netlify deployment failed"
    fi
}

# Deploy to Railway
deploy_railway() {
    echo "🟣 Deploying to Railway..."
    
    if ! command_exists railway; then
        echo "📦 Installing Railway CLI..."
        npm install -g @railway/cli
    fi
    
    echo "🔑 Please login to Railway..."
    railway login
    
    echo "🔗 Linking to Railway project..."
    railway link
    
    echo "🚀 Starting Railway deployment..."
    railway up
    
    if [ $? -eq 0 ]; then
        echo "✅ Successfully deployed to Railway!"
        echo "🔗 Your app is now live and ready to use!"
    else
        echo "❌ Railway deployment failed"
    fi
}

# Setup GitHub Pages
setup_github_pages() {
    echo "📚 Setting up GitHub Pages..."
    echo ""
    echo "To deploy to GitHub Pages:"
    echo "1. Create a new repository on GitHub"
    echo "2. Run these commands:"
    echo ""
    echo "   git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git"
    echo "   git branch -M main"
    echo "   git push -u origin main"
    echo ""
    echo "3. Go to your repository Settings > Pages"
    echo "4. Select 'Deploy from a branch'"
    echo "5. Choose 'main' branch and '/ (root)' folder"
    echo "6. Your app will be live at: https://YOUR_USERNAME.github.io/YOUR_REPO"
    echo ""
    echo "📝 Would you like to add a remote now? (y/n)"
    read -r response
    
    if [[ "$response" =~ ^[Yy]$ ]]; then
        echo "📝 Enter your GitHub repository URL:"
        read -r repo_url
        git remote add origin "$repo_url"
        git branch -M main
        echo "✅ Remote added. Run 'git push -u origin main' when ready to deploy."
    fi
}

# Local preview
local_preview() {
    echo "🌐 Starting local preview..."
    
    if command_exists python3; then
        echo "🐍 Using Python 3 server..."
        echo "🔗 Open http://localhost:8000 in your browser"
        echo "⏹️  Press Ctrl+C to stop"
        python3 -m http.server 8000
    elif command_exists python; then
        echo "🐍 Using Python server..."
        echo "🔗 Open http://localhost:8000 in your browser"
        echo "⏹️  Press Ctrl+C to stop"
        python -m http.server 8000
    elif command_exists npx; then
        echo "📦 Using Node.js http-server..."
        echo "🔗 Open http://localhost:8000 in your browser"
        echo "⏹️  Press Ctrl+C to stop"
        npx http-server -p 8000 -c-1
    else
        echo "❌ No suitable server found. Please install Python or Node.js"
        echo "💡 Alternative: Open index.html directly in your browser"
    fi
}

# Main menu loop
while true; do
    show_menu
    read -p "Choose an option (1-6): " choice
    
    case $choice in
        1)
            deploy_vercel
            break
            ;;
        2)
            deploy_netlify
            break
            ;;
        3)
            deploy_railway
            break
            ;;
        4)
            setup_github_pages
            ;;
        5)
            local_preview
            break
            ;;
        6)
            echo "👋 Goodbye!"
            exit 0
            ;;
        *)
            echo "❌ Invalid option. Please choose 1-6."
            ;;
    esac
done

echo ""
echo "🎉 Deployment process completed!"
echo "📊 Your Sales Tracker Pro is ready for your team!"