#!/bin/bash

# Version bump script
# Usage: ./scripts/bump-version.sh [major|minor|patch]

VERSION_TYPE=${1:-patch}

# Get current version from package.json
CURRENT_VERSION=$(grep -o '"version": "[^"]*"' package.json | grep -o '[0-9]\+\.[0-9]\+\.[0-9]\+' | head -1)
echo "Current version: $CURRENT_VERSION"

# Parse version components
IFS='.' read -ra VERSION_PARTS <<< "$CURRENT_VERSION"
MAJOR=${VERSION_PARTS[0]}
MINOR=${VERSION_PARTS[1]}
PATCH=${VERSION_PARTS[2]}

# Calculate new version
if [ "$VERSION_TYPE" = "major" ]; then
  MAJOR=$((MAJOR + 1))
  MINOR=0
  PATCH=0
elif [ "$VERSION_TYPE" = "minor" ]; then
  MINOR=$((MINOR + 1))
  PATCH=0
else
  PATCH=$((PATCH + 1))
fi

NEW_VERSION="$MAJOR.$MINOR.$PATCH"
echo "New version: $NEW_VERSION"

# Update version in all files
echo "Updating version in files..."

# Update root package.json
sed -i.bak "s/\"version\": \"[^\"]*\"/\"version\": \"$NEW_VERSION\"/" package.json && rm package.json.bak

# Update backend package.json
sed -i.bak "s/\"version\": \"[^\"]*\"/\"version\": \"$NEW_VERSION\"/" backend/package.json && rm backend/package.json.bak

# Update ai-service package.json if exists
if [ -f "ai-service/package.json" ]; then
  sed -i.bak "s/\"version\": \"[^\"]*\"/\"version\": \"$NEW_VERSION\"/" ai-service/package.json && rm ai-service/package.json.bak
fi

# Update index.html meta tag
sed -i.bak "s/<meta name=\"version\" content=\"[^\"]*\">/<meta name=\"version\" content=\"$NEW_VERSION\">/" index.html && rm index.html.bak

# Update config.js VERSION constant
sed -i.bak "s/VERSION: '[^']*'/VERSION: '$NEW_VERSION'/" config.js && rm config.js.bak

# Update version display in HTML
sed -i.bak "s/v[0-9]\+\.[0-9]\+\.[0-9]\+/v$NEW_VERSION/g" index.html && rm index.html.bak

# Update backend server.js health endpoint
if grep -q "version:" backend/server.js; then
  sed -i.bak "s/version: '[^']*'/version: '$NEW_VERSION'/" backend/server.js && rm backend/server.js.bak
fi

# Create VERSION file
echo "$NEW_VERSION" > VERSION
echo "Updated at: $(date)" >> VERSION

echo "✅ Version updated to $NEW_VERSION"
echo ""
echo "Files updated:"
echo "  - package.json"
echo "  - backend/package.json"
echo "  - ai-service/package.json (if exists)"
echo "  - index.html"
echo "  - config.js"
echo "  - backend/server.js"
echo "  - VERSION"
echo ""
echo "Next steps:"
echo "  1. Review changes: git diff"
echo "  2. Commit: git add . && git commit -m '🚀 Bump version to v$NEW_VERSION'"
echo "  3. Tag: git tag v$NEW_VERSION"
echo "  4. Push: git push && git push --tags"