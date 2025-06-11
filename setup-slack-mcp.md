# Slack MCP Setup for Sales Tracker

## Why Slack MCP?
- Send real-time sales notifications to team channels
- Create daily/weekly summaries
- Alert on achievements and milestones
- Analyze team communication patterns

## Setup Steps:

1. **Create Slack App**
   - Go to https://api.slack.com/apps
   - Create New App → From scratch
   - Name: "Sales Tracker Bot"

2. **Configure Bot Permissions**
   - OAuth & Permissions → Scopes → Bot Token Scopes:
     - `channels:read`
     - `chat:write`
     - `users:read`
     - `channels:history`

3. **Install to Workspace**
   - Install App → Install to Workspace
   - Copy Bot User OAuth Token

4. **Update .mcp.json**
   ```json
   "slack": {
     "command": "npx",
     "args": ["-y", "@modelcontextprotocol/server-slack"],
     "env": {
       "SLACK_BOT_TOKEN": "xoxb-your-token",
       "SLACK_TEAM_ID": "T1234567890"
     }
   }
   ```

## Usage Examples:
- "Send daily leaderboard to #sales channel"
- "Analyze sales team communication patterns"
- "Create achievement notification for top performer"