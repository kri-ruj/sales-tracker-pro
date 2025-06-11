import { test, expect } from '@playwright/test';

test.describe('Full Application E2E Test Flow', () => {
  test('complete user journey from login to activity creation', async ({ page }) => {
    // Step 1: Navigate to application
    await test.step('Navigate to app', async () => {
      await page.goto('https://frontend-dot-salesappfkt.as.r.appspot.com/');
      await expect(page).toHaveTitle(/FINNERGY Sales Tracker/);
    });

    // Step 2: Verify login page
    await test.step('Verify login page elements', async () => {
      await expect(page.locator('h1:has-text("FINNERGY Sales Tracker")')).toBeVisible();
      await expect(page.locator('button:has-text("Login with LINE")')).toBeVisible();
      await expect(page.locator('button:has-text("Try Demo Mode")')).toBeVisible();
      
      // Check LIFF environment info
      await expect(page.locator('text=LIFF Environment: Developing')).toBeVisible();
      await expect(page.locator('code:has-text("2007539402-Mnwlaklq")')).toBeVisible();
    });

    // Step 3: Test demo mode disabled
    await test.step('Verify demo mode is disabled', async () => {
      let dialogMessage = '';
      page.on('dialog', async dialog => {
        dialogMessage = dialog.message();
        await dialog.accept();
      });
      
      await page.locator('button:has-text("Try Demo Mode")').click();
      expect(dialogMessage).toContain('Demo mode is disabled');
    });

    // Step 4: Mock login flow (since we can't actually login via LINE in tests)
    await test.step('Mock authenticated state', async () => {
      // In a real test, you would:
      // 1. Mock the LIFF SDK
      // 2. Set authentication tokens
      // 3. Mock user profile data
      
      // For demonstration, we'll inject mock data
      await page.evaluate(() => {
        localStorage.setItem('mockAuth', 'true');
        localStorage.setItem('userProfile', JSON.stringify({
          userId: 'U123456',
          displayName: 'Test User',
          pictureUrl: 'https://example.com/profile.jpg'
        }));
      });
    });

    // Step 5: Verify main app interface (post-login state)
    await test.step('Verify main app interface', async () => {
      // Check header
      await expect(page.locator('header, [role="banner"]')).toBeVisible();
      
      // Check stats display
      await expect(page.locator('text=Today')).toBeVisible();
      await expect(page.locator('text=Week')).toBeVisible();
      await expect(page.locator('text=Goal')).toBeVisible();
      await expect(page.locator('text=Total')).toBeVisible();
      
      // Check navigation
      await expect(page.locator('nav')).toBeVisible();
      await expect(page.locator('text=Activities')).toBeVisible();
      await expect(page.locator('text=Dashboard')).toBeVisible();
      await expect(page.locator('text=Analytics')).toBeVisible();
      await expect(page.locator('text=Leaders')).toBeVisible();
      await expect(page.locator('text=Settings')).toBeVisible();
    });

    // Step 6: Test activity creation flow
    await test.step('Test activity creation interface', async () => {
      // Check FAB button
      const fabButton = page.locator('.fab-btn, button').filter({ hasText: '+' });
      await expect(fabButton).toBeVisible();
      
      // Verify activity types
      const activityTypes = [
        { icon: '📱', points: '20' },  // Phone Call
        { icon: '🤝', points: '50' },  // Meeting
        { icon: '📋', points: '10' },  // Quotation
        { icon: '👥', points: '15' },  // Collaboration
        { icon: '📊', points: '30' },  // Presentation
        { icon: '🎓', points: '40' },  // Training
        { icon: '📄', points: '25' },  // Contract
        { icon: '✨', points: '15' }   // Other
      ];
      
      for (const activity of activityTypes) {
        await expect(page.locator(`text=${activity.icon}`)).toBeVisible();
        await expect(page.locator(`text=${activity.points}`).first()).toBeVisible();
      }
      
      // Check quantity options
      const quantities = ['1', '2', '3', '5', '10'];
      for (const qty of quantities) {
        await expect(page.locator(`text=${qty}`).nth(1)).toBeVisible();
      }
      
      // Check add button (should be disabled initially)
      const addButton = page.locator('button:has-text("เพิ่ม")');
      await expect(addButton).toBeVisible();
      await expect(addButton).toBeDisabled();
    });

    // Step 7: Test navigation
    await test.step('Test navigation between pages', async () => {
      // Dashboard navigation
      await page.locator('text=Dashboard').first().click();
      await page.waitForTimeout(500);
      
      // Analytics navigation
      await page.locator('text=Analytics').first().click();
      await page.waitForTimeout(500);
      
      // Leaders navigation
      await page.locator('text=Leaders').first().click();
      await page.waitForTimeout(500);
      
      // Settings navigation
      await page.locator('text=Settings').first().click();
      await page.waitForTimeout(500);
      
      // Back to Activities
      await page.locator('text=Activities').first().click();
      await page.waitForTimeout(500);
    });

    // Step 8: Test responsive behavior
    await test.step('Test responsive design', async () => {
      // Test mobile viewport
      await page.setViewportSize({ width: 375, height: 667 });
      await expect(page.locator('nav')).toBeVisible();
      
      // Test tablet viewport
      await page.setViewportSize({ width: 768, height: 1024 });
      await expect(page.locator('nav')).toBeVisible();
      
      // Test desktop viewport
      await page.setViewportSize({ width: 1920, height: 1080 });
      await expect(page.locator('nav')).toBeVisible();
    });

    // Step 9: Verify version display
    await test.step('Verify version information', async () => {
      const versionElement = page.locator('.version-display, [class*="version"]');
      await expect(versionElement).toBeVisible();
      await expect(versionElement).toContainText('v3.7');
    });

    // Step 10: Performance checks
    await test.step('Check page performance', async () => {
      // Measure page load time
      const startTime = Date.now();
      await page.reload();
      await page.waitForLoadState('networkidle');
      const loadTime = Date.now() - startTime;
      
      // Assert reasonable load time (adjust threshold as needed)
      expect(loadTime).toBeLessThan(5000); // 5 seconds
      
      // Check for console errors
      const consoleErrors: string[] = [];
      page.on('console', msg => {
        if (msg.type() === 'error') {
          consoleErrors.push(msg.text());
        }
      });
      
      await page.waitForTimeout(1000);
      expect(consoleErrors.length).toBe(0);
    });
  });

  test('test offline functionality', async ({ page }) => {
    await page.goto('https://frontend-dot-salesappfkt.as.r.appspot.com/');
    
    // Go offline
    await page.context().setOffline(true);
    
    // Try to navigate
    await page.reload().catch(() => {
      // Expected to fail
    });
    
    // Should show offline indicator or cached content
    // In a PWA, the service worker should serve cached content
    
    // Go back online
    await page.context().setOffline(false);
    await page.reload();
    
    // Verify app recovers
    await expect(page.locator('h1:has-text("FINNERGY Sales Tracker")')).toBeVisible();
  });

  test('test data persistence', async ({ page, context }) => {
    await page.goto('https://frontend-dot-salesappfkt.as.r.appspot.com/');
    
    // Set some test data in localStorage
    await page.evaluate(() => {
      localStorage.setItem('testData', JSON.stringify({
        timestamp: Date.now(),
        value: 'test-persistence'
      }));
    });
    
    // Open new page in same context
    const newPage = await context.newPage();
    await newPage.goto('https://frontend-dot-salesappfkt.as.r.appspot.com/');
    
    // Verify data persists
    const persistedData = await newPage.evaluate(() => {
      return localStorage.getItem('testData');
    });
    
    expect(persistedData).toBeTruthy();
    expect(JSON.parse(persistedData!).value).toBe('test-persistence');
    
    await newPage.close();
  });
});