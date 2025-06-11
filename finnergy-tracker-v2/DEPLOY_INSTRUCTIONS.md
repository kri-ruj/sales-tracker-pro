# Finnergy Tracker Pro v2 - Deployment Instructions

## 🚀 Quick Deploy to Google Cloud

### Prerequisites
1. Google Cloud account with billing enabled
2. `gcloud` CLI installed
3. LINE Developer account for LIFF app

### Step 1: Create New GCP Project

```bash
# Set your new project ID
export PROJECT_ID="finnergy-pro-v2"

# Create project
gcloud projects create $PROJECT_ID --name="Finnergy Tracker Pro v2"
gcloud config set project $PROJECT_ID

# Enable required APIs
gcloud services enable appengine.googleapis.com
gcloud services enable firestore.googleapis.com
gcloud services enable cloudbuild.googleapis.com

# Create App Engine app
gcloud app create --region=asia-southeast1
```

### Step 2: Set Up Firestore

```bash
# Create Firestore database
gcloud firestore databases create --region=asia-southeast1
```

### Step 3: Deploy Backend

```bash
cd backend
npm install

# Set environment variables
export LINE_CHANNEL_ACCESS_TOKEN="your-line-token"
export LINE_CHANNEL_SECRET="your-line-secret"

# Deploy
gcloud app deploy app.yaml --service=finnergy-api-v2
```

### Step 4: Deploy Frontend

```bash
cd ../public

# Update API URL in app.js
# Replace: https://finnergy-api-v2.as.r.appspot.com
# With: https://finnergy-api-v2-dot-finnergy-pro-v2.as.r.appspot.com

# Deploy
gcloud app deploy app.yaml --service=finnergy-tracker-v2
```

### Step 5: Configure LINE LIFF

1. Go to LINE Developers Console
2. Create new LIFF app or update existing
3. Set endpoint URL: `https://finnergy-tracker-v2-dot-finnergy-pro-v2.as.r.appspot.com`
4. Get new LIFF ID and update in `app.js`

## 🔗 Your New URLs

- **Frontend**: `https://finnergy-tracker-v2-dot-finnergy-pro-v2.as.r.appspot.com`
- **Backend API**: `https://finnergy-api-v2-dot-finnergy-pro-v2.as.r.appspot.com`
- **Health Check**: `https://finnergy-api-v2-dot-finnergy-pro-v2.as.r.appspot.com/health`

## 🎨 Features of v2

- **Modern Glassmorphism UI** with dark theme
- **Animated activity cards** with hover effects
- **Neon glow accents** for visual appeal
- **Floating action button** for quick adds
- **Real-time leaderboard** with rank badges
- **Progressive Web App** with offline support
- **Responsive design** optimized for mobile

## 🔧 Environment Variables

Create `.env.yaml` for backend:

```yaml
env_variables:
  LINE_CHANNEL_ACCESS_TOKEN: "your-token"
  LINE_CHANNEL_SECRET: "your-secret"
  FIREBASE_PROJECT_ID: "finnergy-pro-v2"
  FIREBASE_CLIENT_EMAIL: "your-firebase-email"
  FIREBASE_PRIVATE_KEY: "your-firebase-key"
```

## 📱 Testing

1. Open the frontend URL in browser
2. You'll see the modern glassmorphism login screen
3. Click "Login with LINE" to authenticate
4. Start tracking activities with the new UI!

## 🚨 Important Notes

- The app uses a completely new UI design with glassmorphism effects
- All activity data is stored in Firestore (not SQLite)
- LINE notifications use compact flex messages
- The app is a PWA with offline capabilities