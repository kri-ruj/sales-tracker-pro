import { test, expect } from '@playwright/test';

test.describe('FINNERGY Sales Tracker - Simple E2E Tests', () => {
  test('complete user flow', async ({ page }) => {
    console.log('🎯 Starting FINNERGY Sales Tracker E2E Test');
    
    // Step 1: Navigate to app
    console.log('Step 1: Navigating to app...');
    await page.goto('https://frontend-dot-salesappfkt.as.r.appspot.com/');
    
    // Step 2: Verify redirect to LINE login
    console.log('Step 2: Verifying LINE login redirect...');
    await expect(page).toHaveURL(/line\.me|access\.line\.me/, { timeout: 10000 });
    console.log('✅ Successfully redirected to LINE login');
    
    // Step 3: Check LINE login page
    console.log('Step 3: Checking LINE login page elements...');
    await expect(page).toHaveTitle(/LINE/);
    const loginButton = page.locator('button').filter({ hasText: /เข้าสู่ระบบ|Log in/ });
    await expect(loginButton.first()).toBeVisible();
    console.log('✅ LINE login page loaded correctly');
    
    // Step 4: Test API endpoints
    console.log('Step 4: Testing backend API...');
    const apiResponse = await page.request.get('https://sales-tracker-api-dot-salesappfkt.as.r.appspot.com/health');
    expect(apiResponse.ok()).toBeTruthy();
    const healthData = await apiResponse.json();
    console.log('✅ API Health:', healthData);
    
    // Step 5: Test static resources
    console.log('Step 5: Testing static resources...');
    const manifestResponse = await page.request.get('https://frontend-dot-salesappfkt.as.r.appspot.com/manifest.json');
    expect(manifestResponse.ok()).toBeTruthy();
    const manifest = await manifestResponse.json();
    console.log('✅ Manifest loaded:', manifest.name);
    
    // Step 6: Test LIFF URL
    console.log('Step 6: Testing LIFF URL...');
    await page.goto('https://liff.line.me/2007552096-wrG1aV9p');
    await page.waitForLoadState('networkidle');
    console.log('✅ LIFF URL accessible');
    
    console.log('🎉 All tests passed!');
  });

  test('verify PWA capabilities', async ({ page }) => {
    // Test service worker
    const swResponse = await page.request.get('https://frontend-dot-salesappfkt.as.r.appspot.com/sw.js');
    expect(swResponse.ok()).toBeTruthy();
    console.log('✅ Service worker exists');
    
    // Test manifest
    const manifestResponse = await page.request.get('https://frontend-dot-salesappfkt.as.r.appspot.com/manifest.json');
    const manifest = await manifestResponse.json();
    
    // Verify PWA requirements
    expect(manifest.name).toBeTruthy();
    expect(manifest.short_name).toBeTruthy();
    expect(manifest.start_url).toBeTruthy();
    expect(manifest.display).toBeTruthy();
    expect(manifest.icons).toBeDefined();
    expect(manifest.icons.length).toBeGreaterThan(0);
    
    console.log('✅ PWA manifest valid');
  });

  test('test API endpoints', async ({ request }) => {
    const endpoints = [
      { url: '/health', expectedStatus: 200 },
      { url: '/', expectedStatus: 200 },
      { url: '/api/leaderboard/daily', expectedStatus: [200, 401] },
      { url: '/api/team/stats', expectedStatus: [200, 401] }
    ];
    
    for (const endpoint of endpoints) {
      const response = await request.get(`https://sales-tracker-api-dot-salesappfkt.as.r.appspot.com${endpoint.url}`);
      
      if (Array.isArray(endpoint.expectedStatus)) {
        expect(endpoint.expectedStatus).toContain(response.status());
      } else {
        expect(response.status()).toBe(endpoint.expectedStatus);
      }
      
      console.log(`✅ ${endpoint.url} - Status: ${response.status()}`);
    }
  });

  test('performance metrics', async ({ page }) => {
    const startTime = Date.now();
    await page.goto('https://frontend-dot-salesappfkt.as.r.appspot.com/');
    const loadTime = Date.now() - startTime;
    
    console.log(`⏱️ Initial load time: ${loadTime}ms`);
    expect(loadTime).toBeLessThan(5000); // Should load within 5 seconds
    
    // Measure redirect time
    const redirectStart = Date.now();
    await page.waitForURL(/line\.me|access\.line\.me/, { timeout: 10000 });
    const redirectTime = Date.now() - redirectStart;
    
    console.log(`⏱️ Redirect time: ${redirectTime}ms`);
    expect(redirectTime).toBeLessThan(3000); // Redirect should happen within 3 seconds
  });

  test('mobile responsiveness', async ({ page, browserName }) => {
    // Skip on webkit as it might have different behavior
    test.skip(browserName === 'webkit', 'Webkit has different mobile behavior');
    
    // Test different mobile viewports
    const viewports = [
      { name: 'iPhone SE', width: 375, height: 667 },
      { name: 'iPhone 12', width: 390, height: 844 },
      { name: 'Pixel 5', width: 393, height: 851 },
      { name: 'Galaxy S21', width: 360, height: 800 }
    ];
    
    for (const viewport of viewports) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto('https://frontend-dot-salesappfkt.as.r.appspot.com/');
      
      // Take screenshot for visual verification
      await page.screenshot({ 
        path: `screenshots/${viewport.name.replace(' ', '-')}.png`,
        fullPage: false 
      });
      
      console.log(`✅ Tested ${viewport.name} (${viewport.width}x${viewport.height})`);
    }
  });
});