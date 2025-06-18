# LINE Group Notification Setup

## 1. Configure Webhook in LINE Developers Console

1. Go to [LINE Developers Console](https://developers.line.biz/)
2. Select your channel
3. Go to **Messaging API** tab
4. Under **Webhook settings**:
   - **Webhook URL**: `https://sales-tracker-api-dot-salesappfkt.as.r.appspot.com/webhook`
   - **Use webhook**: ON
   - **Webhook redelivery**: OFF
   - **Error statistics aggregation**: ON

5. Under **Auto-reply messages**:
   - **Auto-reply**: OFF
   - **Greeting messages**: OFF (optional)

## 2. Add Bot to Group

1. In LINE app, create or open a group chat
2. Tap the menu (≡) → Settings → Invite
3. Search for your bot name and add it
4. The bot should send a welcome message

## 3. Register Group for Notifications

After adding the bot to your group:

1. Type `/register` in the group chat
2. Bot will confirm registration
3. All activity submissions will now send notifications to this group

## 4. Test Notifications

1. Add an activity in the web app
2. You should see a notification in the LINE group with:
   - User who added the activity
   - Activity type and description
   - Points earned
   - Current leaderboard

## Troubleshooting

### Bot not responding to /register:
- Check webhook URL is correct
- Verify webhook is enabled
- Check backend logs for errors

### No notifications after activity:
- Ensure group is registered (type `/status` to check)
- Check LINE API quota (free tier: 500 messages/month)
- Verify backend is running

### Check registered groups:
Open: https://sales-tracker-api-dot-salesappfkt.as.r.appspot.com/api/debug/groups

## Commands

- `/register` - Register group for notifications
- `/unregister` - Stop notifications
- `/status` - Check registration status
- `/help` - Show available commands