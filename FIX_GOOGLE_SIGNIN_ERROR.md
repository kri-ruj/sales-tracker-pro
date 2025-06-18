# Fix Google Sign-In Error 400: redirect_uri_mismatch

## The Problem
Google Sign-In is blocking access because the domain/origin you're using isn't authorized in your Google Cloud Console.

## Quick Fix

1. **Go to Google Cloud Console**
   - https://console.cloud.google.com/apis/credentials
   - Select your project

2. **Find your OAuth 2.0 Client ID**
   - Look for: `728428181754-2funchcf7d02p0fq8emorlfb3ttjpo3b.apps.googleusercontent.com`
   - Click on it to edit

3. **Add Authorized JavaScript origins**
   Add ALL of these:
   ```
   http://localhost:8000
   http://localhost:10000
   http://127.0.0.1:8000
   http://127.0.0.1:10000
   ```

4. **Authorized redirect URIs** (if section exists)
   Add the same URLs:
   ```
   http://localhost:8000
   http://localhost:10000
   http://127.0.0.1:8000
   http://127.0.0.1:10000
   ```

5. **Save the changes**

6. **Wait 5 minutes** for changes to propagate

## For Production
When deploying, also add:
- `https://frontend-dot-salesappfkt.as.r.appspot.com`
- `https://salesappfkt.as.r.appspot.com`
- Your custom domain if you have one

## Alternative: Use 127.0.0.1 instead of localhost
If localhost doesn't work, try accessing your app via:
- http://127.0.0.1:8000

## Test Again
After making these changes:
1. Clear browser cache/cookies
2. Try Google Sign-In again
3. It should work!

## Still Not Working?
1. Check if you selected the right project in Google Cloud Console
2. Make sure the Client ID in config.js matches exactly
3. Try incognito/private browsing mode
4. Check browser console for any other errors