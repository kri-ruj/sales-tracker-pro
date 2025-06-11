import { test, expect } from '../fixtures/auth.fixture';
import { TEST_PROFILES } from '../utils/mock-liff';

test.describe('Offline Sync', () => {
  test.beforeEach(async ({ loginAsUser, page }) => {
    // Mock API responses
    await page.route('**/api/activities/sync', async route => {
      await route.fulfill({
        status: 200,
        json: { success: true, synced: 3 }
      });
    });

    await loginAsUser(TEST_PROFILES.user1);
  });

  test('should detect offline status', async ({ page, context }) => {
    await page.waitForSelector('.app-container');
    
    // Go offline
    await context.setOffline(true);
    
    // Wait for status update
    await page.waitForTimeout(1000);
    
    // Check network status indicator
    const networkStatus = page.locator('#networkStatusDot');
    await expect(networkStatus).toHaveClass(/offline/);
  });

  test('should queue activities when offline', async ({ page, context, activitiesPage }) => {
    await activitiesPage.waitForPageLoad();
    
    // Go offline
    await context.setOffline(true);
    await page.waitForTimeout(500);
    
    // Create activity while offline
    await activitiesPage.clickActivity('call');
    await activitiesPage.submitActivities();
    
    // Should show offline indicator
    await expect(page.locator('.toast.warning')).toContainText('Saved offline');
    
    // Check localStorage for pending activities
    const pendingActivities = await page.evaluate(() => {
      return JSON.parse(localStorage.getItem('pendingActivities') || '[]');
    });
    expect(pendingActivities.length).toBeGreaterThan(0);
  });

  test('should sync activities when back online', async ({ page, context, activitiesPage }) => {
    await activitiesPage.waitForPageLoad();
    
    // Go offline
    await context.setOffline(true);
    await page.waitForTimeout(500);
    
    // Create activities while offline
    await activitiesPage.clickActivity('call');
    await activitiesPage.submitActivities();
    await page.waitForTimeout(500);
    
    await activitiesPage.clickActivity('appointment');
    await activitiesPage.submitActivities();
    
    // Check pending queue
    const pendingBefore = await page.evaluate(() => {
      return JSON.parse(localStorage.getItem('pendingActivities') || '[]');
    });
    expect(pendingBefore.length).toBe(2);
    
    // Go back online
    await context.setOffline(false);
    
    // Wait for auto-sync
    await page.waitForTimeout(2000);
    
    // Check sync status
    const syncStatus = page.locator('#syncStatusDot');
    await expect(syncStatus).toHaveClass(/synced/);
    
    // Pending queue should be cleared
    const pendingAfter = await page.evaluate(() => {
      return JSON.parse(localStorage.getItem('pendingActivities') || '[]');
    });
    expect(pendingAfter.length).toBe(0);
  });

  test('should show sync progress indicator', async ({ page, context, activitiesPage }) => {
    await activitiesPage.waitForPageLoad();
    
    // Create offline activities
    await context.setOffline(true);
    await activitiesPage.clickActivity('call');
    await activitiesPage.submitActivities();
    
    // Mock slow sync
    await page.route('**/api/activities/sync', async route => {
      await new Promise(resolve => setTimeout(resolve, 2000));
      await route.fulfill({
        status: 200,
        json: { success: true }
      });
    });
    
    // Go online
    await context.setOffline(false);
    
    // Should show syncing status
    const syncStatus = page.locator('#syncStatusDot');
    await expect(syncStatus).toHaveClass(/syncing/);
    
    // Wait for sync to complete
    await expect(syncStatus).toHaveClass(/synced/, { timeout: 5000 });
  });

  test('should handle sync conflicts', async ({ page, context, activitiesPage }) => {
    await activitiesPage.waitForPageLoad();
    
    // Mock conflict response
    await page.route('**/api/activities/sync', async route => {
      await route.fulfill({
        status: 409,
        json: {
          error: 'Conflict',
          conflicts: [{
            local: { id: '1', points: 10 },
            server: { id: '1', points: 15 }
          }]
        }
      });
    });
    
    // Create offline activity
    await context.setOffline(true);
    await activitiesPage.clickActivity('call');
    await activitiesPage.submitActivities();
    
    // Go online - should trigger sync
    await context.setOffline(false);
    await page.waitForTimeout(1000);
    
    // Should show conflict resolution dialog
    await expect(page.locator('.conflict-dialog')).toBeVisible();
  });

  test('should persist data in localStorage', async ({ page, activitiesPage }) => {
    await activitiesPage.waitForPageLoad();
    
    // Create some activities
    await activitiesPage.clickActivity('call');
    await activitiesPage.submitActivities();
    await activitiesPage.waitForSuccessModal();
    await activitiesPage.closeSuccessModal();
    
    // Check localStorage
    const storedData = await page.evaluate(() => {
      return {
        profile: localStorage.getItem('lineUserProfile'),
        settings: localStorage.getItem('userSettings'),
        version: localStorage.getItem('appVersion')
      };
    });
    
    expect(storedData.profile).toBeTruthy();
    expect(JSON.parse(storedData.profile)).toHaveProperty('userId');
    expect(storedData.version).toBe('3.7.11');
  });

  test('should handle network errors during sync', async ({ page, context, activitiesPage }) => {
    await activitiesPage.waitForPageLoad();
    
    // Create offline activity
    await context.setOffline(true);
    await activitiesPage.clickActivity('call');
    await activitiesPage.submitActivities();
    
    // Mock network error
    await page.route('**/api/activities/sync', async route => {
      await route.abort('connectionfailed');
    });
    
    // Go online
    await context.setOffline(false);
    
    // Should retry sync
    await page.waitForTimeout(3000);
    
    // Activities should still be pending
    const pending = await page.evaluate(() => {
      return JSON.parse(localStorage.getItem('pendingActivities') || '[]');
    });
    expect(pending.length).toBeGreaterThan(0);
  });

  test('should show offline banner', async ({ page, context }) => {
    await page.waitForSelector('.app-container');
    
    // Go offline
    await context.setOffline(true);
    await page.waitForTimeout(500);
    
    // Should show offline banner
    await expect(page.locator('.offline-banner')).toBeVisible();
    await expect(page.locator('.offline-banner')).toContainText('You are offline');
    
    // Go online
    await context.setOffline(false);
    await page.waitForTimeout(500);
    
    // Banner should disappear
    await expect(page.locator('.offline-banner')).toBeHidden();
  });

  test('should cache API responses for offline use', async ({ page, context }) => {
    await page.waitForSelector('.app-container');
    
    // Make sure data is loaded
    await page.click('text=Leaderboard');
    await page.waitForSelector('.leaderboard-item');
    
    // Go offline
    await context.setOffline(true);
    
    // Navigate away and back
    await page.click('text=Activities');
    await page.click('text=Leaderboard');
    
    // Should still show cached data
    await expect(page.locator('.leaderboard-item')).toHaveCount(3);
  });

  test('should update UI optimistically', async ({ page, context, activitiesPage }) => {
    await activitiesPage.waitForPageLoad();
    
    // Get initial points
    const initialPoints = await activitiesPage.getTodayPoints();
    
    // Go offline
    await context.setOffline(true);
    
    // Submit activity
    await activitiesPage.clickActivity('call'); // 10 points
    await activitiesPage.submitActivities();
    
    // Points should update immediately (optimistic update)
    await page.waitForTimeout(500);
    const newPoints = await activitiesPage.getTodayPoints();
    expect(newPoints).toBe(initialPoints + 10);
    
    // Activity count should also update
    const activityCount = await activitiesPage.getTodayActivitiesCount();
    expect(activityCount).toBeGreaterThan(0);
  });
});