# 🚀 GCP Deployment with CI/CD Setup Guide

## 🎯 What You'll Get

✅ **Frontend**: Firebase Hosting (CDN, SSL, Custom Domain)  
✅ **Backend**: Google App Engine (Auto-scaling, Managed)  
✅ **Database**: Cloud SQL PostgreSQL (Managed Database)  
✅ **CI/CD**: GitHub Actions (Auto-deploy on push)  
✅ **Monitoring**: Cloud Logging & Monitoring  
✅ **Security**: IAM, SSL certificates, VPC  

## 📋 Prerequisites Setup

### 1️⃣ Create GCP Project
```bash
# Install Google Cloud CLI
curl https://sdk.cloud.google.com | bash
exec -l $SHELL

# Login and create project
gcloud auth login
gcloud projects create sales-tracker-2024 --name="Sales Tracker"
gcloud config set project sales-tracker-2024

# Enable required APIs
gcloud services enable \
  appengine.googleapis.com \
  cloudbuild.googleapis.com \
  sql-component.googleapis.com \
  sqladmin.googleapis.com \
  firebase.googleapis.com
```

### 2️⃣ Initialize Firebase
```bash
# Install Firebase CLI
npm install -g firebase-tools

# Login and initialize
firebase login
firebase projects:addfirebase sales-tracker-2024
firebase init hosting
```

### 3️⃣ Create Service Account for CI/CD
```bash
# Create service account
gcloud iam service-accounts create github-actions \
  --display-name="GitHub Actions CI/CD"

# Add required roles
gcloud projects add-iam-policy-binding sales-tracker-2024 \
  --member="serviceAccount:github-actions@sales-tracker-2024.iam.gserviceaccount.com" \
  --role="roles/appengine.deployer"

gcloud projects add-iam-policy-binding sales-tracker-2024 \
  --member="serviceAccount:github-actions@sales-tracker-2024.iam.gserviceaccount.com" \
  --role="roles/cloudsql.admin"

gcloud projects add-iam-policy-binding sales-tracker-2024 \
  --member="serviceAccount:github-actions@sales-tracker-2024.iam.gserviceaccount.com" \
  --role="roles/firebase.admin"

# Generate service account key
gcloud iam service-accounts keys create github-actions-key.json \
  --iam-account=github-actions@sales-tracker-2024.iam.gserviceaccount.com
```

## 🔧 GitHub Repository Setup

### 1️⃣ Add GitHub Secrets
Go to your GitHub repository → Settings → Secrets and variables → Actions

Add these secrets:
```
GCP_PROJECT_ID: sales-tracker-2024
GCP_SA_KEY: [paste contents of github-actions-key.json]
FIREBASE_SERVICE_ACCOUNT: [Firebase service account JSON]
LINE_CHANNEL_ACCESS_TOKEN: [your LINE bot token]
LINE_CHANNEL_SECRET: [your LINE bot secret]
DB_ROOT_PASSWORD: [strong password for Cloud SQL]
```

### 2️⃣ Get Firebase Service Account
```bash
# Generate Firebase service account
firebase projects:list
firebase use sales-tracker-2024

# Download service account (for GitHub secret)
# Go to: https://console.firebase.google.com/
# Project Settings → Service Accounts → Generate New Private Key
```

## 🚀 Deployment Process

### Automatic Deployment
Every push to `main` branch will:

1. **Run Tests** ✅
2. **Security Scan** 🔍  
3. **Deploy Frontend** to Firebase Hosting 🌐
4. **Deploy Backend** to App Engine ⚙️
5. **Setup Database** (first time) 🗄️
6. **Send Notifications** 📢

### Manual Deployment (if needed)
```bash
# Deploy backend only
cd backend
gcloud app deploy

# Deploy frontend only
firebase deploy --only hosting

# Deploy with Cloud Build
gcloud builds submit --config cloudbuild.yaml
```

## 🌐 Your Live URLs

After successful deployment:

- **Frontend**: `https://sales-tracker-2024.web.app`
- **Backend API**: `https://sales-tracker-api-dot-sales-tracker-2024.uc.r.appspot.com`
- **LINE LIFF**: Update with Firebase Hosting URL
- **Webhook**: `https://sales-tracker-api-dot-sales-tracker-2024.uc.r.appspot.com/webhook`

