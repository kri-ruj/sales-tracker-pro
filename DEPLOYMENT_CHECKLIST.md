# Deployment Checklist - v3.7.14

## Pre-Deployment Verification ✅

### 1. Files Updated
- [x] VERSION file: 3.7.14
- [x] package.json: 3.7.14
- [x] backend/package.json: 3.7.14
- [x] config.js: 3.7.14
- [x] backend/app.yaml: 3.7.14
- [x] index.html: All version references updated

### 2. Backend Changes
- [x] Created `server-firestore-jwt.js` with:
  - Firestore integration for persistent storage
  - JWT authentication on all user endpoints
  - Backward compatible API
  - Health check endpoint updated

### 3. Test Files Created
- [x] test-features.html - Comprehensive test dashboard
- [x] MIGRATION_GUIDE.md - Complete migration documentation

## Deployment Steps

### Option 1: Automated Deployment (When GCP is available)
```bash
cd backend
./deploy.sh
```

### Option 2: Manual Deployment
```bash
# 1. Navigate to backend
cd backend

# 2. Set project
gcloud config set project salesappfkt

# 3. Deploy backend (retry if 503 error)
gcloud app deploy app.yaml \
  --service=sales-tracker-api \
  --version=v3-7-14 \
  --quiet

# 4. If deployment succeeds, promote traffic
gcloud app services set-traffic sales-tracker-api \
  --splits v3-7-14=1 \
  --quiet
```

### Option 3: Deploy via GitHub Actions
The CI/CD pipeline will automatically deploy when you push to main:
```bash
git add .
git commit -m "feat: Migrate to Firestore with JWT authentication v3.7.14"
git push origin main
```

## Post-Deployment Verification

### 1. Check Health Endpoint
```bash
curl https://sales-tracker-api-dot-salesappfkt.as.r.appspot.com/health
```

Expected response:
```json
{
  "status": "OK",
  "version": "3.7.14",
  "database": "firestore",
  "dbStatus": "healthy",
  "authEnabled": true
}
```

### 2. Test Authentication
Open test-features.html in browser and run:
- JWT Authentication test
- Backend Connection test
- Data Persistence test

### 3. Monitor Logs
```bash
gcloud logs tail sales-tracker-api
```

## Rollback Plan

If issues occur:
1. Revert to SQLite version:
   ```bash
   # Edit app.yaml
   # Change: entrypoint: node server-firestore-jwt.js
   # To: entrypoint: node server-secure.js
   
   # Redeploy
   gcloud app deploy app.yaml --quiet
   ```

2. Check previous version:
   ```bash
   gcloud app versions list --service=sales-tracker-api
   ```

3. Route traffic to previous version:
   ```bash
   gcloud app services set-traffic sales-tracker-api \
     --splits <previous-version>=1
   ```

## Current GCP Issue

If you see this error:
```
ERROR: (gcloud.app.deploy) HttpError 503: Visibility check was unavailable
```

This is a temporary Google Cloud issue. Try:
1. Wait 5-10 minutes and retry
2. Check GCP status: https://status.cloud.google.com/
3. Use a different region if persistent
4. Deploy through Cloud Console UI

## Success Indicators

- [ ] Health endpoint returns firestore database
- [ ] JWT authentication working
- [ ] Activities persist after refresh
- [ ] Demo mode functional
- [ ] No errors in logs

## Next Steps After Deployment

1. Run Firestore migration (optional):
   ```bash
   cd backend
   node setup-firestore.js
   ```

2. Enable Firestore backups in Firebase Console

3. Monitor usage in Firebase Console

4. Test all features with test-features.html