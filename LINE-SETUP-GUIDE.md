# LINE Integration Setup Guide for Sales Tracker Pro

## Overview
This guide walks you through setting up LINE integration for the mobile-first Sales Tracker Pro app, including LINE Login (LIFF) and LINE Chatbot functionality.

## Prerequisites
- LINE Developer Account
- LINE Official Account (for chatbot)
- Backend running with Firestore

## 1. LINE Developers Console Setup

### Create LINE Login Channel
1. Go to [LINE Developers Console](https://developers.line.biz/console/)
2. Create a new provider or select existing
3. Create a new channel → Select "LINE Login"
4. Fill in required information:
   - Channel name: Sales Tracker Pro
   - Channel description: Sales activity tracking app
5. Note down your:
   - **Channel ID**
   - **Channel Secret**

### Create LIFF App
1. In your LINE Login channel, go to "LIFF" tab
2. Click "Add" to create new LIFF app
3. Configure:
   - LIFF app name: Sales Tracker Pro
   - Size: Full
   - Endpoint URL: `https://frontend-dot-salesappfkt.as.r.appspot.com/app-mobile-line.html`
   - Scope: Select all (profile, openid, email)
4. Note down your **LIFF ID** (format: 2007552096-xxxxxxxx)

### Create Messaging API Channel (for Chatbot)
1. Create another channel → Select "Messaging API"
2. Fill in required information:
   - Channel name: Sales Tracker Bot
   - Channel description: Sales activity tracking bot
3. In "Messaging API" tab:
   - Issue **Channel Access Token** (Long-lived)
   - Note down **Channel Secret**
4. Configure webhook:
   - Webhook URL: `https://sales-tracker-api-dot-salesappfkt.as.r.appspot.com/webhook`
   - Use webhook: ON
   - Auto-reply messages: OFF

## 2. Environment Variables Setup

### Backend (.env)
```bash
# LINE Messaging API
LINE_CHANNEL_ACCESS_TOKEN=your_channel_access_token_here
LINE_CHANNEL_SECRET=your_channel_secret_here

# LIFF
LIFF_ID=2007552096-xxxxxxxx
```

### Frontend (config.js)
```javascript
window.CONFIG = {
    apiBaseUrl: 'https://sales-tracker-api-dot-salesappfkt.as.r.appspot.com/api',
    liffId: '2007552096-xxxxxxxx' // Your LIFF ID
};
```

## 3. Rich Menu Setup (Optional)

### Create Rich Menu Image
Create a 2500x1686px image with 6 sections (2x3 grid):
1. Top-left: Stats icon
2. Top-center: Add Activity icon  
3. Top-right: Leaderboard icon
4. Bottom-left: Open App icon
5. Bottom-center: Help icon
6. Bottom-right: Settings icon

### Upload Rich Menu
```bash
# Use LINE API or create via backend endpoint
curl -X POST https://sales-tracker-api-dot-salesappfkt.as.r.appspot.com/richmenu/create
```

## 4. Testing LINE Integration

### Test LIFF App
1. Open LINE app on mobile
2. Add your bot as friend using QR code or ID
3. Open LIFF URL: `https://liff.line.me/2007552096-xxxxxxxx`
4. Should see mobile-optimized Sales Tracker Pro

### Test Chatbot
1. Send message to your bot:
   - `/help` - Show available commands
   - `/stats` - View your statistics
   - `/add` - Add new activity
   - `/leaderboard` - View team rankings
   - `/app` - Open LIFF app

### Test Group Notifications
1. Add bot to a LINE group
2. Type `/register` in the group
3. Activities will now be notified to this group
4. Type `/toggle` to enable/disable notifications

## 5. Quick Reply Actions
The chatbot provides quick reply buttons for common actions:
- 📊 My Stats
- ➕ Add Activity
- 🏆 Leaderboard
- 📱 Open App

## 6. Flex Messages
The bot uses compact Flex Messages to show:
- Activity submissions with team stats
- User statistics with visual charts
- Leaderboard rankings
- Achievement notifications

## 7. Production Deployment

### Deploy Frontend
```bash
# Update app.yaml
runtime: python39
service: frontend

# Deploy
gcloud app deploy --project=salesappfkt
```

### Deploy Backend
```bash
cd backend
# Deploy with LINE secrets
gcloud app deploy --project=salesappfkt
```

### Verify Webhook
Check webhook is receiving events:
```bash
curl https://sales-tracker-api-dot-salesappfkt.as.r.appspot.com/webhook
```

## 8. Troubleshooting

### LIFF Not Loading
- Check LIFF endpoint URL is correct
- Verify LIFF ID in config.js
- Check browser console for errors

### Chatbot Not Responding
- Verify webhook URL in LINE Console
- Check Channel Access Token is set
- View backend logs for webhook errors

### Group Notifications Not Working
- Ensure bot is added to group
- Type `/register` in group
- Check group registration in database

## 9. LINE API Quotas
Free tier limits:
- 500 push messages/month
- Unlimited reply messages
- Monitor quota: `/api/quota/status`

## 10. Security Notes
- Store LINE secrets in environment variables
- Use Google Secret Manager in production
- Verify LINE signature on webhooks
- Implement proper authentication for API endpoints

## Support
For issues or questions:
- Check backend logs: `gcloud app logs tail -s sales-tracker-api`
- Monitor webhook events in LINE Console
- Test with LINE Official Account Manager app