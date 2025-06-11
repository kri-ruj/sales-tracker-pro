#!/bin/bash

# Sales Tracker Pro - Playwright Test Runner
# This script helps run E2E tests with proper setup

set -e

echo "🎯 Sales Tracker Pro - E2E Test Runner"
echo "======================================"

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}Installing dependencies...${NC}"
    npm install
fi

# Check if Playwright is installed
if [ ! -d "node_modules/@playwright" ]; then
    echo -e "${YELLOW}Installing Playwright...${NC}"
    npm install @playwright/test
fi

# Check if browsers are installed
if [ ! -d "$HOME/.cache/ms-playwright" ]; then
    echo -e "${YELLOW}Installing Playwright browsers...${NC}"
    npx playwright install
fi

# Parse command line arguments
MODE=${1:-"test"}

case $MODE in
    "ui")
        echo -e "${GREEN}Starting Playwright UI mode...${NC}"
        npm run test:e2e:ui
        ;;
    "debug")
        echo -e "${GREEN}Starting Playwright debug mode...${NC}"
        npm run test:e2e:debug
        ;;
    "headed")
        echo -e "${GREEN}Running tests in headed mode...${NC}"
        npm run test:e2e:headed
        ;;
    "report")
        echo -e "${GREEN}Opening test report...${NC}"
        npm run test:e2e:report
        ;;
    "test")
        echo -e "${GREEN}Running all tests...${NC}"
        npm test
        ;;
    "auth")
        echo -e "${GREEN}Running auth tests...${NC}"
        npx playwright test tests/e2e/auth/
        ;;
    "activities")
        echo -e "${GREEN}Running activities tests...${NC}"
        npx playwright test tests/e2e/activities/
        ;;
    "integration")
        echo -e "${GREEN}Running integration tests...${NC}"
        npx playwright test tests/e2e/integration/
        ;;
    *)
        echo -e "${RED}Unknown mode: $MODE${NC}"
        echo "Usage: ./scripts/run-tests.sh [mode]"
        echo "Modes:"
        echo "  test        - Run all tests (default)"
        echo "  ui          - Open Playwright UI"
        echo "  debug       - Run in debug mode"
        echo "  headed      - Run with visible browser"
        echo "  report      - Open test report"
        echo "  auth        - Run auth tests only"
        echo "  activities  - Run activities tests only"
        echo "  integration - Run integration tests only"
        exit 1
        ;;
esac

# Show test results summary if tests were run
if [ "$MODE" == "test" ] || [ "$MODE" == "auth" ] || [ "$MODE" == "activities" ] || [ "$MODE" == "integration" ]; then
    if [ -f "test-results/results.json" ]; then
        echo ""
        echo -e "${GREEN}Test Results Summary:${NC}"
        echo "======================================"
        # Parse and display results (requires jq)
        if command -v jq &> /dev/null; then
            jq -r '.stats | "Total: \(.total), Passed: \(.passed), Failed: \(.failed), Skipped: \(.skipped)"' test-results/results.json 2>/dev/null || true
        fi
    fi
fi