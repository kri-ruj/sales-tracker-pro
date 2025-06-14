#!/bin/bash

echo "🚀 Sales Tracker Pro 10X - Test Suite"
echo "===================================="
echo ""

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Check if servers are running
check_servers() {
    echo -e "${BLUE}🔍 Checking servers...${NC}"
    
    # Check backend
    if curl -s http://localhost:10000/health > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Backend is running${NC}"
    else
        echo -e "${YELLOW}⚠️  Starting backend...${NC}"
        cd backend && npm start > ../backend.log 2>&1 &
        BACKEND_PID=$!
        sleep 3
    fi
    
    # Check frontend
    if curl -s http://localhost:8000 > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Frontend is running${NC}"
    else
        echo -e "${YELLOW}⚠️  Starting frontend...${NC}"
        npx http-server -p 8000 -c-1 > frontend.log 2>&1 &
        FRONTEND_PID=$!
        sleep 2
    fi
}

# Run tests
run_tests() {
    echo ""
    echo -e "${BLUE}🧪 Running Playwright tests...${NC}"
    echo ""
    
    # Run the 10x app tests
    npx playwright test tests/e2e/app-10x.spec.ts --reporter=list
    
    # Capture exit code
    TEST_RESULT=$?
    
    echo ""
    if [ $TEST_RESULT -eq 0 ]; then
        echo -e "${GREEN}✅ All tests passed!${NC}"
    else
        echo -e "${RED}❌ Some tests failed${NC}"
    fi
    
    return $TEST_RESULT
}

# Generate report
generate_report() {
    echo ""
    echo -e "${BLUE}📊 Generating test report...${NC}"
    npx playwright show-report
}

# Main execution
main() {
    check_servers
    run_tests
    RESULT=$?
    
    # Ask if user wants to see report
    echo ""
    read -p "Would you like to view the test report? (y/n) " -n 1 -r
    echo ""
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        generate_report
    fi
    
    # Cleanup
    if [ ! -z "$BACKEND_PID" ]; then
        kill $BACKEND_PID 2>/dev/null
    fi
    if [ ! -z "$FRONTEND_PID" ]; then
        kill $FRONTEND_PID 2>/dev/null
    fi
    
    exit $RESULT
}

# Run main
main