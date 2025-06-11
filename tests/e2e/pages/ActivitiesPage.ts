import { Page, Locator } from '@playwright/test';

export class ActivitiesPage {
  readonly page: Page;
  readonly appContainer: Locator;
  readonly userAvatar: Locator;
  readonly userName: Locator;
  readonly logoutButton: Locator;
  readonly targetButton: Locator;
  readonly activityButtons: {
    call: Locator;
    appointment: Locator;
    listen: Locator;
    present: Locator;
    startPlan: Locator;
  };
  readonly activityFeed: Locator;
  readonly todayPoints: Locator;
  readonly weekPoints: Locator;
  readonly monthPoints: Locator;
  readonly todayActivities: Locator;
  readonly versionNumber: Locator;
  readonly syncStatus: Locator;
  readonly networkStatus: Locator;
  readonly submitButton: Locator;
  readonly successModal: Locator;

  constructor(page: Page) {
    this.page = page;
    this.appContainer = page.locator('.app-container');
    this.userAvatar = page.locator('#userAvatar');
    this.userName = page.locator('#userName');
    this.logoutButton = page.locator('.logout-btn');
    this.targetButton = page.locator('.target-btn');
    
    // Activity buttons
    this.activityButtons = {
      call: page.locator('.activity-card:has-text("โทร")'),
      appointment: page.locator('.activity-card:has-text("นัด")'),
      listen: page.locator('.activity-card:has-text("ฟัง")'),
      present: page.locator('.activity-card:has-text("นำเสนอ")'),
      startPlan: page.locator('.activity-card:has-text("เริ่มแผน")')
    };
    
    this.activityFeed = page.locator('.activities-list');
    this.todayPoints = page.locator('.points-value').first();
    this.weekPoints = page.locator('.metric-card:has-text("Week") .metric-value');
    this.monthPoints = page.locator('.metric-card:has-text("Month") .metric-value');
    this.todayActivities = page.locator('.activities-value');
    this.versionNumber = page.locator('#versionNumber');
    this.syncStatus = page.locator('#syncStatusDot');
    this.networkStatus = page.locator('#networkStatusDot');
    this.submitButton = page.locator('.submit-btn');
    this.successModal = page.locator('.modal.success');
  }

  async waitForPageLoad() {
    await this.appContainer.waitFor({ state: 'visible' });
    // Wait for user info to load
    await this.userName.waitFor({ state: 'visible', timeout: 10000 });
  }

  async getUserName() {
    return await this.userName.textContent();
  }

  async getVersion() {
    return await this.versionNumber.textContent();
  }

  async clickActivity(type: keyof typeof this.activityButtons) {
    await this.activityButtons[type].click();
  }

  async isActivitySelected(type: keyof typeof this.activityButtons) {
    const classes = await this.activityButtons[type].getAttribute('class');
    return classes?.includes('selected') || false;
  }

  async submitActivities() {
    await this.submitButton.click();
  }

  async waitForSuccessModal() {
    await this.successModal.waitFor({ state: 'visible' });
  }

  async closeSuccessModal() {
    await this.page.locator('.modal-close').click();
    await this.successModal.waitFor({ state: 'hidden' });
  }

  async getTodayPoints() {
    const text = await this.todayPoints.textContent();
    return parseInt(text || '0');
  }

  async getTodayActivitiesCount() {
    const text = await this.todayActivities.textContent();
    return parseInt(text || '0');
  }

  async getActivityFromFeed(index: number) {
    const activity = this.activityFeed.locator('.activity-item').nth(index);
    return {
      title: await activity.locator('.activity-title').textContent(),
      points: await activity.locator('.activity-points').textContent(),
      time: await activity.locator('.activity-time').textContent()
    };
  }

  async deleteActivity(index: number) {
    const deleteBtn = this.activityFeed.locator('.activity-item').nth(index).locator('.delete-btn');
    await deleteBtn.click();
  }

  async getNetworkStatus() {
    const classes = await this.networkStatus.getAttribute('class');
    return classes?.includes('online') ? 'online' : 'offline';
  }

  async getSyncStatus() {
    const classes = await this.syncStatus.getAttribute('class');
    if (classes?.includes('synced')) return 'synced';
    if (classes?.includes('syncing')) return 'syncing';
    return 'error';
  }

  async clickLogout() {
    await this.logoutButton.click();
  }

  async clickTargetSettings() {
    await this.targetButton.click();
  }

  async getSelectedActivitiesCount() {
    const selectedCards = await this.page.locator('.activity-card.selected').count();
    return selectedCards;
  }

  async waitForDataSync() {
    // Wait for sync status to show synced
    await this.page.waitForFunction(
      () => {
        const syncDot = document.querySelector('#syncStatusDot');
        return syncDot?.classList.contains('synced');
      },
      { timeout: 5000 }
    );
  }
}