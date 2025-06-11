import { test, expect } from '../fixtures/auth.fixture';
import { TEST_PROFILES } from '../utils/mock-liff';

test.describe('LINE Login', () => {
  test.beforeEach(async ({ page }) => {
    // Clear any existing session data
    await page.context().clearCookies();
    
    // Safely clear localStorage
    try {
      await page.evaluate(() => {
        if (typeof localStorage !== 'undefined') {
          localStorage.clear();
        }
      });
    } catch (error) {
      // Ignore localStorage errors in tests
      console.log('localStorage not available:', error.message);
    }
  });

  test('should display login screen when not authenticated', async ({ loginPage }) => {
    await loginPage.goto();
    await loginPage.waitForLoginScreen();
    
    expect(await loginPage.isLoginScreenVisible()).toBe(true);
    expect(await loginPage.getLoginButtonText()).toBe('Login with LINE');
    expect(await loginPage.loginTitle.textContent()).toBe('FINNERGY Sales Tracker');
  });

  test('should show correct LIFF ID in debug info', async ({ loginPage }) => {
    await loginPage.goto();
    await loginPage.waitForLoginScreen();
    
    const liffId = await loginPage.getDebugLiffId();
    expect(liffId).toBe('2007539402-Mnwlaklq'); // Development LIFF ID
  });

  test('should disable demo mode', async ({ page, loginPage }) => {
    await loginPage.goto();
    await loginPage.waitForLoginScreen();
    
    // Listen for dialog
    page.on('dialog', async dialog => {
      expect(dialog.message()).toContain('Demo mode is disabled');
      await dialog.accept();
    });
    
    await loginPage.clickDemoMode();
  });

  test('should login successfully with mock LIFF', async ({ page, mockLiff, loginPage, activitiesPage }) => {
    // Set up mock LIFF in logged out state
    await loginPage.goto();
    await loginPage.waitForLoginScreen();
    
    // Simulate LINE login
    await mockLiff.login(TEST_PROFILES.user1);
    
    // Click login button
    await loginPage.clickLineLogin();
    
    // Should redirect to main app
    await activitiesPage.waitForPageLoad();
    
    // Verify user info is displayed
    expect(await activitiesPage.getUserName()).toBe(TEST_PROFILES.user1.displayName);
  });

  test('should persist login state across page reloads', async ({ page, loginAsUser, activitiesPage }) => {
    // Login first
    await loginAsUser(TEST_PROFILES.user1);
    await activitiesPage.waitForPageLoad();
    
    // Reload the page
    await page.reload();
    
    // Should still be logged in
    await activitiesPage.waitForPageLoad();
    expect(await activitiesPage.getUserName()).toBe(TEST_PROFILES.user1.displayName);
  });

  test('should handle LIFF initialization errors', async ({ page, loginPage }) => {
    // Mock LIFF initialization failure
    await page.addInitScript(() => {
      (window as any).liff = {
        init: () => Promise.reject(new Error('LIFF init failed')),
        ready: Promise.reject(new Error('LIFF not ready'))
      };
    });
    
    await loginPage.goto();
    await loginPage.waitForLoginScreen();
    
    // Should show error in debug info
    await page.waitForTimeout(2000); // Wait for init attempt
    const debugError = await loginPage.getDebugError();
    expect(debugError).toBeTruthy();
  });

  test('should logout successfully', async ({ page, loginAsUser, activitiesPage, loginPage }) => {
    // Login first
    await loginAsUser(TEST_PROFILES.user1);
    await activitiesPage.waitForPageLoad();
    
    // Click logout
    await activitiesPage.clickLogout();
    
    // Should return to login screen
    await loginPage.waitForLoginScreen();
    expect(await loginPage.isLoginScreenVisible()).toBe(true);
    
    // Local storage should be cleared
    const localStorageData = await page.evaluate(() => {
      return Object.keys(localStorage);
    });
    expect(localStorageData.length).toBe(0);
  });

  test('should handle multiple user profiles', async ({ loginAsUser, activitiesPage }) => {
    // Login as user 1
    await loginAsUser(TEST_PROFILES.user1);
    await activitiesPage.waitForPageLoad();
    expect(await activitiesPage.getUserName()).toBe(TEST_PROFILES.user1.displayName);
    
    // Logout and login as user 2
    await activitiesPage.clickLogout();
    await loginAsUser(TEST_PROFILES.user2);
    await activitiesPage.waitForPageLoad();
    expect(await activitiesPage.getUserName()).toBe(TEST_PROFILES.user2.displayName);
  });
});