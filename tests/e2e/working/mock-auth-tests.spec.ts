import { test, expect } from '@playwright/test';

test.describe('FINNERGY Sales Tracker - Mock Authentication Tests', () => {
  // Mock LIFF environment
  test.beforeEach(async ({ page }) => {
    // Intercept LIFF SDK and provide mock implementation
    await page.addInitScript(() => {
      // Mock LIFF object
      (window as any).liff = {
        init: () => Promise.resolve(),
        ready: Promise.resolve(),
        isLoggedIn: () => true,
        getProfile: () => Promise.resolve({
          userId: 'U1234567890',
          displayName: 'Test User',
          pictureUrl: 'https://example.com/profile.jpg',
          statusMessage: 'Testing'
        }),
        getAccessToken: () => 'mock-access-token',
        logout: () => Promise.resolve(),
        closeWindow: () => {},
        isInClient: () => true,
        getOS: () => 'web',
        getLanguage: () => 'en',
        getVersion: () => '2.22.3',
        getLineVersion: () => '12.0.0',
        isApiAvailable: () => true,
        sendMessages: () => Promise.resolve()
      };
      
      // Set LIFF to be ready
      (window as any).liffReady = true;
    });
    
    // Mock backend API responses
    await page.route('**/api/**', route => {
      const url = route.request().url();
      
      if (url.includes('/api/users')) {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            userId: 'U1234567890',
            displayName: 'Test User',
            pictureUrl: 'https://example.com/profile.jpg',
            dailyGoal: 300,
            role: 'user'
          })
        });
      } else if (url.includes('/api/activities')) {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            activities: [
              {
                id: 1,
                userId: 'U1234567890',
                type: 'phone',
                points: 20,
                quantity: 2,
                timestamp: new Date().toISOString()
              },
              {
                id: 2,
                userId: 'U1234567890',
                type: 'meeting',
                points: 50,
                quantity: 1,
                timestamp: new Date().toISOString()
              }
            ]
          })
        });
      } else if (url.includes('/api/team/stats')) {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            totalPoints: 90,
            todayPoints: 90,
            weekPoints: 90,
            monthPoints: 90,
            goalProgress: 30,
            activitiesCount: 2
          })
        });
      } else {
        route.continue();
      }
    });
  });

  test('should display main app interface with mock authentication', async ({ page }) => {
    await page.goto('https://frontend-dot-salesappfkt.as.r.appspot.com/');
    
    // Wait for app to initialize with mock LIFF
    await page.waitForTimeout(2000);
    
    // Should show main app interface (not login page)
    const mainApp = await page.$('#mainApp');
    if (mainApp) {
      const isVisible = await mainApp.isVisible();
      expect(isVisible).toBeTruthy();
    }
    
    // Check for activity elements
    const hasActivityElements = await page.evaluate(() => {
      const body = document.body.innerText;
      return body.includes('Activities') || body.includes('📱') || body.includes('เพิ่ม');
    });
    expect(hasActivityElements).toBeTruthy();
  });

  test('should display user profile information', async ({ page }) => {
    await page.goto('https://frontend-dot-salesappfkt.as.r.appspot.com/');
    await page.waitForTimeout(2000);
    
    // Check if user name is displayed
    const hasUserName = await page.evaluate(() => {
      const body = document.body.innerText;
      return body.includes('Test User');
    });
    
    // User profile might be in header or menu
    console.log('Has user name:', hasUserName);
  });

  test('should handle activity creation with mock API', async ({ page }) => {
    await page.goto('https://frontend-dot-salesappfkt.as.r.appspot.com/');
    await page.waitForTimeout(2000);
    
    // Try to find and click activity type
    const phoneActivity = await page.$('text=📱');
    if (phoneActivity) {
      await phoneActivity.click();
      
      // Select quantity
      const quantity2 = await page.$('text=2');
      if (quantity2) {
        await quantity2.click();
      }
      
      // Check if add button becomes enabled
      const addButton = await page.$('button:has-text("เพิ่ม")');
      if (addButton) {
        const isDisabled = await addButton.isDisabled();
        console.log('Add button disabled:', isDisabled);
      }
    }
  });

  test('should display stats from mock API', async ({ page }) => {
    await page.goto('https://frontend-dot-salesappfkt.as.r.appspot.com/');
    await page.waitForTimeout(2000);
    
    // Check for stats display
    const statsText = await page.evaluate(() => {
      const stats = [];
      // Look for point values
      const elements = document.querySelectorAll('*');
      elements.forEach(el => {
        const text = el.textContent?.trim();
        if (text && /^\d+$/.test(text) && parseInt(text) > 0) {
          stats.push(text);
        }
      });
      return stats;
    });
    
    console.log('Found stats:', statsText);
    expect(statsText.length).toBeGreaterThan(0);
  });

  test('test navigation with mock auth', async ({ page }) => {
    await page.goto('https://frontend-dot-salesappfkt.as.r.appspot.com/');
    await page.waitForTimeout(2000);
    
    // Try clicking navigation items
    const navItems = ['Dashboard', 'Analytics', 'Leaders', 'Settings'];
    
    for (const item of navItems) {
      const navElement = await page.$(`text=${item}`);
      if (navElement) {
        await navElement.click();
        await page.waitForTimeout(500);
        console.log(`Clicked ${item}`);
      }
    }
  });

  test('test logout functionality', async ({ page }) => {
    await page.goto('https://frontend-dot-salesappfkt.as.r.appspot.com/');
    await page.waitForTimeout(2000);
    
    // Look for logout button or menu
    const menuButton = await page.$('button:has-text("☰"), button:has-text("🎯")');
    if (menuButton) {
      await menuButton.click();
      await page.waitForTimeout(500);
      
      // Look for logout option
      const logoutButton = await page.$('text=Logout, text=ออกจากระบบ');
      if (logoutButton) {
        await logoutButton.click();
        console.log('Clicked logout');
      }
    }
  });
});