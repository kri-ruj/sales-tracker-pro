# LINE Webhook Setup for Group Notifications

## Overview
This guide explains how to set up LINE webhooks to send notifications to a group chat when users log in to your Sales Tracker app.

## Prerequisites
1. LINE Business Account
2. LINE Messaging API Channel
3. LINE Group where notifications will be sent
4. Backend deployed with webhook endpoints

## Step 1: Get Your LINE Channel Credentials

1. Go to [LINE Developers Console](https://developers.line.biz/console/)
2. Select your channel
3. Navigate to "Messaging API" tab
4. Note down:
   - **Channel ID**
   - **Channel Secret** 
   - **Channel Access Token** (Long-lived)

## Step 2: Add Bot to Your Group

1. Open LINE app on your phone
2. Go to the group where you want notifications
3. Tap the menu (☰) → Settings → Invite
4. Add your bot using its Basic ID or QR code
5. The bot must be in the group to send messages

## Step 3: Get Group ID

To send messages to a specific group, you need the Group ID:

1. Enable webhook in LINE Developers Console
2. Set webhook URL: `https://salesappfkt.as.r.appspot.com/webhook`
3. Send a message in the group
4. Check your backend logs to see the group ID

## Step 4: Update Backend Environment Variables

Add these to your Google App Engine environment:

```yaml
env_variables:
  LINE_CHANNEL_ACCESS_TOKEN: "your-channel-access-token"
  LINE_CHANNEL_SECRET: "your-channel-secret"
  LINE_GROUP_ID: "your-group-id"
```

## Step 5: Implement LINE Messaging API

Update `backend/server-simple.js`:

```javascript
const axios = require('axios');

// LINE configuration
const LINE_CHANNEL_ACCESS_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN;
const LINE_GROUP_ID = process.env.LINE_GROUP_ID;

// Send message to LINE group
async function sendLineGroupMessage(message) {
    if (!LINE_CHANNEL_ACCESS_TOKEN || !LINE_GROUP_ID) {
        console.log('LINE credentials not configured');
        return false;
    }

    try {
        const response = await axios.post(
            'https://api.line.me/v2/bot/message/push',
            {
                to: LINE_GROUP_ID,
                messages: [{
                    type: 'text',
                    text: message
                }]
            },
            {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${LINE_CHANNEL_ACCESS_TOKEN}`
                }
            }
        );
        return true;
    } catch (error) {
        console.error('Failed to send LINE message:', error.response?.data || error.message);
        return false;
    }
}

// Update the login endpoint
app.post('/api/user/login', async (req, res) => {
    const { userId, userProfile } = req.body;
    
    console.log('User Login:', {
        userId,
        displayName: userProfile?.displayName,
        timestamp: new Date().toISOString()
    });
    
    // Send notification to LINE group
    const message = `🎉 ${userProfile?.displayName || 'Someone'} just logged in to Sales Tracker!`;
    await sendLineGroupMessage(message);
    
    res.json({ 
        success: true, 
        message: 'Login notification sent' 
    });
});

// Update activities sync to also send notifications
app.post('/api/activities/sync', async (req, res) => {
    const { userId, activities: userActivities, userName } = req.body;
    
    // ... existing code ...
    
    // Send notification for significant achievements
    if (userActivities && userActivities.length > 0) {
        const totalPoints = userActivities.reduce((sum, act) => sum + act.points, 0);
        if (totalPoints >= 100) {
            const message = `🏆 ${userName || 'A team member'} just earned ${totalPoints} points!`;
            await sendLineGroupMessage(message);
        }
    }
    
    // ... rest of the code ...
});
```

## Step 6: Test the Integration

1. Clear your browser cache
2. Go to https://salesappfkt-e4119.web.app
3. Login with LINE
4. Check your LINE group for the notification

## Message Examples

### Login Notification
```
🎉 John Doe just logged in to Sales Tracker!
```

### Achievement Notification
```
🏆 Sarah Chen just earned 150 points!
```

### Daily Summary (Optional)
```
📊 Daily Summary:
• Total team points: 1,250
• Active members: 8
• Top performer: Mike Johnson (320 pts)
```

## Security Considerations

1. **Never expose your Channel Access Token** in frontend code
2. **Validate webhook signatures** to ensure requests are from LINE
3. **Rate limit notifications** to avoid spamming the group
4. **Store sensitive data** in environment variables

## Troubleshooting

### Bot doesn't send messages
- Check if bot is in the group
- Verify Channel Access Token is valid
- Check backend logs for errors

### No group ID in webhook
- Ensure webhook URL is correct
- Verify SSL certificate is valid
- Check LINE Developers Console for webhook status

### Messages not appearing
- Check bot permissions in group
- Verify group ID is correct
- Test with LINE Messaging API playground first