# Enable Firebase for Your GCP Project

## Quick Steps to Enable Firebase:

1. **Go to Firebase Console**:
   👉 https://console.firebase.google.com/

2. **Click "Add project"**

3. **Select your existing GCP project**:
   - You'll see "salesappfkt" in the list
   - Select it and click "Continue"

4. **Enable Google Analytics** (Optional):
   - You can skip this if you don't need analytics
   - Click "Continue" or "Skip"

5. **Click "Add Firebase"**

This will enable Firebase services for your GCP project.

## After Firebase is Enabled:

Run this command to verify:
```bash
firebase use salesappfkt
```

## Alternative: Direct Link

Try this direct link to add Firebase to your project:
👉 https://console.firebase.google.com/project/salesappfkt/overview

If it says "Project not found", you need to add Firebase through the steps above.

## Once Firebase is Enabled:

The GitHub Actions deployment will work automatically on the next push!