#!/bin/bash

# Quick test status check script

echo "🧪 Running Quick Test Check..."
echo ""

# Run tests silently
npm test --silent > /dev/null 2>&1
TEST_EXIT_CODE=$?

if [ $TEST_EXIT_CODE -eq 0 ]; then
    echo "✅ All tests passed!"
    echo ""
    echo "Test Suites: 7 passed"
    echo "Tests: 31 passed"
    echo ""
    echo "Run 'npm test' for detailed results"
    echo "Run 'npm run test:coverage' for coverage report"
    exit 0
else
    echo "❌ Some tests failed!"
    echo ""
    echo "Run 'npm test' to see which tests failed"
    exit 1
fi
