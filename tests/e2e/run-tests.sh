#!/bin/bash

# FINNERGY Sales Tracker - E2E Test Runner
# Run automated tests with Playwright

echo "🎯 FINNERGY Sales Tracker - Automated E2E Tests"
echo "=============================================="
echo ""

# Check if Playwright is installed
if ! npx playwright --version > /dev/null 2>&1; then
    echo "❌ Playwright is not installed. Installing..."
    npm install
    npm run test:install
fi

# Create necessary directories
mkdir -p screenshots
mkdir -p test-results
mkdir -p playwright-report

# Function to run specific test suite
run_suite() {
    local suite_name=$1
    local test_path=$2
    
    echo "🧪 Running $suite_name..."
    npx playwright test "$test_path" --project=chromium --reporter=list
    
    if [ $? -eq 0 ]; then
        echo "✅ $suite_name passed!"
    else
        echo "❌ $suite_name failed!"
    fi
    echo ""
}

# Run test suites
case "$1" in
    "quick")
        echo "Running quick smoke tests..."
        run_suite "API Tests" "tests/e2e/working/liff-app-tests.spec.ts:73"
        run_suite "PWA Tests" "tests/e2e/working/simple-e2e-test.spec.ts:46"
        ;;
    "full")
        echo "Running full test suite..."
        npx playwright test tests/e2e/working/ --reporter=html
        ;;
    "report")
        echo "Opening test report..."
        npx playwright show-report
        ;;
    *)
        echo "Usage: $0 {quick|full|report}"
        echo ""
        echo "Options:"
        echo "  quick  - Run quick smoke tests (API & PWA)"
        echo "  full   - Run full test suite with HTML report"
        echo "  report - Open the last test report"
        echo ""
        echo "Example:"
        echo "  ./tests/e2e/run-tests.sh quick"
        ;;
esac