#!/bin/bash

echo "🚀 Finnergy Tracker Pro v2 - Local Preview"
echo "========================================="

# Check if Python is installed
if command -v python3 &> /dev/null; then
    echo "Starting preview server..."
    cd public
    python3 -m http.server 8080
elif command -v python &> /dev/null; then
    echo "Starting preview server..."
    cd public
    python -m SimpleHTTPServer 8080
else
    echo "❌ Python not found. Please install Python to run the preview."
    exit 1
fi