## 🔄 CI/CD Workflow

### Triggered on:
- ✅ Push to `main` branch
- ✅ Pull request to `main`

### Pipeline Steps:
1. **Checkout** code from GitHub
2. **Install** dependencies  
3. **Run tests** and security scans
4. **Build** applications
5. **Deploy frontend** to Firebase
6. **Deploy backend** to App Engine
7. **Update database** schema
8. **Notify** deployment status

### Environment Promotion:
- `main` branch → **Production**
- Pull requests → **Preview** (Firebase preview channels)

## 📊 Monitoring & Logs

### View Logs:
```bash
# App Engine logs
gcloud logs read "resource.type=gae_app"

# Build logs
gcloud logs read "resource.type=build"

# Database logs
gcloud logs read "resource.type=cloudsql_database"
```

### Monitoring Dashboard:
- **GCP Console**: https://console.cloud.google.com/monitoring
- **Firebase Console**: https://console.firebase.google.com/
- **App Engine**: https://console.cloud.google.com/appengine

## 🔒 Security Features

✅ **HTTPS Everywhere** - SSL certificates auto-managed  
✅ **IAM Controls** - Least privilege access  
✅ **VPC Network** - Private database connections  
✅ **Secret Management** - Environment variables encrypted  
✅ **Security Scanning** - Automated vulnerability checks  
✅ **Audit Logging** - All changes tracked  

## 💾 Database Management

### Cloud SQL Setup:
```bash
# Create instance (done automatically by CI/CD)
gcloud sql instances create sales-tracker-db \
  --database-version=POSTGRES_14 \
  --tier=db-f1-micro \
  --region=asia-southeast1

# Connect to database
gcloud sql connect sales-tracker-db --user=postgres
```

### Backup & Recovery:
- **Automatic backups** daily at 3 AM
- **Point-in-time recovery** enabled
- **High availability** option available

## 🎛️ Scaling Configuration

### Frontend (Firebase Hosting):
- **Global CDN** - 150+ edge locations
- **Auto-scaling** - Unlimited traffic
- **Custom domains** supported

### Backend (App Engine):
- **Auto-scaling**: 0-10 instances
- **CPU target**: 60% utilization
- **Memory**: 512MB per instance
- **Disk**: 10GB SSD

### Database (Cloud SQL):
- **Instance**: db-f1-micro (1 vCPU, 0.6GB RAM)
- **Storage**: 10GB SSD (auto-expandable)
- **Connections**: Up to 25 concurrent

## 🚨 Troubleshooting

### Common Issues:

1. **Build fails**: Check GitHub Actions logs
2. **App Engine 500**: Check Cloud Logging
3. **Database connection**: Verify Cloud SQL proxy
4. **LINE webhook**: Test endpoint manually

### Debug Commands:
```bash
# Check App Engine status
gcloud app browse

# View recent deployments
gcloud app versions list

# Check database connectivity
gcloud sql instances describe sales-tracker-db
```

## 📈 Cost Optimization

### Free Tier Limits:
- **Firebase Hosting**: 10GB storage, 360MB/day transfer
- **App Engine**: 28 frontend instance hours/day
- **Cloud SQL**: db-f1-micro free for light usage
- **Cloud Build**: 120 build-minutes/day

### Estimated Monthly Cost:
- **Light usage**: $0-5 USD
- **Medium usage**: $10-25 USD  
- **Heavy usage**: $25-50 USD

## 🎉 Deployment Complete!

Your Sales Tracker is now running on **Google Cloud Platform** with:

✅ **Production-ready** infrastructure  
✅ **Auto-scaling** capabilities  
✅ **CI/CD pipeline** for easy updates  
✅ **Enterprise security** features  
✅ **Global performance** with CDN  
✅ **Managed database** with backups  

**🚀 Just push to GitHub and your app auto-deploys to GCP!**

---

## 📞 Next Steps

1. **Update LINE LIFF** endpoint with Firebase URL
2. **Set webhook URL** in LINE Console  
3. **Test the deployment** with your team
4. **Monitor usage** in GCP Console
5. **Scale resources** as needed

Your LINE Mini App is now **enterprise-ready** on Google Cloud! 🎊