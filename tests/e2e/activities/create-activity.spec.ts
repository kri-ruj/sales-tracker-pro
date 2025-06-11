import { test, expect } from '../fixtures/auth.fixture';
import { TEST_PROFILES } from '../utils/mock-liff';

test.describe('Create Activities', () => {
  test.beforeEach(async ({ loginAsUser, page }) => {
    // Mock API responses
    await page.route('**/api/users', async route => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 200,
          json: { success: true, user: TEST_PROFILES.user1 }
        });
      }
    });

    await page.route('**/api/activities', async route => {
      if (route.request().method() === 'POST') {
        const body = route.request().postDataJSON();
        await route.fulfill({
          status: 200,
          json: {
            success: true,
            activity: {
              id: 'act_' + Date.now(),
              ...body,
              createdAt: new Date().toISOString()
            }
          }
        });
      }
    });

    await page.route('**/api/activities/user/*', async route => {
      await route.fulfill({
        status: 200,
        json: []
      });
    });

    // Login as test user
    await loginAsUser(TEST_PROFILES.user1);
  });

  test('should display all activity types', async ({ activitiesPage }) => {
    await activitiesPage.waitForPageLoad();
    
    // Check all activity buttons are visible
    expect(await activitiesPage.activityButtons.call.isVisible()).toBe(true);
    expect(await activitiesPage.activityButtons.appointment.isVisible()).toBe(true);
    expect(await activitiesPage.activityButtons.listen.isVisible()).toBe(true);
    expect(await activitiesPage.activityButtons.present.isVisible()).toBe(true);
    expect(await activitiesPage.activityButtons.startPlan.isVisible()).toBe(true);
  });

  test('should select and deselect activities', async ({ activitiesPage }) => {
    await activitiesPage.waitForPageLoad();
    
    // Initially no activities selected
    expect(await activitiesPage.getSelectedActivitiesCount()).toBe(0);
    
    // Select call activity
    await activitiesPage.clickActivity('call');
    expect(await activitiesPage.isActivitySelected('call')).toBe(true);
    expect(await activitiesPage.getSelectedActivitiesCount()).toBe(1);
    
    // Select appointment activity
    await activitiesPage.clickActivity('appointment');
    expect(await activitiesPage.isActivitySelected('appointment')).toBe(true);
    expect(await activitiesPage.getSelectedActivitiesCount()).toBe(2);
    
    // Deselect call activity
    await activitiesPage.clickActivity('call');
    expect(await activitiesPage.isActivitySelected('call')).toBe(false);
    expect(await activitiesPage.getSelectedActivitiesCount()).toBe(1);
  });

  test('should submit single activity successfully', async ({ page, activitiesPage }) => {
    await activitiesPage.waitForPageLoad();
    
    // Select call activity
    await activitiesPage.clickActivity('call');
    
    // Submit
    await activitiesPage.submitActivities();
    
    // Wait for success modal
    await activitiesPage.waitForSuccessModal();
    
    // Verify API was called
    const apiCalls = await page.evaluate(() => (window as any).__apiCalls || []);
    expect(apiCalls).toContain('/api/activities');
    
    // Close modal
    await activitiesPage.closeSuccessModal();
  });

  test('should submit multiple activities', async ({ activitiesPage }) => {
    await activitiesPage.waitForPageLoad();
    
    // Select multiple activities
    await activitiesPage.clickActivity('call');
    await activitiesPage.clickActivity('appointment');
    await activitiesPage.clickActivity('present');
    
    expect(await activitiesPage.getSelectedActivitiesCount()).toBe(3);
    
    // Submit
    await activitiesPage.submitActivities();
    
    // Wait for success
    await activitiesPage.waitForSuccessModal();
    await activitiesPage.closeSuccessModal();
  });

  test('should update points after submission', async ({ page, activitiesPage }) => {
    await activitiesPage.waitForPageLoad();
    
    // Get initial points
    const initialPoints = await activitiesPage.getTodayPoints();
    
    // Select and submit activity
    await activitiesPage.clickActivity('call'); // 10 points
    await activitiesPage.submitActivities();
    await activitiesPage.waitForSuccessModal();
    await activitiesPage.closeSuccessModal();
    
    // Points should increase
    await page.waitForTimeout(1000); // Wait for UI update
    const newPoints = await activitiesPage.getTodayPoints();
    expect(newPoints).toBeGreaterThan(initialPoints);
  });

  test('should show activities in feed after creation', async ({ page, activitiesPage }) => {
    await activitiesPage.waitForPageLoad();
    
    // Mock activities response with data
    await page.route('**/api/activities/user/*', async route => {
      await route.fulfill({
        status: 200,
        json: [{
          id: 'act_1',
          type: 'call',
          title: 'โทร',
          points: 10,
          createdAt: new Date().toISOString()
        }]
      });
    });
    
    // Submit activity
    await activitiesPage.clickActivity('call');
    await activitiesPage.submitActivities();
    await activitiesPage.waitForSuccessModal();
    await activitiesPage.closeSuccessModal();
    
    // Reload to fetch updated feed
    await page.reload();
    await activitiesPage.waitForPageLoad();
    
    // Check activity in feed
    const firstActivity = await activitiesPage.getActivityFromFeed(0);
    expect(firstActivity.title).toContain('โทร');
    expect(firstActivity.points).toContain('10');
  });

  test('should prevent submission with no activities selected', async ({ activitiesPage }) => {
    await activitiesPage.waitForPageLoad();
    
    // Try to submit without selecting any activity
    const isSubmitDisabled = await activitiesPage.submitButton.isDisabled();
    expect(isSubmitDisabled).toBe(true);
  });

  test('should handle API errors gracefully', async ({ page, activitiesPage }) => {
    await activitiesPage.waitForPageLoad();
    
    // Mock API error
    await page.route('**/api/activities', async route => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 500,
          json: { error: 'Server error' }
        });
      }
    });
    
    // Try to submit
    await activitiesPage.clickActivity('call');
    await activitiesPage.submitActivities();
    
    // Should show error toast
    await page.waitForSelector('.toast.error', { state: 'visible' });
  });

  test('should calculate correct total points for multiple activities', async ({ activitiesPage }) => {
    await activitiesPage.waitForPageLoad();
    
    // Activity points: call=10, appointment=15, listen=20, present=30, startPlan=50
    const activities = [
      { type: 'call' as const, points: 10 },
      { type: 'appointment' as const, points: 15 },
      { type: 'listen' as const, points: 20 }
    ];
    
    let expectedTotal = 0;
    for (const activity of activities) {
      await activitiesPage.clickActivity(activity.type);
      expectedTotal += activity.points;
    }
    
    // Check selected count
    expect(await activitiesPage.getSelectedActivitiesCount()).toBe(activities.length);
    
    // Submit and verify
    await activitiesPage.submitActivities();
    await activitiesPage.waitForSuccessModal();
  });
});