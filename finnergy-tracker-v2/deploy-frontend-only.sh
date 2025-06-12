#!/bin/bash

echo "🎨 Deploying ONLY Frontend with Static Files..."
echo "=============================================="

cd public

# Create a simple app.yaml for static hosting
cat > app-static.yaml << EOF
runtime: python39
service: finnergy-ui-v2

handlers:
- url: /
  static_files: index.html
  upload: index.html

- url: /app.js
  static_files: app.js
  upload: app.js

- url: /manifest.json
  static_files: manifest.json
  upload: manifest.json

- url: /sw.js
  static_files: sw.js
  upload: sw.js

- url: /.*
  static_files: index.html
  upload: index.html
EOF

# Update API URL
sed -i '' "s|https://finnergy-api-v2.as.r.appspot.com|https://sales-tracker-api-dot-salesappfkt.as.r.appspot.com|g" app.js

echo "Deploying static frontend..."
gcloud app deploy app-static.yaml --project=salesappfkt --quiet

# Clean up
rm app-static.yaml

echo ""
echo "✅ Frontend Deployed!"
echo ""
echo "🔗 Your NEW Frontend URL:"
echo "   https://finnergy-ui-v2-dot-salesappfkt.as.r.appspot.com"
echo ""
echo "This is your glassmorphism UI!"