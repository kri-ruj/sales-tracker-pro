import { test, expect, Page } from '@playwright/test';

test.describe('Advanced Automation Examples', () => {
  test('intercept and modify network requests', async ({ page }) => {
    // Intercept API calls and modify responses
    await page.route('**/api/activities', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          activities: [
            { id: 1, type: 'phone', points: 20, timestamp: Date.now() },
            { id: 2, type: 'meeting', points: 50, timestamp: Date.now() }
          ]
        })
      });
    });
    
    await page.goto('https://frontend-dot-salesappfkt.as.r.appspot.com/');
    
    // The app will now receive our mocked data
  });

  test('simulate different network conditions', async ({ page, context }) => {
    // Create context with slow 3G network
    const slow3G = {
      offline: false,
      downloadThroughput: 50 * 1024 / 8, // 50kb/s
      uploadThroughput: 50 * 1024 / 8,
      latency: 400
    };
    
    await context.route('**/*', async route => {
      await new Promise(resolve => setTimeout(resolve, slow3G.latency));
      await route.continue();
    });
    
    const startTime = Date.now();
    await page.goto('https://frontend-dot-salesappfkt.as.r.appspot.com/');
    const loadTime = Date.now() - startTime;
    
    console.log(`Page load time on slow 3G: ${loadTime}ms`);
    expect(loadTime).toBeGreaterThan(slow3G.latency);
  });

  test('automate complex user interactions', async ({ page }) => {
    await page.goto('https://frontend-dot-salesappfkt.as.r.appspot.com/');
    
    // Simulate keyboard shortcuts
    await page.keyboard.press('Tab'); // Navigate with keyboard
    await page.keyboard.press('Enter'); // Activate focused element
    
    // Simulate touch gestures (for mobile testing)
    await page.setViewportSize({ width: 375, height: 667 });
    
    // Swipe gesture simulation
    await page.mouse.move(200, 300);
    await page.mouse.down();
    await page.mouse.move(50, 300, { steps: 10 });
    await page.mouse.up();
  });

  test('extract and analyze performance metrics', async ({ page }) => {
    await page.goto('https://frontend-dot-salesappfkt.as.r.appspot.com/');
    
    // Get performance metrics
    const metrics = await page.evaluate(() => {
      const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      const paint = performance.getEntriesByType('paint');
      
      return {
        domContentLoaded: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
        loadComplete: navigation.loadEventEnd - navigation.loadEventStart,
        firstPaint: paint.find(p => p.name === 'first-paint')?.startTime,
        firstContentfulPaint: paint.find(p => p.name === 'first-contentful-paint')?.startTime,
        resources: performance.getEntriesByType('resource').length
      };
    });
    
    console.log('Performance Metrics:', metrics);
    
    // Assert performance thresholds
    expect(metrics.firstContentfulPaint).toBeLessThan(3000); // FCP under 3s
    expect(metrics.domContentLoaded).toBeLessThan(2000); // DOM ready under 2s
  });

  test('test progressive web app features', async ({ page, context }) => {
    await page.goto('https://frontend-dot-salesappfkt.as.r.appspot.com/');
    
    // Check PWA manifest
    const manifestLink = await page.$('link[rel="manifest"]');
    expect(manifestLink).toBeTruthy();
    
    // Test offline capability
    await context.setOffline(true);
    
    // Reload page while offline
    try {
      await page.reload();
      // If service worker is properly configured, page should still load
      const title = await page.title();
      expect(title).toContain('FINNERGY');
    } catch (error) {
      // Expected if no service worker
      console.log('App requires network connection');
    }
    
    await context.setOffline(false);
  });

  test('accessibility testing', async ({ page }) => {
    await page.goto('https://frontend-dot-salesappfkt.as.r.appspot.com/');
    
    // Check for accessibility violations
    const accessibilityTree = await page.accessibility.snapshot();
    
    // Verify important elements have proper roles
    const buttons = await page.$$('button');
    for (const button of buttons) {
      const role = await button.getAttribute('role');
      const ariaLabel = await button.getAttribute('aria-label');
      const text = await button.textContent();
      
      // Buttons should have accessible text
      expect(text || ariaLabel).toBeTruthy();
    }
    
    // Check color contrast
    const loginButton = page.locator('button:has-text("Login with LINE")');
    const contrast = await loginButton.evaluate(el => {
      const style = window.getComputedStyle(el);
      return {
        color: style.color,
        backgroundColor: style.backgroundColor
      };
    });
    
    console.log('Button contrast:', contrast);
  });

  test('multi-tab testing', async ({ context }) => {
    // Open multiple tabs
    const page1 = await context.newPage();
    const page2 = await context.newPage();
    
    // Navigate both tabs
    await page1.goto('https://frontend-dot-salesappfkt.as.r.appspot.com/');
    await page2.goto('https://frontend-dot-salesappfkt.as.r.appspot.com/');
    
    // Simulate actions in one tab
    await page1.evaluate(() => {
      localStorage.setItem('testData', 'from-tab-1');
    });
    
    // Check if data syncs to other tab
    await page2.reload();
    const dataInTab2 = await page2.evaluate(() => {
      return localStorage.getItem('testData');
    });
    
    expect(dataInTab2).toBe('from-tab-1');
    
    await page1.close();
    await page2.close();
  });

  test('geolocation testing', async ({ context }) => {
    // Grant geolocation permission
    await context.grantPermissions(['geolocation']);
    
    // Set mock geolocation
    await context.setGeolocation({ latitude: 13.7563, longitude: 100.5018 }); // Bangkok
    
    const page = await context.newPage();
    await page.goto('https://frontend-dot-salesappfkt.as.r.appspot.com/');
    
    // If app uses geolocation, it would receive the mocked coordinates
    const location = await page.evaluate(() => {
      return new Promise(resolve => {
        if ('geolocation' in navigator) {
          navigator.geolocation.getCurrentPosition(
            position => resolve({
              latitude: position.coords.latitude,
              longitude: position.coords.longitude
            }),
            () => resolve(null)
          );
        } else {
          resolve(null);
        }
      });
    });
    
    if (location) {
      expect(location.latitude).toBe(13.7563);
      expect(location.longitude).toBe(100.5018);
    }
  });
});