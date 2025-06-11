# Firestore MCP Setup Guide

This guide helps you connect Claude Desktop to your Google Cloud Firestore database.

## Prerequisites

1. Install dependencies:
```bash
npm install
```

2. Set up Google Cloud credentials:
   - For local development, you need to set up Application Default Credentials
   - Run: `gcloud auth application-default login`
   - Or set `GOOGLE_APPLICATION_CREDENTIALS` environment variable to point to a service account key file

## Configure Claude Desktop

1. Open Claude Desktop settings
2. Go to **Developer → Edit Config**
3. Add the Firestore MCP server configuration:

```json
{
  "mcpServers": {
    "firestore-sales-tracker": {
      "command": "node",
      "args": ["/Users/krittamethrujirachainon/Bright_app/Project_Massage/firestore-mcp-server.js"],
      "env": {
        "GOOGLE_APPLICATION_CREDENTIALS": "/path/to/your/service-account-key.json"
      }
    }
  }
}
```

**Note**: Replace `/path/to/your/service-account-key.json` with the actual path to your service account key file if you're not using Application Default Credentials.

## Available MCP Tools

Once connected, you can use these tools in Claude:

### 1. Query Users
```
Query users from your Firestore database
- Get all users: query_users()
- Get specific user: query_users(userId: "LINE_USER_ID")
- Limit results: query_users(limit: 5)
```

### 2. Query Activities
```
Query sales activities
- All activities: query_activities()
- By user: query_activities(userId: "LINE_USER_ID")
- By date: query_activities(date: "2025-01-06")
- Combined: query_activities(userId: "LINE_USER_ID", date: "2025-01-06", limit: 10)
```

### 3. Get Leaderboard
```
Get sales leaderboard rankings
- Daily: get_leaderboard(period: "daily")
- Weekly: get_leaderboard(period: "weekly")
- Monthly: get_leaderboard(period: "monthly")
- Specific date: get_leaderboard(period: "daily", date: "2025-01-06")
```

### 4. Get Team Stats
```
Get overall team statistics
- Usage: get_team_stats()
- Returns: total users, points, activities, and today's stats
```

### 5. Add Activity
```
Add a new sales activity
- Required: add_activity(userId: "LINE_USER_ID", activity: "Meeting", points: 10)
- With customer: add_activity(userId: "LINE_USER_ID", activity: "Demo", points: 20, customerName: "ABC Corp")
- With date: add_activity(userId: "LINE_USER_ID", activity: "Call", points: 5, date: "2025-01-06")
```

## Testing the Connection

After setting up, restart Claude Desktop and test the connection:

1. Ask Claude: "Can you query the sales tracker database?"
2. Claude should be able to use the Firestore tools to access your data

## Troubleshooting

### Authentication Issues
- Make sure you're logged in to gcloud: `gcloud auth list`
- Check Application Default Credentials: `gcloud auth application-default print-access-token`
- For service account: Ensure the JSON key file path is correct and the account has Firestore permissions

### Connection Issues
- Check if the MCP server is running: Look for "firestore-sales-tracker" in Claude's MCP connections
- Check logs in Claude Desktop developer tools
- Ensure your GCP project ID is correct: `salesappfkt`

### Permissions
Your service account needs these IAM roles:
- `roles/datastore.user` (for read/write access)
- Or `roles/datastore.viewer` (for read-only access)

## Security Notes

- Never commit service account keys to git
- Use Application Default Credentials when possible
- In production, use Google Secret Manager for sensitive data
- The MCP server runs locally and connects to Firestore over HTTPS