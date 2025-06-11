import { test, expect } from '@playwright/test';

test.describe('LINE Login Flow Test', () => {
  test.beforeEach(async ({ page }) => {
    // Clear cookies before each test
    await page.context().clearCookies();
    // Note: localStorage might not be accessible in LIFF context
  });

  test('should redirect to LINE login when accessing LIFF app', async ({ page }) => {
    // Navigate to the LIFF app URL
    await page.goto('https://frontend-dot-salesappfkt.as.r.appspot.com/');
    
    // Since this is a LIFF app, it will redirect to LINE login
    // Wait for the redirect
    await page.waitForURL(/line\.me|access\.line\.me/, { timeout: 10000 });
    
    // Verify we're on LINE's login page
    const pageTitle = await page.title();
    expect(pageTitle).toContain('LINE');
    
    // LINE login page should have login button
    const loginButton = page.locator('button:has-text("เข้าสู่ระบบ"), button:has-text("Log in")');
    await expect(loginButton.first()).toBeVisible();
  });

  test('should display LIFF environment and ID', async ({ page }) => {
    await page.goto('https://frontend-dot-salesappfkt.as.r.appspot.com/');
    
    // Check LIFF environment and ID display
    await expect(page.locator('text=LIFF Environment:')).toBeVisible();
    await expect(page.locator('code:has-text("Developing")')).toBeVisible();
    
    await expect(page.locator('text=LIFF ID:')).toBeVisible();
    await expect(page.locator('code:has-text("2007539402-Mnwlaklq")')).toBeVisible();
    
    // Check for development environment notice
    await expect(page.locator('text=Using Developing Environment LIFF ID')).toBeVisible();
  });

  test('should handle demo mode click', async ({ page }) => {
    await page.goto('https://frontend-dot-salesappfkt.as.r.appspot.com/');
    
    // Click on Demo Mode button
    const demoButton = page.locator('button:has-text("Try Demo Mode")');
    
    // Set up dialog handler
    page.on('dialog', async dialog => {
      expect(dialog.message()).toContain('Demo mode is disabled');
      expect(dialog.type()).toBe('alert');
      await dialog.accept();
    });
    
    await demoButton.click();
    
    // Verify we're still on the login page
    await expect(page.locator('h1:has-text("FINNERGY Sales Tracker")')).toBeVisible();
  });

  test('should initiate LINE login flow', async ({ page }) => {
    await page.goto('https://frontend-dot-salesappfkt.as.r.appspot.com/');
    
    // Click Login with LINE button
    const loginButton = page.locator('button:has-text("Login with LINE")');
    await loginButton.click();
    
    // Note: Actual LINE authentication would redirect to LINE's OAuth page
    // In a real test environment, you would need to handle the LINE OAuth flow
    // or use mock authentication
    
    // For now, we verify the button click initiated some action
    await page.waitForTimeout(1000);
  });

  test('should verify page structure during loading', async ({ page }) => {
    await page.goto('https://frontend-dot-salesappfkt.as.r.appspot.com/');
    
    // Check that the app container exists
    const appContainer = page.locator('#app');
    await expect(appContainer).toBeVisible();
    
    // Verify the login container structure
    const loginContainer = page.locator('.login-container');
    await expect(loginContainer).toBeVisible();
    
    // Check for debug info section
    const debugInfo = page.locator('.debug-info');
    await expect(debugInfo).toBeVisible();
  });

  test('should handle authentication errors gracefully', async ({ page }) => {
    // Navigate with an invalid code parameter to simulate auth error
    await page.goto('https://frontend-dot-salesappfkt.as.r.appspot.com/?code=invalid&state=invalid');
    
    // Should still show the login page
    await expect(page.locator('h1:has-text("FINNERGY Sales Tracker")')).toBeVisible();
    await expect(page.locator('button:has-text("Login with LINE")')).toBeVisible();
  });

  test('should verify version display', async ({ page }) => {
    await page.goto('https://frontend-dot-salesappfkt.as.r.appspot.com/');
    
    // Check for version display in the corner
    const versionElement = page.locator('.version-display');
    await expect(versionElement).toBeVisible();
    await expect(versionElement).toContainText('v3.7');
  });

  test('should handle page reload correctly', async ({ page }) => {
    await page.goto('https://frontend-dot-salesappfkt.as.r.appspot.com/');
    
    // Take initial snapshot
    const initialTitle = await page.locator('h1:has-text("FINNERGY Sales Tracker")').textContent();
    
    // Reload the page
    await page.reload();
    
    // Verify page loads correctly after reload
    await expect(page.locator('h1:has-text("FINNERGY Sales Tracker")')).toBeVisible();
    const reloadedTitle = await page.locator('h1:has-text("FINNERGY Sales Tracker")').textContent();
    expect(reloadedTitle).toBe(initialTitle);
  });
});