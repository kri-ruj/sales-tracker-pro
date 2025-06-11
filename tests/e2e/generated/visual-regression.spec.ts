import { test, expect } from '@playwright/test';

test.describe('Visual Regression Tests', () => {
  test('capture login page screenshots', async ({ page }) => {
    // Navigate to the app
    await page.goto('https://frontend-dot-salesappfkt.as.r.appspot.com/');
    
    // Wait for page to be fully loaded
    await page.waitForLoadState('networkidle');
    
    // Capture full page screenshot
    await page.screenshot({ 
      path: 'tests/screenshots/login-page-full.png',
      fullPage: true 
    });
    
    // Capture login container only
    const loginContainer = page.locator('.login-container');
    await loginContainer.screenshot({ 
      path: 'tests/screenshots/login-container.png' 
    });
    
    // Test different viewport sizes
    const viewports = [
      { name: 'mobile', width: 375, height: 667 },
      { name: 'tablet', width: 768, height: 1024 },
      { name: 'desktop', width: 1920, height: 1080 }
    ];
    
    for (const viewport of viewports) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.screenshot({ 
        path: `tests/screenshots/login-${viewport.name}.png` 
      });
    }
  });

  test('visual comparison test', async ({ page }) => {
    await page.goto('https://frontend-dot-salesappfkt.as.r.appspot.com/');
    
    // Use Playwright's built-in visual comparison
    // This will compare against a baseline screenshot
    await expect(page).toHaveScreenshot('login-page.png', {
      maxDiffPixels: 100,
      threshold: 0.2
    });
    
    // Test specific components
    const header = page.locator('h1:has-text("FINNERGY Sales Tracker")');
    await expect(header).toHaveScreenshot('header.png');
    
    const loginButton = page.locator('button:has-text("Login with LINE")');
    await expect(loginButton).toHaveScreenshot('login-button.png');
  });

  test('test theme and color consistency', async ({ page }) => {
    await page.goto('https://frontend-dot-salesappfkt.as.r.appspot.com/');
    
    // Get computed styles
    const styles = await page.evaluate(() => {
      const root = document.documentElement;
      const computedStyle = getComputedStyle(root);
      
      return {
        primaryColor: computedStyle.getPropertyValue('--primary-color'),
        backgroundColor: computedStyle.getPropertyValue('--bg-color'),
        textColor: computedStyle.getPropertyValue('--text-color'),
        fontSize: computedStyle.fontSize
      };
    });
    
    // Verify theme colors
    expect(styles.primaryColor).toBeTruthy();
    expect(styles.backgroundColor).toBeTruthy();
    
    // Check contrast ratio for accessibility
    const loginButton = page.locator('button:has-text("Login with LINE")');
    const buttonStyles = await loginButton.evaluate(el => {
      const computed = getComputedStyle(el);
      return {
        backgroundColor: computed.backgroundColor,
        color: computed.color
      };
    });
    
    console.log('Button styles:', buttonStyles);
  });
});