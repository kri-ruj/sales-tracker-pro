# Playwright E2E Tests for Sales Tracker Pro

This directory contains end-to-end tests for the Sales Tracker Pro application using Playwright.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Install Playwright browsers:
```bash
npm run test:install
```

## Running Tests

### Run all tests
```bash
npm test
# or
npm run test:e2e
```

### Run tests in UI mode (recommended for development)
```bash
npm run test:e2e:ui
```

### Run tests in headed mode (see browser)
```bash
npm run test:e2e:headed
```

### Debug tests
```bash
npm run test:e2e:debug
```

### Run specific test file
```bash
npx playwright test tests/e2e/auth/line-login.spec.ts
```

### Run tests in specific browser
```bash
npx playwright test --project=chromium
npx playwright test --project="Mobile Chrome"
```

## Test Structure

```
tests/
├── e2e/
│   ├── auth/           # Authentication tests
│   ├── activities/     # Activity management tests
│   ├── leaderboard/    # Leaderboard tests
│   ├── settings/       # User settings tests
│   └── integration/    # Integration tests
├── fixtures/           # Test fixtures and setup
├── pages/             # Page Object Models
└── utils/             # Test utilities
```

## Key Features

### Mock LIFF SDK
Since LINE LIFF requires actual LINE authentication, we use a mock LIFF implementation that simulates:
- User login/logout
- Profile retrieval
- LIFF initialization
- Message sending

### Page Object Model
Tests use the Page Object Model pattern for better maintainability:
- `LoginPage`: Login screen interactions
- `ActivitiesPage`: Main app interactions
- `LeaderboardPage`: Leaderboard viewing (TODO)
- `SettingsPage`: User settings (TODO)

### Test Fixtures
- `auth.fixture.ts`: Provides authenticated user context
- `mockLiff`: Mock LIFF SDK instance
- `loginAsUser`: Helper to quickly login as test user

## Writing Tests

### Basic test structure
```typescript
import { test, expect } from '../fixtures/auth.fixture';

test.describe('Feature Name', () => {
  test.beforeEach(async ({ loginAsUser }) => {
    // Setup - login as test user
    await loginAsUser();
  });

  test('should do something', async ({ activitiesPage }) => {
    // Test implementation
    await activitiesPage.clickActivity('call');
    expect(await activitiesPage.isActivitySelected('call')).toBe(true);
  });
});
```

### Using mock API responses
```typescript
test('should handle API response', async ({ page }) => {
  // Mock API endpoint
  await page.route('**/api/activities', async route => {
    await route.fulfill({
      status: 200,
      json: { success: true }
    });
  });
  
  // Your test code
});
```

## Test Reports

After running tests, view the HTML report:
```bash
npm run test:e2e:report
```

Reports are generated in:
- `playwright-report/` - HTML report
- `test-results/` - JSON and JUnit reports

## CI/CD Integration

Add to GitHub Actions workflow:
```yaml
- name: Install Playwright
  run: |
    npm ci
    npx playwright install --with-deps

- name: Run Playwright tests
  run: npm test

- name: Upload test results
  if: always()
  uses: actions/upload-artifact@v3
  with:
    name: playwright-report
    path: playwright-report/
    retention-days: 30
```

## Best Practices

1. **Use Page Objects**: Keep selectors and interactions in page objects
2. **Mock External Services**: Mock LIFF, APIs, and other external dependencies
3. **Test User Flows**: Focus on complete user journeys
4. **Parallel Execution**: Tests run in parallel by default
5. **Cleanup**: Each test should be independent and clean up after itself
6. **Assertions**: Use meaningful assertions with clear error messages

## Debugging Tips

1. Use `page.pause()` to pause execution
2. Use `--debug` flag to step through tests
3. Use UI mode for visual debugging
4. Check `test-results/` for failure screenshots
5. Use `console.log` in page.evaluate() for browser logs

## Environment Variables

- `PLAYWRIGHT_BASE_URL`: Override base URL (default: http://localhost:8000)
- `CI`: Set to true in CI environments

## Known Issues

1. **Service Worker**: Tests may need to handle service worker registration
2. **LIFF Mock**: Some LIFF features are not fully mocked
3. **Offline Mode**: Offline sync tests need special handling

## TODO

- [ ] Add leaderboard page tests
- [ ] Add settings page tests  
- [ ] Add offline mode tests
- [ ] Add visual regression tests
- [ ] Add performance tests
- [ ] Add accessibility tests
- [ ] Add API error handling tests
- [ ] Add data export tests