#!/bin/bash

# Test runner script with colored output

echo "🧪 WoW Launcher Test Suite"
echo "=========================="
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}⚠️  Installing dependencies...${NC}"
    npm install
    echo ""
fi

# Parse arguments
TEST_TYPE=${1:-"all"}

case $TEST_TYPE in
    "all")
        echo -e "${GREEN}Running all tests...${NC}"
        npm test
        ;;
    "watch")
        echo -e "${GREEN}Running tests in watch mode...${NC}"
        npm run test:watch
        ;;
    "coverage")
        echo -e "${GREEN}Running tests with coverage...${NC}"
        npm run test:coverage
        echo ""
        echo -e "${GREEN}✅ Coverage report generated!${NC}"
        echo "Open coverage/lcov-report/index.html to view detailed report"
        ;;
    "download")
        echo -e "${GREEN}Running download tests...${NC}"
        npx jest tests/download.test.js
        ;;
    "extraction")
        echo -e "${GREEN}Running extraction tests...${NC}"
        npx jest tests/extraction.test.js
        ;;
    "addon-install")
        echo -e "${GREEN}Running addon installation tests...${NC}"
        npx jest tests/addon-installation.test.js
        ;;
    "addon-update-check")
        echo -e "${GREEN}Running addon update check tests...${NC}"
        npx jest tests/addon-update-check.test.js
        ;;
    "addon-update")
        echo -e "${GREEN}Running addon update tests...${NC}"
        npx jest tests/addon-update.test.js
        ;;
    "launcher-update")
        echo -e "${GREEN}Running launcher self-update tests...${NC}"
        npx jest tests/launcher-update.test.js
        ;;
    "integration")
        echo -e "${GREEN}Running integration tests...${NC}"
        npx jest tests/integration.test.js
        ;;
    "ci")
        echo -e "${GREEN}Running CI test suite...${NC}"
        npm run test:coverage
        EXIT_CODE=$?
        
        if [ $EXIT_CODE -eq 0 ]; then
            echo ""
            echo -e "${GREEN}✅ All tests passed!${NC}"
        else
            echo ""
            echo -e "${RED}❌ Some tests failed!${NC}"
            exit $EXIT_CODE
        fi
        ;;
    *)
        echo -e "${RED}Unknown test type: $TEST_TYPE${NC}"
        echo ""
        echo "Usage: ./run-tests.sh [test-type]"
        echo ""
        echo "Available test types:"
        echo "  all              - Run all tests (default)"
        echo "  watch            - Run tests in watch mode"
        echo "  coverage         - Run tests with coverage report"
        echo "  download         - Run download tests only"
        echo "  extraction       - Run extraction tests only"
        echo "  addon-install    - Run addon installation tests only"
        echo "  addon-update-check - Run addon update check tests only"
        echo "  addon-update     - Run addon update tests only"
        echo "  launcher-update  - Run launcher self-update tests only"
        echo "  integration      - Run integration tests only"
        echo "  ci               - Run full CI test suite"
        exit 1
        ;;
esac
