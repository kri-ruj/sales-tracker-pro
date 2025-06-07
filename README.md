# Sales Tracker Pro - Production Deployment

A gamified sales activity tracking application with points system, team competition, and progress analytics.

## 🚀 Quick Deploy Options

### Option 1: Vercel (Recommended)
```bash
# Install Vercel CLI
npm i -g vercel

# Deploy from this directory
vercel --prod
```

### Option 2: Netlify
```bash
# Install Netlify CLI
npm i -g netlify-cli

# Deploy from this directory
netlify deploy --prod --dir .
```

### Option 3: Railway
```bash
# Install Railway CLI
npm i -g @railway/cli

# Deploy
railway login
railway link
railway up
```

### Option 4: GitHub Pages
1. Push this folder to a GitHub repository
2. Go to repository Settings > Pages
3. Select source: Deploy from a branch
4. Choose main branch and root folder
5. Your app will be available at: `https://username.github.io/repository-name`

## 📁 Files Included

- `index.html` - Main application file (production optimized)
- `manifest.json` - PWA manifest for app-like experience
- `sw.js` - Service worker for offline functionality
- `README.md` - This deployment guide

## ✨ Features

- **Activity Tracking**: Log sales activities with points system
- **Gamification**: Levels, streaks, achievements, and leaderboards
- **Progressive Web App**: Works offline, installable on mobile
- **Responsive Design**: Works on all devices
- **Local Storage**: Data persists between sessions
- **Demo Data**: Includes sample activities for testing

## 🔧 Configuration

### Environment Variables (Optional)
For production deployments, you can set these environment variables:

- `LIFF_ID` - LINE LIFF application ID for LINE integration
- `GA_MEASUREMENT_ID` - Google Analytics tracking ID
- `API_BASE_URL` - Backend API URL for data sync

### LINE LIFF Integration
To enable LINE integration:
1. Get your LIFF ID from LINE Developers Console
2. Update line 849 in index.html: `await liff.init({ liffId: 'YOUR_LIFF_ID' });`

### Google Analytics
To enable analytics:
1. Get your GA measurement ID
2. Uncomment lines 42-47 in index.html
3. Replace `GA_MEASUREMENT_ID` with your actual ID

## 📱 PWA Installation

Once deployed, users can:
1. Visit the URL on mobile browser
2. Tap "Add to Home Screen" or "Install App"
3. Use it like a native mobile app

## 🛠 Local Development

```bash
# Serve locally (requires Python)
python -m http.server 8000

# Or with Node.js (requires http-server)
npx http-server -p 8000

# Then visit: http://localhost:8000
```

## 📊 Demo Data

The app includes sample activities:
- Cold prospects
- Referral prospects  
- Appointments scheduled
- Fact finders completed
- Sales closed

Data is stored in browser localStorage and persists between sessions.

## 🔒 Security

- All data stored locally in browser
- No server-side data collection
- HTTPS required for PWA features
- Service worker caches for offline use

## 🎯 Performance

- Optimized for mobile-first experience
- Lazy loading for better performance
- Minimal external dependencies
- Fast offline loading with service worker

## 📞 Support

For issues or feature requests, create an issue in the GitHub repository.

## 📄 License

This project is for demonstration purposes. Customize as needed for your use case.