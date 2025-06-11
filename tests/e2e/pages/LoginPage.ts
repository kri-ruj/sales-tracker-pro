import { Page, Locator } from '@playwright/test';

export class LoginPage {
  readonly page: Page;
  readonly loginContainer: Locator;
  readonly lineLoginButton: Locator;
  readonly demoModeButton: Locator;
  readonly loginTitle: Locator;
  readonly debugInfo: Locator;
  readonly debugError: Locator;

  constructor(page: Page) {
    this.page = page;
    this.loginContainer = page.locator('#loginContainer');
    this.lineLoginButton = page.locator('#lineLoginBtn');
    this.demoModeButton = page.locator('.demo-mode-btn');
    this.loginTitle = page.locator('.login-title');
    this.debugInfo = page.locator('#debugError');
    this.debugError = page.locator('#debugError');
  }

  async goto() {
    await this.page.goto('/');
  }

  async waitForLoginScreen() {
    await this.loginContainer.waitFor({ state: 'visible' });
  }

  async clickLineLogin() {
    await this.lineLoginButton.click();
  }

  async clickDemoMode() {
    await this.demoModeButton.click();
  }

  async getLoginButtonText() {
    return await this.lineLoginButton.locator('#loginBtnText').textContent();
  }

  async isLoginScreenVisible() {
    return await this.loginContainer.isVisible();
  }

  async getDebugError() {
    return await this.debugError.textContent();
  }

  async waitForLoginToComplete() {
    // Wait for login container to disappear
    await this.loginContainer.waitFor({ state: 'hidden', timeout: 10000 });
  }

  async getDebugLiffId() {
    return await this.page.locator('#debugLiffId').textContent();
  }

  async getDebugEnvironment() {
    return await this.page.locator('#debugEnv').textContent();
  }
}