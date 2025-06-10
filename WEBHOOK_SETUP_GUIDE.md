# LINE Webhook & Group Notification Setup Guide

## Current Issue
Group notifications aren't working because:
1. The backend uses in-memory database - group registrations are lost on restart
2. Webhook URL needs to be configured in LINE Developers Console
3. Groups need to be registered with `/register` command

## Setup Steps

### Step 1: Configure Webhook in LINE Developers Console

1. Go to [LINE Developers Console](https://developers.line.biz/console/)
2. Select your channel: **LIFF Sales Tracker**
3. Go to **Messaging API** tab
4. In **Webhook settings**:
   - Webhook URL: `https://sales-tracker-app-dot-salesappfkt.as.r.appspot.com/webhook`
   - Use webhook: **ON**
   - Verify: Click "Verify" button to test connection

### Step 2: Enable Bot Features

In the same Messaging API tab:
- Auto-reply messages: **OFF**
- Greeting messages: **OFF**
- Allow bot to join groups and multi-person chats: **ON**

### Step 3: Add Bot to Your Group

1. Get your bot's Basic ID from LINE Developers Console
2. In LINE app, open your sales team group
3. Tap group menu (☰) → Members → Invite
4. Search for your bot by Basic ID and add it

### Step 4: Register Your Group

**IMPORTANT**: After adding the bot to your group:
1. Type `/register` in the group chat
2. Bot should reply: "✅ This group is now registered for sales activity notifications!"
3. **Note**: Due to in-memory database, you need to re-register after each server restart

### Step 5: Test the Setup

1. Type `/help` in the group - bot should respond with available commands
2. Submit activities via the LIFF app: https://liff.line.me/2007552096-wrG1aV9p
3. You should see compact notifications in the group

## Bot Commands

- `/register` - Register this group for activity notifications
- `/leaderboard` - Show today's team rankings  
- `/stats` - Show today's statistics
- `/help` - Show all available commands

## Troubleshooting

### No notifications received?

1. **Check webhook URL** is correctly set in LINE Developers Console
2. **Verify bot is in the group** - you should see it in member list
3. **Make sure you typed `/register`** - this is required!
4. **Check logs**: `gcloud app logs tail -s default --project=salesappfkt`
5. **API Quota**: You've used 298/300 messages this month (LINE free tier limit)

### Common Issues

1. **"Bot doesn't respond to commands"**
   - Check webhook URL is correct
   - Verify webhook is enabled in LINE Console
   - Check backend logs for errors

2. **"Notifications work then stop"**
   - Server restarted, need to `/register` again
   - Consider implementing persistent storage for production

3. **"Exceeded API quota"**
   - LINE free tier: 300 push messages/month
   - Upgrade to paid plan or wait for next month

## Current Implementation

- ✅ Webhook endpoint at `/webhook`
- ✅ Bot command handling
- ✅ Activity notification system with compact flex messages
- ✅ Group registration system
- ⚠️ In-memory database (registrations lost on restart)

## Quick Verification

Test if webhook is working:
```bash
curl https://sales-tracker-app-dot-salesappfkt.as.r.appspot.com/health
```

Should return:
```json
{
  "status": "OK",
  "message": "Sales Tracker LINE Backend is running",
  "version": "3.7.0"
}
```