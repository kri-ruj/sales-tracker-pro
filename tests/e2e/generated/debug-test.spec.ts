import { test, expect } from '@playwright/test';

test('debug page structure', async ({ page }) => {
  await page.goto('https://frontend-dot-salesappfkt.as.r.appspot.com/');
  
  // Wait for page to load
  await page.waitForLoadState('networkidle');
  
  // Take screenshot
  await page.screenshot({ path: 'debug-page.png', fullPage: true });
  
  // Log page content
  const title = await page.title();
  console.log('Page title:', title);
  
  // Check if login container exists
  const loginContainer = await page.$('#loginContainer');
  console.log('Login container exists:', !!loginContainer);
  
  // Get all visible text
  const visibleText = await page.evaluate(() => {
    return document.body.innerText;
  });
  console.log('Visible text:', visibleText);
  
  // Check for specific elements
  const h1Text = await page.$eval('h1', el => el.textContent).catch(() => null);
  console.log('H1 text:', h1Text);
  
  // Get all buttons
  const buttons = await page.$$eval('button', buttons => 
    buttons.map(btn => btn.textContent?.trim())
  );
  console.log('Buttons:', buttons);
});