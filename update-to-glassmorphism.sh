#!/bin/bash

echo "🎨 Updating Sales Tracker to Glassmorphism UI..."
echo ""

# Backup current index.html
echo "📦 Creating backup of current index.html..."
cp index.html index.html.backup.$(date +%Y%m%d_%H%M%S)

# Copy glassmorphism styles to main directory
echo "📋 Copying glassmorphism styles..."
cp glassmorphism-styles.css ./

# Update the main app
echo "🚀 Updating main app with new UI..."
cp app-glassmorphism.html index.html

echo ""
echo "✅ Update complete!"
echo ""
echo "🌟 The app has been updated with:"
echo "   - Modern glassmorphism effects"
echo "   - Animated background blobs" 
echo "   - Smooth animations and transitions"
echo "   - Enhanced visual hierarchy"
echo "   - Mobile-responsive sidebar"
echo ""
echo "🔗 Open index.html in your browser to see the new UI!"
echo ""
echo "💡 To revert to the previous version:"
echo "   cp index.html.backup.[timestamp] index.html"