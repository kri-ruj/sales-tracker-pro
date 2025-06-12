import { test, expect } from '@playwright/test';

test.describe('Demo Mode Functionality', () => {
  test('should enter demo mode when clicking Try Demo Mode button', async ({ page }) => {
    await page.goto('/');
    
    // Wait for page to load
    await page.waitForLoadState('networkidle');
    
    // Click Try Demo Mode button
    const demoButton = page.locator('button:has-text("Try Demo Mode")');
    await expect(demoButton).toBeVisible();
    await demoButton.click();
    
    // Wait for demo mode to activate
    await page.waitForTimeout(1000);
    
    // Check if login screen is hidden
    const loginContainer = page.locator('#loginContainer');
    await expect(loginContainer).toHaveClass(/hide/);
    
    // Check if user info is displayed
    await expect(page.locator('text=Demo User')).toBeVisible();
    
    // Check if activities are visible
    const activityGrid = page.locator('.activity-grid');
    await expect(activityGrid).toBeVisible();
    
    // Check if demo activities are loaded
    const pointsDisplay = page.locator('.stats-card').first();
    await expect(pointsDisplay).toBeVisible();
  });

  test('should allow adding activities in demo mode', async ({ page }) => {
    await page.goto('/');
    
    // Enter demo mode
    await page.locator('button:has-text("Try Demo Mode")').click();
    await page.waitForTimeout(1000);
    
    // Find and click on cold call activity
    const coldCallActivity = page.locator('.activity-card').filter({ hasText: 'โทร' }).first();
    await coldCallActivity.locator('button:has-text("+")').click();
    
    // Check if counter incremented
    const counter = coldCallActivity.locator('.counter-value');
    await expect(counter).toHaveText('1');
  });

  test('should clear demo data on logout', async ({ page }) => {
    await page.goto('/');
    
    // Enter demo mode
    await page.locator('button:has-text("Try Demo Mode")').click();
    await page.waitForTimeout(1000);
    
    // Click logout button
    const logoutButton = page.locator('.logout-btn');
    await logoutButton.click();
    
    // Wait for page reload
    await page.waitForLoadState('networkidle');
    
    // Check if back at login screen
    await expect(page.locator('#loginContainer')).not.toHaveClass(/hide/);
    await expect(page.locator('h1:has-text("FINNERGY Sales Tracker")')).toBeVisible();
  });

  test('should show demo mode indicator in status', async ({ page }) => {
    await page.goto('/');
    
    // Enter demo mode
    await page.locator('button:has-text("Try Demo Mode")').click();
    await page.waitForTimeout(1000);
    
    // Check backend status shows demo
    const backendStatus = page.locator('[data-status="backend"]');
    const statusDot = backendStatus.locator('.status-dot');
    await expect(statusDot).toHaveClass(/demo/);
  });
});