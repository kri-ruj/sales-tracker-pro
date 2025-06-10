# LINE Group Notification Setup Guide

## What's Been Implemented

✅ **Frontend**: Sends login notification when user logs in
✅ **Backend**: Has endpoint `/api/user/login` ready to receive notifications
✅ **Backend**: Basic logging of user logins

## What You Need to Do

### Step 1: Get LINE Bot Credentials

1. Go to [LINE Developers Console](https://developers.line.biz/console/)
2. Select your channel (or create one)
3. Go to "Messaging API" tab
4. Get these values:
   - **Channel Access Token** (Long-lived)
   - **Channel Secret**

### Step 2: Add Bot to Your Group

1. In LINE app, open your target group
2. Tap menu (☰) → Invite → Add your bot using QR code or ID
3. Bot must be in group to send messages

### Step 3: Get Group ID

Option A - Using Webhook:
1. In LINE Developers Console, enable webhook
2. Set webhook URL: `https://salesappfkt.as.r.appspot.com/webhook`
3. Send any message in the group
4. Check App Engine logs to see the group ID

Option B - Manual:
Use this Node.js script to find your groups:
```javascript
const axios = require('axios');
const TOKEN = 'YOUR_CHANNEL_ACCESS_TOKEN';

axios.get('https://api.line.me/v2/bot/group/summary', {
    headers: { 'Authorization': `Bearer ${TOKEN}` }
}).then(res => console.log(res.data));
```

### Step 4: Set Environment Variables

Update your App Engine configuration:

```bash
# Set environment variables
gcloud app deploy backend/app.yaml --project=salesappfkt \
  --set-env-vars="LINE_CHANNEL_ACCESS_TOKEN=your-token,LINE_GROUP_ID=your-group-id"
```

Or update `backend/app.yaml`:
```yaml
env_variables:
  LINE_CHANNEL_ACCESS_TOKEN: "your-actual-token"
  LINE_CHANNEL_SECRET: "your-actual-secret"
  LINE_GROUP_ID: "Cxxxxxxxxxxxxxxxxx"
```

### Step 5: Enable Actual Notifications

The backend currently just logs. To send real notifications, update `backend/server-simple.js`:

```javascript
const axios = require('axios'); // Add this at top

// In the login endpoint, replace the TODO with:
if (LINE_CHANNEL_ACCESS_TOKEN && LINE_GROUP_ID) {
    try {
        await axios.post(
            'https://api.line.me/v2/bot/message/push',
            {
                to: LINE_GROUP_ID,
                messages: [{
                    type: 'text',
                    text: `🎉 ${userProfile?.displayName} just logged in!`
                }]
            },
            {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${LINE_CHANNEL_ACCESS_TOKEN}`
                }
            }
        );
    } catch (error) {
        console.error('LINE API error:', error.response?.data);
    }
}
```

## Testing

1. Clear browser cache
2. Go to https://salesappfkt-e4119.web.app
3. Login with LINE
4. Check:
   - Browser console for "Login notification sent"
   - Backend logs: `gcloud app logs tail -s sales-tracker-api`
   - Your LINE group for the notification

## Current Status

- ✅ Frontend sends login data to backend
- ✅ Backend receives and logs login events
- ⏳ Actual LINE message sending needs:
  - Your LINE Channel Access Token
  - Your LINE Group ID
  - axios package installed (`npm install axios`)

## Quick Test

You can test if the login webhook is working:

```bash
curl -X POST https://salesappfkt.as.r.appspot.com/api/user/login \
  -H "Content-Type: application/json" \
  -d '{"userId":"test123","userProfile":{"displayName":"Test User"}}'
```

Check backend logs to see if it's received.