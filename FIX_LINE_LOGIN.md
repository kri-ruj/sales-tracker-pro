# Fix LINE Login Integration

## Test Your Setup

1. **Open the diagnostic page**:
   👉 https://salesappfkt-e4119.web.app/test-line-login.html

   This page will show you:
   - LIFF initialization status
   - Backend connection status
   - LINE login functionality
   - Backend sync test

## Common Issues and Solutions

### 1. LIFF Initialization Failed

If you see "LIFF init failed" error, you need to:

1. **Go to LINE Developers Console**:
   - https://developers.line.biz/console/
   - Select your channel
   - Go to "LIFF" tab

2. **Add your Firebase domain**:
   - Click on your LIFF app (ID: `2007539402-Mnwlaklq`)
   - Add endpoint URL: `https://salesappfkt-e4119.web.app`
   - Also add: `https://salesappfkt-e4119.firebaseapp.com`

### 2. Backend Not Syncing

The backend sync is now **enabled** (`ENABLE_BACKEND_SYNC: true`), but check:

1. **CORS Issues**:
   - The backend already has CORS enabled for all origins
   - Should work automatically

2. **User Data Not Saving**:
   - The current backend uses in-memory storage
   - Data resets when the server restarts
   - This is normal for the demo version

### 3. Update Your Main App

If the test page works but your main app doesn't:

1. **Clear browser cache**:
   - Hard refresh: Ctrl+Shift+R (Windows) or Cmd+Shift+R (Mac)
   - Or open in incognito/private mode

2. **Check console errors**:
   - Open browser DevTools (F12)
   - Look for any red errors
   - Common errors:
     - "LIFF ID is invalid" → Wrong environment
     - "Endpoint URL is not registered" → Add domain in LINE console

## Quick Checklist

- [ ] Backend is running: https://salesappfkt.as.r.appspot.com/health ✅
- [ ] Frontend is deployed: https://salesappfkt-e4119.web.app ✅
- [ ] Backend sync enabled: `ENABLE_BACKEND_SYNC: true` ✅
- [ ] LIFF domains registered in LINE console ❓
- [ ] Using correct LIFF ID: `2007539402-Mnwlaklq` ✅

## Test Flow

1. Open https://salesappfkt-e4119.web.app/test-line-login.html
2. Check all status indicators
3. Click "Test LINE Login"
4. After login, click "Test Backend Sync"
5. If all tests pass, your main app should work!

## Still Not Working?

The issue is likely the LIFF endpoint URL registration. In LINE Developers Console:

1. Make sure you're using the **Developing** LIFF app
2. The endpoint URL must be **exactly**: `https://salesappfkt-e4119.web.app`
3. Save and wait 1-2 minutes for changes to propagate

## Backend Logs

To check backend logs:
```bash
gcloud app logs read --service=default --project=salesappfkt --limit=50
```

Or view in console:
https://console.cloud.google.com/logs/query?project=salesappfkt