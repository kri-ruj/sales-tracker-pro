#!/bin/bash

# Sales Tracker Version Update Script
# Usage: ./update-version.sh [new_version]
# Example: ./update-version.sh 2.76

if [ -z "$1" ]; then
    echo "Usage: ./update-version.sh [new_version]"
    echo "Example: ./update-version.sh 2.76"
    exit 1
fi

NEW_VERSION=$1
OLD_VERSION=$(grep -o 'VERSION: .[0-9.]*' index.html | cut -d"'" -f2)

echo "Updating version from $OLD_VERSION to $NEW_VERSION..."

# Update index.html (3 places)
sed -i '' "s/Sales Activity Tracker v$OLD_VERSION/Sales Activity Tracker v$NEW_VERSION/g" index.html
sed -i '' "s/<span id=\"versionNumber\">$OLD_VERSION<\/span>/<span id=\"versionNumber\">$NEW_VERSION<\/span>/g" index.html
sed -i '' "s/VERSION: '$OLD_VERSION'/VERSION: '$NEW_VERSION'/g" index.html

# Update sw.js
sed -i '' "s/sales-tracker-pro-v$OLD_VERSION/sales-tracker-pro-v$NEW_VERSION/g" sw.js

# Update backend files
sed -i '' "s/version: '$OLD_VERSION'/version: '$NEW_VERSION'/g" backend/server-simple.js
sed -i '' "s/version: '$OLD_VERSION'/version: '$NEW_VERSION'/g" backend/server.js
sed -i '' "s/version: '$OLD_VERSION'/version: '$NEW_VERSION'/g" deploy/backend/server-simple.js
sed -i '' "s/version: '$OLD_VERSION'/version: '$NEW_VERSION'/g" deploy/backend/server.js 2>/dev/null || true

echo "✅ Version updated to $NEW_VERSION in all files"
echo ""
echo "Files updated:"
echo "- index.html (3 locations)"
echo "- sw.js (cache name)"
echo "- backend/server-simple.js"
echo "- deploy/backend/server-simple.js"
echo ""
echo "Next steps:"
echo "1. Deploy frontend: npm run deploy:firebase"
echo "2. Deploy backend: npm run deploy:backend"