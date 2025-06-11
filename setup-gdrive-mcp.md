# Google Drive MCP Setup for Sales Tracker

## Why Google Drive MCP?
- Auto-save sales reports to Drive
- Share reports with stakeholders
- Maintain historical data
- Create data backups

## Setup Steps:

1. **Enable Google Drive API**
   - Go to https://console.cloud.google.com
   - Enable Google Drive API
   - Create credentials (OAuth 2.0 Client ID)

2. **Configure OAuth**
   - Application type: Web application
   - Redirect URI: `http://localhost:3000/oauth/callback`
   - Download credentials JSON

3. **Update .mcp.json**
   ```json
   "google-drive": {
     "command": "npx",
     "args": ["-y", "@modelcontextprotocol/server-gdrive"],
     "env": {
       "GOOGLE_DRIVE_CLIENT_ID": "your-client-id",
       "GOOGLE_DRIVE_CLIENT_SECRET": "your-client-secret",
       "GOOGLE_DRIVE_REDIRECT_URI": "http://localhost:3000/oauth/callback"
     }
   }
   ```

## Integration with Sales Tracker:
- Auto-export CSV reports to Drive
- Create monthly folders for organization
- Share leaderboards with management
- Backup activity data