#!/bin/bash

# Test Runner Script for Generated E2E Tests

echo "🎯 FINNERGY Sales Tracker - E2E Test Suite"
echo "=========================================="

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to run tests with nice output
run_test() {
    local test_name=$1
    local test_file=$2
    
    echo -e "\n${BLUE}Running: ${test_name}${NC}"
    npx playwright test "$test_file" --reporter=list
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓ ${test_name} passed${NC}"
    else
        echo -e "${RED}✗ ${test_name} failed${NC}"
    fi
}

# Check if Playwright is installed
if ! npx playwright --version > /dev/null 2>&1; then
    echo -e "${RED}Error: Playwright is not installed${NC}"
    echo "Run: npm install && npm run test:install"
    exit 1
fi

# Create directories for test artifacts
mkdir -p tests/screenshots
mkdir -p test-results
mkdir -p playwright-report

# Run tests based on argument
case "$1" in
    "login")
        run_test "Login Flow Tests" "tests/e2e/generated/line-login-flow.spec.ts"
        ;;
    "activity")
        run_test "Activity Management Tests" "tests/e2e/generated/activity-management.spec.ts"
        ;;
    "leaderboard")
        run_test "Leaderboard Tests" "tests/e2e/generated/leaderboard.spec.ts"
        ;;
    "visual")
        run_test "Visual Regression Tests" "tests/e2e/generated/visual-regression.spec.ts"
        ;;
    "api")
        run_test "API Monitoring Tests" "tests/e2e/generated/api-monitoring.spec.ts"
        ;;
    "advanced")
        run_test "Advanced Automation Tests" "tests/e2e/generated/advanced-automation.spec.ts"
        ;;
    "full")
        run_test "Full App Flow Tests" "tests/e2e/generated/full-app-flow.spec.ts"
        ;;
    "all")
        echo -e "${BLUE}Running all generated tests...${NC}"
        npx playwright test tests/e2e/generated/ --reporter=html
        ;;
    "ui")
        echo -e "${BLUE}Opening Playwright UI Mode...${NC}"
        npx playwright test tests/e2e/generated/ --ui
        ;;
    "debug")
        echo -e "${BLUE}Running tests in debug mode...${NC}"
        npx playwright test tests/e2e/generated/ --debug
        ;;
    "report")
        echo -e "${BLUE}Opening test report...${NC}"
        npx playwright show-report
        ;;
    *)
        echo "Usage: $0 {login|activity|leaderboard|visual|api|advanced|full|all|ui|debug|report}"
        echo ""
        echo "Options:"
        echo "  login       - Run login flow tests"
        echo "  activity    - Run activity management tests"
        echo "  leaderboard - Run leaderboard tests"
        echo "  visual      - Run visual regression tests"
        echo "  api         - Run API monitoring tests"
        echo "  advanced    - Run advanced automation tests"
        echo "  full        - Run full app flow tests"
        echo "  all         - Run all tests with HTML report"
        echo "  ui          - Open Playwright UI mode"
        echo "  debug       - Run tests in debug mode"
        echo "  report      - Open last test report"
        exit 1
        ;;
esac

echo -e "\n${GREEN}Test run complete!${NC}"