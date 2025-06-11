# 🚀 Deploy Backend with Firestore NOW

Your backend is now configured to **always use Firestore**. The SQLite database connection issue will be permanently fixed.

## ✅ Changes Made
1. **app.yaml** - Added explicit entrypoint: `node server-firestore.js`
2. **package.json** - Already configured to use Firestore by default
3. **Firestore services** - Updated to use default database (no named database)
4. Created **setup-gcp-firestore.sh** script for easy GCP setup

## 📋 Quick Deployment Steps

### Step 1: Run GCP Setup Script (5 minutes)
```bash
cd backend/
./setup-gcp-firestore.sh
```

This script will:
- Enable Firestore API
- Create Firestore database
- Setup Secret Manager with your LINE credentials
- Create necessary indexes

**You'll need:**
- LINE Channel Access Token (from LINE Developers Console)
- LINE Channel Secret (from LINE Developers Console)

### Step 2: Deploy Backend (2 minutes)
```bash
cd backend/
npm run deploy:gcp
```

### Step 3: Verify Deployment
Check the health endpoint:
```bash
curl https://sales-tracker-api-dot-salesappfkt.as.r.appspot.com/health
```

Should return:
```json
{
  "status": "ok",
  "service": "sales-tracker-api",
  "database": "connected",
  "timestamp": "..."
}
```

## 🔄 Data Migration (Optional)
If you have existing SQLite data:
```bash
cd backend/
npm run setup:firestore
```

## 🎯 Your Backend Will Be Fixed!
- ✅ No more database connection issues
- ✅ Automatic scaling with Firestore
- ✅ Persistent data storage
- ✅ Multi-instance support
- ✅ Production-ready

## 📱 Update LINE Webhook
After deployment, update your LINE webhook URL to:
`https://sales-tracker-api-dot-salesappfkt.as.r.appspot.com/webhook`

## 🚨 Troubleshooting
If you see any permission errors:
```bash
# Grant App Engine service account Firestore access
gcloud projects add-iam-policy-binding salesappfkt \
  --member="serviceAccount:salesappfkt@appspot.gserviceaccount.com" \
  --role="roles/datastore.user"
```

---
**That's it!** Your backend will now always use Firestore and the database connection issue will be permanently resolved.