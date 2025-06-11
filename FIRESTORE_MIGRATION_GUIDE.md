# 🚀 Firestore Migration Guide

## ✅ What's Been Done

1. **Created Firestore service** (`backend/services/firestore.service.js`)
   - Complete database operations
   - Built-in caching with TTL
   - Optimized for small scale

2. **New server file** (`backend/server-firestore.js`)
   - Uses Firestore instead of SQLite
   - Secret Manager integration ready
   - All endpoints migrated

3. **Setup scripts created**
   - `setup-firestore.js` - Migrates data from SQLite
   - `setup-gcp-services.js` - Configures GCP services
   - `deploy-firestore.sh` - Deployment script

4. **Cost-optimized configuration**
   - Min instances: 0 (scale to zero)
   - Max instances: 2 (perfect for 20 users)
   - Firestore free tier usage

## 📋 Manual Steps Required

### 1. Create Firestore Database (5 minutes)

1. Go to: https://console.cloud.google.com/firestore
2. Click "Create Database"
3. Choose:
   - **Mode**: Native mode
   - **Location**: asia-southeast1 (Bangkok)
4. Click "Create"

### 2. Set Up Secrets in Secret Manager (10 minutes)

1. Go to: https://console.cloud.google.com/security/secret-manager

2. Click "Create Secret" for each:

   **Secret 1: line-channel-access-token**
   ```
   p16MHJa6Wbc8IqZ0EzBGcMC/oAs9zo9MAQ0fSqZ8GCi7tgvQIDeuqNXhI93FetCMeBluaMRgyCsI0z6aA7dh9IvCFKUYoLBgTwaERUkjCYphrdJNQINsDbeFIOHCcamYjZJe7K0UXldyN61WD/uRPwdB04t89/1O/w1cDnyilFU=
   ```

   **Secret 2: line-channel-secret**
   ```
   729d399073b6755757f9b215ee43f037
   ```

   **Secret 3: admin-token**
   ```
   Generate a secure token (e.g., use: openssl rand -hex 32)
   ```

3. For each secret, grant access:
   - Click on the secret
   - Go to "Permissions" tab
   - Add member: `salesappfkt@appspot.gserviceaccount.com`
   - Role: `Secret Manager Secret Accessor`

### 3. Test Locally (Optional)

```bash
cd backend
node test-firestore.js
```

If you get permission errors, you may need to:
1. Download a service account key from GCP Console
2. Set: `export GOOGLE_APPLICATION_CREDENTIALS=path/to/key.json`

### 4. Migrate Data & Deploy

```bash
# Navigate to backend
cd backend

# Run migration (this will copy SQLite data to Firestore)
npm run setup:firestore

# Deploy to App Engine
../scripts/deploy-firestore.sh
```

## 🎯 What You Get

### Immediate Benefits:
- ✅ **True persistence** - Data survives server restarts
- ✅ **Zero cost** - Everything within free tier
- ✅ **Auto-scaling** - Handles 1-10,000 users
- ✅ **Real-time capable** - Firestore supports live updates
- ✅ **No maintenance** - Fully managed by Google

### Architecture:
```
Your App (20 users)
    ↓
App Engine (auto-scales)
    ↓
Firestore (NoSQL)
    ↓
Free Tier ✨
```

## 📊 Cost Breakdown for 20 Users

| Service | Monthly Usage | Cost |
|---------|--------------|------|
| Firestore | ~50MB storage, 2k reads/day | $0 |
| App Engine | ~5 hours/day runtime | $0 |
| Secret Manager | 3 secrets, 100 accesses/day | $0 |
| **Total** | | **$0/month** |

## 🔍 Monitoring

After deployment, monitor your usage:
1. Firestore: https://console.cloud.google.com/firestore/usage
2. App Engine: https://console.cloud.google.com/appengine
3. Secret Manager: https://console.cloud.google.com/security/secret-manager

## ⚠️ Important Notes

1. **First deployment may take 5-10 minutes**
2. **Firestore indexes are created automatically for simple queries**
3. **The old SQLite data remains as backup in server.js**
4. **You can switch back anytime with `npm run start:sqlite`**

## 🚨 Troubleshooting

### "Permission denied" errors
- Make sure Firestore database is created
- Check Secret Manager permissions
- Verify App Engine service account has access

### "Cannot find module firebase-admin"
```bash
cd backend && npm install
```

### "Secrets not loading"
- Secrets only load in production (App Engine)
- For local dev, use .env file

## 🎉 Success Checklist

- [ ] Firestore database created
- [ ] Secrets added to Secret Manager
- [ ] Permissions granted to service account
- [ ] Data migrated with `npm run setup:firestore`
- [ ] Deployed with `deploy-firestore.sh`
- [ ] Tested at https://sales-tracker-api-dot-salesappfkt.as.r.appspot.com/health

Once deployed, your app will have:
- Persistent data storage
- Secure secret management
- Auto-scaling infrastructure
- Zero monthly cost for 20 users!