# How to Use MCP with Sales Tracker

## 🎯 Current Status

You have several MCP servers configured in your `.mcp.json`:

### ✅ Working MCP Servers:
1. **sales-tracker** - Custom server for Sales Tracker operations
2. **firestore-sales-tracker** - Direct Firestore database access
3. **filesystem** - File system operations
4. **slack** - Slack integration (with your bot token)
5. **time** - Time and date operations
6. **fetch** - Web fetching capabilities

### ⚠️ Need Configuration:
- **google-drive** - Missing client ID/secret
- **github** - Missing personal access token
- **line-bot** - Has token but may need testing

## 🚀 Using MCP in Claude Desktop

### Step 1: Restart Claude Desktop
After configuring `.mcp.json`, you must completely restart Claude Desktop (not just reload).

### Step 2: Check Available Tools
In Claude Desktop, you can ask:
- "What MCP tools are available?"
- "Show me Sales Tracker tools"

### Step 3: Use Natural Language Commands

#### Sales Tracker Commands:
```
"Get daily sales statistics"
"Show me the weekly leaderboard"
"List recent activities"
"Generate a CSV report for this month"
"Check current app version"
"Analyze team performance with AI insights"
```

#### Firestore Commands:
```
"Query users from Firestore"
"Get activities for today"
"Show group registrations"
"Check leaderboard cache"
```

#### Slack Commands:
```
"Send a message to #general channel"
"List Slack channels"
"Post sales update to Slack"
```

## 🛠️ Using MCP in Claude Code (CLI)

In Claude Code, you don't directly access MCP servers from `.mcp.json`. Instead, I can:

1. **Run MCP servers as separate processes**
2. **Use the available tools** (Bash, Read, Write, etc.)
3. **Create scripts** that interact with your APIs

## 📝 Example Workflows

### 1. Daily Sales Report
```
You: "Generate and send daily sales report"

Claude will:
1. Use sales-tracker MCP to get daily stats
2. Generate a formatted report
3. Use slack MCP to post to your team channel
```

### 2. Performance Analysis
```
You: "Analyze this week's performance and identify trends"

Claude will:
1. Query Firestore for weekly data
2. Analyze patterns and calculate metrics
3. Generate insights and recommendations
```

### 3. Automated Notifications
```
You: "Send LINE notification about today's top performer"

Claude will:
1. Get leaderboard data
2. Format a compact flex message
3. Preview the notification (actual sending requires webhook)
```

## 🔧 Troubleshooting

### MCP Not Working in Claude Desktop?
1. Check `.mcp.json` syntax (must be valid JSON)
2. Ensure file paths are absolute, not relative
3. Completely quit and restart Claude Desktop
4. Check Console logs (View → Developer → Console)

### API Errors?
1. Verify backend is running: https://sales-tracker-api-dot-salesappfkt.as.r.appspot.com/health
2. Check API endpoints are accessible
3. Ensure proper authentication tokens

### Want to Test MCP Servers?
```bash
# Test sales tracker MCP
node mcp-server-sales-tracker.js

# Test Firestore MCP
node firestore-mcp-server.js

# Run the test script
node test-mcp-direct.js
```

## 💡 Pro Tips

1. **Batch Operations**: Ask for multiple things at once
   - "Get daily stats, generate weekly report, and analyze trends"

2. **Natural Language**: Be conversational
   - Instead of: "Execute get_sales_stats with period=daily"
   - Say: "Show me today's sales performance"

3. **Combine Tools**: MCP servers work together
   - "Get data from Firestore and post summary to Slack"

4. **Schedule Tasks**: Use time MCP for scheduling
   - "Every Monday at 9am, generate weekly report"

## 🚨 Important Notes

- **LINE API Limit**: You're at 298/300 messages (free tier limit)
- **Firestore**: Using named database `sales-tracker-db`
- **Backend URL**: https://sales-tracker-api-dot-salesappfkt.as.r.appspot.com/
- **Version**: Currently at v3.7.9 with auto-increment on commits

---

Ready to use MCP? Just ask me what you want to do! 🎉