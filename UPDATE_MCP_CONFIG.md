# Update Your .mcp.json Configuration

After getting your credentials, update these sections in `.mcp.json`:

## For Slack:

```json
"slack": {
  "command": "npx",
  "args": ["-y", "@modelcontextprotocol/server-slack"],
  "env": {
    "SLACK_BOT_TOKEN": "xoxb-YOUR-BOT-TOKEN-HERE",
    "SLACK_TEAM_ID": "T-YOUR-TEAM-ID-HERE"
  }
}
```

## For Google Drive:

```json
"google-drive": {
  "command": "npx",
  "args": ["-y", "@modelcontextprotocol/server-gdrive"],
  "env": {
    "GOOGLE_DRIVE_CLIENT_ID": "YOUR-CLIENT-ID.apps.googleusercontent.com",
    "GOOGLE_DRIVE_CLIENT_SECRET": "GOCSPX-YOUR-CLIENT-SECRET",
    "GOOGLE_DRIVE_REDIRECT_URI": "http://localhost:3000/oauth/callback"
  }
}
```

## Important Notes:

1. **Keep your tokens secure** - Never commit them to git
2. **Restart Claude Desktop** after updating .mcp.json
3. **First use of Google Drive** will open browser for auth

## Alternative: Environment Variables

For better security, you can use environment variables:

1. Create `.env` file:
```bash
SLACK_BOT_TOKEN=xoxb-your-token
SLACK_TEAM_ID=T-your-team-id
GOOGLE_DRIVE_CLIENT_ID=your-client-id
GOOGLE_DRIVE_CLIENT_SECRET=your-secret
```

2. Update `.mcp.json` to use env vars:
```json
"slack": {
  "command": "npx",
  "args": ["-y", "@modelcontextprotocol/server-slack"],
  "env": {
    "SLACK_BOT_TOKEN": "${SLACK_BOT_TOKEN}",
    "SLACK_TEAM_ID": "${SLACK_TEAM_ID}"
  }
}
```

Note: Claude Desktop may not support env var substitution directly, so you might need to use actual values in .mcp.json.