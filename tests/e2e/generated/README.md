# Playwright E2E Tests - Generated

This directory contains automatically generated E2E tests using Playwright MCP (Model Context Protocol).

## Test Files

### 1. `line-login-flow.spec.ts`
Tests the LINE login authentication flow:
- Login page display and elements
- LIFF environment information
- Demo mode functionality
- Error handling
- Version display

### 2. `activity-management.spec.ts`
Tests activity creation and management features:
- Activity type selection interface
- Point calculation
- Quantity selection
- Add button states
- Navigation menu
- Stats display

### 3. `leaderboard.spec.ts`
Tests leaderboard functionality:
- Navigation to leaderboard
- Time period filters (Daily/Weekly/Monthly)
- User rankings display
- Achievement badges
- Team statistics
- Responsive design

### 4. `full-app-flow.spec.ts`
Comprehensive E2E test covering:
- Complete user journey from login to activity creation
- Navigation between all pages
- Responsive design testing
- Performance checks
- Offline functionality
- Data persistence

## Running the Tests

```bash
# Run all tests
npx playwright test tests/e2e/generated/

# Run specific test file
npx playwright test tests/e2e/generated/line-login-flow.spec.ts

# Run tests in UI mode
npx playwright test tests/e2e/generated/ --ui

# Run tests with specific browser
npx playwright test tests/e2e/generated/ --project=chromium
```

## Test Configuration

These tests use the default Playwright configuration from `playwright.config.ts`. Key settings:
- Base URL: `https://frontend-dot-salesappfkt.as.r.appspot.com/`
- Browsers: Chromium, Firefox, WebKit
- Viewport: Mobile-first (375x667)
- Screenshots on failure: Enabled

## Authentication Notes

Since these tests interact with LINE LIFF authentication, they include:
- Mock authentication patterns for testing
- Comments indicating where real LINE OAuth would occur
- Suggestions for implementing auth fixtures

## Extending the Tests

To add more tests:
1. Use Playwright MCP to navigate and interact with the app
2. Generate new test files based on observed behavior
3. Include proper test structure with:
   - Descriptive test names
   - Step-by-step assertions
   - Error handling
   - Performance checks

## Best Practices

- Tests are independent and can run in any order
- Each test clears state before running
- Uses Page Object Model patterns where applicable
- Includes accessibility checks
- Tests responsive behavior across viewports