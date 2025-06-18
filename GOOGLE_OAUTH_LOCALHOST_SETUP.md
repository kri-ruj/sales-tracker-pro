# Google OAuth Localhost Setup - Step by Step

## Step 1: Go to Google Cloud Console

1. Open: https://console.cloud.google.com/apis/credentials
2. Make sure you're in the correct project (check top left)

## Step 2: Find Your OAuth 2.0 Client

Look for the client with ID:
`728428181754-2funchcf7d02p0fq8emorlfb3ttjpo3b.apps.googleusercontent.com`

Click on it to edit.

## Step 3: Add Authorized JavaScript Origins

In the **Authorized JavaScript origins** section, click "ADD URI" and add:

```
http://localhost:8000
http://localhost:10000
```

## Step 4: Save

Click the **SAVE** button at the bottom.

## Step 5: Wait for Propagation

Google says it can take 5 minutes to a few hours, but usually it's instant or takes 5 minutes.

## Step 6: Test

1. Go to: http://localhost:8000
2. Click "Sign in with Google"
3. It should work now!

## If It Still Doesn't Work

Try these in order:

1. **Clear browser cache**
   - Chrome: Cmd+Shift+Delete (Mac) or Ctrl+Shift+Delete (Windows)
   - Clear "Cookies and other site data" for the last hour

2. **Try Incognito/Private mode**

3. **Try 127.0.0.1 instead**
   - Add `http://127.0.0.1:8000` to authorized origins
   - Access your app at http://127.0.0.1:8000

4. **Check the exact error**
   - Open browser console (F12)
   - Look for specific error messages

## Screenshot Guide

Here's what your OAuth client settings should look like:

```
OAuth 2.0 Client ID: Your App Name

Authorized JavaScript origins:
✓ http://localhost:8000
✓ http://localhost:10000
✓ https://frontend-dot-salesappfkt.as.r.appspot.com (for production)

Authorized redirect URIs:
(Not required for Google Sign-In JavaScript SDK)
```

## Verification

You can verify it's working by:
1. Opening http://localhost:8000/debug-google.html
2. Checking if the Google library loads
3. Clicking "Try Initialize"
4. The Google button should appear and work