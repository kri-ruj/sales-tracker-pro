# Slack MCP Setup - Step by Step Guide

## 1️⃣ Create Slack App

1. Go to: https://api.slack.com/apps
2. Click **"Create New App"**
3. Choose **"From scratch"**
4. Enter:
   - App Name: `Sales Tracker Bot`
   - Pick workspace: Your workspace
5. Click **"Create App"**

## 2️⃣ Configure Bot Permissions

1. In your app settings, go to **"OAuth & Permissions"** (left sidebar)
2. Scroll to **"Scopes"** → **"Bot Token Scopes"**
3. Add these scopes:
   - `channels:read` - View basic channel info
   - `chat:write` - Send messages
   - `users:read` - View user info
   - `channels:history` - View messages in channels
   - `files:write` - Upload files (for reports)

## 3️⃣ Install to Workspace

1. Scroll to top of **"OAuth & Permissions"**
2. Click **"Install to Workspace"**
3. Review and **"Allow"**
4. Copy the **Bot User OAuth Token** (starts with `xoxb-`)

## 4️⃣ Get Team ID

1. Go to your Slack workspace in browser
2. The URL looks like: `https://app.slack.com/client/T1234567890/...`
3. Copy the part after `/client/` (starts with T) - that's your Team ID

## 5️⃣ Invite Bot to Channel

1. In Slack, go to the channel (e.g., #sales)
2. Type: `/invite @Sales Tracker Bot`
3. The bot can now post to this channel

## 📝 Your Credentials:

```
SLACK_BOT_TOKEN: xoxb-[YOUR-TOKEN-HERE]
SLACK_TEAM_ID: T[YOUR-TEAM-ID]
```

## 🧪 Test Your Bot

Run this curl command to test (replace with your token):

```bash
curl -X POST https://slack.com/api/chat.postMessage \
  -H "Authorization: Bearer xoxb-YOUR-TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "channel": "#general",
    "text": "Hello from Sales Tracker Bot! 🚀"
  }'
```

## 🔧 Common Issues:

1. **"not_in_channel"** - Bot needs to be invited to the channel
2. **"invalid_auth"** - Check your token is correct
3. **"channel_not_found"** - Use channel ID (C1234567) instead of name