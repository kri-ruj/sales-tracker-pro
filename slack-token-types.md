# Slack Token Types - Finding the Right One

## Token Types:
- **xapp-** = App-Level Token (for WebSocket connections)
- **xoxb-** = Bot User OAuth Token (what we need for MCP!)
- **xoxp-** = User OAuth Token
- **xoxs-** = Signing Secret

## 🎯 To Find Bot User OAuth Token:

1. Go to: https://api.slack.com/apps/A07F0P95PJ4
   (Using your App ID from the screenshot)

2. Click **"OAuth & Permissions"** in the left sidebar

3. Look for section: **"OAuth Tokens for Your Workspace"**

4. You'll see:
   ```
   Bot User OAuth Token
   xoxb-[long-string-of-characters]
   [Copy] button
   ```

5. Click **[Copy]** to get your bot token

## 📍 Visual Guide:
```
Slack App Settings
├── Basic Information (where you were)
├── OAuth & Permissions ← GO HERE
│   ├── OAuth Tokens for Your Workspace
│   │   └── Bot User OAuth Token: xoxb-... ← THIS ONE!
│   └── Scopes
└── Other settings...
```

## ⚠️ Important:
- App-Level Token (xapp-) = For Socket Mode only
- Bot User OAuth Token (xoxb-) = For API calls and MCP

The MCP server needs the Bot token to send messages and interact with Slack.