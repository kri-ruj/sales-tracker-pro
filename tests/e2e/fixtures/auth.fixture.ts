import { test as base } from '@playwright/test';
import { MockLIFF, MockLIFFProfile, TEST_PROFILES } from '../utils/mock-liff';
import { LoginPage } from '../pages/LoginPage';
import { ActivitiesPage } from '../pages/ActivitiesPage';
import { LeaderboardPage } from '../pages/LeaderboardPage';

type AuthFixtures = {
  mockLiff: MockLIFF;
  loginPage: LoginPage;
  activitiesPage: ActivitiesPage;
  leaderboardPage: LeaderboardPage;
  loginAsUser: (profile?: MockLIFFProfile) => Promise<void>;
};

export const test = base.extend<AuthFixtures>({
  mockLiff: async ({ page }, use) => {
    const mockLiff = new MockLIFF(page);
    await mockLiff.setup();
    await use(mockLiff);
  },

  loginPage: async ({ page }, use) => {
    const loginPage = new LoginPage(page);
    await use(loginPage);
  },

  activitiesPage: async ({ page }, use) => {
    const activitiesPage = new ActivitiesPage(page);
    await use(activitiesPage);
  },

  leaderboardPage: async ({ page }, use) => {
    const leaderboardPage = new LeaderboardPage(page);
    await use(leaderboardPage);
  },

  loginAsUser: async ({ page, mockLiff, loginPage }, use) => {
    const login = async (profile: MockLIFFProfile = TEST_PROFILES.user1) => {
      // Navigate to the app first
      await page.goto('/');
      
      // Wait for app to be fully loaded and initialized
      await page.waitForLoadState('networkidle');
      await page.waitForFunction(() => (window as any).app !== null);
      
      // Set up logged in state after app is ready
      await mockLiff.login(profile);
      
      // Wait for login to be processed
      await page.waitForFunction(() => 
        (window as any).app && (window as any).app.liffInitialized === true
      );
      
      // Ensure we're on the main app page
      await page.waitForSelector('.app-container', { state: 'visible' });
    };
    
    await use(login);
  }
});

export { expect } from '@playwright/test';