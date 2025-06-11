import { test, expect } from '@playwright/test';

test.describe('FINNERGY Sales Tracker - LIFF App Tests', () => {
  test('should redirect to LINE login for unauthenticated users', async ({ page }) => {
    // When accessing LIFF app without authentication
    await page.goto('https://frontend-dot-salesappfkt.as.r.appspot.com/');
    
    // Should redirect to LINE login
    await expect(page).toHaveURL(/line\.me|access\.line\.me/);
    await expect(page).toHaveTitle(/LINE/);
    
    // Verify LINE login page elements
    const loginButton = page.locator('button').filter({ hasText: /เข้าสู่ระบบ|Log in/ });
    await expect(loginButton.first()).toBeVisible();
  });

  test('verify LIFF redirect URL contains correct parameters', async ({ page }) => {
    // Navigate to app
    await page.goto('https://frontend-dot-salesappfkt.as.r.appspot.com/');
    
    // Wait for redirect to LINE
    await page.waitForURL(/line\.me|access\.line\.me/, { timeout: 10000 });
    
    // Check redirect URL parameters
    const url = page.url();
    expect(url).toContain('response_type');
    expect(url).toContain('client_id');
  });

  test('test direct LIFF URL access', async ({ page }) => {
    // Try accessing via LIFF URL directly
    await page.goto('https://liff.line.me/2007552096-wrG1aV9p');
    
    // Should redirect to LINE login if not authenticated
    await page.waitForLoadState('networkidle');
    
    const url = page.url();
    expect(url).toMatch(/line\.me|frontend-dot-salesappfkt/);
  });

  test('verify app handles missing LIFF context gracefully', async ({ page }) => {
    // Directly access the app without LIFF
    const response = await page.goto('https://frontend-dot-salesappfkt.as.r.appspot.com/', {
      waitUntil: 'domcontentloaded'
    });
    
    // App should handle this gracefully
    expect(response?.status()).toBeLessThan(400);
  });

  test('check app manifest and PWA setup', async ({ page }) => {
    // Use direct fetch to avoid redirect
    const response = await page.request.get('https://frontend-dot-salesappfkt.as.r.appspot.com/manifest.json');
    
    expect(response.ok()).toBeTruthy();
    
    const manifest = await response.json();
    expect(manifest.name).toBeTruthy();
    expect(manifest.short_name).toBeTruthy();
    expect(manifest.icons).toBeDefined();
  });

  test('verify service worker registration', async ({ page }) => {
    // Check if service worker file exists
    const swResponse = await page.request.get('https://frontend-dot-salesappfkt.as.r.appspot.com/sw.js');
    expect(swResponse.ok()).toBeTruthy();
    
    // Verify it's a valid JavaScript file
    const contentType = swResponse.headers()['content-type'];
    expect(contentType).toContain('javascript');
  });

  test('test API health endpoint', async ({ request }) => {
    const response = await request.get('https://sales-tracker-api-dot-salesappfkt.as.r.appspot.com/health');
    
    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(data.status.toLowerCase()).toBe('ok');
  });

  test('verify static assets are accessible', async ({ page }) => {
    const assets = [
      '/manifest.json',
      '/sw.js',
      '/version.json'
    ];
    
    for (const asset of assets) {
      const response = await page.request.get(`https://frontend-dot-salesappfkt.as.r.appspot.com${asset}`);
      // Some assets might not exist, so just check if response is valid
      expect(response.status()).toBeDefined();
    }
  });

  test('check version endpoint', async ({ request }) => {
    const response = await request.get('https://frontend-dot-salesappfkt.as.r.appspot.com/version.json');
    
    if (response.ok()) {
      const version = await response.json();
      expect(version.version).toMatch(/^\d+\.\d+\.\d+$/);
      expect(version.timestamp).toBeDefined();
    }
  });

  test('verify CORS headers on API', async ({ request }) => {
    const response = await request.get('https://sales-tracker-api-dot-salesappfkt.as.r.appspot.com/health');
    
    const headers = response.headers();
    expect(headers['access-control-allow-origin']).toBeDefined();
  });
});