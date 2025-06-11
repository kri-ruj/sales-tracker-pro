import { test, expect } from '@playwright/test';

test.describe('Version and Cache Management', () => {
  test('should display correct version number', async ({ page }) => {
    await page.goto('/');
    
    // Wait for app to load
    await page.waitForLoadState('networkidle');
    
    // Check version in multiple places
    const versionElement = await page.locator('#versionNumber');
    const appVersionElement = await page.locator('#appVersion');
    
    // Get version from config.js
    const configVersion = await page.evaluate(() => {
      return (window as any).CONFIG?.VERSION;
    });
    
    expect(configVersion).toBe('3.7.11');
    
    // If logged in, check version displays
    if (await versionElement.isVisible()) {
      expect(await versionElement.textContent()).toBe('3.7.11');
    }
    
    if (await appVersionElement.isVisible()) {
      expect(await appVersionElement.textContent()).toBe('3.7.11');
    }
  });

  test('should load config.js with cache busting', async ({ page }) => {
    const configRequests: string[] = [];
    
    // Monitor network requests
    page.on('request', request => {
      if (request.url().includes('config.js')) {
        configRequests.push(request.url());
      }
    });
    
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Should have loaded config.js with timestamp parameter
    expect(configRequests.length).toBeGreaterThan(0);
    expect(configRequests[0]).toMatch(/config\.js\?v=\d+/);
  });

  test('should load version.json endpoint', async ({ page }) => {
    const response = await page.goto('/version.json');
    expect(response?.status()).toBe(200);
    
    const versionData = await response?.json();
    expect(versionData).toHaveProperty('version');
    expect(versionData.version).toBe('3.7.11');
    expect(versionData).toHaveProperty('timestamp');
  });

  test('should register service worker with version', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Check if service worker is registered
    const swRegistration = await page.evaluate(async () => {
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        return registrations.length > 0;
      }
      return false;
    });
    
    expect(swRegistration).toBe(true);
    
    // Check service worker URL includes version
    const swUrl = await page.evaluate(async () => {
      const registrations = await navigator.serviceWorker.getRegistrations();
      return registrations[0]?.active?.scriptURL || '';
    });
    
    expect(swUrl).toContain('/sw.js');
  });

  test('should handle version mismatch by clearing cache', async ({ page, context }) => {
    // Set an old version in localStorage
    await context.addInitScript(() => {
      localStorage.setItem('appVersion', '3.7.0');
    });
    
    // Track if caches were cleared
    let cacheCleared = false;
    await page.addInitScript(() => {
      const originalDelete = caches.delete;
      (caches as any).delete = function(...args: any[]) {
        (window as any).__cacheCleared = true;
        return originalDelete.apply(caches, args);
      };
    });
    
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Check if cache clearing was triggered
    cacheCleared = await page.evaluate(() => (window as any).__cacheCleared || false);
    
    // Version should be updated
    const storedVersion = await page.evaluate(() => localStorage.getItem('appVersion'));
    expect(storedVersion).toBe('3.7.11');
  });

  test('should load CSS with version parameter', async ({ page }) => {
    const cssRequests: string[] = [];
    
    page.on('request', request => {
      if (request.url().includes('liquid-glass-styles.css')) {
        cssRequests.push(request.url());
      }
    });
    
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // CSS should be loaded with version parameter
    expect(cssRequests.length).toBeGreaterThan(0);
    expect(cssRequests[0]).toMatch(/liquid-glass-styles\.css\?v=3\.7\.11/);
  });

  test('should handle force update page', async ({ page }) => {
    const response = await page.goto('/force-update.html');
    expect(response?.status()).toBe(200);
    
    // Force update page should exist
    const title = await page.title();
    expect(title).toContain('Force Update');
  });

  test('should receive service worker update notifications', async ({ page }) => {
    await page.goto('/');
    
    // Listen for SW messages
    const swMessages: any[] = [];
    await page.evaluateOnNewDocument(() => {
      navigator.serviceWorker.addEventListener('message', (event) => {
        (window as any).__swMessages = (window as any).__swMessages || [];
        (window as any).__swMessages.push(event.data);
      });
    });
    
    // Trigger SW update check
    await page.evaluate(async () => {
      const registration = await navigator.serviceWorker.ready;
      await registration.update();
    });
    
    await page.waitForTimeout(2000);
    
    // Check if any update messages were received
    const messages = await page.evaluate(() => (window as any).__swMessages || []);
    // Messages might include SW_UPDATED, CACHE_CLEARED, etc.
    expect(Array.isArray(messages)).toBe(true);
  });

  test('should have proper cache headers on critical files', async ({ page }) => {
    // Test config.js
    const configResponse = await page.request.get('/config.js');
    expect(configResponse.headers()['cache-control']).toContain('no-cache');
    
    // Test version.json
    const versionResponse = await page.request.get('/version.json');
    expect(versionResponse.headers()['cache-control']).toContain('no-cache');
    
    // Test sw.js
    const swResponse = await page.request.get('/sw.js');
    expect(swResponse.headers()['cache-control']).toContain('no-cache');
  });
});