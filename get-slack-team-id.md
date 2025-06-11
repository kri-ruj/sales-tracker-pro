# How to Find Your Slack Team ID

## Method 1: From Slack Web
1. Open Slack in your browser
2. Look at the URL: `https://app.slack.com/client/T1234567890/C1234567890`
3. The Team ID is the part starting with 'T': **T1234567890**

## Method 2: From Slack App
1. In Slack, click your workspace name (top-left)
2. Select "Settings & administration" → "Workspace settings"
3. The URL will show your team ID

## Method 3: Using Slack API
Once you have your Bot Token, run:
```bash
curl -X GET "https://slack.com/api/team.info" \
  -H "Authorization: Bearer xoxb-YOUR-BOT-TOKEN"
```

The response will include your team ID.

## Example .mcp.json Update:
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