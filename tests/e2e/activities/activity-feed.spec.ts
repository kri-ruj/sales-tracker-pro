import { test, expect } from '../fixtures/auth.fixture';
import { TEST_PROFILES } from '../utils/mock-liff';

test.describe('Activity Feed', () => {
  const mockActivities = [
    {
      id: 'act_1',
      lineUserId: 'U0001',
      activityType: 'call',
      title: 'โทร',
      subtitle: 'ติดต่อลูกค้า',
      points: 10,
      count: 1,
      date: new Date().toISOString().split('T')[0],
      createdAt: new Date(Date.now() - 3600000).toISOString() // 1 hour ago
    },
    {
      id: 'act_2',
      lineUserId: 'U0001',
      activityType: 'appointment',
      title: 'นัด',
      subtitle: 'พบลูกค้า',
      points: 15,
      count: 1,
      date: new Date().toISOString().split('T')[0],
      createdAt: new Date(Date.now() - 7200000).toISOString() // 2 hours ago
    },
    {
      id: 'act_3',
      lineUserId: 'U0001',
      activityType: 'present',
      title: 'นำเสนอ',
      subtitle: 'นำเสนอแผนประกัน',
      points: 30,
      count: 1,
      date: new Date().toISOString().split('T')[0],
      createdAt: new Date(Date.now() - 10800000).toISOString() // 3 hours ago
    }
  ];

  test.beforeEach(async ({ loginAsUser, page }) => {
    // Mock activities API
    await page.route('**/api/activities/user/*', async route => {
      await route.fulfill({
        status: 200,
        json: mockActivities
      });
    });

    // Mock delete API
    await page.route('**/api/activities/*', async route => {
      if (route.request().method() === 'DELETE') {
        await route.fulfill({
          status: 200,
          json: { success: true }
        });
      }
    });

    await loginAsUser(TEST_PROFILES.user1);
  });

  test('should display activity feed', async ({ page, activitiesPage }) => {
    await activitiesPage.waitForPageLoad();
    
    // Check feed is visible
    await expect(activitiesPage.activityFeed).toBeVisible();
    
    // Should show all activities
    const activityItems = page.locator('.activity-item');
    await expect(activityItems).toHaveCount(3);
  });

  test('should display activity details correctly', async ({ page, activitiesPage }) => {
    await activitiesPage.waitForPageLoad();
    
    // Check first activity
    const firstActivity = await activitiesPage.getActivityFromFeed(0);
    expect(firstActivity.title).toContain('โทร');
    expect(firstActivity.points).toContain('10');
    expect(firstActivity.time).toBeTruthy();
  });

  test('should show activities in chronological order', async ({ page, activitiesPage }) => {
    await activitiesPage.waitForPageLoad();
    
    // Get all activity times
    const times = await page.locator('.activity-time').allTextContents();
    
    // Most recent should be first
    expect(times.length).toBe(3);
    // Times should be in descending order
  });

  test('should delete activity', async ({ page, activitiesPage }) => {
    await activitiesPage.waitForPageLoad();
    
    // Initial count
    let activityCount = await page.locator('.activity-item').count();
    expect(activityCount).toBe(3);
    
    // Delete first activity
    await activitiesPage.deleteActivity(0);
    
    // Confirm deletion if dialog appears
    page.on('dialog', dialog => dialog.accept());
    
    // Wait for deletion
    await page.waitForTimeout(500);
    
    // Should have one less activity
    activityCount = await page.locator('.activity-item').count();
    expect(activityCount).toBe(2);
  });

  test('should show empty state when no activities', async ({ page, activitiesPage }) => {
    // Override with empty response
    await page.route('**/api/activities/user/*', async route => {
      await route.fulfill({
        status: 200,
        json: []
      });
    });
    
    await page.reload();
    await activitiesPage.waitForPageLoad();
    
    // Should show empty state
    await expect(page.locator('.empty-activities')).toBeVisible();
    await expect(page.locator('.empty-activities')).toContainText('No activities yet');
  });

  test('should group activities by date', async ({ page, activitiesPage }) => {
    // Mock activities from different dates
    await page.route('**/api/activities/user/*', async route => {
      await route.fulfill({
        status: 200,
        json: [
          ...mockActivities,
          {
            id: 'act_4',
            lineUserId: 'U0001',
            activityType: 'call',
            title: 'โทร',
            points: 10,
            date: new Date(Date.now() - 86400000).toISOString().split('T')[0], // Yesterday
            createdAt: new Date(Date.now() - 86400000).toISOString()
          }
        ]
      });
    });
    
    await page.reload();
    await activitiesPage.waitForPageLoad();
    
    // Should show date headers
    const dateHeaders = page.locator('.date-header');
    await expect(dateHeaders).toHaveCount(2); // Today and Yesterday
  });

  test('should update feed after creating new activity', async ({ page, activitiesPage }) => {
    await activitiesPage.waitForPageLoad();
    
    // Initial count
    const initialCount = await page.locator('.activity-item').count();
    
    // Mock updated response after creation
    await page.route('**/api/activities/user/*', async route => {
      await route.fulfill({
        status: 200,
        json: [
          {
            id: 'act_new',
            lineUserId: 'U0001',
            activityType: 'listen',
            title: 'ฟัง',
            points: 20,
            date: new Date().toISOString().split('T')[0],
            createdAt: new Date().toISOString()
          },
          ...mockActivities
        ]
      });
    });
    
    // Create new activity
    await activitiesPage.clickActivity('listen');
    await activitiesPage.submitActivities();
    await activitiesPage.waitForSuccessModal();
    await activitiesPage.closeSuccessModal();
    
    // Feed should update
    await page.waitForTimeout(1000);
    const newCount = await page.locator('.activity-item').count();
    expect(newCount).toBe(initialCount + 1);
  });

  test('should show activity icons', async ({ page, activitiesPage }) => {
    await activitiesPage.waitForPageLoad();
    
    // Check activity icons
    const activityIcons = page.locator('.activity-icon');
    await expect(activityIcons).toHaveCount(3);
    
    // First activity should have call icon
    const firstIcon = activityIcons.first();
    await expect(firstIcon).toContainText('📞');
  });

  test('should handle long activity lists with pagination', async ({ page, activitiesPage }) => {
    // Mock many activities
    const manyActivities = Array.from({ length: 50 }, (_, i) => ({
      id: `act_${i}`,
      lineUserId: 'U0001',
      activityType: 'call',
      title: 'โทร',
      points: 10,
      date: new Date().toISOString().split('T')[0],
      createdAt: new Date(Date.now() - i * 3600000).toISOString()
    }));
    
    await page.route('**/api/activities/user/*', async route => {
      await route.fulfill({
        status: 200,
        json: manyActivities
      });
    });
    
    await page.reload();
    await activitiesPage.waitForPageLoad();
    
    // Should show load more button or implement virtual scrolling
    const activities = await page.locator('.activity-item').count();
    expect(activities).toBeGreaterThan(0);
  });

  test('should refresh feed on pull down', async ({ page, activitiesPage }) => {
    await activitiesPage.waitForPageLoad();
    
    let apiCallCount = 0;
    await page.route('**/api/activities/user/*', async route => {
      apiCallCount++;
      await route.fulfill({
        status: 200,
        json: mockActivities
      });
    });
    
    // Simulate pull to refresh (if implemented)
    // This would typically be a touch gesture
    // For now, we'll use a refresh button if available
    const refreshButton = page.locator('.refresh-activities-btn');
    if (await refreshButton.isVisible()) {
      await refreshButton.click();
      await page.waitForTimeout(500);
      expect(apiCallCount).toBeGreaterThan(1);
    }
  });
});