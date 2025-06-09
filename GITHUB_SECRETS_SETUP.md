# GitHub Secrets Setup for GCP Deployment

## Add these secrets to your GitHub repository:

Go to: https://github.com/kri-ruj/sales-tracker-pro/settings/secrets/actions

Click "New repository secret" for each:

### 1. GCP_PROJECT_ID
**Value:** `salesappfkt`

### 2. GCP_SA_KEY
**Value:** Copy the entire content of `~/github-actions-key.json`
```bash
cat ~/github-actions-key.json
```
Copy everything and paste as the secret value.

### 3. FIREBASE_SERVICE_ACCOUNT
**Value:** Same as GCP_SA_KEY (copy the same JSON content)

### 4. LINE_CHANNEL_ACCESS_TOKEN
**Value:** Your LINE channel access token (get from LINE Developers Console)

### 5. LINE_CHANNEL_SECRET  
**Value:** Your LINE channel secret (get from LINE Developers Console)

### 6. DB_ROOT_PASSWORD (Optional)
**Value:** Any secure password (e.g., `MySecurePassword123!`)

## After adding all secrets:

1. Commit and push to deploy:
```bash
git add .
git commit -m "Migrate to Google Cloud Platform v2.74"
git push origin main
```

2. Monitor deployment:
- GitHub Actions: https://github.com/kri-ruj/sales-tracker-pro/actions
- App Engine: https://console.cloud.google.com/appengine?project=salesappfkt
- Firebase: https://console.firebase.google.com/project/salesappfkt/hosting

## Your apps will be available at:
- **Frontend**: https://salesappfkt.web.app
- **Backend API**: https://salesappfkt.uc.r.appspot.com

## Important: Update LINE Webhook URL
After deployment, update your LINE channel webhook URL to:
`https://salesappfkt.uc.r.appspot.com/webhook`