import { test, expect } from '@playwright/test';

test.describe('API Monitoring and Network Tests', () => {
  test('monitor API calls during login flow', async ({ page }) => {
    // Collect all API requests
    const apiRequests: string[] = [];
    
    page.on('request', request => {
      if (request.url().includes('api/') || request.url().includes('liff')) {
        apiRequests.push(`${request.method()} ${request.url()}`);
      }
    });
    
    // Collect API responses
    const apiResponses: { url: string; status: number; duration: number }[] = [];
    
    page.on('response', response => {
      if (response.url().includes('api/') || response.url().includes('liff')) {
        apiResponses.push({
          url: response.url(),
          status: response.status(),
          duration: response.request().timing().responseEnd
        });
      }
    });
    
    // Navigate to app
    await page.goto('https://frontend-dot-salesappfkt.as.r.appspot.com/');
    
    // Wait for potential API calls
    await page.waitForTimeout(2000);
    
    // Log collected data
    console.log('API Requests:', apiRequests);
    console.log('API Responses:', apiResponses);
    
    // Verify no failed API calls
    const failedRequests = apiResponses.filter(r => r.status >= 400);
    expect(failedRequests).toHaveLength(0);
  });

  test('test API performance', async ({ page }) => {
    const performanceMetrics: any[] = [];
    
    // Monitor performance
    page.on('response', async response => {
      if (response.url().includes('api/')) {
        const timing = response.request().timing();
        performanceMetrics.push({
          url: response.url(),
          duration: timing.responseEnd,
          size: (await response.body()).length
        });
      }
    });
    
    await page.goto('https://frontend-dot-salesappfkt.as.r.appspot.com/');
    await page.waitForLoadState('networkidle');
    
    // Check API response times
    performanceMetrics.forEach(metric => {
      // API calls should respond within 3 seconds
      expect(metric.duration).toBeLessThan(3000);
      console.log(`API: ${metric.url} - ${metric.duration}ms - ${metric.size} bytes`);
    });
  });

  test('test backend health endpoint', async ({ request }) => {
    // Direct API test without browser
    const response = await request.get('https://sales-tracker-api-dot-salesappfkt.as.r.appspot.com/health');
    
    expect(response.ok()).toBeTruthy();
    expect(response.status()).toBe(200);
    
    const data = await response.json();
    expect(data).toHaveProperty('status');
    expect(data.status).toBe('ok');
  });

  test('test CORS headers', async ({ request }) => {
    const response = await request.get('https://sales-tracker-api-dot-salesappfkt.as.r.appspot.com/health');
    
    // Check CORS headers
    const headers = response.headers();
    expect(headers['access-control-allow-origin']).toBeTruthy();
  });

  test('monitor resource loading', async ({ page }) => {
    const resources: { type: string; url: string; size: number }[] = [];
    
    page.on('response', async response => {
      const request = response.request();
      const resourceType = request.resourceType();
      
      if (['stylesheet', 'script', 'image', 'font'].includes(resourceType)) {
        resources.push({
          type: resourceType,
          url: response.url(),
          size: (await response.body()).length
        });
      }
    });
    
    await page.goto('https://frontend-dot-salesappfkt.as.r.appspot.com/');
    await page.waitForLoadState('networkidle');
    
    // Analyze resources
    const totalSize = resources.reduce((sum, r) => sum + r.size, 0);
    console.log(`Total resources: ${resources.length}`);
    console.log(`Total size: ${(totalSize / 1024 / 1024).toFixed(2)} MB`);
    
    // Group by type
    const byType = resources.reduce((acc, r) => {
      acc[r.type] = (acc[r.type] || 0) + r.size;
      return acc;
    }, {} as Record<string, number>);
    
    console.log('Resource breakdown:');
    Object.entries(byType).forEach(([type, size]) => {
      console.log(`  ${type}: ${(size / 1024).toFixed(2)} KB`);
    });
    
    // Performance assertions
    expect(totalSize).toBeLessThan(5 * 1024 * 1024); // Less than 5MB total
  });

  test('test service worker registration', async ({ page }) => {
    await page.goto('https://frontend-dot-salesappfkt.as.r.appspot.com/');
    
    // Check if service worker is registered
    const hasServiceWorker = await page.evaluate(async () => {
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        return registrations.length > 0;
      }
      return false;
    });
    
    expect(hasServiceWorker).toBeTruthy();
    
    // Check cache storage
    const cacheNames = await page.evaluate(async () => {
      if ('caches' in window) {
        return await caches.keys();
      }
      return [];
    });
    
    console.log('Cache names:', cacheNames);
    expect(cacheNames.length).toBeGreaterThan(0);
  });
});