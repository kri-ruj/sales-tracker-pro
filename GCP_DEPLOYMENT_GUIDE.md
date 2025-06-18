# Freshket Sales Tracker - Complete GCP Deployment Guide

## Prerequisites

1. **Google Cloud Account**: Create one at https://console.cloud.google.com
2. **Install gcloud CLI**: 
   ```bash
   # macOS
   brew install google-cloud-sdk
   
   # Or download from: https://cloud.google.com/sdk/docs/install
   ```
3. **LINE Developer Account**: https://developers.line.biz/console/

## Step 1: GCP Project Setup

### 1.1 Create/Configure GCP Project

```bash
# Login to Google Cloud
gcloud auth login

# Set your project (salesappfkt already exists)
gcloud config set project salesappfkt

# Enable required APIs
gcloud services enable appengine.googleapis.com
gcloud services enable secretmanager.googleapis.com
gcloud services enable firestore.googleapis.com
gcloud services enable cloudbuild.googleapis.com
```

### 1.2 Initialize App Engine

```bash
# Initialize App Engine (if not already done)
gcloud app create --region=asia-southeast1
```

## Step 2: Setup LINE Channel Secrets

### 2.1 Get LINE Credentials
1. Go to [LINE Developers Console](https://developers.line.biz/console/)
2. Select your channel: **LIFF Sales Tracker**
3. Go to **Basic settings** tab:
   - Copy **Channel secret**
4. Go to **Messaging API** tab:
   - Copy **Channel access token** (issue one if needed)

### 2.2 Store Secrets in GCP Secret Manager

```bash
# Store LINE Channel Access Token
echo -n "YOUR_LINE_CHANNEL_ACCESS_TOKEN" | gcloud secrets create line-channel-access-token \
    --data-file=- \
    --replication-policy="automatic"

# Store LINE Channel Secret
echo -n "YOUR_LINE_CHANNEL_SECRET" | gcloud secrets create line-channel-secret \
    --data-file=- \
    --replication-policy="automatic"

# Grant App Engine access to secrets
gcloud secrets add-iam-policy-binding line-channel-access-token \
    --member="serviceAccount:salesappfkt@appspot.gserviceaccount.com" \
    --role="roles/secretmanager.secretAccessor"

gcloud secrets add-iam-policy-binding line-channel-secret \
    --member="serviceAccount:salesappfkt@appspot.gserviceaccount.com" \
    --role="roles/secretmanager.secretAccessor"
```

## Step 3: Deploy Services

### 3.1 Deploy Frontend Service

```bash
# From project root directory
gcloud app deploy app.yaml \
    --version=v3715 \
    --promote \
    --quiet

# Frontend will be available at:
# https://frontend-dot-salesappfkt.as.r.appspot.com/
```

### 3.2 Deploy Backend Service

```bash
# Navigate to backend directory
cd backend

# Install dependencies
npm install --production

# Deploy backend service
gcloud app deploy app.yaml \
    --version=v3715 \
    --promote \
    --quiet

# Backend will be available at:
# https://sales-tracker-api-dot-salesappfkt.as.r.appspot.com/
```

## Step 4: Configure LINE Webhook

### 4.1 Set Webhook URL in LINE Console

1. Go to [LINE Developers Console](https://developers.line.biz/console/)
2. Select your channel: **LIFF Sales Tracker**
3. Go to **Messaging API** tab
4. In **Webhook settings**:
   - **Webhook URL**: `https://sales-tracker-api-dot-salesappfkt.as.r.appspot.com/webhook`
   - **Use webhook**: ON
   - **Webhook redelivery**: OFF
   - Click **Verify** to test the connection
5. Under **Auto-reply messages**:
   - **Auto-reply**: OFF
   - **Greeting messages**: OFF
6. Under **Features**:
   - **Allow bot to join groups**: ON

### 4.2 Update Frontend Configuration

Edit `config.js` to ensure correct URLs:

```javascript
const API_BASE_URL = 'https://sales-tracker-api-dot-salesappfkt.as.r.appspot.com';
const LIFF_ID = '2007552096-wrG1aV9p';
```

## Step 5: Setup LINE Group Notifications

### 5.1 Add Bot to LINE Group

1. Get your bot's Basic ID from LINE Developers Console
2. In LINE app:
   - Open your sales team group
   - Tap menu (≡) → Members → Invite
   - Search for your bot by Basic ID
   - Add the bot to the group

### 5.2 Register Group for Notifications

In the LINE group chat:
1. Type `/register`
2. Bot should reply: "✅ This group is now registered for sales activity notifications!"
3. Test with `/help` to see available commands

## Step 6: Verify Deployment

### 6.1 Check Service Health

```bash
# Check frontend
curl https://frontend-dot-salesappfkt.as.r.appspot.com/version.json

# Check backend health
curl https://sales-tracker-api-dot-salesappfkt.as.r.appspot.com/health

# Check registered groups
curl https://sales-tracker-api-dot-salesappfkt.as.r.appspot.com/api/debug/groups
```

### 6.2 Test the Application

1. Open the LIFF app: https://liff.line.me/2007552096-wrG1aV9p
2. Login with your LINE account
3. Submit a test activity
4. Check if notification appears in the LINE group

## Step 7: Setup Automated Deployment (GitHub Actions)

### 7.1 Create Service Account for CI/CD

```bash
# Create service account
gcloud iam service-accounts create github-actions \
    --display-name="GitHub Actions Deploy"

# Grant necessary permissions
gcloud projects add-iam-policy-binding salesappfkt \
    --member="serviceAccount:github-actions@salesappfkt.iam.gserviceaccount.com" \
    --role="roles/appengine.appAdmin"

gcloud projects add-iam-policy-binding salesappfkt \
    --member="serviceAccount:github-actions@salesappfkt.iam.gserviceaccount.com" \
    --role="roles/cloudbuild.builds.editor"

gcloud projects add-iam-policy-binding salesappfkt \
    --member="serviceAccount:github-actions@salesappfkt.iam.gserviceaccount.com" \
    --role="roles/serviceusage.serviceUsageConsumer"

# Create and download key
gcloud iam service-accounts keys create ~/github-actions-key.json \
    --iam-account=github-actions@salesappfkt.iam.gserviceaccount.com
```

### 7.2 Add Secrets to GitHub

1. Go to your GitHub repository
2. Settings → Secrets and variables → Actions
3. Add these secrets:
   - `GCP_PROJECT_ID`: salesappfkt
   - `GCP_SA_KEY`: (paste entire content of ~/github-actions-key.json)

### 7.3 Enable Auto-deployment

The `.github/workflows/deploy-gcp.yml` is already configured to:
- Auto-bump version on each commit
- Deploy both frontend and backend services
- Run health checks after deployment

Simply push to main branch to trigger deployment:

```bash
git add .
git commit -m "Deploy to GCP"
git push origin main
```

## Monitoring & Logs

### View Application Logs

```bash
# Frontend logs
gcloud app logs tail -s frontend

# Backend logs
gcloud app logs tail -s sales-tracker-api

# All services
gcloud app logs tail
```

### Monitor Performance

1. Go to [GCP Console](https://console.cloud.google.com)
2. Navigate to App Engine → Dashboard
3. View metrics, errors, and latency

## Troubleshooting

### Common Issues

1. **"Webhook verification failed"**
   - Check if backend is running: `curl https://sales-tracker-api-dot-salesappfkt.as.r.appspot.com/health`
   - Verify secrets are properly set in Secret Manager
   - Check backend logs for errors

2. **"Bot doesn't respond to commands"**
   - Ensure webhook URL is correctly set in LINE Console
   - Check if bot has permission to join groups
   - Verify bot is added to the group

3. **"No notifications received"**
   - Type `/register` in the group after adding bot
   - Check LINE API quota (free tier: 500 messages/month)
   - Verify backend can access Firestore

4. **"Version mismatch"**
   - Clear browser cache or use incognito mode
   - Check if all services deployed with same version
   - Use force-update.html page

### Debug Endpoints

- Health Check: `https://sales-tracker-api-dot-salesappfkt.as.r.appspot.com/health`
- Version Info: `https://sales-tracker-api-dot-salesappfkt.as.r.appspot.com/api/version`
- Registered Groups: `https://sales-tracker-api-dot-salesappfkt.as.r.appspot.com/api/debug/groups`

## Cost Optimization

Current configuration uses minimal resources:
- Frontend: Static files only (python39 runtime)
- Backend: 
  - Min instances: 0 (scales to zero)
  - Max instances: 2
  - Memory: 0.5GB
  - CPU: 1 core

Estimated monthly cost: ~$10-30 depending on usage

## Security Notes

1. All secrets stored in GCP Secret Manager
2. HTTPS enforced on all endpoints
3. JWT authentication for user-specific endpoints
4. CORS configured for LINE LIFF domain only
5. Input validation on all API endpoints

## Next Steps

1. **Production Readiness**:
   - Enable Cloud Armor for DDoS protection
   - Setup Cloud Monitoring alerts
   - Configure backup strategy for Firestore

2. **Performance Optimization**:
   - Enable Cloud CDN for frontend assets
   - Setup Memorystore for caching
   - Implement database indexes

3. **LINE Integration Enhancement**:
   - Upgrade LINE plan for more messages
   - Implement rich menu in LINE bot
   - Add more interactive features

## Support

For issues or questions:
1. Check logs: `gcloud app logs tail`
2. Review error messages in GCP Console
3. Verify LINE webhook settings
4. Test individual components separately