import { chromium } from 'playwright';

async function verifyGoogleButton() {
  console.log('🔍 Verifying Google button in production...');
  
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    viewport: { width: 375, height: 812 }
  });
  
  const page = await context.newPage();
  
  try {
    console.log('📱 Loading production app with ?login=alt...');
    await page.goto('https://frontend-dot-salesappfkt.as.r.appspot.com/?login=alt', {
      waitUntil: 'domcontentloaded',
      timeout: 30000
    });
    
    // Wait a bit for page to load
    await page.waitForTimeout(3000);
    
    // Check current URL
    const url = page.url();
    console.log('🔗 Current URL:', url);
    
    if (url.includes('line.me')) {
      console.log('❌ Still redirecting to LINE login');
    } else {
      // Check for Google button
      const googleButton = await page.locator('button:has-text("Continue with Google")').count();
      console.log('✅ Google button found:', googleButton > 0);
      
      // Take screenshot
      await page.screenshot({ path: 'google-button-verified.png' });
      console.log('📸 Screenshot saved: google-button-verified.png');
      
      if (googleButton > 0) {
        console.log('🎉 SUCCESS! Google login button is now available in production!');
        console.log('📍 Access it at: https://frontend-dot-salesappfkt.as.r.appspot.com/?login=alt');
      }
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await page.waitForTimeout(3000);
    await browser.close();
  }
}

verifyGoogleButton().catch(console.error);