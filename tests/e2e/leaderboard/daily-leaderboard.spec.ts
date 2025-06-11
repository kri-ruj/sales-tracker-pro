import { test, expect } from '../fixtures/auth.fixture';
import { TEST_PROFILES } from '../utils/mock-liff';

test.describe('Daily Leaderboard', () => {
  test.beforeEach(async ({ loginAsUser, page }) => {
    // Mock leaderboard API
    await page.route('**/api/leaderboard/daily', async route => {
      await route.fulfill({
        status: 200,
        json: {
          period: 'daily',
          startDate: new Date().toISOString().split('T')[0],
          endDate: new Date().toISOString().split('T')[0],
          entries: [
            {
              userId: 'U0001',
              displayName: 'Test User 1',
              pictureUrl: 'https://via.placeholder.com/150',
              points: 150,
              activities: 10,
              rank: 1
            },
            {
              userId: 'U0002',
              displayName: 'Test User 2',
              pictureUrl: 'https://via.placeholder.com/150',
              points: 120,
              activities: 8,
              rank: 2
            },
            {
              userId: 'U0003',
              displayName: 'Test User 3',
              pictureUrl: 'https://via.placeholder.com/150',
              points: 90,
              activities: 6,
              rank: 3
            }
          ],
          totalParticipants: 3
        }
      });
    });

    // Mock team stats
    await page.route('**/api/team/stats', async route => {
      await route.fulfill({
        status: 200,
        json: {
          totalUsers: 10,
          activeUsers: 5,
          totalPoints: 500,
          totalActivities: 50,
          topPerformers: []
        }
      });
    });

    await loginAsUser(TEST_PROFILES.user1);
  });

  test('should navigate to leaderboard tab', async ({ leaderboardPage }) => {
    await leaderboardPage.navigateToLeaderboard();
    
    // Should show leaderboard content
    await expect(leaderboardPage.leaderboardContainer).toBeVisible();
  });

  test('should display daily leaderboard by default', async ({ page }) => {
    await page.click('text=Leaderboard');
    
    // Check period selector shows "Daily"
    const periodButton = page.locator('.period-selector .period-btn.active');
    await expect(periodButton).toHaveText('Daily');
    
    // Should show today's date
    const dateDisplay = page.locator('.current-date');
    const today = new Date().toLocaleDateString('th-TH');
    await expect(dateDisplay).toContainText(today);
  });

  test('should display top 3 users with medals', async ({ page }) => {
    await page.click('text=Leaderboard');
    
    // Wait for leaderboard to load
    await page.waitForSelector('.leaderboard-item');
    
    // Check medals
    const firstPlace = page.locator('.leaderboard-item').first();
    await expect(firstPlace.locator('.rank-medal')).toContainText('🥇');
    await expect(firstPlace).toContainText('Test User 1');
    await expect(firstPlace).toContainText('150 pts');
    
    const secondPlace = page.locator('.leaderboard-item').nth(1);
    await expect(secondPlace.locator('.rank-medal')).toContainText('🥈');
    
    const thirdPlace = page.locator('.leaderboard-item').nth(2);
    await expect(thirdPlace.locator('.rank-medal')).toContainText('🥉');
  });

  test('should highlight current user in leaderboard', async ({ page }) => {
    await page.click('text=Leaderboard');
    
    // Find current user's entry
    const userEntry = page.locator('.leaderboard-item:has-text("Test User 1")');
    
    // Should have highlight class
    await expect(userEntry).toHaveClass(/current-user/);
  });

  test('should switch between daily, weekly, and monthly views', async ({ page }) => {
    await page.click('text=Leaderboard');
    
    // Test weekly view
    await page.click('.period-btn:has-text("Weekly")');
    await expect(page.locator('.period-btn:has-text("Weekly")')).toHaveClass(/active/);
    
    // Test monthly view
    await page.click('.period-btn:has-text("Monthly")');
    await expect(page.locator('.period-btn:has-text("Monthly")')).toHaveClass(/active/);
    
    // Back to daily
    await page.click('.period-btn:has-text("Daily")');
    await expect(page.locator('.period-btn:has-text("Daily")')).toHaveClass(/active/);
  });

  test('should show loading state while fetching data', async ({ page }) => {
    // Delay API response
    await page.route('**/api/leaderboard/daily', async route => {
      await new Promise(resolve => setTimeout(resolve, 1000));
      await route.fulfill({
        status: 200,
        json: { entries: [] }
      });
    });
    
    await page.click('text=Leaderboard');
    
    // Should show loading spinner
    await expect(page.locator('.loading-spinner')).toBeVisible();
    
    // Should hide after loading
    await expect(page.locator('.loading-spinner')).toBeHidden({ timeout: 2000 });
  });

  test('should handle empty leaderboard', async ({ page }) => {
    // Override with empty response
    await page.route('**/api/leaderboard/daily', async route => {
      await route.fulfill({
        status: 200,
        json: {
          period: 'daily',
          entries: [],
          totalParticipants: 0
        }
      });
    });
    
    await page.click('text=Leaderboard');
    
    // Should show empty state
    await expect(page.locator('.empty-state')).toBeVisible();
    await expect(page.locator('.empty-state')).toContainText('No activities yet today');
  });

  test('should handle API errors gracefully', async ({ page }) => {
    // Mock API error
    await page.route('**/api/leaderboard/daily', async route => {
      await route.fulfill({
        status: 500,
        json: { error: 'Server error' }
      });
    });
    
    await page.click('text=Leaderboard');
    
    // Should show error message
    await expect(page.locator('.error-message')).toBeVisible();
    await expect(page.locator('.error-message')).toContainText('Failed to load leaderboard');
  });

  test('should refresh leaderboard data', async ({ page }) => {
    await page.click('text=Leaderboard');
    
    let apiCallCount = 0;
    await page.route('**/api/leaderboard/daily', async route => {
      apiCallCount++;
      await route.fulfill({
        status: 200,
        json: { entries: [] }
      });
    });
    
    // Find and click refresh button
    await page.click('.refresh-btn');
    
    // API should be called again
    await page.waitForTimeout(500);
    expect(apiCallCount).toBeGreaterThan(1);
  });

  test('should show user statistics in leaderboard', async ({ page }) => {
    await page.click('text=Leaderboard');
    
    // Check if user stats are displayed
    const userStats = page.locator('.user-stats-card');
    await expect(userStats).toBeVisible();
    
    // Should show rank, points, and activities
    await expect(userStats).toContainText('Your Rank');
    await expect(userStats).toContainText('#1');
    await expect(userStats).toContainText('150 pts');
  });
});