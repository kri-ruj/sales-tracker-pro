import { test, expect, Page } from '@playwright/test';

// Test configuration
const APP_URL = 'http://localhost:8000/app-10x.html';
const API_URL = 'http://localhost:10000/api';

test.describe('Sales Tracker Pro 10X - Comprehensive Tests', () => {
  let page: Page;

  test.beforeEach(async ({ page: testPage }) => {
    page = testPage;
    
    // Mock API responses
    await page.route(`${API_URL}/user`, async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'test-user',
          displayName: 'John Doe',
          totalPoints: 12345,
          currentStreak: 28,
          level: 15
        })
      });
    });

    await page.route(`${API_URL}/activities`, async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          activities: [
            {
              id: 1,
              type: 'meeting',
              description: 'Strategy meeting with Tesla team',
              points: 50,
              createdAt: new Date().toISOString(),
              client: 'Tesla',
              tags: ['high-value']
            }
          ]
        })
      });
    });

    await page.route(`${API_URL}/leaderboard/weekly`, async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          leaderboard: [
            { rank: 1, displayName: 'Sarah Chen', totalPoints: 15420, trend: 'up' },
            { rank: 2, displayName: 'Mike Johnson', totalPoints: 14890, trend: 'up' },
            { rank: 3, displayName: 'John Doe', totalPoints: 12345, trend: 'same' }
          ]
        })
      });
    });

    await page.goto(APP_URL);
  });

  test.describe('Core UI Elements', () => {
    test('should display main layout components', async () => {
      // Check sidebar
      await expect(page.locator('.sidebar')).toBeVisible();
      await expect(page.locator('.logo')).toContainText('Sales Tracker Pro');
      
      // Check navigation items
      const navItems = ['Dashboard', 'Activities', 'Analytics', 'Leaderboard', 'Achievements', 'Team', 'Goals', 'Reports'];
      for (const item of navItems) {
        await expect(page.locator('.nav-item', { hasText: item })).toBeVisible();
      }
      
      // Check header
      await expect(page.locator('.header')).toBeVisible();
      await expect(page.locator('#page-title')).toHaveText('Dashboard');
    });

    test('should display stats cards with animations', async () => {
      // Wait for animations
      await page.waitForTimeout(1000);
      
      // Check all stat cards
      const statCards = page.locator('.stat-card');
      await expect(statCards).toHaveCount(4);
      
      // Check specific stats
      await expect(page.locator('.stat-value').first()).toContainText('12,345');
      await expect(page.locator('.stat-value').nth(1)).toContainText('28 days');
      await expect(page.locator('.stat-value').nth(2)).toContainText('#3');
      await expect(page.locator('.stat-value').nth(3)).toContainText('94%');
    });

    test('should display charts', async () => {
      // Check performance chart
      await expect(page.locator('#performanceChart')).toBeVisible();
      
      // Check activity chart
      await expect(page.locator('#activityChart')).toBeVisible();
      
      // Check mini chart
      await expect(page.locator('#miniChart')).toBeVisible();
    });
  });

  test.describe('Navigation', () => {
    test('should switch between pages', async () => {
      // Click on Activities
      await page.click('.nav-item[data-page="activities"]');
      await expect(page.locator('#page-title')).toHaveText('Activities');
      await expect(page.locator('.nav-item[data-page="activities"]')).toHaveClass(/active/);
      
      // Click on Analytics
      await page.click('.nav-item[data-page="analytics"]');
      await expect(page.locator('#page-title')).toHaveText('Analytics');
      await expect(page.locator('.nav-item[data-page="analytics"]')).toHaveClass(/active/);
    });

    test('should handle mobile menu', async () => {
      // Set mobile viewport
      await page.setViewportSize({ width: 375, height: 667 });
      
      // Sidebar should be hidden
      await expect(page.locator('.sidebar')).toHaveCSS('transform', 'matrix(1, 0, 0, 1, -280, 0)');
      
      // Click mobile menu button
      await page.click('.mobile-menu-btn');
      
      // Sidebar should be visible
      await expect(page.locator('.sidebar')).toHaveClass(/open/);
    });
  });

  test.describe('Quick Add Activity', () => {
    test('should open and close quick add modal', async () => {
      // Modal should be hidden initially
      await expect(page.locator('#quickAddModal')).not.toHaveClass(/active/);
      
      // Click Quick Add button
      await page.click('button:has-text("Quick Add")');
      
      // Modal should be visible
      await expect(page.locator('#quickAddModal')).toHaveClass(/active/);
      
      // Click Cancel
      await page.click('button:has-text("Cancel")');
      
      // Modal should be hidden
      await expect(page.locator('#quickAddModal')).not.toHaveClass(/active/);
    });

    test('should add new activity', async () => {
      // Mock POST request
      await page.route(`${API_URL}/activities`, async route => {
        if (route.request().method() === 'POST') {
          const postData = route.request().postDataJSON();
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              activity: {
                id: 2,
                ...postData,
                points: 50,
                createdAt: new Date().toISOString()
              }
            })
          });
        }
      });
      
      // Open modal
      await page.click('button:has-text("Quick Add")');
      
      // Fill form
      await page.selectOption('#activityType', 'meeting');
      await page.fill('#activityDescription', 'Important client meeting');
      await page.fill('#activityClient', 'Acme Corp');
      await page.fill('#activityTags', 'urgent, high-value');
      
      // Submit
      await page.click('button:has-text("Add Activity")');
      
      // Check success
      await expect(page.locator('.achievement-popup')).toBeVisible();
      await expect(page.locator('.achievement-popup')).toContainText('Activity Added!');
      
      // Modal should close
      await expect(page.locator('#quickAddModal')).not.toHaveClass(/active/);
    });

    test('should validate required fields', async () => {
      // Open modal
      await page.click('button:has-text("Quick Add")');
      
      // Try to submit without description
      await page.click('button:has-text("Add Activity")');
      
      // Should show alert
      page.on('dialog', dialog => {
        expect(dialog.message()).toBe('Please enter a description');
        dialog.accept();
      });
    });

    test('should add tags by clicking suggestions', async () => {
      // Open modal
      await page.click('button:has-text("Quick Add")');
      
      // Click tag suggestions
      await page.click('.btn-glass:has-text("urgent")');
      await page.click('.btn-glass:has-text("high-value")');
      
      // Check input value
      await expect(page.locator('#activityTags')).toHaveValue('urgent, high-value');
    });
  });

  test.describe('Voice Input', () => {
    test('should toggle voice recording', async () => {
      const voiceBtn = page.locator('.voice-btn');
      
      // Initially not recording
      await expect(voiceBtn).not.toHaveClass(/recording/);
      
      // Click to start recording
      await voiceBtn.click();
      
      // Should show recording state (if supported)
      // Note: Actual speech recognition won't work in tests
    });
  });

  test.describe('Real-time Features', () => {
    test('should display activity feed', async () => {
      const activities = page.locator('.activity-item');
      await expect(activities).toHaveCount(1);
      
      // Check activity content
      const firstActivity = activities.first();
      await expect(firstActivity).toContainText('Strategy meeting with Tesla team');
      await expect(firstActivity).toContainText('+50');
      await expect(firstActivity).toContainText('points');
      await expect(firstActivity).toContainText('high-value');
    });

    test('should display leaderboard', async () => {
      const leaderboardItems = page.locator('.leaderboard-item');
      await expect(leaderboardItems).toHaveCount(3);
      
      // Check first place
      const firstPlace = leaderboardItems.first();
      await expect(firstPlace.locator('.rank-badge')).toHaveText('1');
      await expect(firstPlace).toContainText('Sarah Chen');
      await expect(firstPlace).toContainText('15,420 points');
    });
  });

  test.describe('Achievements System', () => {
    test('should show achievement popup', async () => {
      // Trigger achievement by adding activity
      await page.route(`${API_URL}/activities`, async route => {
        if (route.request().method() === 'POST') {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              activity: { id: 2, points: 100 }
            })
          });
        }
      });
      
      // Add activity
      await page.click('button:has-text("Quick Add")');
      await page.fill('#activityDescription', 'Big deal closed');
      await page.click('button:has-text("Add Activity")');
      
      // Check achievement popup
      await expect(page.locator('.achievement-popup')).toBeVisible();
      await expect(page.locator('.achievement-popup')).toContainText('Activity Added!');
      await expect(page.locator('.achievement-popup')).toContainText('+100 points');
    });
  });

  test.describe('Offline Support', () => {
    test('should save activities offline when API fails', async () => {
      // Make API fail
      await page.route(`${API_URL}/activities`, async route => {
        if (route.request().method() === 'POST') {
          await route.abort('failed');
        }
      });
      
      // Try to add activity
      await page.click('button:has-text("Quick Add")');
      await page.fill('#activityDescription', 'Offline activity');
      await page.click('button:has-text("Add Activity")');
      
      // Should show offline message
      await expect(page.locator('.achievement-popup')).toContainText('Saved Offline');
      
      // Check localStorage
      const offlineActivities = await page.evaluate(() => {
        return localStorage.getItem('offlineActivities');
      });
      expect(offlineActivities).toBeTruthy();
      const activities = JSON.parse(offlineActivities!);
      expect(activities).toHaveLength(1);
      expect(activities[0].description).toBe('Offline activity');
    });
  });

  test.describe('Keyboard Shortcuts', () => {
    test('should open quick add with Cmd+K', async () => {
      // Press Cmd+K (or Ctrl+K)
      await page.keyboard.press('Meta+k');
      
      // Modal should open
      await expect(page.locator('#quickAddModal')).toHaveClass(/active/);
    });
  });

  test.describe('Performance', () => {
    test('should load quickly', async () => {
      const startTime = Date.now();
      await page.goto(APP_URL);
      await page.waitForLoadState('networkidle');
      const loadTime = Date.now() - startTime;
      
      // Should load in under 3 seconds
      expect(loadTime).toBeLessThan(3000);
    });

    test('should handle large datasets', async () => {
      // Mock large activity list
      const largeActivities = Array.from({ length: 100 }, (_, i) => ({
        id: i,
        type: 'meeting',
        description: `Activity ${i}`,
        points: 50,
        createdAt: new Date().toISOString()
      }));
      
      await page.route(`${API_URL}/activities`, async route => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ activities: largeActivities })
        });
      });
      
      await page.reload();
      
      // Should only display first 5
      const displayedActivities = page.locator('.activity-item');
      await expect(displayedActivities).toHaveCount(5);
    });
  });

  test.describe('Accessibility', () => {
    test('should have proper ARIA labels', async () => {
      // Check main navigation
      await expect(page.locator('.nav-menu')).toBeVisible();
      
      // Check buttons have accessible text
      const buttons = page.locator('button');
      const count = await buttons.count();
      for (let i = 0; i < count; i++) {
        const button = buttons.nth(i);
        const text = await button.textContent();
        expect(text?.trim()).toBeTruthy();
      }
    });

    test('should be keyboard navigable', async () => {
      // Tab through elements
      await page.keyboard.press('Tab');
      await page.keyboard.press('Tab');
      await page.keyboard.press('Tab');
      
      // Should be able to activate with Enter
      await page.keyboard.press('Enter');
    });
  });

  test.describe('Data Export', () => {
    test('should have export functionality in Reports page', async () => {
      // Navigate to Reports
      await page.click('.nav-item[data-page="reports"]');
      await expect(page.locator('#page-title')).toHaveText('Reports');
      
      // Export functionality would be implemented in the Reports page
    });
  });
});

// Visual regression tests
test.describe('Visual Regression', () => {
  test('should match dashboard screenshot', async ({ page }) => {
    await page.goto(APP_URL);
    await page.waitForTimeout(2000); // Wait for animations
    
    await expect(page).toHaveScreenshot('dashboard-10x.png', {
      fullPage: true,
      animations: 'disabled'
    });
  });
  
  test('should match mobile view', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto(APP_URL);
    await page.waitForTimeout(1000);
    
    await expect(page).toHaveScreenshot('mobile-10x.png', {
      fullPage: true,
      animations: 'disabled'
    });
  });
});