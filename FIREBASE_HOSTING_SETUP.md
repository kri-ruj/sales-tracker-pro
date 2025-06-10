# 🔥 Firebase Hosting Setup Guide

## Quick Setup (If Already Logged In)

```bash
# Deploy immediately
./deploy-to-firebase.sh
```

## Full Setup (First Time)

### 1. Install Firebase CLI (if needed)
```bash
npm install -g firebase-tools
```

### 2. Login to Firebase
```bash
firebase login
```
This will open your browser for authentication.

### 3. Initialize Firebase Hosting
```bash
firebase init hosting
```

When prompted:
- **Select project**: Choose your existing project or create new
- **Public directory**: Enter `.` (current directory)
- **Single-page app**: Yes
- **Overwrite index.html**: No
- **Set up GitHub Actions**: No (we already have it)

### 4. Deploy Your App
```bash
firebase deploy --only hosting
```

## 🚀 After Setup

Your app will be available at:
- `https://[PROJECT-ID].web.app`
- `https://[PROJECT-ID].firebaseapp.com`

## 📱 LINE Integration

Your LIFF app URL remains the same:
- https://liff.line.me/2007552096-wrG1aV9p

Firebase hosting will serve as the backend for your LIFF app.

## 🔄 Continuous Deployment

Every push to `main` branch will automatically deploy if you have set up GitHub Actions with the `FIREBASE_SERVICE_ACCOUNT` secret.

## ⚡ Benefits of Firebase Hosting

1. **Global CDN**: Fast loading worldwide
2. **SSL Certificate**: Automatic HTTPS
3. **Auto Caching**: Smart caching rules
4. **Version History**: Roll back if needed
5. **Custom Domain**: Add your own domain
6. **Free Tier**: Generous free hosting

## 🛠️ Troubleshooting

### "Project not found" Error
```bash
# List your projects
firebase projects:list

# Set the correct project
firebase use [PROJECT-ID]
```

### Permission Denied
```bash
# Re-authenticate
firebase login --reauth
```

### Deployment Fails
```bash
# Check firebase.json is correct
cat firebase.json

# Try verbose mode
firebase deploy --only hosting --debug
```

## 📝 Current Configuration

Your `firebase.json` is configured to:
- Serve files from current directory
- Ignore backend and development files
- Handle single-page app routing
- Set proper headers for PWA

Ready to deploy? Run:
```bash
./deploy-to-firebase.sh
```