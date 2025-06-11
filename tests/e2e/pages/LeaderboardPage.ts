import { Page, Locator } from '@playwright/test';

export class LeaderboardPage {
  readonly page: Page;
  readonly leaderboardTab: Locator;
  readonly leaderboardContainer: Locator;
  readonly periodSelector: Locator;
  readonly dailyButton: Locator;
  readonly weeklyButton: Locator;
  readonly monthlyButton: Locator;
  readonly currentDate: Locator;
  readonly leaderboardItems: Locator;
  readonly loadingSpinner: Locator;
  readonly emptyState: Locator;
  readonly errorMessage: Locator;
  readonly refreshButton: Locator;
  readonly userStatsCard: Locator;

  constructor(page: Page) {
    this.page = page;
    this.leaderboardTab = page.locator('text=Leaderboard');
    this.leaderboardContainer = page.locator('.leaderboard-container');
    this.periodSelector = page.locator('.period-selector');
    this.dailyButton = page.locator('.period-btn:has-text("Daily")');
    this.weeklyButton = page.locator('.period-btn:has-text("Weekly")');
    this.monthlyButton = page.locator('.period-btn:has-text("Monthly")');
    this.currentDate = page.locator('.current-date');
    this.leaderboardItems = page.locator('.leaderboard-item');
    this.loadingSpinner = page.locator('.loading-spinner');
    this.emptyState = page.locator('.empty-state');
    this.errorMessage = page.locator('.error-message');
    this.refreshButton = page.locator('.refresh-btn');
    this.userStatsCard = page.locator('.user-stats-card');
  }

  async navigateToLeaderboard() {
    await this.leaderboardTab.click();
    await this.leaderboardContainer.waitFor({ state: 'visible' });
  }

  async selectPeriod(period: 'daily' | 'weekly' | 'monthly') {
    switch (period) {
      case 'daily':
        await this.dailyButton.click();
        break;
      case 'weekly':
        await this.weeklyButton.click();
        break;
      case 'monthly':
        await this.monthlyButton.click();
        break;
    }
  }

  async getActivePeriod() {
    const activeButton = this.periodSelector.locator('.period-btn.active');
    return await activeButton.textContent();
  }

  async getLeaderboardEntry(index: number) {
    const item = this.leaderboardItems.nth(index);
    return {
      rank: await item.locator('.rank-medal, .rank-number').textContent(),
      name: await item.locator('.user-name').textContent(),
      points: await item.locator('.user-points').textContent(),
      hasHighlight: await item.evaluate(el => el.classList.contains('current-user'))
    };
  }

  async getLeaderboardCount() {
    return await this.leaderboardItems.count();
  }

  async isLoading() {
    return await this.loadingSpinner.isVisible();
  }

  async waitForDataLoad() {
    await this.loadingSpinner.waitFor({ state: 'hidden', timeout: 5000 });
  }

  async refreshLeaderboard() {
    await this.refreshButton.click();
  }

  async getUserStats() {
    if (!await this.userStatsCard.isVisible()) {
      return null;
    }
    
    return {
      rank: await this.userStatsCard.locator('.stat-rank').textContent(),
      points: await this.userStatsCard.locator('.stat-points').textContent(),
      activities: await this.userStatsCard.locator('.stat-activities').textContent()
    };
  }

  async hasEmptyState() {
    return await this.emptyState.isVisible();
  }

  async hasError() {
    return await this.errorMessage.isVisible();
  }

  async getErrorMessage() {
    return await this.errorMessage.textContent();
  }
}