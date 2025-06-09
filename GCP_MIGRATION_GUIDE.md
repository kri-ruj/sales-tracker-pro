# Complete GCP Migration Guide

## Prerequisites

You'll need to set up the following in Google Cloud Console:

### 1. Create a GCP Project
1. Go to https://console.cloud.google.com
2. Create a new project or select existing one
3. Note your Project ID (e.g., `sales-tracker-2024`)

### 2. Enable Required APIs
Enable these APIs in your project:
- App Engine Admin API
- Cloud Build API
- Firebase Hosting API
- Cloud SQL Admin API (optional)

### 3. Create Service Account
1. Go to IAM & Admin → Service Accounts
2. Create a new service account named `github-actions`
3. Grant these roles:
   - App Engine Admin
   - Cloud Build Editor
   - Firebase Admin
   - Service Account User
4. Create and download JSON key

### 4. Set up Firebase
1. Go to https://console.firebase.google.com
2. Add your GCP project to Firebase
3. Enable Firebase Hosting

## GitHub Secrets to Add

Go to your GitHub repository → Settings → Secrets → Actions, and add:

1. **GCP_PROJECT_ID**: Your project ID (e.g., `sales-tracker-2024`)
2. **GCP_SA_KEY**: The entire JSON key content from service account
3. **FIREBASE_SERVICE_ACCOUNT**: Same as GCP_SA_KEY
4. **LINE_CHANNEL_ACCESS_TOKEN**: Your LINE channel access token
5. **LINE_CHANNEL_SECRET**: Your LINE channel secret
6. **DB_ROOT_PASSWORD**: A secure password for Cloud SQL (optional)

## Files to Update

### 1. Frontend Configuration
Update `index.html` to use App Engine backend URL:

```javascript
// Around line 856-858
BACKEND_URL: window.location.hostname === 'localhost' 
    ? 'http://localhost:10000' 
    : 'https://sales-tracker-api-dot-YOUR_PROJECT_ID.uc.r.appspot.com',
```

Replace `YOUR_PROJECT_ID` with your actual GCP project ID.

### 2. Enable GCP Workflow
The workflow is already written! Just rename it back:

```bash
mv .github/workflows/deploy-gcp.yml.disabled .github/workflows/deploy-gcp.yml
```

### 3. Update Backend for App Engine
The backend is already compatible! App Engine will use `server-simple.js`.

## Deployment Steps

### Step 1: Set up GCP Project
```bash
# Install gcloud CLI if not already installed
# For Mac:
brew install google-cloud-sdk

# Login to GCP
gcloud auth login

# Set project
gcloud config set project YOUR_PROJECT_ID

# Enable APIs
gcloud services enable appengine.googleapis.com
gcloud services enable cloudbuild.googleapis.com
gcloud services enable firebase.googleapis.com
```

### Step 2: Initialize App Engine
```bash
# Create App Engine app (choose region)
gcloud app create --region=asia-southeast1

# Or for US:
# gcloud app create --region=us-central
```

### Step 3: Initialize Firebase
```bash
# Install Firebase CLI
npm install -g firebase-tools

# Login to Firebase
firebase login

# Initialize Firebase in your project
firebase init hosting

# When prompted:
# - Select your GCP project
# - Use 'dist' as public directory
# - Configure as single-page app: Yes
# - Don't overwrite index.html
```

### Step 4: Test Locally
```bash
# Test backend
cd backend
npm install
npm start

# Test frontend (in another terminal)
cd ..
python3 -m http.server 8000
```

### Step 5: Deploy via GitHub Actions
Once all secrets are added:
```bash
git add .
git commit -m "Migrate to Google Cloud Platform"
git push origin main
```

## After Deployment

Your services will be available at:
- **Frontend**: https://YOUR_PROJECT_ID.web.app
- **Backend**: https://sales-tracker-api-dot-YOUR_PROJECT_ID.uc.r.appspot.com

## Cost Estimates

### Free Tier Includes:
- App Engine: 28 instance hours per day
- Firebase Hosting: 10GB storage, 360MB/day transfer
- Cloud Build: 120 build minutes per day

### Estimated Monthly Cost:
- Light usage: $0 (within free tier)
- Medium usage: $5-20
- Heavy usage: $20-50

## Monitoring

1. **App Engine Dashboard**: 
   https://console.cloud.google.com/appengine

2. **Firebase Hosting**:
   https://console.firebase.google.com/project/YOUR_PROJECT_ID/hosting

3. **Logs**:
   https://console.cloud.google.com/logs

## Rollback Plan

If something goes wrong:
1. App Engine keeps previous versions
2. Firebase Hosting has version history
3. Your Render deployment remains unchanged until you delete it

## Next Steps After Migration

1. Update your LINE app settings with new URLs
2. Delete Render service to avoid confusion
3. Set up monitoring alerts in GCP
4. Configure custom domain (optional)