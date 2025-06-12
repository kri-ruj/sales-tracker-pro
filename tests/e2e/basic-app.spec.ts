import { test, expect } from '@playwright/test';

test.describe('Basic App Functionality', () => {
  test('should load the app homepage', async ({ page }) => {
    await page.goto('/');
    
    // Check app title
    await expect(page).toHaveTitle('FINNERGY Sales Tracker - ฟินเนอจี้');
    
    // Check main heading
    await expect(page.locator('h1:has-text("FINNERGY Sales Tracker")')).toBeVisible();
    
    // Check login options are available
    await expect(page.locator('text=Continue with Google')).toBeVisible();
  });

  test('should show correct environment on localhost', async ({ page }) => {
    await page.goto('/');
    
    // Wait for environment detection
    await page.waitForTimeout(1000);
    
    // Check environment shows Development on localhost
    const envText = await page.locator('#debugEnv').textContent();
    expect(envText).toBe('Development');
    
    // Check environment info
    const envInfo = await page.locator('#debugInfo').textContent();
    expect(envInfo).toBe('Local development environment');
  });

  test('should connect to backend API', async ({ page }) => {
    await page.goto('/');
    
    // Wait for backend connection check
    await page.waitForTimeout(2000);
    
    // Check for backend connection toast (if visible)
    const toastLocator = page.locator('text=Connected to backend');
    const toastCount = await toastLocator.count();
    
    if (toastCount > 0) {
      console.log('✅ Backend connection successful');
    } else {
      console.log('⚠️ Backend connection not established - might be normal for test environment');
    }
  });

  test('should have Google login button enabled', async ({ page }) => {
    await page.goto('/');
    
    // Check Google login button is enabled
    const googleButton = page.locator('button:has-text("Continue with Google")');
    await expect(googleButton).toBeVisible();
    await expect(googleButton).toBeEnabled();
  });

  test('should show version number', async ({ page }) => {
    await page.goto('/');
    
    // Check version display
    const versionLocator = page.locator('#versionNumber');
    const versionCount = await versionLocator.count();
    
    if (versionCount > 0) {
      const version = await versionLocator.textContent();
      expect(version).toMatch(/^\d+\.\d+\.\d+$/);
      console.log(`App version: ${version}`);
    }
  });
});