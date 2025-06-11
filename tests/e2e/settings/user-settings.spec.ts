import { test, expect } from '../fixtures/auth.fixture';
import { TEST_PROFILES } from '../utils/mock-liff';

test.describe('User Settings', () => {
  test.beforeEach(async ({ loginAsUser, page }) => {
    // Mock settings API
    await page.route('**/api/users/*/settings', async route => {
      if (route.request().method() === 'PUT') {
        await route.fulfill({
          status: 200,
          json: { success: true }
        });
      }
    });

    await loginAsUser(TEST_PROFILES.user1);
  });

  test('should open settings modal', async ({ page, activitiesPage }) => {
    await activitiesPage.waitForPageLoad();
    
    // Click target/settings button
    await activitiesPage.clickTargetSettings();
    
    // Settings modal should be visible
    await expect(page.locator('.settings-modal')).toBeVisible();
    await expect(page.locator('.modal-title')).toContainText('Settings');
  });

  test('should display user profile in settings', async ({ page, activitiesPage }) => {
    await activitiesPage.waitForPageLoad();
    await activitiesPage.clickTargetSettings();
    
    // Check user info is displayed
    await expect(page.locator('.settings-user-name')).toContainText(TEST_PROFILES.user1.displayName);
    await expect(page.locator('.settings-user-id')).toContainText(TEST_PROFILES.user1.userId);
  });

  test('should set daily target', async ({ page, activitiesPage }) => {
    await activitiesPage.waitForPageLoad();
    await activitiesPage.clickTargetSettings();
    
    // Find daily target input
    const targetInput = page.locator('input[name="dailyTarget"]');
    await targetInput.fill('100');
    
    // Save settings
    await page.click('button:has-text("Save")');
    
    // Modal should close
    await expect(page.locator('.settings-modal')).toBeHidden();
    
    // Target should be saved in localStorage
    const settings = await page.evaluate(() => {
      return JSON.parse(localStorage.getItem('userSettings') || '{}');
    });
    expect(settings.dailyTarget).toBe(100);
  });

  test('should toggle notification settings', async ({ page, activitiesPage }) => {
    await activitiesPage.waitForPageLoad();
    await activitiesPage.clickTargetSettings();
    
    // Toggle notifications
    const notificationToggle = page.locator('input[name="enableNotifications"]');
    const initialState = await notificationToggle.isChecked();
    
    await notificationToggle.click();
    
    // Save
    await page.click('button:has-text("Save")');
    
    // Check saved state
    const settings = await page.evaluate(() => {
      return JSON.parse(localStorage.getItem('userSettings') || '{}');
    });
    expect(settings.enableNotifications).toBe(!initialState);
  });

  test('should select preferred language', async ({ page, activitiesPage }) => {
    await activitiesPage.waitForPageLoad();
    await activitiesPage.clickTargetSettings();
    
    // Select language
    await page.selectOption('select[name="language"]', 'en');
    
    // Save
    await page.click('button:has-text("Save")');
    
    // Check saved
    const settings = await page.evaluate(() => {
      return JSON.parse(localStorage.getItem('userSettings') || '{}');
    });
    expect(settings.language).toBe('en');
  });

  test('should validate daily target input', async ({ page, activitiesPage }) => {
    await activitiesPage.waitForPageLoad();
    await activitiesPage.clickTargetSettings();
    
    const targetInput = page.locator('input[name="dailyTarget"]');
    
    // Try negative number
    await targetInput.fill('-10');
    await page.click('button:has-text("Save")');
    
    // Should show validation error
    await expect(page.locator('.error-message')).toContainText('must be positive');
    
    // Try valid number
    await targetInput.fill('50');
    await page.click('button:has-text("Save")');
    
    // Should save successfully
    await expect(page.locator('.settings-modal')).toBeHidden();
  });

  test('should close settings modal on cancel', async ({ page, activitiesPage }) => {
    await activitiesPage.waitForPageLoad();
    await activitiesPage.clickTargetSettings();
    
    // Make changes
    await page.fill('input[name="dailyTarget"]', '200');
    
    // Cancel
    await page.click('button:has-text("Cancel")');
    
    // Modal should close
    await expect(page.locator('.settings-modal')).toBeHidden();
    
    // Changes should not be saved
    const settings = await page.evaluate(() => {
      return JSON.parse(localStorage.getItem('userSettings') || '{}');
    });
    expect(settings.dailyTarget).not.toBe(200);
  });

  test('should show current version in settings', async ({ page, activitiesPage }) => {
    await activitiesPage.waitForPageLoad();
    await activitiesPage.clickTargetSettings();
    
    // Version should be displayed
    await expect(page.locator('.settings-version')).toContainText('Version: 3.7.11');
  });

  test('should handle settings API errors', async ({ page, activitiesPage }) => {
    await activitiesPage.waitForPageLoad();
    
    // Mock API error
    await page.route('**/api/users/*/settings', async route => {
      await route.fulfill({
        status: 500,
        json: { error: 'Server error' }
      });
    });
    
    await activitiesPage.clickTargetSettings();
    await page.fill('input[name="dailyTarget"]', '100');
    await page.click('button:has-text("Save")');
    
    // Should show error toast
    await expect(page.locator('.toast.error')).toContainText('Failed to save settings');
  });

  test('should reset settings to defaults', async ({ page, activitiesPage }) => {
    await activitiesPage.waitForPageLoad();
    
    // Set custom settings first
    await page.evaluate(() => {
      localStorage.setItem('userSettings', JSON.stringify({
        dailyTarget: 150,
        enableNotifications: false,
        language: 'en'
      }));
    });
    
    await activitiesPage.clickTargetSettings();
    
    // Click reset button
    await page.click('button:has-text("Reset to Defaults")');
    
    // Confirm dialog
    page.on('dialog', dialog => dialog.accept());
    
    // Check defaults are restored
    const settings = await page.evaluate(() => {
      return JSON.parse(localStorage.getItem('userSettings') || '{}');
    });
    expect(settings.dailyTarget).toBe(50); // Default
    expect(settings.enableNotifications).toBe(true); // Default
    expect(settings.language).toBe('th'); // Default
  });

  test('should sync settings with backend', async ({ page, activitiesPage }) => {
    await activitiesPage.waitForPageLoad();
    
    let apiCalled = false;
    await page.route('**/api/users/*/settings', async route => {
      apiCalled = true;
      const body = route.request().postDataJSON();
      expect(body).toHaveProperty('dailyTarget');
      await route.fulfill({
        status: 200,
        json: { success: true }
      });
    });
    
    await activitiesPage.clickTargetSettings();
    await page.fill('input[name="dailyTarget"]', '75');
    await page.click('button:has-text("Save")');
    
    // API should be called
    await page.waitForTimeout(500);
    expect(apiCalled).toBe(true);
  });
});